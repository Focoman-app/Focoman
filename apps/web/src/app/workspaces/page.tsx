"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import { FocomanLoadingState, FocomanSpinner } from "@/components/FocomanSpinner";
import { subscribeToAuthState, signInWithGoogle, signOutUser, syncServerSession } from "@/lib/firebaseAuth";
import { getUserWorkspacesAction, deleteStudioAction, leaveStudioAction } from "@/actions/studioActions";
import { getMyPendingInvitationsAction } from "@/actions/memberActions";
import { StudioInvitationSummary, StudioMembership } from "@focoman/types";
import { User } from "firebase/auth";
import {
  resolveAndSyncDefaultWorkspace,
  setDefaultWorkspace,
  clearDefaultWorkspace,
  subscribeToDefaultWorkspaceChanges,
} from "@/lib/workspaceDefaults";

export default function WorkspacesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [workspaces, setWorkspaces] = useState<StudioMembership[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<StudioInvitationSummary[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Default workspace state
  const [defaultStudioId, setDefaultStudioId] = useState<string | null>(null);

  // Deletion modal state
  const [targetWorkspaceToDelete, setTargetWorkspaceToDelete] = useState<StudioMembership | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (user) => {
      setCurrentUser(user);
      setLoadingUser(false);
      if (user) {
        setLoadingWorkspaces(true);

        // Ensure the server-side HTTP session cookie is active before launching any workspace
        await syncServerSession();

        // CHG-011: Pass the Firebase ID token (JWT), not the UID — identity is verified server-side.
        const idToken = await user.getIdToken();
        const [data, invitations] = await Promise.all([
          getUserWorkspacesAction(idToken),
          getMyPendingInvitationsAction(idToken),
        ]);
        setWorkspaces(data);
        setPendingInvitations(invitations);

        const initialDefault = await resolveAndSyncDefaultWorkspace(user.uid, data, idToken);
        setDefaultStudioId(initialDefault);

        setLoadingWorkspaces(false);
      } else {
        setWorkspaces([]);
        setPendingInvitations([]);
        setDefaultStudioId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to default workspace changes across tabs & in-tab
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToDefaultWorkspaceChanges(currentUser.uid, (newDefault) => {
      setDefaultStudioId(newDefault);
    });
    return () => unsub();
  }, [currentUser]);

  const handleSetDefault = async (studioId: string) => {
    if (!currentUser) return;
    setDefaultStudioId(studioId);
    const idToken = await currentUser.getIdToken();
    await setDefaultWorkspace(currentUser.uid, studioId, idToken);
    setSuccessToast(`Default workspace switched to "/${studioId}". Future dashboard visits will open this studio.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleClearDefault = async () => {
    if (!currentUser) return;
    setDefaultStudioId(null);
    const idToken = await currentUser.getIdToken();
    await clearDefaultWorkspace(currentUser.uid, idToken);
    setSuccessToast("Cleared default workspace preference.");
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !targetWorkspaceToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const idToken = await currentUser.getIdToken();
      const isOwner = targetWorkspaceToDelete.role === "STUDIO_OWNER";
      
      let res;
      if (isOwner) {
        res = await deleteStudioAction(targetWorkspaceToDelete.studioId, idToken);
      } else {
        res = await leaveStudioAction(targetWorkspaceToDelete.studioId, idToken);
      }

      if (!res.success) {
        setDeleteError(res.error || "Failed to process workspace deletion.");
        setIsDeleting(false);
        return;
      }

      // Update local state
      setWorkspaces((prev) => prev.filter((w) => w.studioId !== targetWorkspaceToDelete.studioId));
      if (defaultStudioId === targetWorkspaceToDelete.studioId) {
        await clearDefaultWorkspace(currentUser.uid, idToken);
        setDefaultStudioId(null);
      }

      setSuccessToast(
        isOwner 
          ? `Studio "${targetWorkspaceToDelete.studioName || targetWorkspaceToDelete.studioId}" deleted successfully!`
          : `Left studio "${targetWorkspaceToDelete.studioName || targetWorkspaceToDelete.studioId}" successfully!`
      );
      setTimeout(() => setSuccessToast(null), 4000);
      setTargetWorkspaceToDelete(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!loadingUser && !currentUser) {
      router.replace("/sign-in");
    }
  }, [loadingUser, currentUser, router]);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error("Sign-in failed:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("auth/unauthorized-domain") ||
        (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "auth/unauthorized-domain")
      ) {
        const domain = typeof window !== "undefined" ? window.location.hostname : "current domain";
        setAuthError(
          `Domain "${domain}" is not authorized in Firebase. Please add "${domain}" to Authorized Domains in Firebase Console (Authentication -> Settings -> Authorized domains).`
        );
      } else if (errorMessage.includes("auth/popup-closed-by-user")) {
        setAuthError(null);
      } else {
        setAuthError(errorMessage || "Sign-in failed. Please try again.");
      }
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton fallbackHref="/dashboard" />
        </div>
        {loadingUser ? (
          <FocomanLoadingState
            status="Checking authentication status..."
            subtext="Loading your studio memberships and workspace access"
            showCard={false}
            minHeight="min-h-[320px]"
          />
        ) : !currentUser ? (
          /* Unauthenticated State - Now redirects to home */
          <FocomanLoadingState
            status="Redirecting..."
            subtext="Please wait while we route you"
            showCard={false}
            minHeight="min-h-[320px]"
          />
        ) : (
          /* Authenticated State */
          <div className="space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-divider pb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
                  Personal Identity
                </span>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
                  Your Studio Workspaces
                </h1>
                <p className="text-xs text-text-secondary mt-1">
                  Logged in as <span className="font-semibold text-text-primary">{currentUser.displayName || currentUser.email}</span> ({currentUser.email})
                </p>
              </div>
            </div>

            {successToast && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-900 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-600">✓</span>
                  <span>{successToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessToast(null)}
                  className="text-emerald-800 font-bold hover:text-emerald-950 px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {!loadingWorkspaces && pendingInvitations.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-amber-950">Invitations to Join</h2>
                    <p className="mt-1 text-xs text-amber-900">These invitations were sent to your signed-in Google email.</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">{pendingInvitations.length}</span>
                </div>
                <ul className="mt-3 divide-y divide-amber-200">
                  {pendingInvitations.map((invitation) => (
                    <li key={invitation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{invitation.studioName}</p>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          Invited as {invitation.name || "Crew Member"} · {invitation.skills.join(", ")}
                        </p>
                      </div>
                      <Link
                        href={`/onboarding/join-studio?code=${encodeURIComponent(invitation.id)}`}
                        className="inline-flex items-center justify-center rounded-lg bg-brand-purple-primary px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
                      >
                        Review &amp; Join
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {loadingWorkspaces ? (
              <div className="py-12 text-center text-xs text-text-tertiary">
                Fetching accessible studio workspaces...
              </div>
            ) : workspaces.length === 0 ? (
              /* State A: 0 Studio Memberships */
              <div className="rounded-3xl border border-border-default bg-white p-8 text-center shadow-sm sm:p-12">
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                  Welcome to Focoman! How would you like to get started?
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-xs text-text-secondary">
                  Your personal profile is active. Choose how you would like to use Focoman:
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto text-left">
                  {/* Option 1: Studio Owner (Primary Target) */}
                  <Link
                    href="/onboarding/register-studio"
                    className="flex flex-col justify-between rounded-2xl border-2 border-brand-orange-primary/30 bg-brand-orange-background/30 p-6 transition hover:border-brand-orange-primary hover:bg-brand-orange-background/60 shadow-2xs group"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-brand-orange-primary group-hover:text-orange-700">
                        I run a Studio
                      </h3>
                      <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                        Manage orders, team, production pipeline, invoices, and payments in one workspace.
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center text-xs font-bold text-brand-orange-primary group-hover:underline">
                      Register Your Studio →
                    </span>
                  </Link>

                  {/* Option 2: Crew Member */}
                  <Link
                    href="/onboarding/join-studio"
                    className="flex flex-col justify-between rounded-2xl border-2 border-brand-purple-primary/30 bg-brand-purple-background/30 p-6 transition hover:border-brand-purple-primary hover:bg-brand-purple-background/60 shadow-2xs group"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-brand-purple-primary group-hover:text-purple-700">
                        I&apos;m a Crew Member
                      </h3>
                      <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                        Photographer, videographer, or editor accepting an invitation from a studio owner.
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center text-xs font-bold text-brand-purple-primary group-hover:underline">
                      Join with Invite Code →
                    </span>
                  </Link>

                  {/* Option 3: Customer */}
                  <Link
                    href="/studios"
                    className="flex flex-col justify-between rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/40 p-6 transition hover:border-emerald-500 hover:bg-emerald-50/80 shadow-2xs group"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950 group-hover:text-emerald-700">
                        I&apos;m a Customer
                      </h3>
                      <p className="mt-1 text-xs text-emerald-900/80 leading-relaxed">
                        Browse verified studios, explore event packages &amp; track your bookings.
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center text-xs font-bold text-emerald-700 group-hover:underline">
                      Explore Studios →
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              /* State B: Has Memberships */
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {workspaces.map((m) => {
                    const isDefault = m.studioId.toLowerCase() === defaultStudioId?.toLowerCase();
                    return (
                      <div
                        key={m.id}
                        className={`rounded-2xl border bg-white p-6 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                          isDefault ? "border-brand-blue-primary/40 ring-1 ring-brand-blue-primary/20" : "border-border-default"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-xs font-semibold text-text-tertiary truncate">
                                /{m.studioId}
                              </span>
                              {isDefault && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800 shrink-0">
                                  Default Workspace
                                </span>
                              )}
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shrink-0 ${
                                m.role === "STUDIO_OWNER"
                                  ? "bg-brand-orange-background text-brand-orange-primary"
                                  : "bg-brand-purple-background text-brand-purple-primary"
                              }`}
                            >
                              {m.role === "STUDIO_OWNER" ? "Owner" : "Crew Member"}
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-bold text-text-primary">
                            {m.studioName || m.studioId}
                          </h3>

                          {m.skills && m.skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {m.skills.map((s) => (
                                <span
                                  key={s}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-border-divider flex items-center gap-3">
                          <Link
                            href={`/${m.studioId}/dashboard`}
                            className="flex-1 text-center rounded-xl bg-brand-blue-primary py-2.5 text-xs font-bold text-white transition hover:bg-sky-600 shadow-xs"
                          >
                            Launch Workspace →
                          </Link>
                          <Link
                            href={`/${m.studioId}/dashboard/settings`}
                            className="rounded-xl border border-border-default bg-white px-3 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 hover:text-text-primary transition shrink-0"
                            title="Studio Settings & Workspace Options"
                          >
                            Settings
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Additional Actions */}
                <div className="rounded-2xl border border-dashed border-border-default bg-surface-app p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Need something else?</h4>
                    <p className="text-xs text-text-secondary">
                      Explore studios as a customer, register another studio, accept a crew invite, or track an existing order anytime.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <Link
                      href="/onboarding/register-studio"
                      className="rounded-xl border border-brand-orange-primary bg-white px-3.5 py-2 text-xs font-bold text-brand-orange-primary hover:bg-orange-50 transition"
                    >
                      + Register Studio
                    </Link>
                    <Link
                      href="/onboarding/join-studio"
                      className="rounded-xl border border-brand-purple-primary bg-white px-3.5 py-2 text-xs font-bold text-brand-purple-primary hover:bg-purple-50 transition"
                    >
                      + Join Studio
                    </Link>
                    <Link
                      href="/studios"
                      className="rounded-xl border border-emerald-600 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      Explore Studios
                    </Link>
                    <Link
                      href="/track"
                      className="rounded-xl border border-brand-blue-primary bg-brand-blue-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-600 transition shadow-xs"
                    >
                      Track Order
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete / Leave Workspace Confirmation Modal */}
        {targetWorkspaceToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default animate-in fade-in duration-150">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-text-primary">
                {targetWorkspaceToDelete.role === "STUDIO_OWNER"
                  ? "Delete Studio Workspace"
                  : "Leave Studio Workspace"}
              </h3>

              <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                {targetWorkspaceToDelete.role === "STUDIO_OWNER" ? (
                  <>
                    Are you sure you want to close <span className="font-bold text-text-primary">{targetWorkspaceToDelete.studioName || targetWorkspaceToDelete.studioId}</span> (<span className="font-mono">/{targetWorkspaceToDelete.studioId}</span>)? It will be unavailable and may be restored by an authorised owner within 30 days.
                  </>
                ) : (
                  <>
                    Are you sure you want to leave <span className="font-bold text-text-primary">{targetWorkspaceToDelete.studioName || targetWorkspaceToDelete.studioId}</span>? You will no longer have access to this studio workspace unless invited again.
                  </>
                )}
              </p>


              {deleteError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {deleteError}
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTargetWorkspaceToDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                  className="w-full sm:w-auto rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="w-full sm:w-auto rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <FocomanSpinner size="xs" />
                      Processing...
                    </>
                  ) : targetWorkspaceToDelete.role === "STUDIO_OWNER" ? (
                    "Yes, Delete Workspace"
                  ) : (
                    "Yes, Leave Workspace"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
