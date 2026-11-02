"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  signInWithGoogle,
  signInWithGooglePopup,
  handleRedirectAuth,
  subscribeToAuthState,
  syncServerSession,
} from "@/lib/firebaseAuth";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const autoSync = searchParams.get("autoSync");

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showTroubleOptions, setShowTroubleOptions] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Check if returning from a Google OAuth redirect
    handleRedirectAuth()
      .then(async (credential) => {
        const hadPendingRedirect =
          typeof window !== "undefined" &&
          sessionStorage.getItem("focoman_auth_redirect_pending") === "true";
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("focoman_auth_redirect_pending");
        }

        if (credential?.user && isMounted) {
          const savedTarget =
            typeof window !== "undefined"
              ? sessionStorage.getItem("focoman_auth_redirect")
              : null;
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("focoman_auth_redirect");
          }

          const effectiveTarget = redirectUrl || savedTarget || "/dashboard";
          const finalUrl = autoSync
            ? `${effectiveTarget}${effectiveTarget.includes("?") ? "&" : "?"}autoSync=true`
            : effectiveTarget;

          window.location.href = finalUrl;
        } else if (hadPendingRedirect && !credential?.user && isMounted) {
          setAuthError("Sign-in completed without session credentials. Please try signing in again.");
          setIsSigningIn(false);
        }
      })
      .catch((err) => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("focoman_auth_redirect_pending");
        }
        if (isMounted) {
          const msg = err instanceof Error ? err.message : String(err);
          setAuthError(msg || "Failed to process Google sign-in.");
          setIsSigningIn(false);
        }
      });

    // Listen to active auth state
    const unsubscribe = subscribeToAuthState(async (user) => {
      if (user && isMounted) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("focoman_auth_redirect_pending");
        }
        await syncServerSession();
        const savedTarget =
          typeof window !== "undefined"
            ? sessionStorage.getItem("focoman_auth_redirect")
            : null;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("focoman_auth_redirect");
        }

        const effectiveTarget = redirectUrl || savedTarget || "/dashboard";
        const finalUrl = autoSync
          ? `${effectiveTarget}${effectiveTarget.includes("?") ? "&" : "?"}autoSync=true`
          : effectiveTarget;

        window.location.href = finalUrl;
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router, redirectUrl, autoSync]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setAuthError(null);

      if (typeof window !== "undefined") {
        if (redirectUrl) sessionStorage.setItem("focoman_auth_redirect", redirectUrl);
        sessionStorage.setItem("focoman_auth_redirect_pending", "true");
      }

      const res = await signInWithGoogle();
      if (res && "user" in res && res.user) {
        if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect_pending");
        const savedTarget =
          typeof window !== "undefined"
            ? sessionStorage.getItem("focoman_auth_redirect")
            : null;
        if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect");

        const effectiveTarget = redirectUrl || savedTarget || "/dashboard";
        const finalUrl = autoSync
          ? `${effectiveTarget}${effectiveTarget.includes("?") ? "&" : "?"}autoSync=true`
          : effectiveTarget;

        window.location.href = finalUrl;
      }
    } catch (err: unknown) {
      if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect_pending");
      setIsSigningIn(false);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("auth/unauthorized-domain")) {
        const domain = typeof window !== "undefined" ? window.location.hostname : "current domain";
        setAuthError(`Domain "${domain}" is not authorized in Firebase settings.`);
      } else if (
        !errorMessage.includes("auth/popup-closed-by-user") &&
        !errorMessage.includes("auth/cancelled-popup-request")
      ) {
        setAuthError(errorMessage || "Sign-in request could not be completed.");
      }
    }
  };

  const handleGoogleAlternateSignIn = async () => {
    try {
      setIsSigningIn(true);
      setAuthError(null);
      const res = await signInWithGooglePopup();
      if (res?.user) {
        if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect_pending");
        const savedTarget =
          typeof window !== "undefined"
            ? sessionStorage.getItem("focoman_auth_redirect")
            : null;
        if (typeof window !== "undefined") sessionStorage.removeItem("focoman_auth_redirect");

        const effectiveTarget = redirectUrl || savedTarget || "/dashboard";
        const finalUrl = autoSync
          ? `${effectiveTarget}${effectiveTarget.includes("?") ? "&" : "?"}autoSync=true`
          : effectiveTarget;

        window.location.href = finalUrl;
      }
    } catch (err: unknown) {
      setIsSigningIn(false);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        !errorMessage.includes("auth/popup-closed-by-user") &&
        !errorMessage.includes("auth/cancelled-popup-request")
      ) {
        setAuthError(errorMessage || "Sign-in request failed. Please try again.");
      }
    }
  };

  return (
    <div className="w-full max-w-lg rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
      <div className="text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
          {redirectUrl ? "Order Association" : "Operational Access"}
        </span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          {redirectUrl ? "Sign In to Your Account" : "Studio Workspace Access"}
        </h1>
        <p className="mx-auto mt-2 text-sm text-text-secondary">
          {redirectUrl
            ? "Sign in with Google to link this order and view real-time deliverables."
            : "Sign in to access your studio operations and team dashboard."}
        </p>
      </div>

      <div className="mx-auto mt-8">
        <div className="rounded-2xl border border-border-default bg-gray-50/50 p-6 sm:p-8 text-center">
          <h2 className="text-lg font-bold text-text-primary">
            Sign In to Focoman
          </h2>

          {/* Account deleted notice */}
          {searchParams.get("deleted") === "true" && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 text-left">
              Your user account and personal session have been successfully deleted.
            </div>
          )}

          {/* Conditional rendering: If there is an auth error, hide standard sign-in & trouble options, showing only Alternate method card */}
          {authError ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-xs text-left space-y-3.5 shadow-xs animate-in fade-in">
              <div className="space-y-1">
                <p className="font-bold text-sm text-amber-950">Sign in failed</p>
                <p className="text-amber-800 leading-relaxed font-medium">{authError}</p>
              </div>

              <div className="pt-2 border-t border-amber-200/80">
                <button
                  type="button"
                  onClick={handleGoogleAlternateSignIn}
                  disabled={isSigningIn}
                  className="w-full rounded-xl bg-text-primary text-white font-bold py-3 px-4 text-xs shadow-sm hover:bg-black active:translate-y-[1px] transition text-center cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSigningIn ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Opening Alternate Window...</span>
                    </>
                  ) : (
                    <span>Try alternate method</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-3.5">
              {/* Primary Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="inline-flex w-full justify-center items-center gap-3 rounded-xl border border-border-default bg-white px-6 py-3 text-sm font-bold text-text-primary shadow-xs transition hover:bg-gray-50 hover:shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isSigningIn ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-purple-primary border-t-transparent" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Trouble signing in toggle option (Hidden initially, shown only if user clicks) */}
              {!showTroubleOptions ? (
                <button
                  type="button"
                  onClick={() => setShowTroubleOptions(true)}
                  className="text-[11px] font-medium text-text-tertiary hover:text-text-secondary transition cursor-pointer mt-1"
                >
                  Having trouble signing in?
                </button>
              ) : (
                <div className="w-full mt-1 p-3 bg-white border border-border-default rounded-xl space-y-2 text-center animate-in fade-in">
                  <p className="text-[11px] text-text-secondary">If same-tab redirection is restricted in your browser:</p>
                  <button
                    type="button"
                    onClick={handleGoogleAlternateSignIn}
                    disabled={isSigningIn}
                    className="w-full rounded-lg bg-text-primary text-white font-bold py-2 px-3 text-xs shadow-xs hover:bg-black transition text-center cursor-pointer"
                  >
                    Try alternate method
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] sm:text-xs text-text-tertiary max-w-xs mx-auto mt-6">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-text-primary transition">
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-text-primary transition">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface-app text-text-primary selection:bg-brand-blue-soft flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-4 py-12">
        <div className="w-full max-w-lg mb-6 self-start md:self-auto md:w-full">
          <BackButton fallbackHref="/" />
        </div>
        <Suspense
          fallback={
            <div className="w-full max-w-lg rounded-3xl border border-border-default bg-white p-8 text-center text-sm text-text-secondary">
              Loading authentication portal...
            </div>
          }
        >
          <SignInContent />
        </Suspense>
      </main>
    </div>
  );
}
