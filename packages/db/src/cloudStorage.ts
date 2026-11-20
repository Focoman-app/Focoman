import 'server-only';
import { createHash } from 'node:crypto';
import { getFirestoreServerInstance } from './index.ts';
import type {
  CloudUploadSession,
  CloudStorageSettings,
  CloudStorageJob,
  OrderCloudPhoto,
  Studio,
  Order,
} from '@focoman/types';
import { canTransitionCloudUploadState, cloudCommitReservationRelease, requireSafeCounter, sameCloudPhotoIdSet } from '@focoman/domain';

const PLATFORM_REF = 'cloud_storage_platform/current';

function storageNumber(value: unknown, label: string): number {
  return requireSafeCounter(value ?? 0, label);
}

function uploadIdempotencyDocumentId(session: Pick<CloudUploadSession, 'studioId' | 'orderId' | 'actorUid' | 'idempotencyKey'>): string {
  return createHash('sha256')
    .update(`${session.studioId}\u0000${session.orderId}\u0000${session.actorUid}\u0000${session.idempotencyKey || ''}`)
    .digest('hex');
}

function uploadReservationBytes(session: CloudUploadSession): number {
  return storageNumber(session.reservedBytes, 'session reserved bytes')
    + storageNumber(session.previewReservedBytes, 'session preview reserved bytes');
}

/**
 * The platform document is intentionally a single admission lock. It must be
 * initialized by the reconciliation/migration run before any new uploads are
 * admitted; inventing a zero baseline would defeat the platform safety cap.
 */
export async function reserveCloudStorageAdmission(input: {
  studioId: string;
  bytes: number;
  count: number;
  studioLimitBytes: number;
  platformLimitBytes: number;
}): Promise<void> {
  const db = getFirestoreServerInstance();
  const studioRef = db.collection('studios').doc(input.studioId.toLowerCase());
  const platformRef = db.doc(PLATFORM_REF);
  return await db.runTransaction(async (tx) => {
    const [studioSnap, platformSnap] = await Promise.all([tx.get(studioRef), tx.get(platformRef)]);
    if (!studioSnap.exists) throw new Error('Studio not found.');
    if (!platformSnap.exists) throw new Error('Cloud storage admissions are disabled until storage reconciliation is initialized.');
    const studio = studioSnap.data() as Studio;
    const platform = platformSnap.data() as { usedBytes?: unknown; reservedBytes?: unknown; admissionsEnabled?: boolean };
    if (platform.admissionsEnabled !== true) throw new Error('Cloud storage admissions are currently disabled.');
    const used = storageNumber(studio.storageUsedBytes, 'studio used bytes');
    const reserved = storageNumber(studio.storageReservedBytes, 'studio reserved bytes');
    const platformUsed = storageNumber(platform.usedBytes, 'platform used bytes');
    const platformReserved = storageNumber(platform.reservedBytes, 'platform reserved bytes');
    if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0 || !Number.isSafeInteger(input.count) || input.count <= 0) throw new Error('Invalid storage reservation.');
    if (used + reserved + input.bytes > input.studioLimitBytes) throw new Error('Storage quota exceeded.');
    if (platformUsed + platformReserved + input.bytes > input.platformLimitBytes) throw new Error('Platform cloud storage safety cap reached.');
    tx.update(studioRef, {
      storageReservedBytes: reserved + input.bytes,
      storageReservedFileCount: storageNumber(studio.storageReservedFileCount, 'studio reserved file count') + input.count,
      updatedAt: new Date().toISOString(),
    });
    tx.update(platformRef, { reservedBytes: platformReserved + input.bytes, updatedAt: new Date().toISOString() });
  });
}

/** Atomically creates the durable session identity with its reservation. A
 * retry receives the exact existing sessions, so it cannot reserve capacity a
 * second time while a prior admission is still active. */
