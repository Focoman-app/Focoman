// File: apps/web/src/lib/entitlementAuth.ts
import { CapabilityId } from '@focoman/types';
import { getStudioPlan } from '@focoman/db';
import { hasCapability } from '@focoman/entitlements';
import { PLAN_CAPABILITIES } from '@focoman/config';

/**
 * Ensure the calling studio has the required capability.
 * Throws an Error with a user-friendly message if not allowed.
 */
export async function requireCapability(studioId: string, capability: CapabilityId): Promise<void> {
  if (!(await hasStudioCapability(studioId, capability))) {
    // Determine which plan would grant this capability for clearer messaging
    const allowed = Object.entries(PLAN_CAPABILITIES).find(([, caps]) => caps.includes(capability));
    const requiredPlan = allowed ? allowed[0] : 'higher tier';
    throw new Error(`Feature not available on your current plan. Upgrade to ${requiredPlan} or higher.`);
  }
}

/**
 * Resolves an entitlement from the durable studio plan. Use this when a
 * feature needs conditional behavior rather than an authorization error.
 */
export async function hasStudioCapability(studioId: string, capability: CapabilityId): Promise<boolean> {
  const planInfo = await getStudioPlan(studioId);
  return hasCapability(capability, planInfo ?? undefined);
}
