import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
  User,
  UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Client-side Firebase Authentication helper functions
 * Strictly Google OAuth + Session Cookie (No password collection or storage)
 */

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

let inFlightSync: Promise<boolean> | null = null;
let lastSyncedToken: string | null = null;
let redirectHandlingPromise: Promise<UserCredential | null> | null = null;

/**
 * Synchronizes client-side Firebase Auth credentials with the server-side
 * HTTP session cookie (`__session`).
 *
 * Idempotent: Deduplicates simultaneous in-flight requests and avoids
 * redundant calls if the token has not changed.
 */
export async function syncServerSession(force = false): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const origin = window.location.origin;

  if (!auth.currentUser) {
    try {
      await fetch(`${origin}/api/session`, { method: "DELETE", credentials: "same-origin" });
    } catch {
      // Ignore background delete errors
    }
    lastSyncedToken = null;
    return false;
  }

  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    try {
      const idToken = await auth.currentUser!.getIdToken(force);
      if (!force && lastSyncedToken === idToken) {
        return true;
      }
      const response = await fetch(`${origin}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        credentials: "same-origin",
      });
      if (response.ok) {
        lastSyncedToken = idToken;
        return true;
      }
      return false;
    } catch (error) {
      console.warn("[Focoman Auth] Session sync deferred (network/navigation state):", error instanceof Error ? error.message : error);
      return false;
    } finally {
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}

/**
 * Initiates Google sign-in.
 * Primary: same-tab signInWithRedirect using canonical authorized authDomain.
 * Fallback: popup sign-in if same-tab redirect throws or is blocked.
 */
export async function signInWithGoogle(): Promise<UserCredential | void> {
  if (typeof window !== "undefined") {
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Ignore if persistence is already configured
    }
  }

  const isIframe = typeof window !== "undefined" && window.self !== window.top;
  const isVercel = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
  const isCustomHost =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    !window.location.hostname.includes("firebaseapp.com") &&
    !window.location.hostname.includes("web.app");

  // Use popup sign-in on Vercel, custom domains, or inside iFrames to prevent cross-origin redirect token loss (3rd-party cookie / ITP restrictions)
  if (isIframe || isVercel || isCustomHost) {
    console.log("[Focoman Auth] Using popup sign-in for cross-domain / Vercel host:", typeof window !== "undefined" ? window.location.hostname : "");
    const credential = await signInWithPopup(auth, googleProvider);
    await syncServerSession(true);
    return credential;
  }

  console.log("[Focoman Auth] Initiating same-tab signInWithRedirect (authDomain:", auth.config?.authDomain || "focoman.firebaseapp.com", ")...");
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.warn("[Focoman Auth] signInWithRedirect encountered error, attempting fallback popup:", error);
    const credential = await signInWithPopup(auth, googleProvider);
    await syncServerSession(true);
    return credential;
  }
}

/**
 * Handles incoming redirect sign-in results from Google OAuth.
 * Safe to call on multiple component mounts: memoizes in-flight execution.
 */
export async function handleRedirectAuth(): Promise<UserCredential | null> {
  if (typeof window === "undefined") return null;
  if (redirectHandlingPromise) return redirectHandlingPromise;

  redirectHandlingPromise = (async () => {
    try {
      console.log("[Focoman Auth] Checking getRedirectResult(auth)...");
      const credential = await getRedirectResult(auth);
      console.log("[Focoman Auth] getRedirectResult returned:", credential ? {
        uid: credential.user?.uid,
        email: credential.user?.email,
      } : "null (no pending redirect credential)");

      if (credential?.user) {
        console.log("[Focoman Auth] Syncing server session for user:", credential.user.email);
        await syncServerSession(true);
        return credential;
      }
      return null;
    } catch (error) {
      console.error("[Focoman Auth] Error processing redirect sign-in:", error);
      throw error;
    }
  })();

  return redirectHandlingPromise;
}

/**
 * Optional fallback popup sign-in if redirect is blocked.
 */
export async function signInWithGooglePopup(): Promise<UserCredential> {
  console.log("[Focoman Auth] Initiating signInWithPopup as fallback...");
  const credential = await signInWithPopup(auth, googleProvider);
  await syncServerSession(true);
  return credential;
}

export async function signOutUser(): Promise<void> {
  lastSyncedToken = null;
  const response = await fetch('/api/session', { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Unable to clear the secure server session. Please try signing out again.');
  }
  await signOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function subscribeToTokenChange(callback: (user: User | null) => void) {
  return onIdTokenChanged(auth, callback);
}

export async function getCurrentUserIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken(forceRefresh);
}