export async function admitCloudUploadSessions(input: {
  sessions: CloudUploadSession[];
  studioLimitBytes: number;
  platformLimitBytes: number;
}): Promise<{ sessions: CloudUploadSession[]; reused: boolean }> {
  if (input.sessions.length === 0) throw new Error('At least one upload session is required.');
  const db = getFirestoreServerInstance();
  const first = input.sessions[0];
  const studioRef = db.collection('studios').doc(first.studioId.toLowerCase());
  const platformRef = db.doc(PLATFORM_REF);
  return await db.runTransaction(async (tx) => {
    const idempotencyRefs = input.sessions.map((session) => db.collection('cloud_upload_idempotency').doc(uploadIdempotencyDocumentId(session)));
    const [studioSnap, platformSnap, ...idempotencySnaps] = await Promise.all([
      tx.get(studioRef), tx.get(platformRef), ...idempotencyRefs.map((ref) => tx.get(ref)),
    ]);
    if (!studioSnap.exists) throw new Error('Studio not found.');
    if (!platformSnap.exists) throw new Error('Cloud storage admissions are disabled until storage reconciliation is initialized.');
    const existingCount = idempotencySnaps.filter((snap) => snap.exists).length;
    if (existingCount > 0) {
      if (existingCount !== input.sessions.length) throw new Error('Retry the same admitted upload batch before adding new files.');
      const existingSessionRefs = idempotencySnaps.map((snap, index) => {
        const record = snap.data() as { sessionId?: string; manifestHash?: string };
        if (!record.sessionId || record.manifestHash !== input.sessions[index].manifestHash) {
          throw new Error('This upload retry does not match its admitted file manifest.');
        }
        return db.collection('cloud_upload_sessions').doc(record.sessionId);
      });
      const existingSessions = await Promise.all(existingSessionRefs.map((ref) => tx.get(ref)));
      if (existingSessions.some((snap) => !snap.exists)) throw new Error('Upload idempotency requires reconciliation.');
      return { sessions: existingSessions.map((snap) => snap.data() as CloudUploadSession), reused: true };
    }
    const studio = studioSnap.data() as Studio;
    const platform = platformSnap.data() as { usedBytes?: unknown; reservedBytes?: unknown; admissionsEnabled?: boolean };
    if (platform.admissionsEnabled !== true) throw new Error('Cloud storage admissions are currently disabled.');
    const bytes = input.sessions.reduce((sum, session) => sum + uploadReservationBytes(session), 0);
    const count = input.sessions.length;
    const used = storageNumber(studio.storageUsedBytes, 'studio used bytes');
    const reserved = storageNumber(studio.storageReservedBytes, 'studio reserved bytes');
    const platformUsed = storageNumber(platform.usedBytes, 'platform used bytes');
    const platformReserved = storageNumber(platform.reservedBytes, 'platform reserved bytes');
    if (used + reserved + bytes > input.studioLimitBytes) throw new Error('Storage quota exceeded.');
    if (platformUsed + platformReserved + bytes > input.platformLimitBytes) throw new Error('Platform cloud storage safety cap reached.');
    tx.update(studioRef, {
      storageReservedBytes: reserved + bytes,
      storageReservedFileCount: storageNumber(studio.storageReservedFileCount, 'studio reserved file count') + count,
      updatedAt: new Date().toISOString(),
    });
    tx.update(platformRef, { reservedBytes: platformReserved + bytes, updatedAt: new Date().toISOString() });
    input.sessions.forEach((session, index) => {
      tx.create(db.collection('cloud_upload_sessions').doc(session.id), session);
      tx.create(idempotencyRefs[index], { sessionId: session.id, manifestHash: session.manifestHash, createdAt: new Date().toISOString() });
    });
    return { sessions: input.sessions, reused: false };
  });
}

/** Cleans an admission only when no browser URL remains usable and every
 * provider multipart upload created for it has already been aborted. */
