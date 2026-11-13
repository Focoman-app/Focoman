"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { FocomanLoadingState } from "@/components/FocomanSpinner";
import { subscribeToAuthState, signOutUser } from "@/lib/firebaseAuth";
import { getCustomerAuthorizedOrdersHistoryAction } from "@/actions/customerActions";
import { CustomerOrderView, StudioMembership, Studio } from "@focoman/types";
import { User, updateProfile } from "firebase/auth";
import { getUserWorkspacesAction, getStudioAction, deleteUserAccountAction } from "@/actions/studioActions";
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
  const [defaultStudioDetails, setDefaultStudioDetails] = useState<Studio | null>(null);
  const [selectedDefaultStudio, setSelectedDefaultStudio] = useState<string>("");
  const [defaultSaveLoading, setDefaultSaveLoading] = useState(false);
  const [defaultSaveSuccess, setDefaultSaveSuccess] = useState(false);

  // Profile editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [nameSaveLoading, setNameSaveLoading] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);

  // Account Deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        router.replace("/sign-in");
        return;
      }

      setDisplayNameInput(currentUser.displayName || "");

      // Handle default studio fetching later

      setHistoryLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const [ordersRes, workspacesData] = await Promise.all([
          getCustomerAuthorizedOrdersHistoryAction(token),
          getUserWorkspacesAction(token),
        ]);

        if (ordersRes.success && ordersRes.history) {
          setOrders(ordersRes.history);
        }
        if (workspacesData) {
          setWorkspaces(workspacesData);
        }
        
        const initialDefault = await resolveAndSyncDefaultWorkspace(currentUser.uid, workspacesData || [], token);
        setDefaultStudio(initialDefault);
        if (initialDefault) {
          setSelectedDefaultStudio(initialDefault);
          const studioRes = await getStudioAction(initialDefault, token);
          if (studioRes.success && studioRes.studio) {
            setDefaultStudioDetails(studioRes.studio);
          }
        } else if (workspacesData && workspacesData.length > 0) {
          setSelectedDefaultStudio(workspacesData[0].studioId);
          setDefaultStudioDetails(null);
        }
      } catch (err) {
        console.error("Failed to load customer order history", err);
      } finally {
        setHistoryLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Subscribe to default workspace changes across tabs and in-tab
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToDefaultWorkspaceChanges(user.uid, async (newDefault) => {
      setDefaultStudio(newDefault);
      if (newDefault) {
        setSelectedDefaultStudio(newDefault);
        try {
          const token = await user.getIdToken();
          const studioRes = await getStudioAction(newDefault, token);
          if (studioRes.success && studioRes.studio) {
            setDefaultStudioDetails(studioRes.studio);
          }
        } catch {}
      } else {
        setDefaultStudioDetails(null);
      }
    });
    return () => unsub();
  }, [user]);

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
      setDefaultStudioDetails(null);
    } else {
      await setDefaultWorkspace(user.uid, studioId, token);
      setDefaultStudio(studioId);
      const studioRes = await getStudioAction(studioId, token);
      if (studioRes.success && studioRes.studio) {
        setDefaultStudioDetails(studioRes.studio);
      }
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
      const res = await deleteUserAccountAction(token);

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

          <div className="flex items-center gap-3 text-xs">
            {defaultStudio && (
              <Link
                href={`/${defaultStudio}/dashboard`}
                className="text-text-secondary hover:text-brand-blue-primary font-medium transition"
              >
                {defaultStudio} Dashboard
              </Link>
            )}
            <Link
              href="/workspaces"
              className="text-text-secondary hover:text-brand-blue-primary font-medium transition"
            >
              My Workspaces
            </Link>
          </div>
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

        {/* Panel 1.5: Plan Subscription (Shown if default studio selected) */}
        {defaultStudioDetails && (
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-divider pb-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Subscription Plan Details</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Current active plan for <b>{defaultStudioDetails.name}</b>.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                (defaultStudioDetails.planInfo?.selectedCapabilities && defaultStudioDetails.planInfo.selectedCapabilities.length > 0) ||
                defaultStudioDetails.planInfo?.plan === 'COMPLETE' ||
                defaultStudioDetails.planInfo?.plan === 'PROFESSIONAL' ||
                defaultStudioDetails.planInfo?.plan === 'STARTER'
                  ? 'bg-brand-blue-primary text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {(defaultStudioDetails.planInfo?.selectedCapabilities && defaultStudioDetails.planInfo.selectedCapabilities.length > 0) ||
                defaultStudioDetails.planInfo?.plan === 'COMPLETE' ||
                defaultStudioDetails.planInfo?.plan === 'PROFESSIONAL'
                  ? defaultStudioDetails.planInfo?.plan === 'STARTER'
                    ? 'STARTER PLAN'
                    : 'PROFESSIONAL PLAN'
                  : 'FREE PLAN'}
              </span>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-text-primary">Selected Modules</h3>
              <div className="flex flex-wrap gap-2">
                {defaultStudioDetails.planInfo?.selectedCapabilities && defaultStudioDetails.planInfo.selectedCapabilities.length > 0 ? (
                  defaultStudioDetails.planInfo.selectedCapabilities.map(cap => (
                    <span key={cap} className="rounded-md bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 border border-green-200">
                      {cap.replace(/_/g, " ")}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-tertiary">
                    No extra modules selected. Core Order Management (OMS) is included free.
                  </span>
                )}
              </div>
            </div>
            <div className="pt-2 flex items-center gap-4">
              <Link
                href={`/checkout?studio=${defaultStudioDetails.id}`}
                className="text-xs font-bold text-brand-blue-primary hover:underline inline-flex items-center gap-1"
              >
                <span>
                  {(defaultStudioDetails.planInfo?.selectedCapabilities && defaultStudioDetails.planInfo.selectedCapabilities.length > 0)
                    ? "Review Plan →"
                    : "View Plans →"}
                </span>
              </Link>
            </div>
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
                Close the account and deactivate sole-owner workspaces. Workspace data remains recoverable for 30 days under the Privacy Policy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
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
            <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-red-200 animate-in fade-in duration-150 space-y-5">
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

              <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-xs text-red-900 space-y-1.5 leading-relaxed">
                <p className="font-bold">Warning: this removes access from the current session.</p>
                <p>
                  Sole-owner workspaces enter a 30-day recovery period. Contact support through the Privacy Policy if restoration is needed during that period.
                </p>
              </div>

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
                  {isDeleting ? "Closing Account..." : "Close Account"}
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
