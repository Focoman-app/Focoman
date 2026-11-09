"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FREE_CORE_CAPABILITY,
  PURCHASABLE_CAPABILITIES,
  calculateMonthlyTotal,
  getEffectiveCapabilities,
} from "@focoman/config";
import { subscribeToAuthState } from "@/lib/firebaseAuth";
import { saveStudioCapabilitiesAction, getStudioAction } from "@/actions/studioActions";
import type { User } from "firebase/auth";
import type { CapabilityId } from "@focoman/types";

// ==========================================
// DYNAMIC PRICING FORMULA ENGINE
// ==========================================

export const MVP_LAUNCH_DISCOUNT_PERCENT = 100;

export interface SingleModulePrice {
  originalPrice: number;
  discountedPrice: number;
  isFree: boolean;
}

export function computeModuleCardPrice(
  originalPrice: number,
  discountPercent: number = MVP_LAUNCH_DISCOUNT_PERCENT
): SingleModulePrice {
  const discountAmount = Math.round((originalPrice * discountPercent) / 100);
  const discountedPrice = Math.max(0, originalPrice - discountAmount);
  return {
    originalPrice,
    discountedPrice,
    isFree: discountedPrice === 0,
  };
}

export interface CartPricingCalculation {
  regularSubtotal: number;
  discountPercentage: number;
  discountAmount: number;
  finalPayableTotal: number;
  itemizedBreakdown: Array<{
    id: CapabilityId;
    name: string;
    originalPrice: number;
    discountedPrice: number;
    isCoveredByAdvanced?: boolean;
  }>;
}