export async function cleanFailedCloudUploadAdmission(sessionIds: string[]): Promise<void> {
  const db = getFirestoreServerInstance();
  const platformRef = db.doc(PLATFORM_REF);
  await db.runTransaction(async (tx) => {
    const refs = sessionIds.map((id) => db.collection('cloud_upload_sessions').doc(id));
    const sessions = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (sessions.some((snap) => !snap.exists)) throw new Error('Upload admission cleanup requires reconciliation.');
    const data = sessions.map((snap) => snap.data() as CloudUploadSession);
    if (data.some((session) => session.state !== 'RESERVED' || session.lastSignedUrlExpiresAt || (session.leaseUntil && new Date(session.leaseUntil).getTime() > Date.now()))) {
      throw new Error('Upload admission cleanup is not safe after signed URLs are issued.');
    }
    const studioRef = db.collection('studios').doc(data[0].studioId);
    const [studioSnap, platformSnap] = await Promise.all([tx.get(studioRef), tx.get(platformRef)]);
    if (!studioSnap.exists || !platformSnap.exists) throw new Error('Storage ledger is unavailable for cleanup.');
    const bytes = data.reduce((sum, session) => sum + uploadReservationBytes(session), 0);
    const studio = studioSnap.data() as Studio;
    const platform = platformSnap.data() as { reservedBytes?: unknown };
    const studioReserved = storageNumber(studio.storageReservedBytes, 'studio reserved bytes');
    const studioCount = storageNumber(studio.storageReservedFileCount, 'studio reserved file count');
    const platformReserved = storageNumber(platform.reservedBytes, 'platform reserved bytes');
    if (bytes > studioReserved || data.length > studioCount || bytes > platformReserved) throw new Error('Storage ledger requires reconciliation before cleanup.');
    tx.update(studioRef, { storageReservedBytes: studioReserved - bytes, storageReservedFileCount: studioCount - data.length, updatedAt: new Date().toISOString() });
    tx.update(platformRef, { reservedBytes: platformReserved - bytes, updatedAt: new Date().toISOString() });
    data.forEach((session, index) => {
      tx.update(refs[index], { state: 'CLEANED', errorCode: 'ADMISSION_FAILED', updatedAt: new Date().toISOString() });
      tx.delete(db.collection('cloud_upload_idempotency').doc(uploadIdempotencyDocumentId(session)));
    });
  });
}

export async function markCloudUploadAdmissionCleanupPending(sessionIds: string[]): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.runTransaction(async (tx) => {
    const refs = sessionIds.map((id) => db.collection('cloud_upload_sessions').doc(id));
    const sessions = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (sessions.some((snap) => !snap.exists)) throw new Error('Upload admission cleanup requires reconciliation.');
    const data = sessions.map((snap) => snap.data() as CloudUploadSession);
    if (data.some((session) => session.state !== 'RESERVED' || (session.leaseUntil && new Date(session.leaseUntil).getTime() > Date.now()))) {
      throw new Error('Upload admission cleanup is already in progress.');
    }
    refs.forEach((ref) => tx.update(ref, { state: 'CLEANUP_PENDING', errorCode: 'ADMISSION_FAILED', leaseToken: null, leaseUntil: null, updatedAt: new Date().toISOString() }));
  });
}

/** Records an uncertain provider outcome without releasing the reservation or
 * changing an active lease. A later retry/maintenance pass must list R2 and
 * prove absence or abort the discovered upload before cleanup can proceed. */
export async function recordCloudMultipartInitiationUncertain(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  const db = getFirestoreServerInstance();
  const batch = db.batch();
  sessionIds.forEach((id) => batch.set(db.collection('cloud_upload_sessions').doc(id), {
    errorCode: 'MULTIPART_INITIATION_UNKNOWN',
    updatedAt: new Date().toISOString(),
  }, { merge: true }));
  await batch.commit();
}

