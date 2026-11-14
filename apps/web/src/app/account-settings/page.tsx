"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { FocomanLoadingState } from "@/components/FocomanSpinner";
import { subscribeToAuthState, signOutUser } from "@/lib/firebaseAuth";
import { getCustomerAuthorizedOrdersHistoryAction } from "@/actions/customerActions";
import {
  CustomerOrderView,
  StudioMembership,
  Studio,
  DeletedStudioRecoveryInfo,
} from "@focoman/types";
import { User, updateProfile } from "firebase/auth";
import {
  getUserWorkspacesAction,
  getStudioAction,
  deleteUserAccountAction,
  getDeletedStudiosAction,
  restoreStudioAction,
  deleteStudioAction,
} from "@/actions/studioActions";
import {
  resolveAndSyncDefaultWorkspace,
  setDefaultWorkspace,
  clearDefaultWorkspace,
  subscribeToDefaultWorkspaceChanges,
} from "@/lib/workspaceDefaults";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<CustomerOrderView[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [defaultStudio, setDefaultStudio] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<StudioMembership[]>([]);
  const [studioPlanRows, setStudioPlanRows] = useState<
    Array<{ studioId: string; studioName: string; planLabel: "Free" | "Starter" | "Professional" }>
  >([]);
  const [selectedDefaultStudio, setSelectedDefaultStudio] = useState<string>("");
  const [defaultSaveLoading, setDefaultSaveLoading] = useState(false);
  const [defaultSaveSuccess, setDefaultSaveSuccess] = useState(false);

  // Deleted Studios (Recovery Window)
  const [deletedStudios, setDeletedStudios] = useState<DeletedStudioRecoveryInfo[]>([]);
  const [restoringStudioId, setRestoringStudioId] = useState<string | null>(null);
  const [purgingStudioId, setPurgingStudioId] = useState<string | null>(null);
  const [deletedStudioMessage, setDeletedStudioMessage] = useState<string | null>(null);
  const [deletedStudioError, setDeletedStudioError] = useState<string | null>(null);

  // Profile editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [nameSaveLoading, setNameSaveLoading] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);

  // Account Deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instantDeleteAccount, setInstantDeleteAccount] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const resolvePlanLabel = (studio?: Studio | null): "Free" | "Starter" | "Professional" => {
    const plan = studio?.planInfo?.plan;
    const caps = studio?.planInfo?.selectedCapabilities || [];
    if (
      plan === "PROFESSIONAL" ||
      plan === "COMPLETE" ||
      caps.some((c) => ["WHATSAPP_OPERATIONS", "WHATSAPP_BOT", "BUSINESS_REPORTS", "ANALYTICS_ADVANCED"].includes(c))
    ) {
      return "Professional";
    }
    if (
      plan === "STARTER" ||
      caps.some((c) => c !== "OMS_BASIC" && c !== "OMS_CORE")
    ) {
      return "Starter";
    }
    return "Free";
  };

  const formatDeletionSchedule = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const loadWorkspacesAndDeletedStudios = useCallback(async (currentUser: User) => {
    const token = await currentUser.getIdToken();
    const [workspacesData, deletedRes] = await Promise.all([
      getUserWorkspacesAction(token),
      getDeletedStudiosAction(token),
    ]);

    const activeWorkspaces = workspacesData || [];
    setWorkspaces(activeWorkspaces);
    if (deletedRes.success) {
      setDeletedStudios(deletedRes.studios);
    }

    const initialDefault = await resolveAndSyncDefaultWorkspace(currentUser.uid, activeWorkspaces, token);
    setDefaultStudio(initialDefault);
    if (initialDefault) {
      setSelectedDefaultStudio(initialDefault);
    } else if (activeWorkspaces.length > 0) {
      setSelectedDefaultStudio(activeWorkspaces[0].studioId);
    }

    const rows = await Promise.all(
      activeWorkspaces.map(async (w) => {
        if (w.role === "STUDIO_OWNER") {
          const studioRes = await getStudioAction(w.studioId, token);
          if (studioRes.success && studioRes.studio) {
            return {
              studioId: w.studioId,
              studioName: studioRes.studio.name || w.studioName || w.studioId,
              planLabel: resolvePlanLabel(studioRes.studio),
            };
          }
        }
        return {
          studioId: w.studioId,
          studioName: w.studioName || w.studioId,
          planLabel: "Free" as const,
        };
      })
    );
    setStudioPlanRows(rows);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        router.replace("/sign-in");
        return;
      }

      setDisplayNameInput(currentUser.displayName || "");

      setHistoryLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const [ordersRes] = await Promise.all([
          getCustomerAuthorizedOrdersHistoryAction(token),
          loadWorkspacesAndDeletedStudios(currentUser),
        ]);

        if (ordersRes.success && ordersRes.history) {
          setOrders(ordersRes.history);
        }
      } catch (err) {
        console.error("Failed to load customer order history", err);
      } finally {
        setHistoryLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, loadWorkspacesAndDeletedStudios]);

  // Subscribe to default workspace changes across tabs and in-tab
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToDefaultWorkspaceChanges(user.uid, (newDefault) => {
      setDefaultStudio(newDefault);
      if (newDefault) {
        setSelectedDefaultStudio(newDefault);
      }
    });
    return () => unsub();
  }, [user]);

  const handleRestoreDeletedStudio = async (studioId: string, studioName: string) => {
    if (!user) return;
    setRestoringStudioId(studioId);
    setDeletedStudioError(null);
    setDeletedStudioMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await restoreStudioAction(studioId, token);
      if (!res.success) {
        setDeletedStudioError(res.error || "Failed to restore studio.");
      } else {
        await loadWorkspacesAndDeletedStudios(user);
        setDeletedStudioMessage(`Restored "${studioName}" (/${studioId}) to active workspaces.`);
        setTimeout(() => setDeletedStudioMessage(null), 4000);
      }
    } catch (err: unknown) {
      setDeletedStudioError(err instanceof Error ? err.message : "Failed to restore studio.");
    } finally {
      setRestoringStudioId(null);
    }
  };

  const handleInstantDeleteRemainingStudio = async (studioId: string, studioName: string) => {
    if (!user) return;
    setPurgingStudioId(studioId);
    setDeletedStudioError(null);
    setDeletedStudioMessage(null);
    try {
      const token = await user.getIdToken();
      const res = await deleteStudioAction(studioId, token, { permanent: true });
      if (!res.success) {
        setDeletedStudioError(res.error || "Failed to permanently delete studio.");
      } else {
        setDeletedStudios((prev) => prev.filter((s) => s.id !== studioId));
        setDeletedStudioMessage(`Permanently deleted "${studioName}" and all associated data.`);
        setTimeout(() => setDeletedStudioMessage(null), 4000);
      }
    } catch (err: unknown) {
      setDeletedStudioError(err instanceof Error ? err.message : "Failed to permanently delete studio.");
    } finally {
      setPurgingStudioId(null);
    }
  };

  const handleSaveName = async () => {
    if (!user || !displayNameInput.trim()) return;
    setNameSaveLoading(true);
    setNameSaveSuccess(false);
    try {
      await updateProfile(user, { displayName: displayNameInput.trim() });
      setNameSaveSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile name:", err);
    } finally {
      setNameSaveLoading(false);
    }
  };

  const handleSetDefault = async (studioId: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    if (studioId === "") {
      await clearDefaultWorkspace(user.uid, token);
      setDefaultStudio(null);
    } else {
      await setDefaultWorkspace(user.uid, studioId, token);
      setDefaultStudio(studioId);
    }
  };

  const handleSaveDefault = async () => {
    if (!user || !selectedDefaultStudio) return;
    setDefaultSaveLoading(true);
    setDefaultSaveSuccess(false);
    try {
      await handleSetDefault(selectedDefaultStudio);
      setDefaultSaveSuccess(true);
      setTimeout(() => setDefaultSaveSuccess(false), 2500);
    } finally {
      setDefaultSaveLoading(false);
    }
  };

  const handleClearDefault = async () => {
    if (!user) return;
    setDefaultSaveLoading(true);
    try {
      await handleSetDefault("");
    } finally {
      setDefaultSaveLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput.trim().toLowerCase() !== "delete") return;
    if (!user) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const token = await user.getIdToken();
      const res = await deleteUserAccountAction(token, { permanent: instantDeleteAccount });

      if (res.success) {
        await clearDefaultWorkspace(user.uid);
        if (typeof window !== "undefined") {
          try {
            Object.keys(localStorage).forEach((key) => {
              if (key.startsWith("focoman_")) {
                localStorage.removeItem(key);
              }
            });
          } catch (e) {
            console.warn("[handleDeleteAccount] Failed to clear local storage:", e);
          }
        }
        await signOutUser();
        router.replace("/sign-in?deleted=true");
      } else {
        setDeleteError(res.error || "Failed to close account. Please try again.");
        setIsDeleting(false);
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to close account. Please try again.");
      setIsDeleting(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (defaultStudio) {
      router.push(`/${defaultStudio}/dashboard`);
    } else {
      router.push("/workspaces");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-app flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <FocomanLoadingState
            status="Loading Account Settings..."
            subtext="Fetching profile and workspace preferences"
            showCard={true}
          />
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb / Back button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition group cursor-pointer"
          >
            <span className="text-brand-blue-primary font-bold">←</span>
            <span>{defaultStudio ? `Back to ${defaultStudio} Dashboard` : "Back to Workspaces"}</span>
          </button>

        </div>

        {/* Panel 1: Profile & Account Settings */}
        <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-divider pb-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">
                Account Settings
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Manage your personal profile, credentials, and customer bookings across Focoman.
              </p>
            </div>
            <div className="h-14 w-14 flex-shrink-0 rounded-full bg-brand-blue-primary text-white flex items-center justify-center text-xl font-bold shadow-sm">
              {user.displayName
                ? user.displayName.charAt(0).toUpperCase()
                : user.email
                ? user.email.charAt(0).toUpperCase()
                : "U"}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Full Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                {!isEditingName ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="text-[11px] font-bold text-brand-blue-primary hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setDisplayNameInput(user.displayName || "");
                    }}
                    className="text-[11px] font-semibold text-text-tertiary hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="w-full rounded-xl border border-brand-blue-primary px-3.5 py-2 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue-primary/20"
                    placeholder="Your full name"
                  />
                  <button
                    type="button"
                    disabled={nameSaveLoading}
                    onClick={handleSaveName}
                    className="rounded-xl bg-brand-blue-primary px-4 py-2 text-xs font-bold text-white hover:bg-brand-blue-hover transition shrink-0 cursor-pointer"
                  >
                    {nameSaveLoading ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : (
                <div className="w-full rounded-xl border border-border-default bg-surface-app px-4 py-2 text-sm font-medium text-text-primary flex items-center justify-between">
                  <span>{user.displayName || "Not provided"}</span>
                  {nameSaveSuccess && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ Updated
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Email Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-text-secondary">Email Address</label>
                {user.emailVerified && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Verified
                  </span>
                )}
              </div>
              <div className="w-full rounded-xl border border-border-default bg-surface-app px-4 py-2 text-sm font-medium text-text-primary">
                {user.email}
              </div>
            </div>

            {/* Default Workspace Preference & Quick Switch */}
            <div className="sm:col-span-2 pt-2 border-t border-border-divider/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-primary">Default Studio Workspace</span>
                    {defaultStudio && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-text-secondary text-[11px] block mt-0.5">
                    {defaultStudio
                      ? `Currently configured to "${defaultStudio} Studio".`
                      : "No default studio configured. Choose a workspace to enable quick dashboard launching."}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {workspaces.length > 0 ? (
                    <>
                      <select
                        value={selectedDefaultStudio || (defaultStudio || workspaces[0]?.studioId || "")}
                        onChange={(e) => setSelectedDefaultStudio(e.target.value)}
                        className="rounded-xl border border-brand-blue-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand-blue-primary shrink-0 cursor-pointer"
                      >
                        {workspaces.map((w) => (
                          <option key={w.studioId} value={w.studioId}>
                            {w.studioName || w.studioId}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleSaveDefault}
                        disabled={
                          defaultSaveLoading ||
                          !selectedDefaultStudio ||
                          selectedDefaultStudio === defaultStudio
                        }
                        className="rounded-xl bg-brand-blue-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-blue-hover transition cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Save Default Workspace"
                      >
                        {defaultSaveLoading ? "Saving..." : defaultSaveSuccess ? "Saved ✓" : "Save"}
                      </button>
                      {defaultStudio && (
                        <button
                          type="button"
                          onClick={handleClearDefault}
                          disabled={defaultSaveLoading}
                          className="rounded-xl border border-border-default bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-secondary hover:text-red-600 hover:border-red-200 transition cursor-pointer shadow-2xs"
                          title="Clear Default Studio"
                        >
                          Clear
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-text-tertiary text-[11px]">No workspaces found</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 1.5: Subscription Plan Details Table (All Studios) */}
        {studioPlanRows.length > 0 && (
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-divider pb-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Subscription Plan Details</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Active plan for each of your studios.
                </p>
              </div>
              <Link
                href="/checkout"
                className="text-xs font-bold text-brand-blue-primary hover:underline inline-flex items-center gap-1"
              >
                <span>View Plans →</span>
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border-default">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-app border-b border-border-default text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-bold">Studio</th>
                    <th className="px-4 py-3 font-bold">Plan</th>
                    <th className="px-4 py-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-divider bg-white">
                  {studioPlanRows.map((row) => (
                    <tr key={row.studioId}>
                      <td className="px-4 py-3 font-semibold text-text-primary">
                        {row.studioName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            row.planLabel === "Professional"
                              ? "bg-brand-blue-primary text-white"
                              : row.planLabel === "Starter"
                              ? "bg-brand-orange-background text-brand-orange-primary border border-brand-orange-soft"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {row.planLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/checkout?studio=${encodeURIComponent(row.studioId)}`}
                          className="font-bold text-brand-blue-primary hover:underline"
                        >
                          {row.planLabel === "Free" ? "Upgrade" : "Manage"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Panel 1.75: Deleted Studios (Recovery Window) */}
        {(deletedStudios.length > 0 || deletedStudioMessage || deletedStudioError) && (
          <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-divider pb-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Deleted Studios</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Workspaces in the 30-day recovery window before permanent removal.
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-800 tabular-nums">
                {deletedStudios.length} {deletedStudios.length === 1 ? "studio" : "studios"} pending deletion
              </span>
            </div>

            {deletedStudioMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                ✓ {deletedStudioMessage}
              </div>
            )}

            {deletedStudioError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {deletedStudioError}
              </div>
            )}

            {deletedStudios.length === 0 ? (
              <p className="text-xs text-text-secondary py-2">
                No studios are currently pending deletion.
              </p>
            ) : (
              <div className="divide-y divide-border-divider rounded-2xl border border-border-default bg-surface-app/40">
                {deletedStudios.map((ds) => {
                  const isRestoring = restoringStudioId === ds.id;
                  const isPurging = purgingStudioId === ds.id;
                  return (
                    <div
                      key={ds.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-text-primary text-sm">{ds.name}</span>
                          <span aria-hidden="true" className="text-text-tertiary">·</span>
                          <span className="font-mono text-text-secondary">/{ds.id}</span>
                          {ds.city && (
                            <>
                              <span aria-hidden="true" className="text-text-tertiary">·</span>
                              <span className="text-text-secondary">{ds.city}</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-amber-900 tabular-nums">
                          <span className="font-bold">
                            Recoverable within {ds.remainingDays} {ds.remainingDays === 1 ? "day" : "days"}
                          </span>
                          <span aria-hidden="true" className="text-text-tertiary">·</span>
                          <span className="text-text-secondary">
                            Scheduled for deletion on{" "}
                            <span className="font-semibold text-text-primary">
                              {formatDeletionSchedule(ds.scheduledDeletionAt)}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreDeletedStudio(ds.id, ds.name)}
                          disabled={isRestoring || isPurging}
                          className="rounded-xl bg-brand-blue-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-blue-hover transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {isRestoring ? "Restoring..." : "Restore Studio"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInstantDeleteRemainingStudio(ds.id, ds.name)}
                          disabled={isRestoring || isPurging}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {isPurging ? "Deleting..." : "Delete Now"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Panel 2: Confirmed orders as customer */}
        <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-divider pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary">Orders as customer</h2>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Confirmed orders associated with your account.
              </p>
            </div>
          </div>

          {historyLoading ? (
            <div className="text-xs text-text-secondary py-4 text-center">Loading your customer orders...</div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default p-5 text-center bg-surface-app/50">
              <p className="text-xs font-bold text-text-primary">No personal customer orders found</p>
              <p className="text-[11px] text-text-tertiary mt-0.5 max-w-sm mx-auto">
                Confirmed orders associated with your account will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Confirmed Orders */}
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-border-default bg-surface-app p-4 text-xs space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-divider pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-brand-blue-primary">{ord.orderNumber}</span>
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-status-success border border-green-200">
                          {ord.orderStatus}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-text-primary mt-0.5">
                        {ord.studioName} — {ord.eventType}
                      </h3>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xs font-extrabold text-text-primary">
                        ₹{ord.totalAmount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        Paid: ₹{ord.amountPaid.toLocaleString("en-IN")} · Balance: ₹{ord.remainingAmount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
                    <div>
                      <span className="text-text-tertiary">Date:</span>{" "}
                      <span className="font-semibold text-text-primary">{ord.eventDate}</span>
                      {ord.eventLocation && (
                        <>
                          <span className="text-text-tertiary mx-1.5">•</span>
                          <span className="text-text-tertiary">Location:</span>{" "}
                          <span className="font-semibold text-text-primary">{ord.eventLocation}</span>
                        </>
                      )}
                    </div>
                    {ord.trackingPasskey && (
                      <Link
                        href={`/track/${ord.trackingPasskey}`}
                        className="rounded-lg bg-text-primary px-2.5 py-1 text-[10px] font-bold text-white hover:bg-black transition"
                      >
                        Track Deliverables →
                      </Link>
                    )}
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>

        {/* Panel 3: Session Security & Sign Out */}
        <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Session Security</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Signed in as <span className="font-semibold">{user.email}</span>. Sign out from this device session.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition whitespace-nowrap cursor-pointer"
          >
            Sign Out
          </button>
        </div>

        {/* Panel 4: Close Account */}
        <div className="rounded-3xl border border-red-200 bg-red-50/40 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-extrabold text-text-primary">Close User Account</h4>
              <p className="text-xs text-text-secondary mt-1 max-w-xl">
                Close the account and delete all owned studios. Workspace data remains recoverable for 30 days unless full instant delete is selected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setInstantDeleteAccount(false);
                setDeleteConfirmationInput("");
                setDeleteError(null);
              }}
              className="rounded-xl border border-red-300 bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 active:scale-[0.98] transition whitespace-nowrap cursor-pointer shadow-xs"
            >
              Close User Account
            </button>
          </div>
        </div>

        {/* Account Closure Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-red-200 animate-in fade-in duration-150 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-base font-extrabold text-text-primary">Close User Account</h3>
                <button
                  type="button"
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="text-text-tertiary hover:text-text-primary p-1 rounded-lg"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3.5 text-xs text-red-900 space-y-1 leading-relaxed">
                <p className="font-bold">Warning: this closes your account and removes session access.</p>
                <p>
                  {instantDeleteAccount
                    ? "All owned studios and all associated data will be permanently deleted immediately."
                    : "Owned studios enter a 30-day recovery window before permanent deletion."}
                </p>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/40 p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={instantDeleteAccount}
                  onChange={(e) => setInstantDeleteAccount(e.target.checked)}
                  disabled={isDeleting}
                  className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <span className="text-xs text-red-950 leading-snug">
                  <span className="font-bold block">Full instant delete</span>
                  <span className="text-[11px] text-red-800">
                    Immediately remove all studios and associated data without timeline.
                  </span>
                </span>
              </label>

              {deleteError && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {deleteError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-primary">
                  To confirm, type <span className="font-mono text-red-600 font-extrabold">&quot;delete&quot;</span> in the box below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  placeholder='Type "delete" to confirm'
                  disabled={isDeleting}
                  className="w-full rounded-xl border border-border-default px-3.5 py-2.5 text-base sm:text-xs font-mono font-bold text-text-primary outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-divider">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-app transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmationInput.trim().toLowerCase() !== "delete" || isDeleting}
                  className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                >
                  {isDeleting
                    ? "Closing Account..."
                    : instantDeleteAccount
                    ? "Delete Immediately"
                    : "Close Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border-divider bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-tertiary">
            <p>© {new Date().getFullYear()} Focoman. All rights reserved.</p>
            <p>Built for professional photography studios.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
