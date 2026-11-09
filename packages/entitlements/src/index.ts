import { PLAN_CAPABILITIES, TRIAL_DURATION_DAYS, getEffectiveCapabilities } from '@focoman/config';
import { CapabilityId, PlanType, StudioPlan } from '@focoman/types';
import { getStudioPlan as getStudioPlanFromDb, upsertStudioPlan as upsertStudioPlanInDb } from '@focoman/db';

/**
 * Resolve the effective plan for a studio, considering trial status.
 */
export function getEffectivePlan(studioPlan?: StudioPlan): PlanType {
  if (!studioPlan) return 'FREE';
  if (studioPlan.isTrial && studioPlan.trialExpiresAt) {
    const now = new Date();
    const expires = new Date(studioPlan.trialExpiresAt);
    if (now <= expires) {
      return 'COMPLETE';
    }
  }
  return studioPlan.plan || 'FREE';
}

/**
 * Returns true if the given capability is enabled for the studio's selected capabilities or active trial.
 */
export function hasCapability(capability: CapabilityId, studioPlan?: StudioPlan): boolean {
  if (!studioPlan) {
    // Default to Free Core OMS
    return capability === 'OMS_BASIC' || capability === 'OMS_CORE';
  }

  // Active trial grants all capabilities
  if (isTrialActive(studioPlan)) {
    return true;
  }

  // Expand selected capabilities including inclusions
  const selectedCaps = studioPlan.selectedCapabilities || [];
  const effectiveCaps = getEffectiveCapabilities(selectedCaps);

  if (effectiveCaps.includes(capability)) {
    return true;
  }

  // Fallback check against legacy plan if present
  if (studioPlan.plan) {
    const planCaps = PLAN_CAPABILITIES[studioPlan.plan] ?? [];
    if (planCaps.includes(capability)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a trial is still active.
 */
export function isTrialActive(studioPlan?: StudioPlan): boolean {
  if (!studioPlan?.isTrial) return false;
  if (!studioPlan.trialExpiresAt) return false;
  return new Date() <= new Date(studioPlan.trialExpiresAt);
}

/**
 * Checks if a trial has expired.
 */
export function isTrialExpired(studioPlan?: StudioPlan): boolean {
  if (!studioPlan?.isTrial) return false;
  if (!studioPlan.trialExpiresAt) return false;
  return new Date() > new Date(studioPlan.trialExpiresAt);
}

/**
 * Returns the plan that the studio should fall back to after trial expiry.
 */
export function getEffectivePlanAfterTrial(studioPlan?: StudioPlan): PlanType {
  if (!studioPlan) return 'FREE';
  if (studioPlan.isTrial && isTrialExpired(studioPlan)) {
    return 'FREE';
  }
  return studioPlan.plan || 'FREE';
}

/**
 * Initialize a studio with Free Core (OMS_BASIC) and start a 30‑day trial.
 */
export async function initializeStudioPlan(studioId: string, nowIso: string = new Date().toISOString()): Promise<void> {
  const trialExpires = new Date();
  trialExpires.setDate(trialExpires.getDate() + TRIAL_DURATION_DAYS);
  const plan: StudioPlan = {
    selectedCapabilities: ['OMS_BASIC'],
    plan: 'FREE',
    isTrial: true,
    trialStartedAt: nowIso,
    trialExpiresAt: trialExpires.toISOString(),
    updatedAt: nowIso,
  };
  await upsertStudioPlanInDb(studioId, plan);
}

/**
 * Save selected capabilities for a studio and resolve the matching 3-tier plan (FREE, PROFESSIONAL, COMPLETE).
 */
export async function updateStudioCapabilities(
  studioId: string,
  selectedCapabilities: CapabilityId[],
  nowIso: string = new Date().toISOString(),
  explicitPlan?: PlanType
): Promise<void> {
  const existing = await getStudioPlanFromDb(studioId);
  const completeTierCaps: CapabilityId[] = [
    'WHATSAPP_BOT',
    'WHATSAPP_OPERATIONS',
    'WHATSAPP_ALERTS',
    'WHATSAPP_NOTIFICATIONS',
    'BUSINESS_REPORTS',
    'ANALYTICS_ADVANCED',
  ];
  const proTierCaps: CapabilityId[] = [
    'OMS_ADVANCED',
    'DRIVE_CLIENT_REVIEW',
    'CUSTOMER_CRM',
    'STUDIO_ERP',
    'ANALYTICS_BASIC',
  ];

  let resolvedPlan: PlanType = explicitPlan || 'FREE';
  if (!explicitPlan) {
    if (selectedCapabilities.some((cap) => completeTierCaps.includes(cap))) {
      resolvedPlan = 'COMPLETE';
    } else if (selectedCapabilities.some((cap) => proTierCaps.includes(cap))) {
      resolvedPlan = 'PROFESSIONAL';
    } else {
      resolvedPlan = 'FREE';
    }
  }

  const plan: StudioPlan = {
    selectedCapabilities,
    plan: resolvedPlan,
    isTrial: false,
    updatedAt: nowIso,
  };
  if (existing?.trialStartedAt) {
    plan.trialStartedAt = existing.trialStartedAt;
    plan.trialExpiresAt = existing.trialExpiresAt;
  }
  await upsertStudioPlanInDb(studioId, plan);
}

/**
 * Legacy plan updater compatibility
 */
export async function updateStudioPlan(studioId: string, newPlan: PlanType, nowIso: string = new Date().toISOString()): Promise<void> {
  const existing = await getStudioPlanFromDb(studioId);
  const defaultCapsForPlan = PLAN_CAPABILITIES[newPlan] || existing?.selectedCapabilities || ['OMS_BASIC'];
  const plan: StudioPlan = {
    selectedCapabilities: defaultCapsForPlan,
    plan: newPlan,
    isTrial: false,
    updatedAt: nowIso,
  };
  await upsertStudioPlanInDb(studioId, plan);
}