export async function releaseCloudStorageAdmission(input: { studioId: string; bytes: number; count: number }): Promise<void> {
  const db = getFirestoreServerInstance();
  const studioRef = db.collection('studios').doc(input.studioId.toLowerCase());
  const platformRef = db.doc(PLATFORM_REF);
  return await db.runTransaction(async (tx) => {
    const [studioSnap, platformSnap] = await Promise.all([tx.get(studioRef), tx.get(platformRef)]);
    if (!studioSnap.exists || !platformSnap.exists) throw new Error('Storage ledger is unavailable for cleanup.');
    const studio = studioSnap.data() as Studio;
    const platform = platformSnap.data() as { reservedBytes?: unknown };
    const reserved = storageNumber(studio.storageReservedBytes, 'studio reserved bytes');
    const reservedCount = storageNumber(studio.storageReservedFileCount, 'studio reserved file count');
    const platformReserved = storageNumber(platform.reservedBytes, 'platform reserved bytes');
    if (input.bytes > reserved || input.count > reservedCount || input.bytes > platformReserved) throw new Error('Storage ledger requires reconciliation before releasing reservation.');
    tx.update(studioRef, { storageReservedBytes: reserved - input.bytes, storageReservedFileCount: reservedCount - input.count, updatedAt: new Date().toISOString() });
    tx.update(platformRef, { reservedBytes: platformReserved - input.bytes, updatedAt: new Date().toISOString() });
  });
}

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

/** Finds a prior nonterminal admission for a retry. The caller must compare the
 * complete immutable manifest before returning it to the browser. */
export async function findCloudUploadSessionByIdempotency(input: {
  studioId: string;
  orderId: string;
  actorUid: string;
  idempotencyKey: string;
}): Promise<CloudUploadSession | null> {
  const db = getFirestoreServerInstance();
  const snap = await db.collection('cloud_upload_sessions')
    .where('studioId', '==', input.studioId)
    .where('orderId', '==', input.orderId)
    .where('actorUid', '==', input.actorUid)
    .where('idempotencyKey', '==', input.idempotencyKey)
    .limit(2)
    .get();
  if (snap.empty) return null;
  if (snap.size !== 1) throw new Error('Upload idempotency requires reconciliation.');
  return snap.docs[0].data() as CloudUploadSession;
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

/** Claims a session for server-side verification. The lease fences concurrent
 * completion/cancellation without pretending Firestore and R2 share a transaction. */
export async function beginCloudUploadVerification(input: {
  sessionId: string;
  leaseToken: string;
  leaseDurationMs: number;
}): Promise<CloudUploadSession> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('cloud_upload_sessions').doc(input.sessionId);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Upload session not found.');
    const session = snap.data() as CloudUploadSession;
    if (session.state === 'COMMITTED') return session;
    if (session.state === 'CLEANUP_PENDING' || session.state === 'CLEANED' || session.state === 'ABORTED') {
      throw new Error('Upload session cannot be completed.');
    }
    const now = Date.now();
    const liveLease = session.state === 'VERIFYING' && session.leaseUntil && new Date(session.leaseUntil).getTime() > now;
    if (liveLease && session.leaseToken !== input.leaseToken) {
      throw new Error('Upload completion is already in progress.');
    }
    if (!canTransitionCloudUploadState(session.state, 'VERIFYING') && session.state !== 'VERIFYING') {
      throw new Error('Upload session cannot be completed.');
    }
    const leaseUntil = new Date(now + input.leaseDurationMs).toISOString();
    tx.update(ref, { state: 'VERIFYING', leaseToken: input.leaseToken, leaseUntil, updatedAt: new Date().toISOString() });
    return { ...session, state: 'VERIFYING', leaseToken: input.leaseToken, leaseUntil };
  });
}

/** Fences multipart creation itself. A retry may observe the durable session,
 * but it must not create a second provider upload for the same object key. */
