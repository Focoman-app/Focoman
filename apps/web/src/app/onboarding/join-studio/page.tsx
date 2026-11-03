"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import { FocomanLoadingState, FocomanSpinner } from "@/components/FocomanSpinner";
import { subscribeToAuthState, signInWithGoogle, getCurrentUserIdToken } from "@/lib/firebaseAuth";
import { acceptInvitationAction, getInvitationClaimStatusAction } from "@/actions/memberActions";
import { User } from "firebase/auth";

function JoinStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || searchParams.get("token") || "";

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inviteCode, setInviteCode] = useState(initialCode.toUpperCase());
  const [claimCode, setClaimCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [claimStatus, setClaimStatus] = useState<{
    status: "PENDING" | "CLAIMED_BY_YOU" | "CLAIMED" | "REVOKED" | "LOCKED" | "UNAVAILABLE" | "EMAIL_MISMATCH" | "NOT_FOUND" | "CHECKING" | "OWNER_VIEW";
    studioId?: string;
    studioName?: string;
    requiresPasscode?: boolean;
    inviteeName?: string;
    inviteeEmail?: string;
    invitationStatus?: "PENDING" | "ACCEPTED" | "REVOKED";
    acceptedAt?: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success" | "info"; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentUser || !inviteCode.trim()) {
      setClaimStatus(null);
      return;
    }

    setClaimStatus({ status: "CHECKING" });
    void (async () => {
      try {
        const idToken = await getCurrentUserIdToken(true);
        if (!idToken) return;
        const result = await getInvitationClaimStatusAction(inviteCode, idToken);
        if (!active) return;
        setClaimStatus(result);
        if (result.status === "CLAIMED_BY_YOU" && result.studioId) {
          router.replace(`/${result.studioId}/dashboard`);
        }
      } catch (error: unknown) {
        if (active) {
          setClaimStatus(null);
          setFeedback({
            type: "error",
            message: error instanceof Error ? error.message : "Could not check invitation status.",
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser, inviteCode, router]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setFeedback(null);
    try {
      await signInWithGoogle();
      // Auth state listener above sets currentUser after popup completes
    } catch (err: any) {
      console.error("Sign-in error:", err);
      setIsSigningIn(false);
      if (!err.code?.includes("popup-closed-by-user") && !err.code?.includes("cancelled-popup-request")) {
        setFeedback({
          type: "error",
          message: err.message || "Failed to sign in with Google.",
        });
      }
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentUser) {
      setFeedback({
        type: "error",
        message: "Please sign in with your Google account first to link your membership.",
      });
      return;
    }

    if (!inviteCode || inviteCode.trim().length < 5) {
      setFeedback({
        type: "error",
        message: "Please enter a valid invitation code.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await getCurrentUserIdToken(true);
      if (!idToken) {
        throw new Error("Unable to retrieve authentication credentials. Please re-sign in.");
      }

      const res = await acceptInvitationAction({
        inviteCode: inviteCode.trim(),
        claimCode: claimCode || undefined,
        linkToken: searchParams.get("token") || undefined,
        idToken,
      });

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to activate studio invitation.",
        });
        setClaimStatus(await getInvitationClaimStatusAction(inviteCode, idToken));
        return;
      }

      setFeedback({
        type: "success",
        message: `Welcome aboard! You have joined "${res.studioName || res.studioId}". Redirecting to your dashboard...`,
      });

      router.replace(`/${res.studioId}/dashboard`);
    } catch (err: any) {
      console.error("[JoinStudioPage] Error:", err);
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred while verifying the invitation.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-10">
      <div className="border-b border-border-divider pb-6">
        <span className="inline-block rounded-full bg-brand-purple-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-purple-primary">
          Crew Member Onboarding
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          Join an Existing Studio
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Enter the single-use invitation code provided by your studio owner. Your Google account will be linked to that studio workspace.
        </p>
      </div>

      {feedback && (
        <div
          className={`mt-6 rounded-xl border p-4 text-xs font-medium ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-600"
              : feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-brand-purple-light bg-brand-purple-background text-brand-purple-primary"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── OWNER VIEW ── */}
      {claimStatus?.status === "OWNER_VIEW" && (
        <div role="status" className="mt-6 rounded-xl border border-brand-purple-light bg-brand-purple-background p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full bg-brand-purple-primary/10 p-1.5">
              <svg className="h-4 w-4 text-brand-purple-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="text-sm font-bold text-brand-purple-primary">This is your studio&apos;s invitation link</span>
          </div>
          <div className="rounded-lg bg-white/70 border border-brand-purple-light px-4 py-3 space-y-1.5 text-xs">
            {claimStatus.inviteeName && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary font-medium">Invited</span>
                <span className="font-bold text-text-primary">{claimStatus.inviteeName}</span>
              </div>
            )}
            {claimStatus.inviteeEmail && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary font-medium">Email</span>
                <span className="font-mono text-text-primary">{claimStatus.inviteeEmail}</span>
              </div>
            )}
            {!claimStatus.inviteeEmail && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary font-medium">Type</span>
                <span className="text-text-primary">Passcode-protected link</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-brand-purple-light">
              <span className="text-text-secondary font-medium">Status</span>
              {claimStatus.invitationStatus === "ACCEPTED" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  ✓ Accepted{claimStatus.acceptedAt ? ` · ${new Date(claimStatus.acceptedAt).toLocaleDateString()}` : ""}
                </span>
              ) : claimStatus.invitationStatus === "REVOKED" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Revoked</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Awaiting acceptance</span>
              )}
            </div>
          </div>
          <p className="text-xs text-text-secondary">You are viewing this as the studio owner. Share this link with the invitee to let them join.</p>
        </div>
      )}

      {/* ── CLAIMED (by someone else) ── */}
      {claimStatus?.status === "CLAIMED" && (
        <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span className="font-bold">Invitation used.</span> This invitation has already been accepted and is no longer available.
        </div>
      )}
      {claimStatus?.status === "REVOKED" && (
        <div role="status" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This invitation was revoked by the studio owner and can no longer be used.
        </div>
      )}
      {claimStatus?.status === "LOCKED" && (
        <div role="status" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          This invitation is locked after too many incorrect passcode attempts. Contact the studio owner to get a new invite.
        </div>
      )}
      {claimStatus?.status === "NOT_FOUND" && (
        <div role="status" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="font-bold">Invalid or expired link.</span> This invitation code does not exist or has been removed.
        </div>
      )}
      {claimStatus?.status === "EMAIL_MISMATCH" && (
        <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This invitation was sent to a specific email address. Please sign in with the correct Google account that was invited by the studio owner.
        </div>
      )}
      {claimStatus?.status === "UNAVAILABLE" && (
        <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This invitation is no longer available. Please ask the studio owner to create a new invitation for you.
        </div>
      )}

      {!currentUser && (
        <div className="mt-6 rounded-2xl border border-dashed border-border-default bg-surface-app p-5 text-center">
          <p className="text-xs text-text-secondary">
            You must authenticate with your personal Google account to link your crew membership.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-text-primary shadow-xs border border-border-default hover:bg-slate-50 transition"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {isSigningIn ? "Signing in..." : "Sign in with Google"}
          </button>
        </div>
      )}

      {currentUser && claimStatus?.status !== "OWNER_VIEW" && claimStatus?.status !== "CLAIMED" && claimStatus?.status !== "REVOKED" && claimStatus?.status !== "LOCKED" && claimStatus?.status !== "UNAVAILABLE" && claimStatus?.status !== "EMAIL_MISMATCH" && claimStatus?.status !== "NOT_FOUND" && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-text-secondary border border-border-default">
          <div className="flex flex-col">
            <span>
              Signed in as: <strong className="text-text-primary">{currentUser.email}</strong>
            </span>
            <button 
              type="button" 
              onClick={handleGoogleSignIn}
              className="mt-1 text-left text-[10px] font-semibold text-brand-purple-primary hover:underline"
            >
              Switch Account
            </button>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Authenticated
          </span>
        </div>
      )}

      {claimStatus?.status !== "OWNER_VIEW" && claimStatus?.status !== "CLAIMED" && claimStatus?.status !== "REVOKED" && claimStatus?.status !== "LOCKED" && claimStatus?.status !== "UNAVAILABLE" && claimStatus?.status !== "EMAIL_MISMATCH" && claimStatus?.status !== "NOT_FOUND" && (
      <form onSubmit={handleVerify} className="mt-6 space-y-5" suppressHydrationWarning>
        <div>
          <label htmlFor="invite-code" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
            Invitation Code *
          </label>
          <input
            id="invite-code"
            type="text"
            required
            placeholder="e.g. INV-FOC-RAH-1234"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="mt-1.5 w-full rounded-xl border border-border-default px-4 py-2.5 font-mono text-sm uppercase outline-none focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
          />
          <p className="mt-1.5 text-xs text-text-tertiary">
            Your studio owner shared this single-use invitation link with you.
          </p>
        </div>

        {claimStatus?.status === "PENDING" && claimStatus.requiresPasscode && (
          <div>
            <label htmlFor="claim-passcode" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
              Six-digit passcode *
            </label>
            <input
              id="claim-passcode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1.5 w-full rounded-xl border border-border-default px-4 py-2.5 font-mono text-sm outline-none focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
            />
          </div>
        )}

        <div className="pt-4 flex items-center justify-between border-t border-border-divider">
          <Link href="/workspaces" className="text-xs font-semibold text-text-secondary hover:text-text-primary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !currentUser || claimStatus?.status === "CHECKING" || (claimStatus?.status === "PENDING" && claimStatus.requiresPasscode && claimCode.length !== 6)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-purple-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <FocomanSpinner size="xs" />
                <span>Joining Studio...</span>
              </>
            ) : claimStatus?.status === "CHECKING" ? (
              <>
                <FocomanSpinner size="xs" />
                <span>Checking invitation...</span>
              </>
            ) : (
              "Verify & Join Studio"
            )}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}

export default function JoinStudioPage() {
  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton fallbackHref="/workspaces" />
        </div>
        <Suspense fallback={<FocomanLoadingState status="Loading invitation..." showCard={false} minHeight="min-h-[250px]" />}>
          <JoinStudioContent />
        </Suspense>
      </main>
    </div>
  );
}

