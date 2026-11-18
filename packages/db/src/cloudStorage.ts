import 'server-only';
import { getFirestoreServerInstance } from './index.ts';
import type {
  CloudUploadSession,
  CloudStorageSettings,
  CloudStorageJob,
  OrderCloudPhoto,
  Studio,
  Order,
} from '@focoman/types';

/**
 * Updates an order's cloud storage settings (compression, proofing)
 */
export async function updateOrderCloudStorageSettings(
  orderId: string,
  settings: CloudStorageSettings
): Promise<void> {
  const db = getFirestoreServerInstance();
  const orderRef = db.collection('orders').doc(orderId);
  await orderRef.update({
    cloudStorageSettings: settings,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Creates upload session records in `cloud_upload_sessions`
 */
export async function createCloudUploadSessions(
  sessions: CloudUploadSession[]
): Promise<void> {
  if (sessions.length === 0) return;
  const db = getFirestoreServerInstance();
  for (let i = 0; i < sessions.length; i += 400) {
    const batch = db.batch();
    const chunk = sessions.slice(i, i + 400);
    chunk.forEach((session) => {
      batch.set(db.collection('cloud_upload_sessions').doc(session.id), session);
    });
    await batch.commit();
  }
}

/**
 * Fetches an upload session by ID
 */
export async function getCloudUploadSession(
  sessionId: string
): Promise<CloudUploadSession | null> {
  const db = getFirestoreServerInstance();
  const doc = await db.collection('cloud_upload_sessions').doc(sessionId).get();
  if (!doc.exists) return null;
  return doc.data() as CloudUploadSession;
}

/**
 * Updates an upload session
 */
export async function updateCloudUploadSession(
  sessionId: string,
  updates: Partial<CloudUploadSession>
): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('cloud_upload_sessions').doc(sessionId).set(updates, { merge: true });
}

/**
 * Deletes upload sessions by IDs
 */
export async function deleteCloudUploadSessions(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  const db = getFirestoreServerInstance();
  for (let i = 0; i < sessionIds.length; i += 400) {
    const batch = db.batch();
    const chunk = sessionIds.slice(i, i + 400);
    chunk.forEach((id) => {
      batch.delete(db.collection('cloud_upload_sessions').doc(id));
    });
    await batch.commit();
  }
}

/**
 * Atomically reserves storage bytes and file count for a studio.
 * Validates available quota against studio plan limits within the transaction.
 */
export async function reserveStudioStorage(
  studioId: string,
  reservedBytes: number,
  reservedCount: number,
  quotaLimitBytes: number
): Promise<{ success: boolean; error?: string }> {
  const db = getFirestoreServerInstance();
  const sid = studioId.toLowerCase();
  const studioRef = db.collection('studios').doc(sid);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(studioRef);
    if (!snap.exists) {
      return { success: false, error: 'Studio not found.' };
    }
    const data = snap.data() as Studio;
    const currentUsed = Math.max(0, Number(data.storageUsedBytes || 0));
    const currentReserved = Math.max(0, Number(data.storageReservedBytes || 0));
    const currentTotal = currentUsed + currentReserved;

    if (quotaLimitBytes > 0 && currentTotal + reservedBytes > quotaLimitBytes) {
      return {
        success: false,
        error: `Storage capacity exceeded. Attempting to allocate ${reservedBytes} bytes but only ${Math.max(
          0,
          quotaLimitBytes - currentTotal
        )} bytes remaining on plan.`,
      };
    }

    const nextReservedBytes = currentReserved + reservedBytes;
    const nextReservedCount = Math.max(0, Number(data.storageReservedFileCount || 0) + reservedCount);

    tx.update(studioRef, {
      storageReservedBytes: nextReservedBytes,
      storageReservedFileCount: nextReservedCount,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  });
}

/**
 * Atomically releases reserved storage (e.g. on upload cancellation or expiry).
 */
export async function releaseStudioStorageReservation(
  studioId: string,
  bytesToRelease: number,
  countToRelease: number
): Promise<void> {
  const db = getFirestoreServerInstance();
  const sid = studioId.toLowerCase();
  const studioRef = db.collection('studios').doc(sid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(studioRef);
    if (!snap.exists) return;
    const data = snap.data() as Studio;
    const currentReservedBytes = Math.max(0, Number(data.storageReservedBytes || 0));
    const currentReservedCount = Math.max(0, Number(data.storageReservedFileCount || 0));

    tx.update(studioRef, {
      storageReservedBytes: Math.max(0, currentReservedBytes - bytesToRelease),
      storageReservedFileCount: Math.max(0, currentReservedCount - countToRelease),
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Atomically commits verified uploaded photos:
 * 1. Decrements reserved storage
 * 2. Increments used storage
 * 3. Saves `OrderCloudPhoto` records
 * 4. Marks sessions as COMMITTED
 * 5. Updates order photo count and bytes summary
 */
export async function commitVerifiedUploadBatch(params: {
  studioId: string;
  orderId: string;
  photos: OrderCloudPhoto[];
  sessionsToCommit: { id: string; reservedBytes: number }[];
}): Promise<void> {
  const { studioId, orderId, photos, sessionsToCommit } = params;
  const db = getFirestoreServerInstance();
  const sid = studioId.toLowerCase();
  const studioRef = db.collection('studios').doc(sid);
  const orderRef = db.collection('orders').doc(orderId);

  const totalActualBytes = photos.reduce((acc, p) => acc + (p.sizeBytes || 0), 0);
  const totalReservedBytes = sessionsToCommit.reduce((acc, s) => acc + s.reservedBytes, 0);
  const count = photos.length;

  await db.runTransaction(async (tx) => {
    const studioSnap = await tx.get(studioRef);
    const orderSnap = await tx.get(orderRef);

    const studioData = studioSnap.exists ? (studioSnap.data() as Studio) : null;
    const orderData = orderSnap.exists ? (orderSnap.data() as Order) : null;

    // Adjust studio ledger
    const currentUsedBytes = Math.max(0, Number(studioData?.storageUsedBytes || 0));
    const currentUsedCount = Math.max(0, Number(studioData?.storageFileCount || 0));
    const currentReservedBytes = Math.max(0, Number(studioData?.storageReservedBytes || 0));
    const currentReservedCount = Math.max(0, Number(studioData?.storageReservedFileCount || 0));

    if (studioSnap.exists) {
      tx.update(studioRef, {
        storageUsedBytes: currentUsedBytes + totalActualBytes,
        storageFileCount: currentUsedCount + count,
        storageReservedBytes: Math.max(0, currentReservedBytes - totalReservedBytes),
        storageReservedFileCount: Math.max(0, currentReservedCount - count),
        updatedAt: new Date().toISOString(),
      });
    }

    // Adjust order totals
    const currentOrderCount = Math.max(0, Number(orderData?.cloudPhotoCount || 0));
    const currentOrderBytes = Math.max(0, Number(orderData?.cloudStorageBytes || 0));

    if (orderSnap.exists) {
      tx.update(orderRef, {
        cloudPhotoCount: currentOrderCount + count,
        cloudStorageBytes: currentOrderBytes + totalActualBytes,
        updatedAt: new Date().toISOString(),
      });
    }

    // Save photos
    photos.forEach((photo) => {
      tx.set(db.collection('cloud_photos').doc(photo.id), photo);
    });

    // Mark sessions committed
    sessionsToCommit.forEach((s) => {
      tx.update(db.collection('cloud_upload_sessions').doc(s.id), {
        state: 'COMMITTED',
        updatedAt: new Date().toISOString(),
      });
    });
  });
}

/**
 * Enqueues a storage background job (preview generation, verification, or cleanup)
 */
export async function enqueueCloudStorageJob(job: CloudStorageJob): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('cloud_storage_jobs').doc(job.id).set(job);
}

/**
 * Atomically claims the next pending storage job with lease timeout
 */
export async function claimNextCloudStorageJob(
  workerId: string,
  leaseDurationMs: number = 60000
): Promise<CloudStorageJob | null> {
  const db = getFirestoreServerInstance();
  const now = new Date();
  const nowIso = now.toISOString();

  // Query pending jobs
  const snap = await db
    .collection('cloud_storage_jobs')
    .where('state', '==', 'PENDING')
    .orderBy('runAfter')
    .limit(5)
    .get();

  for (const doc of snap.docs) {
    const job = doc.data() as CloudStorageJob;
    if (job.runAfter && job.runAfter > nowIso) continue;

    const claimed = await db.runTransaction(async (tx) => {
      const live = await tx.get(doc.ref);
      if (!live.exists) return null;
      const data = live.data() as CloudStorageJob;
      if (data.state !== 'PENDING') return null;

      const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
      tx.update(doc.ref, {
        state: 'RUNNING',
        lockedBy: workerId,
        lockedAt: nowIso,
        leaseUntil: leaseExpiresAt,
        updatedAt: nowIso,
      });
      return { ...data, state: 'RUNNING' as const, lockedBy: workerId, lockedAt: nowIso, leaseUntil: leaseExpiresAt };
    });

    if (claimed) return claimed;
  }
  return null;
}

/**
 * Completes a cloud storage job
 */
export async function completeCloudStorageJob(
  jobId: string,
  resultUpdates?: Partial<CloudStorageJob>
): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('cloud_storage_jobs').doc(jobId).update({
    state: 'SUCCEEDED',
    ...resultUpdates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Fails a job with retry backoff or moves to FAILED
 */
export async function failCloudStorageJob(
  jobId: string,
  errorMessage: string,
  canRetry: boolean = true
): Promise<void> {
  const db = getFirestoreServerInstance();
  const jobRef = db.collection('cloud_storage_jobs').doc(jobId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) return;
    const data = snap.data() as CloudStorageJob;
    const nextAttempts = (data.attempts || data.attempt || 0) + 1;
    const willRetry = canRetry && nextAttempts < (data.maxAttempts || 3);

    const backoffSeconds = Math.pow(2, nextAttempts) * 10;
    const nextRunAfter = new Date(Date.now() + backoffSeconds * 1000).toISOString();

    tx.update(jobRef, {
      state: willRetry ? 'PENDING' : 'FAILED',
      attempts: nextAttempts,
      attempt: nextAttempts,
      lastError: errorMessage,
      ...(willRetry ? { runAfter: nextRunAfter, availableAt: nextRunAfter } : {}),
      lockedBy: null,
      lockedAt: null,
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Cancels pending preview jobs when proofing is toggled OFF for an order
 */
export async function cancelJobsForOrder(orderId: string): Promise<number> {
  const db = getFirestoreServerInstance();
  const snap = await db
    .collection('cloud_storage_jobs')
    .where('orderId', '==', orderId)
    .where('state', '==', 'PENDING')
    .get();

  let cancelled = 0;
  for (const doc of snap.docs) {
    await doc.ref.update({
      state: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    });
    cancelled++;
  }
  return cancelled;
}
