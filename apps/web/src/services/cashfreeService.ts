import "server-only";
import crypto from "node:crypto";
import { CASHFREE_CONFIG } from "@focoman/config";
import type {
  CashfreeCreateOrderPayload,
  CashfreeOrderResponse,
} from "@focoman/types";

/**
 * Returns whether Cashfree credentials are set in the environment.
 */
export function isCashfreeConfigured(): boolean {
  return CASHFREE_CONFIG.isConfigured;
}

/**
 * Returns safe status information about Cashfree configuration without exposing secrets.
 */
export function getCashfreeConfigStatus() {
  return {
    configured: isCashfreeConfigured(),
    env: CASHFREE_CONFIG.env,
    apiVersion: CASHFREE_CONFIG.apiVersion,
  };
}

/**
 * Helper to build standard Cashfree HTTP headers.
 */
function getCashfreeHeaders(): Record<string, string> {
  if (!isCashfreeConfigured()) {
    throw new Error(
      "Cashfree is not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in your environment."
    );
  }

  return {
    "x-client-id": CASHFREE_CONFIG.appId,
    "x-client-secret": CASHFREE_CONFIG.secretKey,
    "x-api-version": CASHFREE_CONFIG.apiVersion,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Create a Payment Gateway Order in Cashfree.
 * Returns order details including `payment_session_id`.
 */
export async function createCashfreeOrder(
  payload: CashfreeCreateOrderPayload
): Promise<CashfreeOrderResponse> {
  const url = `${CASHFREE_CONFIG.baseUrl}/orders`;
  const headers = getCashfreeHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json()) as CashfreeOrderResponse;

  if (!response.ok) {
    const errorMsg =
      data.message ||
      data.code ||
      `Cashfree order creation failed with HTTP status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Fetch Order details from Cashfree by order ID.
 */
export async function getCashfreeOrder(
  orderId: string
): Promise<CashfreeOrderResponse> {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) {
    throw new Error("Cashfree order ID is required.");
  }

  const url = `${CASHFREE_CONFIG.baseUrl}/orders/${encodeURIComponent(cleanOrderId)}`;
  const headers = getCashfreeHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const data = (await response.json()) as CashfreeOrderResponse;

  if (!response.ok) {
    const errorMsg =
      data.message ||
      data.code ||
      `Failed to retrieve Cashfree order (${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * Fetch Payment attempts for a Cashfree order.
 */
export async function getCashfreeOrderPayments(orderId: string): Promise<any[]> {
  const cleanOrderId = orderId.trim();
  if (!cleanOrderId) {
    throw new Error("Cashfree order ID is required.");
  }

  const url = `${CASHFREE_CONFIG.baseUrl}/orders/${encodeURIComponent(cleanOrderId)}/payments`;
  const headers = getCashfreeHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  try {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Verify webhook signature sent by Cashfree.
 * Cashfree computes HMAC-SHA256 of `${timestamp}${rawBody}` using secret key.
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!CASHFREE_CONFIG.secretKey || !signature || !timestamp) {
    return false;
  }

  try {
    const payload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", CASHFREE_CONFIG.secretKey)
      .update(payload)
      .digest("base64");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const signatureBuffer = Buffer.from(signature, "utf-8");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