export async function beginCloudMultipartInitialization(input: {
  sessionId: string;
  leaseToken: string;
  leaseDurationMs: number;
}): Promise<CloudUploadSession> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('cloud_upload_sessions').doc(input.sessionId);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Upload session not found.');
    const session = snap.data() as CloudUploadSession;
    if (session.multipartUploadId) return session;
    if (session.state !== 'RESERVED') throw new Error('Upload session cannot initialize multipart upload.');
    if (session.leaseUntil && new Date(session.leaseUntil).getTime() > Date.now()) {
      throw new Error('Upload initialization is already in progress.');
    }
    const leaseUntil = new Date(Date.now() + input.leaseDurationMs).toISOString();
    tx.update(ref, { leaseToken: input.leaseToken, leaseUntil, updatedAt: new Date().toISOString() });
    return { ...session, leaseToken: input.leaseToken, leaseUntil };
  });
}

export async function completeCloudMultipartInitialization(input: {
  sessionId: string;
  leaseToken: string;
  multipartUploadId: string;
}): Promise<CloudUploadSession> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('cloud_upload_sessions').doc(input.sessionId);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Upload session not found.');
    const session = snap.data() as CloudUploadSession;
    if (session.multipartUploadId) return session;
    if (session.state !== 'RESERVED' || session.leaseToken !== input.leaseToken) {
      throw new Error('Upload initialization lease is no longer valid.');
    }
    tx.update(ref, { multipartUploadId: input.multipartUploadId, leaseToken: null, leaseUntil: null, updatedAt: new Date().toISOString() });
    return { ...session, multipartUploadId: input.multipartUploadId, leaseToken: undefined, leaseUntil: undefined };
  });
}

/** Moves only an uploadable session into cleanup. Verification holds a lease and
 * must finish or expire before cleanup can be retried. */
export async function beginCloudUploadCleanup(sessionId: string): Promise<CloudUploadSession> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('cloud_upload_sessions').doc(sessionId);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('Upload session not found.');
    const session = snap.data() as CloudUploadSession;
    if (session.state === 'CLEANED') return session;
    if (session.state === 'COMMITTED') throw new Error('Committed files must be deleted through file management.');
    if (session.state === 'VERIFYING' && session.leaseUntil && new Date(session.leaseUntil).getTime() > Date.now()) {
      throw new Error('Upload completion is in progress.');
    }
    if (session.state === 'CLEANUP_PENDING') return session;
    if (!canTransitionCloudUploadState(session.state, 'CLEANUP_PENDING')) {
      throw new Error('Upload session cannot be cancelled.');
    }
    tx.update(ref, { state: 'CLEANUP_PENDING', leaseToken: null, leaseUntil: null, updatedAt: new Date().toISOString() });
    return { ...session, state: 'CLEANUP_PENDING', leaseToken: undefined, leaseUntil: undefined };
  });
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
 * Marks a set of photo records for deletion before contacting R2.  This is a
 * durable tombstone: a failed provider call leaves the records and capacity
 * intact, so a worker or a subsequent retry can safely resume the same job.
 */