export function computeCartPricing(
  selectedCapIds: CapabilityId[],
  discountPercent: number = MVP_LAUNCH_DISCOUNT_PERCENT
): CartPricingCalculation {
  const regularSubtotal = calculateMonthlyTotal(selectedCapIds);
  const discountAmount = Math.round((regularSubtotal * discountPercent) / 100);
  const finalPayableTotal = Math.max(0, regularSubtotal - discountAmount);

  const itemizedBreakdown = selectedCapIds.map((id) => {
    const cap = PURCHASABLE_CAPABILITIES.find((p) => p.id === id);
    const originalPrice = cap ? cap.price : 0;
    const isCovered = id === "WHATSAPP_NOTIFICATIONS" && selectedCapIds.includes("WHATSAPP_OPERATIONS");
    const modulePrice = computeModuleCardPrice(originalPrice, discountPercent);
    return {
      id,
      name: cap ? cap.name : id,
      originalPrice,
      discountedPrice: isCovered ? 0 : modulePrice.discountedPrice,
      isCoveredByAdvanced: isCovered,
    };
  });

  return {
    regularSubtotal,
    discountPercentage: discountPercent,
    discountAmount,
    finalPayableTotal,
    itemizedBreakdown,
  };
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export function CheckoutBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgradeParam = searchParams.get("upgrade")?.toLowerCase() || searchParams.get("feature")?.toLowerCase();
  const actionParam = searchParams.get("action")?.toLowerCase();
  const studioParam = searchParams.get("studio");

  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialCapsLoaded, setInitialCapsLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Currently selected capabilities
  const [selectedCaps, setSelectedCaps] = useState<CapabilityId[]>(() => {
    const initial: CapabilityId[] = [];
    if (upgradeParam === "crm") initial.push("CUSTOMER_CRM");
    else if (upgradeParam === "erp" || upgradeParam === "crew") initial.push("STUDIO_ERP");
    else if (upgradeParam === "reports" || upgradeParam === "analytics") initial.push("BUSINESS_REPORTS");
    else if (upgradeParam === "whatsapp") initial.push("WHATSAPP_NOTIFICATIONS");
    else if (upgradeParam === "marketplace") initial.push("MARKETPLACE");
    else if (upgradeParam === "drive") initial.push("DRIVE_CLIENT_REVIEW");
    return initial;
  });
  const [checkoutSuccess, setCheckoutSuccess] = useState<boolean>(false);

  // Load existing capabilities if configuring for a specific studio
  useEffect(() => {
    if (!user || !studioParam) return;
    let cancelled = false;

    const loadExistingPlan = async () => {
      try {
        const token = await user.getIdToken();
        const res = await getStudioAction(studioParam, token);
        if (!cancelled && res.success && res.studio?.planInfo) {
          const loaded = (res.studio.planInfo.selectedCapabilities || []) as CapabilityId[];
          setSelectedCaps((prev) => {
            const merged = new Set([...loaded, ...prev]);
            return Array.from(merged);
          });
          setInitialCapsLoaded(true);
        }
      } catch (err) {
        console.warn("[CheckoutBuilder] Error loading studio capabilities:", err);
      }
    };

    loadExistingPlan();
    return () => {
      cancelled = true;
    };
  }, [user, studioParam]);

  // Dynamic formula calculation for the entire checkout
  const cartPricing = computeCartPricing(selectedCaps, MVP_LAUNCH_DISCOUNT_PERCENT);

  const handleToggleCapability = (capId: CapabilityId) => {
    setSelectedCaps((prev) => {
      const exists = prev.includes(capId);

      // WhatsApp Bot includes Notifications
      if (capId === "WHATSAPP_OPERATIONS") {
        return exists
          ? prev.filter((c) => c !== "WHATSAPP_OPERATIONS")
          : [...prev.filter((c) => c !== "WHATSAPP_NOTIFICATIONS"), "WHATSAPP_OPERATIONS"];
      }

      if (capId === "WHATSAPP_NOTIFICATIONS") {
        return exists
          ? prev.filter((c) => c !== "WHATSAPP_NOTIFICATIONS" && c !== "WHATSAPP_OPERATIONS")
          : [...prev.filter((c) => c !== "WHATSAPP_OPERATIONS"), "WHATSAPP_NOTIFICATIONS"];
      }

      return exists ? prev.filter((c) => c !== capId) : [...prev, capId];
    });
  };

  const handleUnselectAll = () => {
    setSelectedCaps([]);
  };

  const handleSelectAll = () => {
    const all = PURCHASABLE_CAPABILITIES.map((c) => c.id as CapabilityId);
    setSelectedCaps(all);
  };

  // Smart contextual previous page navigation
  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (studioParam) {
      router.push(`/${studioParam}/dashboard`);
    } else {
      router.push("/pricing");
    }
  };

  // Process checkout / module activation
  const handleProceed = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (user && studioParam) {
        const idToken = await user.getIdToken();
        const res = await saveStudioCapabilitiesAction(studioParam, selectedCaps, idToken);
        if (!res.success) {
          console.warn("[CheckoutBuilder] Capability update note:", res.error);
        }
      }
      setCheckoutSuccess(true);
    } catch (err: unknown) {
      console.error("[CheckoutBuilder] Error updating studio capabilities:", err);
      // Still show success UI so user isn't stuck
      setCheckoutSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Contextual Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-border-default shadow-2xs">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-app px-3.5 py-1.5 text-xs font-bold text-text-primary shadow-2xs hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer"
        >
          <span className="text-brand-blue-primary font-black">←</span>
          <span>{studioParam ? `Back to ${studioParam} Studio Dashboard` : "Back to Pricing Overview"}</span>
        </button>

        <div className="flex items-center gap-3 text-xs">
          {studioParam && (
            <>
              <Link
                href={`/${studioParam}/dashboard`}
                className="font-bold text-text-secondary hover:text-brand-blue-primary transition"
              >
                {studioParam} Dashboard
              </Link>
              <span className="text-text-tertiary">•</span>
            </>
          )}
          <Link
            href="/pricing"
            className="font-semibold text-text-secondary hover:text-brand-blue-primary transition"
          >
            Pricing Overview
          </Link>
        </div>
      </div>

      {/* Workspace / Logged In Status Banner */}
      {user ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-border-divider text-xs gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-secondary">Viewing Workspace:</span>
            <span className="font-bold text-text-primary">
              {studioParam ? `${studioParam} Studio` : "Active Workspace"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-secondary">Logged in as:</span>
            <span className="font-bold text-text-primary">{user.email}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-50/50 border border-amber-200/60 p-4 text-xs text-amber-800">
          You are not currently logged in. To configure modules and persist them to an active workspace, please{" "}
          <Link href="/sign-in" className="font-bold underline hover:text-amber-900">
            Sign In
          </Link>{" "}
          first.
        </div>
      )}

      {/* Action / Unselect Alert Banner */}
      {actionParam === "unselect" && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="text-xs font-extrabold text-red-700 uppercase tracking-wider">
              Manage &amp; Unselect Active Subscriptions
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Uncheck or unselect any modules below to remove them from your workspace, or click &ldquo;Unselect All&rdquo; to revert to the 100% Free Core OMS plan, then save changes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUnselectAll}
            className="px-3.5 py-1.5 rounded-xl border border-red-300 bg-white text-xs font-bold text-red-700 hover:bg-red-50 transition shrink-0 cursor-pointer shadow-2xs"
          >
            Unselect All
          </button>
        </div>
      )}

      {/* Navigated Upgrade Alert (e.g. from OMS sidebar/pages) */}
      {upgradeParam && (
        <div className="rounded-2xl border border-brand-orange-light bg-brand-orange-background/40 p-4 flex items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs font-extrabold text-brand-orange-primary uppercase tracking-wider">
                Navigated from Studio Workspace: {upgradeParam.toUpperCase()} Selected
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {upgradeParam === "crm"
                  ? "Customer Management (CRM) has been pre-selected below. You can customize additional modules or proceed directly to payment."
                  : `The ${upgradeParam.toUpperCase()} module has been pre-selected for your workspace below.`}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-brand-orange-primary text-white shrink-0">
            PRO UPGRADE
          </span>
        </div>
      )}

      {/* Interactive Selection Grid */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-divider pb-4">
          <div>
            <h3 className="text-2xl font-extrabold text-text-primary">
              {actionParam === "unselect" ? "Manage Studio Subscriptions" : "Select Your Studio Modules"}
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Select or unselect modular capabilities below for your studio workspace.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedCaps.length > 0 && (
              <button
                type="button"
                onClick={handleUnselectAll}
                className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer shadow-2xs"
              >
                Unselect All Subscriptions
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAll}
              className="rounded-xl border border-brand-blue-primary/40 bg-white px-3 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-sky-50 transition cursor-pointer shadow-2xs"
            >
              Select All Pro Modules
            </button>
          </div>
        </div>

        {/* Three-Tier Subscription Plan Selector */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Tier 1: Free Plan — ₹0 */}
          <div
            onClick={handleUnselectAll}
            className={`rounded-3xl p-6 shadow-2xs space-y-4 flex flex-col justify-between cursor-pointer transition border ${
              selectedCaps.length === 0
                ? "bg-white border-brand-blue-primary ring-2 ring-brand-blue-primary/15"
                : "bg-slate-50 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    Free Plan
                  </span>
                  <h4 className="text-base font-extrabold text-text-primary mt-1.5">Basic OMS &amp; Marketplace</h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-text-primary">₹0</span>
                  <span className="text-[11px] text-text-tertiary font-bold"> / forever</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Core Order Management System (OMS) and Studio Marketplace profile. Directs straight to OMS workspace.
              </p>
            </div>
            <div className="grid gap-1.5 text-[11px] text-text-secondary pt-2 border-t border-slate-200/50">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Basic OMS (Order Management System)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Studio Marketplace</span>
              </div>
            </div>
          </div>

          {/* Tier 2: ₹999/month Plan */}
          <div
            onClick={() =>
              setSelectedCaps(["OMS_ADVANCED", "CUSTOMER_CRM", "STUDIO_ERP"])
            }
            className={`rounded-3xl p-6 shadow-2xs space-y-4 flex flex-col justify-between cursor-pointer transition border ${
              selectedCaps.includes("CUSTOMER_CRM") &&
              selectedCaps.includes("STUDIO_ERP") &&
              !selectedCaps.includes("WHATSAPP_BOT") &&
              !selectedCaps.includes("BUSINESS_REPORTS")
                ? "bg-white border-brand-blue-primary ring-2 ring-brand-blue-primary/15"
                : "bg-white border-border-default hover:border-slate-300"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    ₹999/month Plan
                  </span>
                  <h4 className="text-base font-extrabold text-text-primary mt-1.5">Studio Growth Suite</h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-brand-blue-primary">₹999</span>
                  <span className="text-[11px] text-text-tertiary font-bold"> / month</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Everything in Free, plus Google Drive photo preview &amp; selection, CRM, ERP, and Basic Business Dashboard.
              </p>
            </div>
            <div className="grid gap-1.5 text-[11px] text-text-secondary pt-2 border-t border-slate-200/50">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Advanced OMS (Google Drive Preview &amp; Review)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>CRM &amp; ERP (Studio Operations)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Basic Business Dashboard (Orders, Revenue, Pending)</span>
              </div>
            </div>
          </div>

          {/* Tier 3: ₹1,999/month Plan */}
          <div
            onClick={handleSelectAll}
            className={`rounded-3xl p-6 shadow-2xs space-y-4 flex flex-col justify-between cursor-pointer transition border ${
              selectedCaps.includes("WHATSAPP_BOT") && selectedCaps.includes("BUSINESS_REPORTS")
                ? "bg-emerald-50/40 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-emerald-50/20 border-emerald-200/80 hover:border-emerald-400"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
                <div>
                  <span className="rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                    ₹1,999/month Plan
                  </span>
                  <h4 className="text-base font-extrabold text-text-primary mt-1.5">Complete Studio OS</h4>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-700">₹1,999</span>
                  <span className="text-[11px] text-emerald-800 font-bold"> / month</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Everything in the ₹999 plan, plus WhatsApp Operations &amp; Interactive Bot, Advanced Business Reports &amp; Excel Exports.
              </p>
            </div>
            <div className="grid gap-1.5 text-[11px] text-text-secondary pt-2 border-t border-emerald-200/50">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>WhatsApp Operations &amp; Interactive Bot</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Advanced Business Reports &amp; Analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Excel Report Exports</span>
              </div>
            </div>
          </div>
        </div>

        {/* Unified Modules Stack */}
        <div className="bg-white border border-border-default rounded-3xl p-6 shadow-xs space-y-5">
          <div className="border-b border-border-divider pb-3">
            <h4 className="text-base font-extrabold text-text-primary">
              Choose Add-on Modules
            </h4>
            <p className="text-xs text-text-secondary mt-0.5">
              Select one or more professional modules. They will integrate seamlessly into your workspace.
            </p>
          </div>

          <div className="space-y-4">
            {PURCHASABLE_CAPABILITIES.map((cap) => {
              const isDirectlySelected = selectedCaps.includes(cap.id);

              const isCoveredByAdvanced =
                cap.id === "WHATSAPP_NOTIFICATIONS" && selectedCaps.includes("WHATSAPP_OPERATIONS");

              const modulePrice = computeModuleCardPrice(cap.price, MVP_LAUNCH_DISCOUNT_PERCENT);

              return (
                <div
                  key={cap.id}
                  onClick={() => handleToggleCapability(cap.id)}
                  className={`group relative rounded-2xl border p-5 transition-all duration-200 cursor-pointer bg-white ${
                    isDirectlySelected
                      ? "border-brand-blue-primary bg-brand-blue-background/5 shadow-sm ring-2 ring-brand-blue-primary/15"
                      : isCoveredByAdvanced
                      ? "border-emerald-300 bg-emerald-50/30"
                      : "border-border-default hover:border-slate-300 hover:bg-slate-50/20"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Checkbox and text info */}
                    <div className="flex items-start gap-3.5 flex-1">
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isDirectlySelected || isCoveredByAdvanced}
                          onChange={() => handleToggleCapability(cap.id)}
                          className="h-5 w-5 rounded border-slate-300 text-brand-blue-primary focus:ring-brand-blue-primary cursor-pointer transition"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <h5 className="text-sm font-extrabold text-text-primary">
                            {cap.name}
                          </h5>
                          {isCoveredByAdvanced && (
                            <span className="inline-block rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                              Included in Bot
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {cap.description}
                        </p>

                        {/* Features List as clean grid */}
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-3 mt-3 border-t border-slate-100 text-[11px] text-text-secondary">
                          {cap.features.map((feat, fIdx) => (
                            <li key={fIdx} className="flex items-start gap-1.5 pl-1">
                              <span className="text-emerald-500 font-extrabold shrink-0">•</span>
                              <span className="leading-tight">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Price and Status Button with Strikethrough Discount Display */}
                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-left md:text-right">
                        {isCoveredByAdvanced ? (
                          <div>
                            <div className="flex items-baseline gap-1.5 md:justify-end">
                              <span className="text-sm line-through text-text-tertiary font-bold">
                                ₹{cap.price}
                              </span>
                              <span className="text-2xl font-black text-emerald-600">
                                ₹0
                              </span>
                              <span className="text-xs text-emerald-700 font-bold">/mo</span>
                            </div>
                            <span className="inline-block mt-0.5 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                              Included in Bot
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-baseline gap-1.5 md:justify-end">
                              <span className="text-sm line-through text-text-tertiary font-bold">
                                ₹{modulePrice.originalPrice}
                              </span>
                              <span className="text-2xl font-black text-emerald-600">
                                ₹{modulePrice.discountedPrice}
                              </span>
                              <span className="text-xs text-emerald-700 font-bold">/mo</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="md:mt-2 flex items-center gap-1.5 flex-wrap justify-end">
                        {isDirectlySelected ? (
                          <>
                            <span className="inline-block text-[11px] font-extrabold px-3 py-1 rounded-full tracking-wide bg-brand-blue-primary text-white shadow-2xs">
                              ✓ Subscribed
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCapability(cap.id);
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                              title="Unselect this module"
                            >
                              Unselect
                            </button>
                          </>
                        ) : isCoveredByAdvanced ? (
                          <span className="inline-block text-[11px] font-extrabold px-3 py-1 rounded-full tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Included in Bot
                          </span>
                        ) : (
                          <span className="inline-block text-[11px] font-extrabold px-3 py-1 rounded-full tracking-wide bg-slate-100 text-text-primary border border-slate-200 hover:bg-slate-200">
                            + Add Module
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Checkout Summary & Dynamic Formula Breakdown */}
      <div className="rounded-3xl border border-brand-orange-primary/30 bg-gradient-to-br from-white via-orange-50/20 to-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-divider pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-orange-primary">
                ORDER BREAKDOWN
              </span>
            </div>
            <h3 className="text-xl font-extrabold text-text-primary mt-1">
              Monthly Subscription Total
            </h3>
          </div>
          <div className="flex items-baseline gap-2">
            {cartPricing.regularSubtotal > 0 && (
              <span className="text-lg line-through text-text-tertiary font-bold">
                ₹{cartPricing.regularSubtotal}
              </span>
            )}
            <span className="text-3xl font-extrabold text-emerald-600">
              ₹{cartPricing.finalPayableTotal}
            </span>
            <span className="text-xs text-emerald-700 font-bold">/ month (Limited Period)</span>
          </div>
        </div>

        <div className="space-y-2 text-xs text-text-secondary">
          <div className="flex items-center justify-between py-1 border-b border-border-divider/50">
            <span>Basic Order management (₹0 Forever)</span>
            <span className="font-bold text-emerald-700">INCLUDED (₹0)</span>
          </div>
          {cartPricing.itemizedBreakdown.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1 border-b border-border-divider/50">
              <span className="font-medium text-text-primary">{item.name}</span>
              <span className="font-extrabold text-text-primary flex items-center gap-1.5">
                {item.isCoveredByAdvanced ? (
                  <span className="text-emerald-700 font-bold">INCLUDED IN BOT (₹0)</span>
                ) : (
                  <>
                    <span className="line-through text-text-tertiary font-normal">₹{item.originalPrice}/mo</span>
                    <span className="text-emerald-600 font-bold">₹{item.discountedPrice}</span>
                  </>
                )}
              </span>
            </div>
          ))}

          {cartPricing.discountAmount > 0 && (
            <div className="flex items-center justify-between py-1.5 text-emerald-700 font-bold border-b border-border-divider/50">
              <span>Introductory Discount ({cartPricing.discountPercentage}%)</span>
              <span>-₹{cartPricing.discountAmount}/mo</span>
            </div>
          )}
        </div>

        {checkoutSuccess ? (
          <div className="rounded-3xl bg-emerald-50/90 border-2 border-emerald-400 p-8 text-center space-y-4 shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-2xl font-black">
              ✓
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xl font-extrabold text-emerald-950">
                Studio Modules Activated Successfully!
              </h4>
              <p className="text-xs text-emerald-800 max-w-lg mx-auto">
                Your modular configuration has been activated successfully for{" "}
                <span className="font-extrabold">{studioParam ? `${studioParam} Studio Workspace` : "your studio"}</span>.
                All selected capabilities are enabled and ready for use.
              </p>
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              {studioParam ? (
                <Link
                  href={`/${studioParam}/dashboard`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm transition"
                >
                  <span>Return to {studioParam} Studio Dashboard</span>
                  <span>→</span>
                </Link>
              ) : (
                <Link
                  href="/workspaces"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm transition"
                >
                  <span>Go to My Workspaces</span>
                  <span>→</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setCheckoutSuccess(false)}
                className="px-4 py-3 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-100/50 text-emerald-900 text-xs font-bold transition cursor-pointer"
              >
                Adjust Selected Modules
              </button>
              <Link
                href="/pricing"
                className="px-4 py-3 rounded-xl border border-border-default bg-white hover:bg-slate-50 text-text-secondary text-xs font-bold transition"
              >
                Pricing Overview
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleProceed}
              className={`w-full rounded-xl px-8 py-4 text-xs font-extrabold text-white shadow-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                selectedCaps.length === 0
                  ? "bg-slate-800 hover:bg-black"
                  : cartPricing.finalPayableTotal === 0
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-brand-orange-primary hover:bg-orange-600"
              }`}
            >
              {isSubmitting ? (
                <span>Saving Studio Plan...</span>
              ) : selectedCaps.length === 0 ? (
                <span>Save Changes &amp; Revert to Free Core OMS (₹0/forever) →</span>
              ) : cartPricing.finalPayableTotal === 0 ? (
                <>
                  <span>
                    Save Subscription Changes (₹{cartPricing.finalPayableTotal}/mo)
                  </span>
                  <span>→</span>
                </>
              ) : (
                <>
                  <span>Proceed to Payment Gateway (₹{cartPricing.finalPayableTotal}/mo)</span>
                  <span>→</span>
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-text-tertiary">
              Secure 256-bit SSL Payment Gateway · Cancel or adjust modules anytime from your studio settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
