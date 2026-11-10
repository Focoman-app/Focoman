/**
 * Focoman Pro Entitlements & Three-Tier Subscription Resolution
 *
 * Tiers:
 * 1. FREE (₹0): Basic OMS + Studio Marketplace (No Business Dashboard; redirects to OMS).
 * 2. PROFESSIONAL (₹999/month): Free + Advanced OMS (Drive Preview & Selection + Client Review) + CRM + ERP + Basic Business Dashboard (Order counts, Revenue overview, Pending payment overview).
 * 3. COMPLETE (₹1,999/month): Everything in ₹999 + WhatsApp Operations & Interactive Bot + Advanced Business Reports & Analytics + Excel Report Exports.
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
 * - "COMPLETE" (₹1,999/month, active 30-day trial, or whitelisted lifetime Pro email)
 * - "PROFESSIONAL" (₹999/month)
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

  if (planInfo.isTrial && planInfo.trialExpiresAt) {
    if (new Date() <= new Date(planInfo.trialExpiresAt)) {
      return "COMPLETE";
    }
  }

  if (planInfo.plan === "COMPLETE") return "COMPLETE";
  if (planInfo.plan === "PROFESSIONAL") return "PROFESSIONAL";

  const caps = Array.isArray(planInfo.selectedCapabilities) ? planInfo.selectedCapabilities : [];
  const hasCompleteCaps = caps.some((c) =>
    [
      "WHATSAPP_BOT",
      "WHATSAPP_OPERATIONS",
      "WHATSAPP_ALERTS",
      "WHATSAPP_NOTIFICATIONS",
      "BUSINESS_REPORTS",
      "ANALYTICS_ADVANCED",
    ].includes(c)
  );
  if (hasCompleteCaps) return "COMPLETE";

  const hasProCaps = caps.some((c) =>
    [
      "OMS_ADVANCED",
      "DRIVE_CLIENT_REVIEW",
      "CUSTOMER_CRM",
      "STUDIO_ERP",
      "ANALYTICS_BASIC",
      "GOOGLE_DRIVE",
    ].includes(c)
  );
  if (hasProCaps) return "PROFESSIONAL";

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
 * - FREE (₹0): oms, marketplace (basicDashboard = false)
 * - PROFESSIONAL (₹999/mo): oms, marketplace, crm, erp, driveReview, basicDashboard (whatsapp = false, reports = false)
 * - COMPLETE (₹1,999/mo): oms, marketplace, crm, erp, driveReview, basicDashboard, whatsapp, reports
 */
export function getEffectiveStudioFeatures(
  ownerEmail?: string | null,
  configuredFeatures?: {
    oms?: boolean;
    crm?: boolean;
    erp?: boolean;
    whatsapp?: boolean;
    reports?: boolean;
    marketplace?: boolean;
    driveReview?: boolean;
    basicDashboard?: boolean;
    autoAssignCrew?: boolean;
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
      marketplace: true,
      driveReview: true,
      basicDashboard: true,
      autoAssignCrew: configuredFeatures?.autoAssignCrew ?? true,
    };
  }

  if (tier === "PROFESSIONAL") {
    return {
      oms: true,
      crm: true,
      erp: true,
      whatsapp: caps.includes("WHATSAPP_OPERATIONS") || caps.includes("WHATSAPP_BOT") || caps.includes("WHATSAPP_NOTIFICATIONS"),
      reports: caps.includes("BUSINESS_REPORTS"),
      marketplace: true,
      driveReview: true,
      basicDashboard: true,
      autoAssignCrew: configuredFeatures?.autoAssignCrew ?? true,
    };
  }

  // FREE Plan (₹0): Basic OMS + Studio Marketplace only
  return {
    oms: true,
    crm: false,
    erp: false,
    whatsapp: false,
    reports: false,
    marketplace: true,
    driveReview: false,
    basicDashboard: false,
    autoAssignCrew: false,
  };
}

