/**
 * Focoman Pro Entitlements & Three-Tier Subscription Resolution
 *
 * Tiers:
 * 1. FREE (₹0): Basic OMS (optional shareable photo links under the hood; 0 GB Cloud Storage).
 * 2. STARTER (₹999/month): Free + 20 GB Cloud Proofing Storage, Shareable Links & Client Photo Selection + CRM + ERP + Basic Business Dashboard.
 * 3. PROFESSIONAL (₹1,999/month): Everything in Starter + 50 GB Cloud Proofing Storage (10 GB during 30-day Free Trial) + WhatsApp Operations & Interactive Bot + Advanced Business Reports & Analytics + Excel Report Exports.
 * COMPLETE remains an internal legacy value for older records.
 */

export const LIFETIME_PRO_EMAILS: readonly string[] = [] as const;

export type EffectiveStudioTier = "FREE" | "PROFESSIONAL" | "COMPLETE";
export type StudioSubscriptionTier = EffectiveStudioTier;

/**
 * Checks whether an email address belongs to a whitelisted lifetime Pro test account.
 */
export function isLifetimeProEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return LIFETIME_PRO_EMAILS.some((item) => item.toLowerCase() === clean);
}

export interface StudioPlanInfoShape {
  plan?: string;
  selectedCapabilities?: string[];
  isTrial?: boolean;
  trialExpiresAt?: string;
}

export interface StudioEntitlementShape {
  ownerEmail?: string | null;
  planInfo?: StudioPlanInfoShape | null;
}

/**
 * Resolves the effective 3-tier subscription level for a studio:
 * - internal "COMPLETE" (public Professional plan, active legacy trial, or whitelisted lifetime Pro email)
 * - internal "PROFESSIONAL" (public Starter plan)
 * - "FREE" (₹0)
 */
export function getEffectiveStudioTier(
  ownerEmailOrStudio?: string | StudioEntitlementShape | null,
  planInfoArg?: StudioPlanInfoShape | null
): EffectiveStudioTier {
  const isStudioObject =
    typeof ownerEmailOrStudio === "object" && ownerEmailOrStudio !== null;
  const ownerEmail = isStudioObject
    ? ownerEmailOrStudio.ownerEmail
    : ownerEmailOrStudio;
  const planInfo = isStudioObject
    ? ownerEmailOrStudio.planInfo ?? planInfoArg
    : planInfoArg;

  if (isLifetimeProEmail(ownerEmail)) return "COMPLETE";
  if (!planInfo) return "FREE";
  if (planInfo.plan === "FREE") return "FREE";

  if (planInfo.plan === "COMPLETE" || planInfo.plan === "PROFESSIONAL") return "COMPLETE";
  if (planInfo.plan === "STARTER") return "PROFESSIONAL";

  return "FREE";
}

/**
 * Evaluates whether a studio possesses any paid Pro access (PROFESSIONAL or COMPLETE).
 */
export function isStudioProEntitled(
  ownerEmailOrStudio?: string | StudioEntitlementShape | null,
  planInfo?: StudioPlanInfoShape | null
): boolean {
  return getEffectiveStudioTier(ownerEmailOrStudio, planInfo) !== "FREE";
}

/**
 * Returns effective features for a studio across the 3-tier pricing model:
 * - FREE (₹0): oms (basicDashboard = false)
 * - PROFESSIONAL (₹999/mo): oms, crm, erp, driveReview, basicDashboard (whatsapp = false, reports = false)
 * - COMPLETE (₹1,999/mo): oms, crm, erp, driveReview, basicDashboard, whatsapp, reports
 */
export function getEffectiveStudioFeatures(
  ownerEmail?: string | null,
  configuredFeatures?: {
    oms?: boolean;
    crm?: boolean;
    erp?: boolean;
    whatsapp?: boolean;
    reports?: boolean;
    driveReview?: boolean;
    basicDashboard?: boolean;
    autoAssignCrew?: boolean;
    autoAssignCrewConfigured?: boolean;
  } | null,
  planInfo?: {
    plan?: string;
    selectedCapabilities?: string[];
    isTrial?: boolean;
    trialExpiresAt?: string;
  } | null
) {
  const tier = getEffectiveStudioTier(ownerEmail, planInfo);
  const caps = Array.isArray(planInfo?.selectedCapabilities) ? planInfo!.selectedCapabilities : [];

  if (tier === "COMPLETE") {
    return {
      oms: true,
      crm: true,
      erp: true,
      whatsapp: true,
      reports: true,
      driveReview: true,
      basicDashboard: true,
      autoAssignCrew: configuredFeatures?.autoAssignCrew ?? true,
      autoAssignCrewConfigured: Boolean(configuredFeatures?.autoAssignCrewConfigured),
    };
  }

  if (tier === "PROFESSIONAL") {
    return {
      oms: true,
      crm: true,
      erp: true,
      whatsapp: false,
      reports: caps.some((c) => ["BUSINESS_REPORTS", "ANALYTICS_ADVANCED"].includes(c)),
      driveReview: true,
      basicDashboard: true,
      autoAssignCrew: configuredFeatures?.autoAssignCrew ?? true,
      autoAssignCrewConfigured: Boolean(configuredFeatures?.autoAssignCrewConfigured),
    };
  }

  // FREE Plan (₹0) includes Shareable Photos & Storage Links; modular capability add-ons apply on top:
  const hasCrm = caps.some((c) => ["CUSTOMER_CRM", "CUSTOMER_BASIC", "CUSTOMER_ADVANCED"].includes(c));
  const hasErp = caps.some((c) => ["STUDIO_ERP", "CREW_BASIC", "CREW_ADVANCED"].includes(c));
  const hasDashboard = caps.some((c) => ["ANALYTICS_BASIC", "BUSINESS_REPORTS"].includes(c));
  const hasReports = caps.some((c) => ["BUSINESS_REPORTS", "ANALYTICS_ADVANCED"].includes(c));

  return {
    oms: true,
    crm: hasCrm,
    erp: hasErp,
    whatsapp: false,
    reports: hasReports,
    driveReview: true,
    basicDashboard: hasDashboard,
    autoAssignCrew: hasErp ? (configuredFeatures?.autoAssignCrew ?? true) : false,
    autoAssignCrewConfigured: Boolean(configuredFeatures?.autoAssignCrewConfigured),
  };
}

