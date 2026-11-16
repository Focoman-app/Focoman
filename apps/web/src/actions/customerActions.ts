"use server";

import { randomUUID } from "crypto";
import {
  getCustomersByStudio,
  getDeletedCustomersByStudio,
  getCustomerById,
  getCustomerByIdIncludeDeleted,
  saveCustomer,
  updateCustomer,
  softDeleteCustomer,
  restoreCustomer,
} from "@focoman/db";
import { Customer } from "@focoman/types";
import { CreateCustomerSchema, UpdateCustomerSchema } from "@focoman/validation";
import { isContactMatch } from "@focoman/domain";
import { requireVerifiedUser, requireStudioOwner } from "@/lib/serverAuth";
import { hasStudioCapability } from "@/lib/entitlementAuth";

/**
 * Server Actions for Customer Management (CRM)
 * Full CRUD: Create, Read (active + deleted), Update, Soft-Delete, Restore.
 * Enforces authenticated user, authorized studio, and resource ownership.
 */

export async function getStudioCustomersAction(
  studioSlug: string,
  idToken: string
): Promise<Customer[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  return await getCustomersByStudio(studioSlug);
}

export async function getDeletedStudioCustomersAction(
  studioSlug: string,
  idToken: string
): Promise<Customer[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  return await getDeletedCustomersByStudio(studioSlug);
}

export async function getCustomerAction(
  customerId: string,
  studioSlug: string,
  idToken: string
): Promise<Customer | null> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  
  const customer = await getCustomerById(customerId);
  if (!customer) return null;
  // Resource ownership validation
  if (customer.studioId !== studioSlug.toLowerCase()) {
    throw new Error("Access denied: Customer does not belong to the authorized studio.");
  }
  return customer;
}

