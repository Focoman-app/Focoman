import { getUserDefaultStudioAction, setUserDefaultStudioAction } from "@/actions/studioActions";

export const FOCOMAN_DEFAULT_WORKSPACE_EVENT = "focoman_default_workspace_changed";
export const CLEARED_SENTINEL = "__cleared__";
export const STORAGE_KEY_PREFIX = "focoman_default_workspace_";

export function getStorageKey(uid: string): string {
  return `${STORAGE_KEY_PREFIX}${uid}`;
}

/**
 * Reads local storage preference synchronously.
 * Returns:
 * - studioId: string | null
 * - status: 'set' | 'cleared' | 'unset'
 */
export function getLocalDefaultWorkspace(uid: string): {
  studioId: string | null;
  status: "set" | "cleared" | "unset";
} {
  if (typeof window === "undefined" || !uid) {
    return { studioId: null, status: "unset" };
  }
  try {
    const val = localStorage.getItem(getStorageKey(uid));
    if (val === null || val === undefined || val === "") {
      return { studioId: null, status: "unset" };
    }
    if (val === CLEARED_SENTINEL) {
      return { studioId: null, status: "cleared" };
    }
    return { studioId: val, status: "set" };
  } catch {
    return { studioId: null, status: "unset" };
  }
}

/**
 * Dispatches an in-tab CustomEvent so all mounted components
 * (Navbar, DashboardSidebar, WorkspacesPage, AccountSettings, etc.)
 * update immediately within the same tab without a reload.
 */
export function broadcastDefaultWorkspaceChange(studioId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(FOCOMAN_DEFAULT_WORKSPACE_EVENT, {
        detail: { studioId },
      })
    );
  } catch (err) {
    console.warn("[workspaceDefaults] Failed to dispatch broadcast event:", err);
  }
}

/**
 * Sets a studio as the default workspace:
 * 1. Writes to localStorage
 * 2. Cleans up any legacy storage keys
 * 3. Broadcasts change via CustomEvent to current tab
 * 4. Asynchronously updates Firestore user_preferences/{uid}
 */
export async function setDefaultWorkspace(
  uid: string,
  studioId: string,
  idToken?: string
): Promise<void> {
  if (!uid || !studioId) return;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(uid), studioId);
      localStorage.removeItem("focoman_default_workspace");
    } catch (e) {
      console.warn("[workspaceDefaults] localStorage write failed:", e);
    }
  }
  broadcastDefaultWorkspaceChange(studioId);

  if (idToken) {
    try {
      await setUserDefaultStudioAction(studioId, idToken);
    } catch (err) {
      console.warn("[workspaceDefaults] Failed to sync default studio to server:", err);
    }
  }
}

/**
 * Clears default workspace preference:
 * 1. Writes '__cleared__' sentinel to localStorage
 * 2. Broadcasts change via CustomEvent to current tab
 * 3. Asynchronously updates Firestore user_preferences/{uid} to null
 */
export async function clearDefaultWorkspace(
  uid: string,
  idToken?: string
): Promise<void> {
  if (!uid) return;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getStorageKey(uid), CLEARED_SENTINEL);
      localStorage.removeItem("focoman_default_workspace");
    } catch (e) {
      console.warn("[workspaceDefaults] localStorage clear failed:", e);
    }
  }
  broadcastDefaultWorkspaceChange(null);

  if (idToken) {
    try {
      await setUserDefaultStudioAction(null, idToken);
    } catch (err) {
      console.warn("[workspaceDefaults] Failed to sync clear default studio to server:", err);
    }
  }
}

/**
 * Resolves the default workspace across localStorage, Firestore, and available workspaces.
 *
 * Rules:
 * 1. If explicitly cleared (__cleared__ locally or on server), returns null.
 * 2. If valid default found in localStorage that exists in user's active workspaces, returns it.
 * 3. If unset locally, checks Firestore server preference.
 *    - If found on server and valid in active workspaces: saves to localStorage, returns it.
 *    - If server has __cleared__, respects it.
 * 4. If unset everywhere, returns null so the caller can show the workspace
 *    selector. A default is only persisted after an explicit user choice.
 */
export async function resolveAndSyncDefaultWorkspace(
  uid: string,
  availableWorkspaces: Array<{ studioId: string; status?: string }>,
  idToken?: string
): Promise<string | null> {
  if (!uid) return null;

  const activeWorkspaces = availableWorkspaces.filter(
    (w) => !w.status || w.status === "ACTIVE"
  );
  const activeIds = new Set(activeWorkspaces.map((w) => w.studioId.toLowerCase()));

  const local = getLocalDefaultWorkspace(uid);

  // 1. Explicitly cleared locally
  if (local.status === "cleared") {
    return null;
  }

  // 2. Local value is set and exists in active workspaces
  if (local.status === "set" && local.studioId && activeIds.has(local.studioId.toLowerCase())) {
    if (idToken) {
      // Background sync to ensure Firestore user_preferences is up to date
      setUserDefaultStudioAction(local.studioId, idToken).catch(() => {});
    }
    return local.studioId;
  }

  // 3. Unset locally (or pointing to a deleted studio) -> check Firestore server preference
  let serverPref: string | null = null;
  if (idToken) {
    try {
      serverPref = await getUserDefaultStudioAction(idToken);
    } catch (e) {
      console.warn("[workspaceDefaults] Error checking server default:", e);
    }
  }

  if (serverPref === CLEARED_SENTINEL) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(uid), CLEARED_SENTINEL);
      } catch {}
    }
    return null;
  }

  if (serverPref && activeIds.has(serverPref.toLowerCase())) {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(uid), serverPref);
      } catch {}
    }
    broadcastDefaultWorkspaceChange(serverPref);
    return serverPref;
  }

  // 4. Neither local nor server has a preference. Do not silently choose or
  // persist a workspace: callers must route the user to the selector.
  return null;
}

/**
 * Subscribes to default workspace changes across tabs (via 'storage' event)
 * AND within the same tab (via CustomEvent).
 */
export function subscribeToDefaultWorkspaceChanges(
  uid: string,
  callback: (studioId: string | null) => void
): () => void {
  if (typeof window === "undefined" || !uid) {
    return () => {};
  }

  const handleCustomEvent = (event: Event) => {
    const custom = event as CustomEvent<{ studioId: string | null }>;
    callback(custom.detail?.studioId ?? null);
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === getStorageKey(uid)) {
      const val = event.newValue;
      if (!val || val === CLEARED_SENTINEL) {
        callback(null);
      } else {
        callback(val);
      }
    }
  };

  window.addEventListener(FOCOMAN_DEFAULT_WORKSPACE_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(FOCOMAN_DEFAULT_WORKSPACE_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
