import 'server-only';

import { cookies } from 'next/headers';
import { getFirestoreServerInstance } from '@focoman/db';
import { isDevPortalPasswordFreePreview, validDevPortalSession } from './devPortalCrypto';
export { createDevPortalSession, DEV_PORTAL_SESSION_SECONDS, isDevPortalConfigured, verifyDevPortalPassword } from './devPortalCrypto';

export const DEV_PORTAL_COOKIE = 'focoman_dev_session';
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function isDevPortalAuthenticated(): Promise<boolean> {
  // Temporary development preview: not an authentication mechanism. Anyone
  // who can reach the dev server can see its aggregate metrics, including
  // visitors through a tunnel. Never applies to production builds.
  if (isDevPortalPasswordFreePreview()) return true;
  return validDevPortalSession((await cookies()).get(DEV_PORTAL_COOKIE)?.value);
}

export async function requireDevPortalSession(): Promise<void> {
  if (!await isDevPortalAuthenticated()) throw new Error('Unauthorized');
}

// A shared account-level limit is persisted in Firestore, so it applies across
// server instances. If the store is unavailable login fails closed.
export async function reserveDevPortalAttempt(): Promise<boolean> {
  const db = getFirestoreServerInstance();
  const ref = db.collection('_internal_security').doc('dev_portal_login');
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data();
    const now = Date.now();
    const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : now;
    const attempts = typeof data?.attempts === 'number' ? data.attempts : 0;
    if (now - windowStart < WINDOW_MS && attempts >= MAX_ATTEMPTS) return false;
    const expired = now - windowStart >= WINDOW_MS || windowStart > now;
    transaction.set(ref, { windowStart: expired ? now : windowStart, attempts: expired ? 1 : attempts + 1 });
    return true;
  });
}

export async function clearDevPortalAttempts(): Promise<void> {
  await getFirestoreServerInstance().collection('_internal_security').doc('dev_portal_login').delete();
}
