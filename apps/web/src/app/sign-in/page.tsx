"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAdditionalUserInfo, type User, type UserCredential } from "firebase/auth";
import { clearLegalConsentAuthState, handleRedirectAuth, hasPendingLegalConsent, markLegalConsentAuthCandidate, markLegalConsentPending, signInWithGoogle, signInWithGooglePopup, subscribeToAuthState, syncServerSession } from "@/lib/firebaseAuth";
import { recordNewUserLegalConsentAction } from "@/actions/legalConsentActions";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import { FocomanSpinner } from "@/components/FocomanSpinner";
import { LegalDocumentContent, type LegalDocumentKind } from "@/components/legal/LegalDocumentContent";

function LegalDocument({ kind, onRead }: { kind: LegalDocumentKind; onRead: () => void }) {
  const terms = kind === "terms";
  return <details open className="rounded-xl border border-border-default bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-bold text-text-primary">{terms ? "Terms and Conditions" : "Privacy Policy"}</summary><div className="max-h-56 overflow-y-auto border-t border-border-divider px-4 py-3 text-xs leading-5 text-text-secondary" onScroll={(event) => { const node = event.currentTarget; if (node.scrollTop + node.clientHeight >= node.scrollHeight - 4) onRead(); }}>
    <div className="space-y-3 [&_h2]:font-bold [&_h2]:text-text-primary [&_p]:mt-2"><LegalDocumentContent kind={kind} /></div>
  </div></details>;
}

function SignInContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const autoSync = searchParams.get("autoSync");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTroubleOptions, setShowTroubleOptions] = useState(false);
  const [pendingConsent, setPendingConsent] = useState<User | null>(null);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);
  const interactiveAttempt = useRef(false);
  const consentPending = useRef(typeof window !== "undefined" && hasPendingLegalConsent());

  const getTarget = useCallback(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem("focoman_auth_redirect") : null;
    const target = redirectUrl || saved || "/dashboard";
    return autoSync ? `${target}${target.includes("?") ? "&" : "?"}autoSync=true` : target;
  }, [autoSync, redirectUrl]);
  const continueToTarget = useCallback(() => {
    if (typeof window !== "undefined") {
      const target = getTarget();
      sessionStorage.removeItem("focoman_auth_redirect");
      sessionStorage.removeItem("focoman_auth_redirect_pending");
      window.location.href = target;
    }
  }, [getTarget]);
  const handleCredential = useCallback(async (credential: UserCredential) => {
    if (getAdditionalUserInfo(credential)?.isNewUser) {
      consentPending.current = true;
      markLegalConsentPending();
      setPendingConsent(credential.user);
      setIsSigningIn(false);
      return;
    }
    clearLegalConsentAuthState();
    await syncServerSession(true);
    continueToTarget();
  }, [continueToTarget]);

  useEffect(() => {
    let mounted = true;
    let redirectResolved = false;
    let redirectCredentialHandled = false;
    let observedUser: User | null = null;
    const unsubscribe = subscribeToAuthState(async (user) => {
      observedUser = user;
      if (user && hasPendingLegalConsent()) {
        consentPending.current = true;
        setPendingConsent(user);
        setIsSigningIn(false);
        return;
      }
      if (!user || !mounted || !redirectResolved || redirectCredentialHandled || interactiveAttempt.current || consentPending.current) return;
      await syncServerSession();
      if (mounted) continueToTarget();
    });
    handleRedirectAuth().then(async (credential) => {
      redirectResolved = true;
      if (!mounted) return;
      if (credential?.user) {
        redirectCredentialHandled = true;
        await handleCredential(credential);
      } else if (typeof window !== "undefined" && sessionStorage.getItem("focoman_auth_redirect_pending") === "true") {
        sessionStorage.removeItem("focoman_auth_redirect_pending");
        clearLegalConsentAuthState();
        setAuthError("Sign-in completed without session credentials. Please try signing in again.");
        setIsSigningIn(false);
      } else if (observedUser && !interactiveAttempt.current && !consentPending.current) {
        await syncServerSession();
        if (mounted) continueToTarget();
      }
    }).catch((error) => {
      if (!mounted) return;
      if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect_pending");
      setAuthError(error instanceof Error ? error.message : "Failed to process Google sign-in.");
      setIsSigningIn(false);
    });
    return () => { mounted = false; unsubscribe(); };
  }, [continueToTarget, handleCredential]);

  const startGoogleSignIn = async (alternate = false) => {
    try {
      interactiveAttempt.current = true;
      setIsSigningIn(true);
      setAuthError(null);
      markLegalConsentAuthCandidate();
      if (typeof window !== "undefined") {
        if (redirectUrl) sessionStorage.setItem("focoman_auth_redirect", redirectUrl);
        sessionStorage.setItem("focoman_auth_redirect_pending", "true");
      }
      const credential = alternate ? await signInWithGooglePopup() : await signInWithGoogle();
      if (credential?.user) await handleCredential(credential);
    } catch (error) {
      if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect_pending");
      clearLegalConsentAuthState();
      const message = error instanceof Error ? error.message : "Sign-in request could not be completed.";
      if (!message.includes("auth/popup-closed-by-user") && !message.includes("auth/cancelled-popup-request")) setAuthError(message);
      setIsSigningIn(false);
      interactiveAttempt.current = false;
    }
  };
  const submitConsent = async () => {
    if (!pendingConsent || !termsRead || !privacyRead || !accepted) return;
    setSubmittingConsent(true);
    setAuthError(null);
    try {
      const result = await recordNewUserLegalConsentAction({ idToken: await pendingConsent.getIdToken(), termsRead, privacyRead, accepted });
      if (!result.success) throw new Error(result.error);
      consentPending.current = false;
      clearLegalConsentAuthState();
      await syncServerSession(true);
      continueToTarget();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to save legal consent.");
      setSubmittingConsent(false);
    }
  };

  if (pendingConsent) {
    const canAgree = termsRead && privacyRead;
    return <div className="w-full max-w-3xl rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8"><div className="text-center"><p className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">New account</p><h1 className="mt-2 text-2xl font-extrabold text-text-primary">Review before creating your account</h1><p className="mt-2 text-sm text-text-secondary">Read both documents to enable agreement and continue.</p></div><div className="mt-6 space-y-4"><LegalDocument kind="terms" onRead={() => setTermsRead(true)} /><LegalDocument kind="privacy" onRead={() => setPrivacyRead(true)} /></div><label className={`mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${canAgree ? "border-border-default bg-surface-app/50 cursor-pointer" : "border-border-divider bg-slate-50 text-text-tertiary cursor-not-allowed"}`}><input type="checkbox" disabled={!canAgree || submittingConsent} checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" /><span>I have read and agree to the Terms and Conditions and Privacy Policy.</span></label>{authError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{authError}</p>}<button type="button" disabled={!accepted || submittingConsent} onClick={() => void submitConsent()} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-blue-primary px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submittingConsent ? "Saving agreement..." : "Accept and continue"}</button></div>;
  }

  return <div className="w-full max-w-lg rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12"><div className="text-center"><span className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">{redirectUrl ? "Order Association" : "Operational Access"}</span><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">{redirectUrl ? "Sign In to Your Account" : "Studio Workspace Access"}</h1><p className="mx-auto mt-2 text-sm text-text-secondary">{redirectUrl ? "Sign in with Google to link this order and view real-time deliverables." : "Sign in to access your studio operations and team dashboard."}</p></div><div className="mx-auto mt-8 rounded-2xl border border-border-default bg-gray-50/50 p-6 text-center sm:p-8"><h2 className="text-lg font-bold text-text-primary">Sign In to Focoman</h2>{searchParams.get("deleted") === "true" && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-left text-xs font-semibold text-emerald-800">Your account closure request was recorded and this session has been signed out. Sole-owner workspaces remain recoverable for 30 days.</div>}{authError ? <div className="mt-6 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-left text-xs"><p className="font-bold text-sm text-amber-950">Sign in failed</p><p className="text-amber-800">{authError}</p><button type="button" onClick={() => setAuthError(null)} className="w-full rounded-xl border border-amber-300 bg-white py-2.5 text-xs font-bold text-amber-900">Review sign-in options</button><button type="button" onClick={() => void startGoogleSignIn(true)} disabled={isSigningIn} className="w-full rounded-xl bg-text-primary px-4 py-3 text-xs font-bold text-white disabled:opacity-60">Try alternate method</button></div> : <div className="mt-6 flex flex-col items-center gap-3.5"><button type="button" onClick={() => void startGoogleSignIn()} disabled={isSigningIn} className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border-default bg-white px-6 py-3 text-sm font-bold text-text-primary shadow-xs disabled:opacity-60">{isSigningIn ? <><FocomanSpinner size="xs" /><span>Connecting to Google...</span></> : <span>Continue with Google</span>}</button>{!showTroubleOptions ? <button type="button" onClick={() => setShowTroubleOptions(true)} className="mt-1 text-[11px] font-medium text-text-tertiary">Having trouble signing in?</button> : <div className="w-full rounded-xl border border-border-default bg-white p-3"><p className="mb-2 text-[11px] text-text-secondary">If same-tab redirection is restricted in your browser:</p><button type="button" onClick={() => void startGoogleSignIn(true)} disabled={isSigningIn} className="w-full rounded-lg bg-text-primary py-2 text-xs font-bold text-white">Try alternate method</button></div>}</div>}<p className="mx-auto mt-6 max-w-xs text-[10px] text-text-tertiary">New accounts review and accept the Terms and Privacy Policy after Google sign-in.</p></div></div>;
}

export default function SignInPage() {
  return <div className="min-h-screen bg-surface-app text-text-primary selection:bg-brand-blue-soft flex flex-col"><Navbar /><main className="flex-1 flex flex-col items-center justify-center p-4 py-12"><div className="w-full max-w-3xl mb-6 self-start md:self-auto"><BackButton fallbackHref="/" /></div><Suspense fallback={<div className="w-full max-w-lg rounded-3xl border border-border-default bg-white p-8 text-center text-sm text-text-secondary">Loading authentication portal...</div>}><SignInContent /></Suspense></main></div>;
}
