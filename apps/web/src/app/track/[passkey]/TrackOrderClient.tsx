"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerTrackingView, OrderStatus, TaskStatus, OrderCollaborator } from "@focoman/types";
import { Navbar } from "@/components/Navbar";
import { subscribeToAuthState, signOutUser } from "@/lib/firebaseAuth";
import { syncOrderToAccountAction, updateOrderCollaboratorsAction, checkIsStudioStaffAction } from "@/actions/orderActions";
import { User } from "firebase/auth";
import Link from "next/link";
import { getEventDaysRemaining } from "@/utils/dateUtils";
import { OrderVerticalWorkflow } from "@/components/workflow/OrderVerticalWorkflow";

const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_EVENT: "Awaiting Event",
  POST_EVENT_IN_PROGRESS: "Post-Event In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  AWAITING_EVENT: "Awaiting Event",
  ASSIGNED: "Pending",
  IN_PROGRESS: "In Progress",
  REVIEW: "Under Review",
  REWORK: "Revising",
  COMPLETED: "Completed",
};

interface TrackOrderClientProps {
  view: CustomerTrackingView;
  rawIdentifier: string;
}

export function TrackOrderClient({ view, rawIdentifier }: TrackOrderClientProps) {
  const { order, tasks } = view;

  const searchParams = useSearchParams();
  const autoSyncRequested = searchParams.get("autoSync") === "true";
  const hasAutoSyncedRef = useRef(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [enteredPasskey, setEnteredPasskey] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  // Collaborators & Permissions State
  const [collaborators, setCollaborators] = useState<OrderCollaborator[]>(order.collaborators || []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR">("VIEWER");
  const [isUpdatingCollaborators, setIsUpdatingCollaborators] = useState(false);
  const [collaboratorSuccess, setCollaboratorSuccess] = useState<string | null>(null);
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Sync / Claim state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Tracks the email that just claimed this order (so UI updates immediately without a page reload)
  const [claimedAsEmail, setClaimedAsEmail] = useState<string | null>(null);

  const hasCustomerEmail = Boolean(order.customerEmail && order.customerEmail.trim().length > 0);

  const validatePasskey = useCallback(
    (input: string): boolean => {
      const cleanInput = input.trim().toUpperCase();
      if (!cleanInput) return false;

      const numericPinMatch = order.trackingPasskey?.match(/\d{6}/g) || order.orderNumber.match(/\d{6}/g) || [];

      if (order.passkeyPin && cleanInput === order.passkeyPin.toUpperCase()) return true;
      if (order.trackingPasskey && cleanInput === order.trackingPasskey.toUpperCase()) return true;
      if (cleanInput === order.orderNumber.toUpperCase()) return true;
      if (cleanInput === order.id.toUpperCase()) return true;
      if (numericPinMatch.some((pin) => cleanInput === pin)) return true;

      return false;
    },
    [order.passkeyPin, order.trackingPasskey, order.orderNumber, order.id]
  );

  // Listen to Auth State and evaluate access
  useEffect(() => {
    // If not email protected (PIN mode), check sessionStorage for unlocked session
    if (!hasCustomerEmail) {
      const sessionKey = `focoman_unlocked_order_${order.id}`;
      const stored = typeof window !== "undefined" ? sessionStorage.getItem(sessionKey) : null;
      if (stored === "true") {
        setIsUnlocked(true);
      }
    }

    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user);
      setAuthChecked(true);

      if (user) {
        const userEmail = user.email?.toLowerCase();
        const customerEmail = order.customerEmail?.toLowerCase();

        // 1. Studio Owner match
        const isOwnerMatch = Boolean(
          (userEmail && order.studioOwnerEmail && userEmail === order.studioOwnerEmail.toLowerCase()) ||
          (order.studioOwnerId && order.studioOwnerId === user.uid)
        );

        // 2. Crew / Staff match
        const isStaffMatch = Boolean(
          isOwnerMatch ||
          (userEmail && order.staffEmails && order.staffEmails.includes(userEmail)) ||
          (order.staffUids && order.staffUids.includes(user.uid))
        );

        // 3. Customer email or UID match (Primary Customer) - strictly when NOT studio staff
        const isCustomerMatch = Boolean(
          !isStaffMatch &&
          ((userEmail && customerEmail && userEmail === customerEmail) ||
          (order.customerUid && order.customerUid === user.uid))
        );

        // 4. Collaborator match (Family / Friends invited with Can View or Can Edit)
        const isCollaboratorMatch = Boolean(
          userEmail &&
          (collaborators || order.collaborators || []).some(
            (c) => c.email.toLowerCase() === userEmail
          )
        );

        if (isCustomerMatch || isStaffMatch || isCollaboratorMatch) {
          setIsUnlocked(true);
        }

        // Authoritative studio membership check via server action
        if (order.studioId) {
          user.getIdToken().then(async (token) => {
            try {
              const res = await checkIsStudioStaffAction({
                studioId: order.studioId || "",
                idToken: token,
              });
              if (res.isStaff) {
                setIsStaffUser(true);
                setStaffRole(res.role || "STUDIO_MEMBER");
                setIsUnlocked(true);
              }
            } catch {
              // ignore
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [
    hasCustomerEmail,
    order.id,
    order.studioId,
    order.customerEmail,
    order.customerUid,
    order.studioOwnerEmail,
    order.studioOwnerId,
    order.staffEmails,
    order.staffUids,
    collaborators,
    order.collaborators,
  ]);

  const handleVerifyPasskey = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePasskey(enteredPasskey)) {
      setIsUnlocked(true);
      setPasskeyError(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`focoman_unlocked_order_${order.id}`, "true");
      }
    } else {
      setPasskeyError("Invalid 6-digit access PIN. Please check and try again.");
    }
  };

  const handleSyncToAccount = useCallback(async () => {
    if (!currentUser) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const token = await currentUser.getIdToken();
      const res = await syncOrderToAccountAction({
        passkey: order.trackingPasskey || rawIdentifier,
        idToken: token,
      });

      if (res.success) {
        setSyncSuccess(true);
        setIsUnlocked(true);
        // Mark the current user's email as the claimed customer — updates role ribbon immediately
        setClaimedAsEmail(currentUser.email?.toLowerCase() || null);
      } else {
        setSyncError(res.error || "Failed to claim order to your account.");
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "An error occurred while claiming order.");
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, order.trackingPasskey, rawIdentifier]);

  // Auto-sync order when redirected back from sign-in for claiming
  useEffect(() => {
    if (!currentUser || !autoSyncRequested || hasAutoSyncedRef.current) return;

    const userEmail = currentUser.email?.toLowerCase();
    const isOwnerMatch = Boolean(
      (userEmail && order.studioOwnerEmail && userEmail === order.studioOwnerEmail.toLowerCase()) ||
      (order.studioOwnerId && order.studioOwnerId === currentUser.uid)
    );
    const isStaffMatch = Boolean(
      isOwnerMatch ||
      (userEmail && order.staffEmails && order.staffEmails.includes(userEmail)) ||
      (order.staffUids && order.staffUids.includes(currentUser.uid))
    );

    if (isStaffMatch) {
      setIsUnlocked(true);
      return;
    }

    hasAutoSyncedRef.current = true;
    setIsUnlocked(true);
    handleSyncToAccount();
  }, [
    currentUser,
    autoSyncRequested,
    order.studioOwnerEmail,
    order.studioOwnerId,
    order.staffEmails,
    order.staffUids,
    handleSyncToAccount,
  ]);

  // Collaborator sharing management
  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !inviteEmail.trim()) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (order.customerEmail && cleanEmail === order.customerEmail.toLowerCase()) {
      setCollaboratorError("The primary customer email already has full access.");
      return;
    }
    if (collaborators.some((c) => c.email.toLowerCase() === cleanEmail)) {
      setCollaboratorError("This email already has access. You can change their permission below.");
      return;
    }

    setIsUpdatingCollaborators(true);
    setCollaboratorError(null);
    setCollaboratorSuccess(null);

    const updated: OrderCollaborator[] = [
      ...collaborators,
      { email: cleanEmail, role: inviteRole, addedAt: new Date().toISOString() },
    ];

    try {
      const token = await currentUser.getIdToken();
      const res = await updateOrderCollaboratorsAction({
        orderId: order.id,
        collaborators: updated,
        idToken: token,
      });

      if (res.success) {
        setCollaborators(updated);
        setInviteEmail("");
        setCollaboratorSuccess(`Granted "${inviteRole === "EDITOR" ? "Can Edit" : "Can View"}" access to ${cleanEmail}`);
        setTimeout(() => setCollaboratorSuccess(null), 3500);
      } else {
        setCollaboratorError(res.error || "Failed to update permissions.");
      }
    } catch (err) {
      setCollaboratorError(err instanceof Error ? err.message : "Error saving access.");
    } finally {
      setIsUpdatingCollaborators(false);
    }
  };

  const handleRemoveCollaborator = async (emailToRemove: string) => {
    if (!currentUser) return;
    setIsUpdatingCollaborators(true);
    setCollaboratorError(null);
    const updated = collaborators.filter((c) => c.email.toLowerCase() !== emailToRemove.toLowerCase());

    try {
      const token = await currentUser.getIdToken();
      const res = await updateOrderCollaboratorsAction({
        orderId: order.id,
        collaborators: updated,
        idToken: token,
      });

      if (res.success) {
        setCollaborators(updated);
        setCollaboratorSuccess(`Removed access for ${emailToRemove}`);
        setTimeout(() => setCollaboratorSuccess(null), 3000);
      } else {
        setCollaboratorError(res.error || "Failed to remove collaborator.");
      }
    } catch (err) {
      setCollaboratorError(err instanceof Error ? err.message : "Error removing access.");
    } finally {
      setIsUpdatingCollaborators(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOutUser();
    setCurrentUser(null);
    setIsUnlocked(false);
  };

  // Determine user's active role on unlocked view
  const userEmail = currentUser?.email?.toLowerCase();
  const customerEmail = order.customerEmail?.toLowerCase();

  const isOwnerMatch = Boolean(
    currentUser &&
    (staffRole === "STUDIO_OWNER" ||
    (userEmail && order.studioOwnerEmail && userEmail === order.studioOwnerEmail.toLowerCase()) ||
    (order.studioOwnerId && order.studioOwnerId === currentUser.uid))
  );

  const isStaffMatch = Boolean(
    currentUser &&
    (isStaffUser ||
    isOwnerMatch ||
    (userEmail && order.staffEmails && order.staffEmails.includes(userEmail)) ||
    (order.staffUids && currentUser && order.staffUids.includes(currentUser.uid)))
  );

  // Primary Customer: Strictly for genuine customer account, NEVER studio staff.
  // claimedAsEmail covers the case where a PIN-only order was just claimed in this session
  // (order.customerUid / customerEmail are stale server props until the next page load).
  const isCustomerOwnerMatch = Boolean(
    !isStaffMatch &&
    currentUser &&
    (
      (userEmail && customerEmail && userEmail === customerEmail) ||
      (order.customerUid && currentUser && order.customerUid === currentUser.uid) ||
      (claimedAsEmail && userEmail && claimedAsEmail === userEmail)
    )
  );

  const collaboratorMatch = (collaborators || []).find(
    (c) => userEmail && c.email.toLowerCase() === userEmail
  );

  const isEmailProtectedOrClaimed = Boolean(hasCustomerEmail || order.customerUid || syncSuccess);
  // Family & Friends sharing is strictly for the Primary Customer once the order is claimed or has customer email
  const canManageSharing = Boolean(!isStaffMatch && isEmailProtectedOrClaimed && isCustomerOwnerMatch);
  const canEdit = Boolean(isCustomerOwnerMatch || isStaffMatch || collaboratorMatch?.role === "EDITOR");

  const signInRedirectUrl = `/sign-in?redirect=${encodeURIComponent(`/track/${rawIdentifier}`)}&autoSync=true`;
  const isCompleted = order.orderStatus === "COMPLETED";

  // =========================================================================
  // 1. LOCKED STATE: Show Email Auth (No PIN) OR PIN Auth (If no customer email)
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-surface-app text-text-primary flex flex-col">
        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center p-4 py-12">
          <div className="w-full max-w-lg space-y-6">
            <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-10 shadow-sm text-center space-y-6">
              <div>
                <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-2 ${
                  hasCustomerEmail ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-brand-blue-primary"
                }`}>
                  {hasCustomerEmail ? "Email Protected Order" : "PIN Protected Order"}
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary">
                  Order Access Verification
                </h1>
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  Order Number: <span className="font-mono font-bold text-text-primary">{order.orderNumber}</span>
                </p>
              </div>

              {/* CASE 1: CUSTOMER EMAIL PROVIDED -> STRICT EMAIL AUTH (NO PIN EVER ASKED) */}
              {hasCustomerEmail ? (
                <div className="space-y-4 rounded-2xl bg-emerald-50/60 p-5 border border-emerald-200 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 block">Registered Customer Email</span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                      Protected Access
                    </span>
                  </div>
                  <span className="font-mono text-sm font-extrabold text-emerald-800 block mt-0.5">
                    {order.customerEmail}
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    This order is protected with email authentication. Only the registered customer (<strong className="text-text-primary">{order.customerEmail}</strong>) or invited family and friends can access this portal.
                  </p>

                  {currentUser ? (
                    <div className="space-y-3 pt-2 border-t border-emerald-200">
                      <p className="text-xs text-text-secondary">
                        Signed in as <strong className="text-text-primary">{currentUser.email}</strong>.
                      </p>
                      <div className="rounded-xl border border-red-200 bg-white p-3 space-y-2">
                        <p className="text-xs font-semibold text-status-error">
                          Your account ({currentUser.email}) does not match the registered customer email ({order.customerEmail}) and has not been added to the family &amp; friends access list.
                        </p>
                        <p className="text-[11px] text-text-tertiary">
                          Please sign in with <strong className="text-text-primary">{order.customerEmail}</strong> or request the customer to invite your email.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSwitchAccount}
                        className="w-full rounded-xl border border-border-default bg-white py-2.5 text-xs font-bold text-text-primary hover:bg-slate-50 transition shadow-xs"
                      >
                        Switch Google Account
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <Link
                        href={signInRedirectUrl}
                        className="block w-full text-center rounded-xl bg-brand-blue-primary py-3 text-xs font-bold text-white hover:bg-sky-600 transition shadow-xs"
                      >
                        Sign In with Google to Access Order →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                /* CASE 2: NO CUSTOMER EMAIL PROVIDED -> 6-DIGIT PIN AUTH */
                <div className="space-y-4 text-left rounded-2xl bg-surface-app/70 p-5 border border-border-default">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary block">
                      6-Digit Access PIN
                    </label>
                    <span className="text-[10px] font-semibold text-text-tertiary">
                      PIN Verification
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Enter the 6-digit access PIN provided by <strong className="text-text-primary">{order.studioName}</strong> to unlock order status and milestones.
                  </p>

                  <form onSubmit={handleVerifyPasskey} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        maxLength={6}
                        value={enteredPasskey}
                        onChange={(e) => {
                          setEnteredPasskey(e.target.value.replace(/\D/g, "").slice(0, 6));
                          if (passkeyError) setPasskeyError(null);
                        }}
                        placeholder="Enter 6-digit PIN"
                        className="w-full rounded-2xl border border-border-default bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-text-primary outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft transition"
                      />
                      {passkeyError && (
                        <p className="mt-2 text-xs font-semibold text-status-error">{passkeyError}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-brand-blue-primary py-3.5 text-xs font-bold text-white hover:bg-sky-600 transition shadow-xs"
                    >
                      Unlock Order Details
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
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

  // =========================================================================
  // 2. UNLOCKED STATE: Full tracking, permissions & photo selection/review
  // =========================================================================
  return (
    <div className="min-h-screen bg-surface-app text-text-primary flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col p-4 py-12">
        <div className="mx-auto w-full max-w-4xl space-y-6">

          {/* Archived / Inactive Studio Banner for Headless Orders */}
          {(order.isHeadless || order.studioStatus === "INACTIVE" || order.studioStatus === "DELETED") && (
            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-900 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 px-2.5 items-center justify-center rounded-xl bg-slate-200 text-slate-800 font-extrabold shrink-0 text-[10px] uppercase tracking-wider">
                  Archived Record
                </span>
                <div>
                  <p className="font-bold">
                    Studio Inactive &bull; Historical Order Record Preserved
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    The photography studio associated with this booking is no longer actively operating on FocoMan. You can still view the order summary and milestones shown below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Studio Staff Recognition Banner: Only for Studio Owner / Crew */}
          {isStaffMatch && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-purple-950 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 px-2 items-center justify-center rounded-xl bg-purple-200 text-purple-900 font-extrabold shrink-0 text-[10px] uppercase tracking-wider">
                  Staff
                </span>
                <div>
                  <p className="font-bold">
                    Studio Access: {isOwnerMatch ? "Studio Owner" : "Crew Member"} ({currentUser?.email})
                  </p>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    Viewing live customer-facing tracking portal for this order. Passkey is bypassed automatically.
                  </p>
                </div>
              </div>
              {order.studioId && !order.isHeadless && order.studioStatus !== "INACTIVE" && (
                <Link
                  href={`/${order.studioId}/dashboard/oms`}
                  className="rounded-xl border border-purple-300 bg-white px-3.5 py-1.5 text-xs font-bold text-purple-900 hover:bg-purple-100 transition shrink-0 shadow-xs"
                >
                  Open in Studio OMS →
                </Link>
              )}
            </div>
          )}

          {/* BANNER 1: Security Notice for PIN-Only Unclaimed Orders (NEVER shown to studio staff) */}
          {!isStaffMatch && !hasCustomerEmail && !order.customerUid && !syncSuccess && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4.5 sm:p-5 text-amber-950 space-y-3">
              <div className="flex items-start gap-3">
                <div className="space-y-1">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                    Important Security Notice: Claim Your Order Before Sharing
                  </h3>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    This order is currently protected only by a PIN. Before sharing this link with family or friends, <strong>please claim and sync this order with your Google Account</strong>. Once claimed, you can use secure Email Authentication to invite friends with <strong>Can View</strong> or <strong>Can Edit</strong> permissions.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    <em>Notice: If you share this link &amp; PIN without claiming, anyone with the code can view it, and neither the studio nor Focoman can be responsible for unauthorized access. If you prefer not to sign in, keep the link and PIN strictly private.</em>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-amber-200/80">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={handleSyncToAccount}
                    disabled={isSyncing}
                    className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 transition disabled:opacity-50"
                  >
                    {isSyncing ? "Claiming..." : `Claim Order to ${currentUser.email}`}
                  </button>
                ) : (
                  <Link
                    href={signInRedirectUrl}
                    className="rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 transition"
                  >
                    Sign In with Google to Claim &amp; Protect Order →
                  </Link>
                )}
                {syncError && <span className="text-xs font-semibold text-status-error">{syncError}</span>}
              </div>
            </div>
          )}

          {/* BANNER 2: Claim Success Notice */}
          {syncSuccess && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
              Order successfully claimed and synced to your account ({currentUser?.email}). This order is now protected with email authentication. You can now invite family and friends with Can View or Can Edit permissions below.
            </div>
          )}

          {/* BANNER 3: Current User Role Identity Ribbon (Only for customers and collaborators, not duplicate for staff) */}
          {!isStaffMatch && (
            <div className="rounded-2xl border border-border-default bg-white p-3.5 px-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  isCustomerOwnerMatch ? "bg-emerald-100 text-emerald-800" :
                  canEdit ? "bg-blue-100 text-brand-blue-primary" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  {isCustomerOwnerMatch ? "OWN" : canEdit ? "EDT" : "GST"}
                </span>
                <div>
                  <p className="font-bold text-text-primary">
                    {isCustomerOwnerMatch ? `Primary Customer Account (${currentUser?.email})` :
                     collaboratorMatch ? `Family & Friends Access: ${collaboratorMatch.role === "EDITOR" ? "Can Edit" : "Can View Only"} (${currentUser?.email})` :
                     "Viewing as Guest (PIN Session)"}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    You can view order progress here. Photo selection and reviews are not available yet.
                  </p>
                </div>
              </div>

              {canManageSharing && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(!showShareModal)}
                  className="rounded-xl border border-brand-blue-primary bg-brand-blue-background/60 px-3.5 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-brand-blue-primary hover:text-white transition shrink-0"
                >
                  {showShareModal ? "Hide Sharing Options" : "Share with Family & Friends"}
                </button>
              )}
            </div>
          )}

          {/* SHARING PANEL: ONLY available when order is claimed/email-associated AND user is Primary Customer, toggled via button */}
          {canManageSharing && showShareModal && (
            <div className="rounded-3xl border border-brand-blue-soft bg-white p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-border-divider pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 px-2 items-center justify-center rounded-xl bg-brand-blue-primary text-white text-[10px] font-bold uppercase tracking-wider">
                    Share
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-text-primary">
                      Family &amp; Friends Access Permissions
                    </h2>
                    <p className="text-xs text-text-secondary">
                      Share access to this order. These roles do not change access to files in Google Drive.
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Collaborator Form */}
              <form onSubmit={handleAddCollaborator} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="email"
                  required
                  placeholder="Enter family member's email (e.g. spouse@gmail.com)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "VIEWER" | "EDITOR")}
                  className="rounded-xl border border-border-default px-3 py-2 text-xs font-bold text-text-primary bg-white focus:border-brand-blue-primary"
                >
                  <option value="VIEWER">Can View</option>
                  <option value="EDITOR">Can Edit</option>
                </select>
                <button
                  type="submit"
                  disabled={isUpdatingCollaborators}
                  className="rounded-xl bg-brand-blue-primary px-4 py-2 text-xs font-bold text-white hover:bg-sky-600 transition shrink-0 disabled:opacity-50"
                >
                  {isUpdatingCollaborators ? "Saving..." : "+ Grant Access"}
                </button>
              </form>

              {collaboratorSuccess && (
                <p className="text-xs font-bold text-status-success animate-fade-in">✓ {collaboratorSuccess}</p>
              )}
              {collaboratorError && (
                <p className="text-xs font-semibold text-status-error animate-fade-in">{collaboratorError}</p>
              )}

              {/* Current Collaborators List */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
                  People with access:
                </span>
                <div className="divide-y divide-border-default rounded-2xl border border-border-default bg-surface-app/40 overflow-hidden text-xs">
                  {/* Primary Owner Row */}
                  <div className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <span className="font-bold text-text-primary">{order.customerEmail || currentUser?.email || order.customerName}</span>
                      <span className="text-[10px] text-text-tertiary block">Primary Customer</span>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                      Owner
                    </span>
                  </div>

                  {/* Collaborators */}
                  {collaborators.map((c) => (
                    <div key={c.email} className="p-3 flex items-center justify-between bg-white">
                      <div>
                        <span className="font-semibold text-text-primary">{c.email}</span>
                        <span className="text-[10px] text-text-tertiary block">Added {c.addedAt ? c.addedAt.split("T")[0] : ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          c.role === "EDITOR" ? "bg-blue-100 text-brand-blue-primary" : "bg-slate-100 text-slate-700"
                        }`}>
                          {c.role === "EDITOR" ? "Can Edit" : "Can View"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollaborator(c.email)}
                          disabled={isUpdatingCollaborators}
                          className="text-text-tertiary hover:text-status-error text-xs font-bold px-2 py-1 transition"
                          title="Remove access"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {collaborators.length === 0 && (
                    <div className="p-3 text-center text-xs text-text-tertiary italic">
                      No family or friends added yet. Enter an email above to share access.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Order Details Header Card */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-divider pb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
                  Order Tracking
                </span>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
                  {order.eventType}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  Order Number: <span className="font-semibold text-text-primary">{order.orderNumber}</span>
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-xs ${
                  isCompleted ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : 
                  order.orderStatus === "POST_EVENT_IN_PROGRESS" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                  "bg-sky-100 text-sky-800 border border-sky-300"
                }`}>
                  {STATUS_LABELS[order.orderStatus]}
                </div>
              </div>
            </div>

            {/* Event Details Grid */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Customer</span>
                <p className="mt-1 text-sm font-semibold text-text-primary">{order.customerName}</p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Date</span>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {order.eventDate || "—"}
                  {order.orderStatus === "AWAITING_EVENT" && (() => {
                    const d = getEventDaysRemaining(order.eventDate);
                    return d && d.diffDays > 0 ? ` (${d.label})` : "";
                  })()}
                </p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Location</span>
                <p className="mt-1 text-sm font-semibold text-text-primary truncate">
                  {order.eventLocation || "Studio Venue"}
                </p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Services</span>
                <p className="mt-1 text-sm font-semibold text-text-primary leading-relaxed">
                  {order.services.join(", ")}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-text-primary mb-4">Payment Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-surface-app p-4 border border-border-default">
                <span className="text-xs text-text-tertiary block">Total Value</span>
                <span className="text-lg font-extrabold text-text-primary mt-1 block">
                  ₹{Math.round(order.totalAmount).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="rounded-2xl bg-emerald-50/60 p-4 border border-emerald-200">
                <span className="text-xs text-emerald-800 block">Advance Paid</span>
                <span className="text-lg font-extrabold text-emerald-900 mt-1 block">
                  ₹{Math.round(order.advanceAmount).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="rounded-2xl bg-surface-app p-4 border border-border-default">
                <span className="text-xs text-text-tertiary block">Remaining Balance</span>
                <span className="text-lg font-extrabold text-text-primary mt-1 block">
                  ₹{Math.round(order.remainingAmount).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* No authorized deliverable source is connected to this portal yet. */}
          <section aria-labelledby="media-availability-title" className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8">
            <h2 id="media-availability-title" className="text-lg font-bold text-text-primary">Photos &amp; Deliverables</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Media previews are not available in this tracking portal yet. Please contact your studio for photos, videos, and album files.
            </p>
          </section>

          {/* Order Lifecycle Pipeline — Unified Vertical Workflow */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-divider">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Order Lifecycle Pipeline</h2>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Live end-to-end vertical workflow tracking pre-event preparation, shoot execution, and post-event milestones
                </p>
              </div>
              <div className="self-start sm:self-center">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  order.orderStatus === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : order.orderStatus === "POST_EVENT_IN_PROGRESS"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : order.orderStatus === "CANCELLED"
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}>
                  {STATUS_LABELS[order.orderStatus]}
                </span>
              </div>
            </div>

            <OrderVerticalWorkflow
              order={order}
              tasks={tasks}
              variant="tracking"
            />
          </div>
        </div>
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
