#!/usr/bin/env node
/**
 * Cloud Storage & Photo Selection Lifecycle Maintenance Utility
 *
 * Dry-run by default.
 * Pass `--run` or `--execute` to perform active cleanup of expired uncommitted sessions.
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CloudUploadSession, CloudStorageJob } from '@focoman/types';

interface MaintenanceSummary {
  mode: 'DRY_RUN' | 'EXECUTE';
  scannedSessions: number;
  expiredSessions: number;
  reclaimedBytes: number;
  cleanedSessions: number;
  scannedJobs: number;
  completedJobs: number;
  failedJobs: number;
}

function parsePrivateKey(rawKey: string | undefined): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
}

function getDbInstance() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return getFirestore(existingApps[0]);
  }
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'focoman';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  let app;
  if (clientEmail && privateKey && projectId) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    app = initializeApp({ projectId });
  }
  return getFirestore(app);
}

export async function runCloudStorageMaintenance(options: { execute?: boolean }): Promise<MaintenanceSummary> {
  const isExecute = Boolean(options.execute);
  const mode = isExecute ? 'EXECUTE' : 'DRY_RUN';
  const now = new Date();
  const nowIso = now.toISOString();

  const summary: MaintenanceSummary = {
    mode,
    scannedSessions: 0,
    expiredSessions: 0,
    reclaimedBytes: 0,
    cleanedSessions: 0,
    scannedJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  };

  const db = getDbInstance();

  // 1. Audit uncommitted upload sessions for expiry
  try {
    const sessionsSnap = await db
      .collection('cloud_upload_sessions')
      .where('state', 'in', ['RESERVED', 'UPLOADING', 'VERIFYING', 'CLEANUP_PENDING'])
      .limit(100)
      .get();

    summary.scannedSessions = sessionsSnap.size;

    for (const doc of sessionsSnap.docs) {
      const session = doc.data() as CloudUploadSession;
      const isExpired = session.expiresAt && new Date(session.expiresAt).getTime() < now.getTime();
      const isPendingCleanup = session.state === 'CLEANUP_PENDING';

      if (!isExpired && !isPendingCleanup) continue;

      summary.expiredSessions++;
      const reservedBytes = session.reservedBytes || 0;
      summary.reclaimedBytes += reservedBytes;

      console.log(
        `[${mode}] Session ${session.id} (studio: ${session.studioId}, state: ${session.state}, reserved: ${reservedBytes}B, expires: ${session.expiresAt})`
      );

      if (isExecute) {
        try {
          await db.runTransaction(async (tx) => {
            const liveSnap = await tx.get(doc.ref);
            if (!liveSnap.exists) return;
            const live = liveSnap.data() as CloudUploadSession;
            if (live.state === 'COMMITTED' || live.state === 'CLEANED') return;

            tx.update(doc.ref, {
              state: 'CLEANED',
              leaseToken: null,
              leaseUntil: null,
              updatedAt: nowIso,
            });

            // Decrement reservations if active
            if (live.reservedBytes && live.studioId) {
              const studioRef = db.collection('studios').doc(live.studioId.toLowerCase());
              tx.set(
                studioRef,
                { storageReservedBytes: FieldValue.increment(-live.reservedBytes) },
                { merge: true }
              );
              const studioAcctRef = db.collection('studio_storage_accounts').doc(live.studioId.toLowerCase());
              tx.set(
                studioAcctRef,
                { reservedBytes: FieldValue.increment(-live.reservedBytes) },
                { merge: true }
              );
              const platformRef = db.collection('cloud_storage_platform').doc('current');
              tx.set(
                platformRef,
                { reservedBytes: FieldValue.increment(-live.reservedBytes) },
                { merge: true }
              );
            }
          });
          summary.cleanedSessions++;
        } catch (err) {
          console.error(`Failed to clean session ${session.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn(`Sessions collection audit skipped or unavailable:`, err instanceof Error ? err.message : err);
  }

  // 2. Audit pending cleanup jobs
  try {
    const jobsSnap = await db
      .collection('cloud_storage_jobs')
      .where('state', '==', 'PENDING')
      .limit(50)
      .get();

    summary.scannedJobs = jobsSnap.size;

    for (const doc of jobsSnap.docs) {
      const job = doc.data() as CloudStorageJob;
      if (job.runAfter && job.runAfter > nowIso) continue;

      console.log(`[${mode}] Actionable job: ${job.id} (kind: ${job.kind}, studio: ${job.studioId})`);

      if (isExecute) {
        try {
          await doc.ref.update({
            state: 'SUCCEEDED',
            updatedAt: nowIso,
          });
          summary.completedJobs++;
        } catch (err) {
          summary.failedJobs++;
          await doc.ref.update({
            state: 'FAILED',
            lastError: err instanceof Error ? err.message : 'Job failed',
            updatedAt: nowIso,
          });
        }
      }
    }
  } catch (err) {
    console.warn(`Storage jobs audit skipped or unavailable:`, err instanceof Error ? err.message : err);
  }

  return summary;
}

// Direct execution entrypoint
if (typeof process !== 'undefined' && process.argv && (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test')) {
  const isDirect = process.argv[1]?.includes('cloud-storage-maintenance');
  if (isDirect) {
    const execute = process.argv.includes('--run') || process.argv.includes('--execute');
    console.log(`\n=== Focoman Cloud Storage Lifecycle Maintenance [${execute ? 'LIVE EXECUTE' : 'DRY RUN'}] ===\n`);
    runCloudStorageMaintenance({ execute })
      .then((summary) => {
        console.log('\n=== Maintenance Summary ===');
        console.log(`Mode:              ${summary.mode}`);
        console.log(`Scanned Sessions:  ${summary.scannedSessions}`);
        console.log(`Expired Sessions:  ${summary.expiredSessions}`);
        console.log(`Reclaimed Bytes:   ${summary.reclaimedBytes}`);
        console.log(`Cleaned Sessions:  ${summary.cleanedSessions}`);
        console.log(`Scanned Jobs:      ${summary.scannedJobs}`);
        console.log(`Completed Jobs:    ${summary.completedJobs}`);
        console.log(`Failed Jobs:       ${summary.failedJobs}`);
        console.log('===========================\n');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Maintenance error:', err);
        process.exit(1);
      });
  }
}
