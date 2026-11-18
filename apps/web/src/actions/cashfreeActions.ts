"use server";

import { requireVerifiedUser, requireStudioMember } from "@/lib/serverAuth";
import { getStudioBySlug, updateStudio } from "@focoman/db";
import { PLAN_CAPABILITIES, PLAN_PRICES_INR, CASHFREE_CONFIG } from "@focoman/config";
import type {
  PlanPaymentSessionResult,
  PlanPaymentVerificationResult,
} from "@focoman/types";
import {
  isCashfreeConfigured,
  createCashfreeOrder,
  getCashfreeOrder,
} from "@/services/cashfreeService";

/**
 * Creates a Cashfree payment session for a studio plan upgrade.
 * Enforces server-side authentication, STUDIO_OWNER role, and canonical plan pricing.
 */
export async function createPlanPaymentSessionAction(
  studioSlug: string,
  plan: "STARTER" | "PROFESSIONAL",
  idToken: string,
  origin?: string
): Promise<PlanPaymentSessionResult> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    if (plan !== "STARTER" && plan !== "PROFESSIONAL") {
      return { success: false, error: "Paid payment sessions are only available for Starter or Professional plans." };
    }

    if (!isCashfreeConfigured()) {
      return {
        success: false,
        error: "Payment gateway is not configured. Please ensure credentials are set.",
      };
    }

    const price = PLAN_PRICES_INR[plan];
    if (!price || price <= 0) {
      return { success: false, error: "Invalid plan pricing." };
    }

    const studio = await getStudioBySlug(studioSlug);
    const studioName = studio?.name || studioSlug;

    // Build a unique, valid Cashfree order ID (max 50 chars, alphanumeric, _ and -)
    const sanitizedSlug = studioSlug.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
    const orderId = `PLAN_${sanitizedSlug}_${Date.now()}`;

    // Ensure customer phone is valid digits (default placeholder for test accounts if unprovided)
    const rawPhone = (decoded.phone_number || "").replace(/\D/g, "");
    const customerPhone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9999999999";
    const customerName = decoded.name || studioName || "Studio Owner";
    const customerEmail = decoded.email || "owner@focoman.com";
    const baseOrigin = (origin || "http://localhost:3000").replace(/\/+$/, "");

    const orderPayload = {
      order_id: orderId,
      order_amount: price,
      order_currency: "INR",
      customer_details: {
        customer_id: decoded.uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${baseOrigin}/checkout?studio=${studioSlug}&plan=${plan.toLowerCase()}&order_id={order_id}&status=verify`,
      },
      order_note: `FocoMan ${plan} Plan Subscription for ${studioName}`,
      order_tags: {
        studioSlug,
        plan,
        userId: decoded.uid,
      },
    };

    const cfOrder = await createCashfreeOrder(orderPayload);

    if (!cfOrder.payment_session_id) {
      return {
        success: false,
        error: "Failed to obtain payment session from payment gateway.",
      };
    }

    return {
      success: true,
      paymentSessionId: cfOrder.payment_session_id,
      orderId: cfOrder.order_id,
      environment: CASHFREE_CONFIG.env,
    };
  } catch (err: unknown) {
    console.error("[createPlanPaymentSessionAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to initialize payment session.",
    };
  }
}

/**
 * Verifies payment status with Cashfree and activates the studio plan if verified PAID.
 */
export async function verifyAndActivatePlanAction(
  orderId: string,
  studioSlug: string,
  expectedPlan: "STARTER" | "PROFESSIONAL",
  idToken: string
): Promise<PlanPaymentVerificationResult> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER");

    if (expectedPlan !== "STARTER" && expectedPlan !== "PROFESSIONAL") {
      return { success: false, error: "Invalid target plan." };
    }

    if (!isCashfreeConfigured()) {
      return {
        success: false,
        error: "Cashfree payment gateway is not configured.",
      };
    }

    // Retrieve order status directly from Cashfree
    const cfOrder = await getCashfreeOrder(orderId);

    if (cfOrder.order_status !== "PAID") {
      return {
        success: false,
        paymentStatus: cfOrder.order_status,
        error: `Payment is not completed. Current status: ${cfOrder.order_status}`,
      };
    }

    // Verify amount matches the plan price
    const expectedPrice = PLAN_PRICES_INR[expectedPlan];
    if (Math.round(cfOrder.order_amount) !== expectedPrice) {
      return {
        success: false,
        error: `Order amount mismatch. Expected ₹${expectedPrice}, got ₹${cfOrder.order_amount}`,
      };
    }

    // Activate the studio plan
    const canonicalCapabilities = PLAN_CAPABILITIES[expectedPlan];
    if (!canonicalCapabilities) {
      return { success: false, error: "The selected plan is not configured." };
    }

    const { updateStudioCapabilities } = await import("@focoman/entitlements");
    await updateStudioCapabilities(
      studioSlug,
      canonicalCapabilities,
      undefined,
      expectedPlan
    );

    const existingStudio = await getStudioBySlug(studioSlug);
    await updateStudio(studioSlug, {
      features: {
        oms: true,
        crm: true,
        erp: true,
        whatsapp: expectedPlan === "PROFESSIONAL",
        autoAssignCrew: existingStudio?.features?.autoAssignCrew ?? true,
        ...(existingStudio?.features?.autoAssignCrewConfigured !== undefined
          ? { autoAssignCrewConfigured: existingStudio.features.autoAssignCrewConfigured }
          : {}),
      },
    });

    return {
      success: true,
      plan: expectedPlan,
      orderId,
      paymentStatus: "PAID",
    };
  } catch (err: unknown) {
    console.error("[verifyAndActivatePlanAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to verify and activate studio plan.",
    };
  }
}