export async function beginCloudPhotoDeletion(input: {
  jobId: string;
  studioId: string;
  orderId: string;
  photoIds: string[];
  actorUid: string;
}): Promise<{ jobId: string; objectKeys: string[] }> {
  const db = getFirestoreServerInstance();
  return await db.runTransaction(async (tx) => {
    const jobRef = db.collection('cloud_storage_deletion_jobs').doc(input.jobId);
    const existing = await tx.get(jobRef);
    if (existing.exists) {
      const data = existing.data() as { objectKeys?: string[] };
      return { jobId: input.jobId, objectKeys: data.objectKeys || [] };
    }
    const refs = input.photoIds.map((id) => db.collection('cloud_photos').doc(id));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (snaps.some((snap) => !snap.exists)) throw new Error('One or more cloud photos no longer exist.');
    const photos = snaps.map((snap) => snap.data() as OrderCloudPhoto);
    if (photos.some((photo) => photo.studioId !== input.studioId || photo.orderId !== input.orderId)) throw new Error('Deletion target is outside the authorized order.');
    const pendingJobIds = new Set(photos.filter((photo) => photo.deletionStatus === 'PENDING').map((photo) => photo.deletionJobId).filter(Boolean));
    if (pendingJobIds.size > 0) {
      if (pendingJobIds.size !== 1 || photos.some((photo) => photo.deletionStatus !== 'PENDING')) {
        throw new Error('A selected file is already pending deletion.');
      }
      const pendingJobId = [...pendingJobIds][0]!;
      const pendingJob = await tx.get(db.collection('cloud_storage_deletion_jobs').doc(pendingJobId));
      if (!pendingJob.exists) throw new Error('Deletion requires reconciliation because its job is missing.');
      const data = pendingJob.data() as { objectKeys?: string[]; state?: string; photoIds?: string[] };
      if (data.state !== 'PENDING') throw new Error('Deletion is not ready to retry.');
      if (!sameCloudPhotoIdSet(input.photoIds, data.photoIds || [])) {
        throw new Error('Retry the same pending deletion selection.');
      }
      return { jobId: pendingJobId, objectKeys: data.objectKeys || [] };
    }
    const keys = photos.flatMap((photo) => [photo.objectKey, photo.preview?.objectKey].filter(Boolean) as string[]);
    tx.set(jobRef, { ...input, state: 'PENDING', objectKeys: keys, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    refs.forEach((ref) => tx.update(ref, { deletionStatus: 'PENDING', deletionJobId: input.jobId, deletedObjectKeys: keys, updatedAt: new Date().toISOString() }));
    return { jobId: input.jobId, objectKeys: keys };
  });
}

/** Finalizes a previously tombstoned delete after R2 has confirmed success. */
export async function finalizeCloudPhotoDeletion(input: { jobId: string }): Promise<{ freedBytes: number; deletedCount: number; storageUsedBytes: number; storageFileCount: number }> {
  const db = getFirestoreServerInstance();
  const platformRef = db.doc(PLATFORM_REF);
  return await db.runTransaction(async (tx) => {
    const jobRef = db.collection('cloud_storage_deletion_jobs').doc(input.jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new Error('Deletion job not found.');
    const job = jobSnap.data() as { state?: string; studioId: string; orderId: string; photoIds: string[] };
    if (job.state === 'COMPLETED') return { freedBytes: 0, deletedCount: 0, storageUsedBytes: 0, storageFileCount: 0 };
    if (job.state !== 'PENDING') throw new Error('Deletion job is not ready to finalize.');
    const [studioSnap, orderSnap, platformSnap] = await Promise.all([
      tx.get(db.collection('studios').doc(job.studioId)), tx.get(db.collection('orders').doc(job.orderId)), tx.get(platformRef),
    ]);
    if (!studioSnap.exists || !orderSnap.exists || !platformSnap.exists) throw new Error('Storage ledger is unavailable for deletion finalization.');
    const refs = job.photoIds.map((id) => db.collection('cloud_photos').doc(id));
    const photoSnaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (photoSnaps.some((snap) => !snap.exists)) throw new Error('Deletion requires reconciliation because a tombstoned photo is missing.');
    const photos = photoSnaps.map((snap) => snap.data() as OrderCloudPhoto);
    if (photos.some((photo) => photo.deletionStatus !== 'PENDING')) throw new Error('Deletion requires reconciliation because a tombstone changed.');
    const freedBytes = photos.reduce((total, photo) => total + storageNumber(photo.sizeBytes, 'photo size') + storageNumber(photo.preview?.sizeBytes ?? 0, 'preview size'), 0);
    const studio = studioSnap.data() as Studio;
    const order = orderSnap.data() as Order;
    const platform = platformSnap.data() as { usedBytes?: unknown };
    const studioUsed = storageNumber(studio.storageUsedBytes, 'studio used bytes');
    const studioCount = storageNumber(studio.storageFileCount, 'studio file count');
    const platformUsed = storageNumber(platform.usedBytes, 'platform used bytes');
    const orderBytes = storageNumber(order.cloudStorageBytes, 'order storage bytes');
    const orderCount = storageNumber(order.cloudPhotoCount, 'order photo count');
    if (freedBytes > studioUsed || freedBytes > platformUsed || freedBytes > orderBytes || photos.length > studioCount || photos.length > orderCount) throw new Error('Storage ledger requires reconciliation before deletion finalization.');
    refs.forEach((ref) => tx.delete(ref));
    tx.update(studioSnap.ref, { storageUsedBytes: studioUsed - freedBytes, storageFileCount: studioCount - photos.length, updatedAt: new Date().toISOString() });
    tx.update(platformRef, { usedBytes: platformUsed - freedBytes, updatedAt: new Date().toISOString() });
    tx.update(orderSnap.ref, { cloudStorageBytes: orderBytes - freedBytes, cloudPhotoCount: orderCount - photos.length, updatedAt: new Date().toISOString() });
    tx.update(jobRef, { state: 'COMPLETED', freedBytes, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return { freedBytes, deletedCount: photos.length, storageUsedBytes: studioUsed - freedBytes, storageFileCount: studioCount - photos.length };
  });
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
    .where('kind', '==', 'PREVIEW')
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

/** Commits one verified session exactly once. The session, not browser input,
 * supplies the file identity, object key and reservation. */
export async function commitCloudUploadSession(input: {
  sessionId: string;
  actualSizeBytes: number;
  actualContentType?: string;
  actualSha256: string;
  leaseToken?: string;
  processingUnavailable?: boolean;
  previewJob?: CloudStorageJob;
}): Promise<{ photo: OrderCloudPhoto; committed: boolean }> {
  const db = getFirestoreServerInstance();
  const sessionRef = db.collection('cloud_upload_sessions').doc(input.sessionId);
  const platformRef = db.doc(PLATFORM_REF);
  return await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new Error('Upload session not found.');
    const session = sessionSnap.data() as CloudUploadSession;
    const photoRef = db.collection('cloud_photos').doc(session.photoId);
    if (session.state === 'COMMITTED') {
      const existing = await tx.get(photoRef);
      if (!existing.exists) throw new Error('Committed upload metadata is missing; reconciliation required.');
      return { photo: existing.data() as OrderCloudPhoto, committed: false };
    }
    if (session.state !== 'VERIFYING' || !input.leaseToken || session.leaseToken !== input.leaseToken) {
      throw new Error('Upload session verification lease is no longer valid.');
    }
    const [studioSnap, platformSnap, orderSnap, existingPhoto] = await Promise.all([
      tx.get(db.collection('studios').doc(session.studioId)), tx.get(platformRef), tx.get(db.collection('orders').doc(session.orderId)), tx.get(photoRef),
    ]);
    if (!studioSnap.exists || !platformSnap.exists || !orderSnap.exists) throw new Error('Storage ledger is unavailable for completion.');
    if (existingPhoto.exists) throw new Error('Photo identity already exists.');
    const studio = studioSnap.data() as Studio;
    const platform = platformSnap.data() as { usedBytes?: unknown; reservedBytes?: unknown };
    const reserved = storageNumber(session.reservedBytes, 'session reserved bytes');
    const previewReserved = storageNumber(session.previewReservedBytes, 'session preview reserved bytes');
    if (reserved !== input.actualSizeBytes) throw new Error('Stored object size differs from the reserved upload size.');
    const studioReserved = storageNumber(studio.storageReservedBytes, 'studio reserved bytes');
    const studioReservedCount = storageNumber(studio.storageReservedFileCount, 'studio reserved file count');
    const platformReserved = storageNumber(platform.reservedBytes, 'platform reserved bytes');
    const retainsPreviewReservation = Boolean(input.previewJob && session.settings?.proofingEnabled && session.storageKind === 'ORIGINAL');
    const reservationToRelease = cloudCommitReservationRelease({ primaryReservedBytes: reserved, previewReservedBytes: previewReserved, previewJobOwnsReservation: retainsPreviewReservation });
    if (studioReserved < reservationToRelease || studioReservedCount < 1 || platformReserved < reservationToRelease) throw new Error('Storage ledger requires reconciliation before completion.');
    // No worker is a preview-unavailable state, not a reason to leave a
    // conservative preview reservation blocking the studio forever.
    const processingUnavailable = input.processingUnavailable === true || !retainsPreviewReservation;
    const processingStatus = session.settings?.proofingEnabled && session.storageKind === 'ORIGINAL'
      ? (processingUnavailable ? 'FAILED' as const : 'PENDING' as const) : 'NOT_REQUIRED' as const;
    const photo: OrderCloudPhoto = {
      id: session.photoId, orderId: session.orderId, studioId: session.studioId,
      galleryId: session.galleryId || session.orderId, schemaVersion: 1,
      fileName: session.sourceFileName, sourceFileName: session.sourceFileName,
      sourceSizeBytes: session.sourceSizeBytes, sourceMimeType: session.sourceMimeType,
      displayName: session.sourceFileName, objectKey: session.objectKey,
      mimeType: input.actualContentType || session.uploadMimeType || session.mimeType || 'application/octet-stream',
      sizeBytes: input.actualSizeBytes, storageKind: session.storageKind,
      compressionEnabled: session.settings?.compressionEnabled, sha256: input.actualSha256,
      processingStatus, ...(processingUnavailable ? { processingError: 'Preview processing is unavailable until the storage worker is configured.' } : {}),
      selected: false, uploadedAt: new Date().toISOString(), uploadedBy: session.actorName,
    };
    tx.set(photoRef, photo);
    tx.update(sessionRef, { state: 'COMMITTED', actualSizeBytes: input.actualSizeBytes, sha256: input.actualSha256, leaseToken: null, leaseUntil: null, updatedAt: new Date().toISOString() });
    tx.update(studioSnap.ref, {
      storageUsedBytes: storageNumber(studio.storageUsedBytes, 'studio used bytes') + input.actualSizeBytes,
      storageFileCount: storageNumber(studio.storageFileCount, 'studio file count') + 1,
      storageReservedBytes: studioReserved - reservationToRelease,
      storageReservedFileCount: studioReservedCount - 1,
      updatedAt: new Date().toISOString(),
    });
    tx.update(platformRef, {
      usedBytes: storageNumber(platform.usedBytes, 'platform used bytes') + input.actualSizeBytes,
      reservedBytes: platformReserved - reservationToRelease, updatedAt: new Date().toISOString(),
    });
    const order = orderSnap.data() as Order;
    tx.update(orderSnap.ref, {
      cloudPhotoCount: storageNumber(order.cloudPhotoCount, 'order photo count') + 1,
      cloudStorageBytes: storageNumber(order.cloudStorageBytes, 'order storage bytes') + input.actualSizeBytes,
      updatedAt: new Date().toISOString(),
    });
    if (input.previewJob) tx.set(db.collection('cloud_storage_jobs').doc(input.previewJob.id), input.previewJob);
    return { photo, committed: true };
  });
}

export async function appendCloudStorageAudit(input: { studioId: string; orderId?: string; photoId?: string; sessionId?: string; actorUid: string; action: string; result: 'SUCCESS' | 'DENIED' | 'FAILED'; byteDelta?: number; errorCode?: string }): Promise<void> {
  const db = getFirestoreServerInstance();
  await db.collection('cloud_storage_audit').add({ ...input, timestamp: new Date().toISOString() });
}