export async function createCustomerAction(input: {
  studioId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notifyWhatsApp?: boolean;
  notifyEmail?: boolean;
  idToken: string;
}): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const validated = CreateCustomerSchema.parse({
      studioId: input.studioId,
      name: input.name,
      phone: input.phone || undefined,
      email: input.email || undefined,
      address: input.address || undefined,
      notifyWhatsApp: input.notifyWhatsApp,
      notifyEmail: input.notifyEmail,
    });

    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, validated.studioId);

    if (
      validated.notifyWhatsApp &&
      !(await hasStudioCapability(validated.studioId, "WHATSAPP_OPERATIONS"))
    ) {
      return {
        success: false,
        error: "WhatsApp alerts and notifications require the Professional (₹1,999/mo) plan.",
      };
    }

    // Duplicate detection check
    const existingCustomers = await getCustomersByStudio(validated.studioId);
    const duplicate = existingCustomers.find((c) =>
      isContactMatch(
        { phone: validated.phone, email: validated.email },
        { phone: c.phone, email: c.email }
      )
    );

    if (duplicate) {
      return {
        success: false,
        error: `A client with matching contact details already exists (${duplicate.name}).`,
      };
    }

    const customerId = `CUS-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const customer: Customer = {
      id: customerId,
      studioId: validated.studioId.toLowerCase(),
      name: validated.name.trim(),
      phone: validated.phone?.trim() || undefined,
      email: validated.email?.trim() || undefined,
      address: validated.address?.trim() || undefined,
      ...(validated.notifyWhatsApp !== undefined
        ? { notifyWhatsApp: Boolean(validated.notifyWhatsApp && validated.phone?.trim()) }
        : {}),
      ...(validated.notifyEmail !== undefined
        ? { notifyEmail: Boolean(validated.notifyEmail && validated.email?.trim()) }
        : {}),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await saveCustomer(customer);
    return { success: true, customer };
  } catch (err: unknown) {
    console.error("[createCustomerAction] Error:", err);
    return {
      success: false,
      error: (err as any)?.errors?.[0]?.message || (err instanceof Error ? err.message : "Failed to create customer"),
    };
  }
}

export async function updateCustomerAction(input: {
  customerId: string;
  studioId: string;
  updates: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notifyWhatsApp?: boolean;
    notifyEmail?: boolean;
  };
  idToken: string;
}): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const validated = UpdateCustomerSchema.parse({
      customerId: input.customerId,
      studioId: input.studioId,
      name: input.updates.name,
      phone: input.updates.phone,
      email: input.updates.email,
      address: input.updates.address,
      notifyWhatsApp: input.updates.notifyWhatsApp,
      notifyEmail: input.updates.notifyEmail,
    });

    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, validated.studioId);

    if (
      validated.notifyWhatsApp &&
      !(await hasStudioCapability(validated.studioId, "WHATSAPP_OPERATIONS"))
    ) {
      return {
        success: false,
        error: "WhatsApp alerts and notifications require the Professional (₹1,999/mo) plan.",
      };
    }

    const existing = await getCustomerById(validated.customerId);
    if (!existing) {
      return { success: false, error: "Customer not found." };
    }
    // Resource ownership validation
    if (existing.studioId !== validated.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Customer does not belong to this studio." };
    }

    // Check for conflicting contact details on another customer
    if (validated.phone || validated.email) {
      const allCustomers = await getCustomersByStudio(validated.studioId);
      const conflict = allCustomers.find((c) =>
        c.id !== validated.customerId &&
        isContactMatch(
          { phone: validated.phone, email: validated.email },
          { phone: c.phone, email: c.email }
        )
      );
      if (conflict) {
        return {
          success: false,
          error: `Contact details already belong to another client (${conflict.name}).`,
        };
      }
    }

    const updated = await updateCustomer(validated.customerId, {
      ...(validated.name ? { name: validated.name.trim() } : {}),
      ...(validated.phone !== undefined ? { phone: validated.phone.trim() || undefined } : {}),
      ...(validated.email !== undefined ? { email: validated.email.trim() || undefined } : {}),
      ...(validated.address !== undefined ? { address: validated.address.trim() || undefined } : {}),
      ...(validated.notifyWhatsApp !== undefined
        ? { notifyWhatsApp: validated.notifyWhatsApp }
        : {}),
      ...(validated.notifyEmail !== undefined
        ? { notifyEmail: validated.notifyEmail }
        : {}),
    });

    return { success: true, customer: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateCustomerAction] Error:", err);
    return {
      success: false,
      error: (err as any)?.errors?.[0]?.message || (err instanceof Error ? err.message : "Failed to update customer"),
    };
  }
}

export async function deleteCustomerAction(input: {
  customerId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const existing = await getCustomerById(input.customerId);
    if (!existing) {
      return { success: false, error: "Customer not found." };
    }
    if (existing.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Customer does not belong to this studio." };
    }

    await softDeleteCustomer(input.customerId, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    console.error("[deleteCustomerAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete customer" };
  }
}

export async function restoreCustomerAction(input: {
  customerId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const customer = await getCustomerByIdIncludeDeleted(input.customerId);
    if (!customer || customer.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Customer not found in the authorized studio." };
    }

    await restoreCustomer(input.customerId);
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreCustomerAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore customer" };
  }
}

export async function getCustomerAuthorizedOrdersHistoryAction(idToken: string) {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const customerId = decoded.uid;

    const { getCustomerOrdersHistory, getStudioBySlug } = await import("@focoman/db");
    const { toCustomerOrderView } = await import("@focoman/domain");

    const orders = await getCustomerOrdersHistory(customerId);

    // Transform into clean CustomerOrderView DTOs
    const historyPromises = orders.map(async (order) => {
      const studio = await getStudioBySlug(order.studioId);
      return toCustomerOrderView(order, studio?.name || "Studio");
    });

    const sanitizedHistory = await Promise.all(historyPromises);

    return { success: true, history: sanitizedHistory };
  } catch (err: unknown) {
    console.error("[getCustomerAuthorizedOrdersHistoryAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch customer order history" };
  }
}

