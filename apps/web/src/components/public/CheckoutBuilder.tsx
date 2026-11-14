"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { StudioMembership } from "@focoman/types";
import { getUserWorkspacesAction, selectStudioPlanAction } from "@/actions/studioActions";
import { subscribeToAuthState } from "@/lib/firebaseAuth";
import type { User } from "firebase/auth";

type CheckoutPlanId = "FREE" | "STARTER" | "PROFESSIONAL";

type PlanOption = {
  id: CheckoutPlanId;
  name: string;
  price?: string;
  summary: string;
  features: readonly string[];
};

const PLAN_OPTIONS: readonly PlanOption[] = [
  {
    id: "FREE",
    name: "Free",
    summary: "Essential order management for confirmed studio orders.",
    features: [
      "Create, view, and edit confirmed orders",
      "Track each order through the production workflow",
      "Keep order progress visible in one workspace",
    ],
  },
  {
    id: "STARTER",
    name: "Starter",
    price: "₹999/month",
    summary: "Order management with client review, customer records, studio operations, and dashboard visibility.",
    features: [
      "Everything in Free",
      "Google Drive photo preview and client review",
      "Customer relationship management and studio operations",
      "Basic business dashboard for orders, revenue, and pending payments",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    price: "₹1,999/month",
    summary: "Starter tools with WhatsApp operations and advanced business reporting.",
    features: [
      "Everything in Starter",
      "WhatsApp notifications and studio operations bot",
      "Advanced business reports and analytics",
      "Excel report exports",
    ],
  },
];

function isCheckoutPlanId(value: string | null): value is CheckoutPlanId {
  return value === "FREE" || value === "STARTER" || value === "PROFESSIONAL";
}

function buildCheckoutUrl(studioId: string, plan: CheckoutPlanId) {
  const params = new URLSearchParams({ studio: studioId, plan: plan.toLowerCase() });
  return `/checkout?${params.toString()}`;
}

export function CheckoutBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studioParam = searchParams.get("studio") ?? "";
  const planParam = searchParams.get("plan")?.toUpperCase() ?? null;
  const [user, setUser] = useState<User | null>(null);
  const [ownerWorkspaces, setOwnerWorkspaces] = useState<StudioMembership[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId>(
    isCheckoutPlanId(planParam) ? planParam : "FREE"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setOwnerWorkspaces([]);
      setIsLoadingWorkspaces(false);
      return;
    }

    let cancelled = false;
    setIsLoadingWorkspaces(true);
    setWorkspaceError(null);

    void (async () => {
      try {
        const idToken = await user.getIdToken();
        const memberships = await getUserWorkspacesAction(idToken);
        const owned = memberships.filter(
          (membership) => membership.role === "STUDIO_OWNER" && membership.status === "ACTIVE"
        );
        if (!cancelled) setOwnerWorkspaces(owned);
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Unable to load your studios.");
        }
      } finally {
        if (!cancelled) setIsLoadingWorkspaces(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (ownerWorkspaces.length === 0) return;
    const selectedWorkspace = ownerWorkspaces.find((workspace) => workspace.studioId === studioParam);
    if (!selectedWorkspace) {
      router.replace(buildCheckoutUrl(ownerWorkspaces[0].studioId, selectedPlan));
    }
  }, [ownerWorkspaces, router, selectedPlan, studioParam]);

  useEffect(() => {
    if (isCheckoutPlanId(planParam) && planParam !== selectedPlan) {
      setSelectedPlan(planParam);
      setCheckoutSuccess(false);
      setSubmitError(null);
    }
  }, [planParam, selectedPlan]);

  const selectedWorkspace = useMemo(
    () => ownerWorkspaces.find((workspace) => workspace.studioId === studioParam),
    [ownerWorkspaces, studioParam]
  );
  const selectedPlanOption = PLAN_OPTIONS.find((plan) => plan.id === selectedPlan) ?? PLAN_OPTIONS[0];

  const chooseWorkspace = (studioId: string) => {
    setCheckoutSuccess(false);
    setSubmitError(null);
    router.replace(buildCheckoutUrl(studioId, selectedPlan));
  };

  const choosePlan = (plan: CheckoutPlanId) => {
    setSelectedPlan(plan);
    setCheckoutSuccess(false);
    setSubmitError(null);
    if (selectedWorkspace) router.replace(buildCheckoutUrl(selectedWorkspace.studioId, plan));
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/pricing");
  };

  const handleProceed = async () => {
    if (!user || !selectedWorkspace) {
      setSubmitError("Sign in and choose one of your studio workspaces before changing a plan.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await selectStudioPlanAction(selectedWorkspace.studioId, selectedPlan, idToken);
      if (!result.success) throw new Error(result.error || "Unable to save the studio plan.");
      setCheckoutSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save the studio plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary shadow-2xs transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="font-black text-brand-blue-primary">←</span>
        <span>Back</span>
      </button>

      {!user ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800">
          Sign in to choose a studio and review its fixed plan.
          <Link href="/sign-in" className="ml-1 font-bold underline hover:text-amber-900">Sign in</Link>
        </div>
      ) : (
        <section className="rounded-3xl border border-border-default bg-white p-6 shadow-xs">
          <label htmlFor="checkout-studio" className="block text-sm font-extrabold text-text-primary">Studio</label>
          <p className="mt-1 text-xs text-text-secondary">Each studio has its own plan and billing.</p>
          {isLoadingWorkspaces ? (
            <p className="mt-4 text-sm text-text-secondary">Loading your studios...</p>
          ) : workspaceError ? (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{workspaceError}</p>
          ) : ownerWorkspaces.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">No owner studios are available for plan configuration.</p>
          ) : (
            <select
              id="checkout-studio"
              value={selectedWorkspace?.studioId ?? ""}
              onChange={(event) => chooseWorkspace(event.target.value)}
              className="mt-4 w-full rounded-xl border border-border-default bg-surface-app px-3 py-2.5 text-sm font-semibold text-text-primary outline-none transition focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-primary/15"
            >
              {ownerWorkspaces.map((workspace) => (
                <option key={workspace.studioId} value={workspace.studioId}>{workspace.studioName}</option>
              ))}
            </select>
          )}
        </section>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-extrabold text-text-primary">Choose a plan</h2>
          <p className="mt-1 text-sm text-text-secondary">Plans include fixed features for the selected studio.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_OPTIONS.map((plan) => {
            const isSelected = plan.id === selectedPlan;
            return (
              <article
                key={plan.id}
                className={`flex flex-col rounded-3xl border p-6 shadow-2xs transition ${
                  isSelected ? "border-brand-blue-primary bg-brand-blue-background/5 ring-2 ring-brand-blue-primary/15" : "border-border-default bg-white"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-extrabold text-text-primary">{plan.name}</h3>
                    {plan.price && <span className="text-sm font-extrabold text-brand-blue-primary">{plan.price}</span>}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-text-secondary">{plan.summary}</p>
                  <ul className="mt-5 space-y-2 border-t border-border-divider pt-4 text-xs text-text-secondary">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2"><span className="font-black text-emerald-600">✓</span><span>{feature}</span></li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => choosePlan(plan.id)}
                  className={`mt-6 w-full rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                    isSelected ? "bg-brand-blue-primary text-white" : "border border-border-default bg-white text-text-primary hover:bg-slate-50"
                  }`}
                >
                  {isSelected ? "Selected" : `Choose ${plan.name}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-brand-orange-primary/30 bg-gradient-to-br from-white via-orange-50/20 to-white p-6 shadow-sm">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-orange-primary">Plan summary</span>
        <div className="mt-2 flex flex-col gap-2 border-b border-border-divider pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-text-primary">{selectedPlanOption.name}</h2>
            <p className="mt-1 text-xs text-text-secondary">{selectedPlanOption.summary}</p>
          </div>
          {selectedPlanOption.price && <span className="text-lg font-extrabold text-emerald-700">{selectedPlanOption.price}</span>}
        </div>

        {checkoutSuccess ? (
          <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-center">
            <h3 className="text-base font-extrabold text-emerald-950">Free plan saved</h3>
            <p className="mt-1 text-xs text-emerald-800">The Free plan is now saved for {selectedWorkspace?.studioName ?? "this studio"}.</p>
            {selectedWorkspace && (
              <Link href={`/${selectedWorkspace.studioId}/dashboard`} className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-800">Open studio dashboard</Link>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              disabled={isSubmitting || !selectedWorkspace}
              onClick={handleProceed}
              className="w-full rounded-xl bg-brand-orange-primary px-6 py-3.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Saving plan..." : selectedPlan === "FREE" ? "Save Free plan" : "Continue to payment setup"}
            </button>
            {selectedPlan !== "FREE" && <p className="text-center text-[11px] text-text-tertiary">Paid plans are activated only after verified payment confirmation.</p>}
            {submitError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[11px] text-red-700">{submitError}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
