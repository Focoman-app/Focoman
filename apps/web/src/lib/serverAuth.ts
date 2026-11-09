import 'server-only';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getMembershipByUidAndStudio } from '@focoman/db';
import { StudioMembership } from '@focoman/types';
import { cookies } from 'next/headers';
import {
  canAutoHealStudioOwner,
  isRejectedDevSessionCookie,
  StudioMembershipRequiredError,
  UnauthenticatedSessionError,
  verifyActiveStudioMembership,
} from '@/lib/sessionSecurity';

export const SESSION_COOKIE_NAME = '__session';
export const SESSION_COOKIE_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export { UnauthenticatedSessionError, StudioMembershipRequiredError };

/**
 * Server-Side Authorization Utilities — CHG-010
 * Provides identity verification and studio membership enforcement
 * for all mutating Server Actions.
 *
 * Pattern:
 *   const decoded = await requireVerifiedUser(idToken);
 *   const membership = await requireStudioMember(decoded.uid, studioId);
 */

function parsePrivateKey(rawKey: string | undefined): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
}

export function getAdminAuthInstance() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'focoman';

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  const existingApps = getApps();
  if (existingApps.length > 0) {
    return getAuth(existingApps[0]);
  }

  if (clientEmail && privateKey && projectId) {
    const app = initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }), projectId },
      'auth-instance'
    );
    return getAuth(app);
  }

  // Fallback initialization using default project credentials
  const app = initializeApp({ projectId }, 'auth-instance');
  return getAuth(app);
}

/**
 * Verifies a Firebase ID token and returns the decoded token payload.
 * Throws an error with a user-safe message if the token is missing or invalid.
 */
export async function requireVerifiedUser(idToken: string | undefined): Promise<DecodedIdToken> {
  if (idToken && idToken.trim().length > 0) {
    try {
      const adminAuth = getAdminAuthInstance();
      const decoded = await adminAuth.verifyIdToken(idToken);
      return decoded;
    } catch {
      // If client ID token has expired, fall back to verified session cookie
    }
  }

  try {
    return await requireVerifiedSession();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Token verification failed.';
    throw new Error(`Authentication failed: ${message}`);
  }
}

export async function createSessionCookieFromIdToken(idToken: string): Promise<string> {
  const adminAuth = getAdminAuthInstance();
  await adminAuth.verifyIdToken(idToken);
  return await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_COOKIE_MAX_AGE_MS });
}

export async function requireVerifiedSession(): Promise<DecodedIdToken> {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie || isRejectedDevSessionCookie(sessionCookie)) {
    throw new UnauthenticatedSessionError('Authentication required.');
  }

  try {
    return await getAdminAuthInstance().verifySessionCookie(sessionCookie, true);
  } catch {
    throw new UnauthenticatedSessionError('Authentication required.');
  }
}

export async function requireStudioSessionMember(studioId: string): Promise<{
  decoded: DecodedIdToken;
  membership: StudioMembership;
}> {
  const decoded = await requireVerifiedSession();
  let membership = await getMembershipByUidAndStudio(decoded.uid, studioId);

  if (!membership && decoded.uid) {
    const { getStudioBySlug, getFirestoreServerInstance } = await import('@focoman/db');
    const studio = await getStudioBySlug(studioId);

    const canHealOwner = canAutoHealStudioOwner(
      studio,
      decoded.uid,
      decoded.email,
      Boolean(decoded.email_verified)
    );

    if (studio && canHealOwner) {
      membership = {
        id: `${studio.id}_${decoded.uid}`,
        studioId: studio.id,
        studioName: studio.name,
        uid: decoded.uid,
        role: 'STUDIO_OWNER',
        status: 'ACTIVE',
        joinedAt: studio.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const firestore = getFirestoreServerInstance();
        await firestore.collection('memberships').doc(membership.id).set(membership, { merge: true });
      } catch (e) {
        console.warn('[serverAuth] Failed to auto-heal owner membership:', e);
      }
    }
  }

  const activeMembership = verifyActiveStudioMembership(membership, studioId);
  return { decoded, membership: activeMembership };
}

/**
 * Verifies that the authenticated user (by UID) is an ACTIVE member or owner
 * of the specified studio. Throws if no active membership record exists.
 *
 * @param uid - The Firebase UID from `requireVerifiedUser`.
 * @param studioId - The studio slug/ID to check membership against.
 * @param requiredRole - Optional: enforce a specific role (e.g., 'STUDIO_OWNER').
 */
export async function requireStudioMember(
  uid: string,
  studioId: string,
  requiredRole?: string
): Promise<StudioMembership> {
  let membership = await getMembershipByUidAndStudio(uid, studioId);

  if (!membership && uid) {
    const { getStudioBySlug, getFirestoreServerInstance } = await import('@focoman/db');
    const studio = await getStudioBySlug(studioId);
    if (studio && canAutoHealStudioOwner(studio, uid)) {
      membership = {
        id: `${studio.id}_${uid}`,
        studioId: studio.id,
        studioName: studio.name,
        uid,
        role: 'STUDIO_OWNER',
        status: 'ACTIVE',
        joinedAt: studio.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const firestore = getFirestoreServerInstance();
        await firestore.collection('memberships').doc(membership.id).set(membership, { merge: true });
      } catch (e) {
        console.warn('[serverAuth] Failed to auto-heal owner membership:', e);
      }
    }
  }

  return verifyActiveStudioMembership(membership, studioId, requiredRole);
}

export async function requireStudioOwner(uid: string, studioId: string): Promise<StudioMembership> {
  return requireStudioMember(uid, studioId, 'STUDIO_OWNER');
}
