import "server-only";
import {
  generateOrderIdentifiers,
  generateSixDigitPasskeyPin,
  generateTimestampDigits,
  prefixLetters,
} from "@/lib/invitationPasscode";
import { CreateOrderSchema } from "@focoman/validation";
import {
  generateResourceSuggestions,
  generateWorkflowTasks,
  getStudioCalendarDate,
  getStudioTimestampIST,
  isContactMatch,
} from "@focoman/domain";
import {
  getCustomersByStudio,
  getDeletedOrdersByStudio,
  getMembersByStudio,
  getOrderById,
  getOrderByIdIncludeDeleted,
  getOrdersByStudio,
  getStudioBySlug,
  getTasksByOrder,
  restoreOrder,
  saveCustomer,
  saveOrder,
  saveTasks,
  softDeleteOrder,
  updateCustomer,
  updateOrder,
} from "@focoman/db";
import type {
  Order,
  OrderAuditEntry,
  OrderStatus,
  PaymentStatus,
  ResourceAssignment,
  Task,
} from "@focoman/types";
import {
  requireStudioMember,
  requireStudioOwner,
  requireVerifiedUser,
} from "@/lib/serverAuth";
import { sendOrderConfirmedCustomerEmail } from "@/services/emailService";
import { hasStudioCapability } from "@/lib/entitlementAuth";
import { getFreeWorkflowTaskAssignee } from "@/lib/erpCrewPolicy";
import { requireAssignedOrderAccess } from "./orderAccessHelpers";

export async function createOrderCore(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  tasks?: Task[];
  error?: string;
}> {
  try {
    const validated = CreateOrderSchema.parse(rawInput);

    const decoded = await requireVerifiedUser(validated.idToken);
    await requireStudioOwner(decoded.uid, validated.studioId);

    if (
      validated.notifyWhatsApp &&
      !(await hasStudioCapability(validated.studioId, "WHATSAPP_OPERATIONS"))
    ) {
      return {
        success: false,
        error: "WhatsApp notifications require the ₹1,999 Professional plan.",
      };
    }

    const now = new Date();
    const { orderId, customerId } = generateOrderIdentifiers(validated.studioId, now);
    const nowIso = now.toISOString();

    const remainingAmount = Math.max(0, validated.finalConfirmedPrice - validated.advanceAmount);
    const initialPaymentStatus: PaymentStatus =
      validated.advanceAmount >= validated.finalConfirmedPrice && validated.finalConfirmedPrice > 0
        ? "PAID"
        : validated.advanceAmount > 0
        ? "ADVANCE_RECEIVED"
        : "PENDING";

    const customerPhone = validated.customerPhone?.trim() || undefined;
    const customerEmail = validated.customerEmail?.trim() || undefined;
    const passkeyPin = validated.passkeyPin?.trim() || generateSixDigitPasskeyPin();

    const studioPrefix = prefixLetters(validated.studioId);
    const finalPasskey = orderId;

    const todayStr = getStudioCalendarDate(now);
    const initialOrderStatus: OrderStatus =
      validated.eventDate < todayStr ? "POST_EVENT_IN_PROGRESS" : "AWAITING_EVENT";

    const [existingCustomers, studioMembers, studio, hasErp] = await Promise.all([
      getCustomersByStudio(validated.studioId),
      getMembersByStudio(validated.studioId),
      getStudioBySlug(validated.studioId),
      hasStudioCapability(validated.studioId, "STUDIO_ERP"),
    ]);
    const matchedCustomer = existingCustomers.find((c) =>
      isContactMatch(
        { phone: customerPhone, email: customerEmail },
        { phone: c.phone, email: c.email }
      )
    );
    const effectiveCustomerId = matchedCustomer ? matchedCustomer.id : customerId;

    const suggestions = hasErp
      ? generateResourceSuggestions(
          validated.eventDate,
          ["PHOTOGRAPHY", "VIDEOGRAPHY", "ALBUM_DESIGN", "PHOTO_EDITING"],
          studioMembers,
          []
        )
      : [];

    const autoAssignEnabled = hasErp && studio?.features?.autoAssignCrew !== false;
    const assignedResources: ResourceAssignment[] = [];
    if (autoAssignEnabled) {
      const usedMembers = new Set<string>();
      for (const s of suggestions) {
        if (s.availableOnDate && !usedMembers.has(s.memberId) && assignedResources.length < 2) {
          usedMembers.add(s.memberId);
          assignedResources.push({
            memberId: s.memberId,
            memberName: s.memberName,
            skill: s.skill,
            availabilityConfirmed: null,
          });
        }
      }
    }

    const newOrder: Order = {
      id: orderId,
      studioId: validated.studioId.toLowerCase(),
      orderNumber: orderId,
      customer: {
        id: effectiveCustomerId,
        name: validated.customerName,
        ...(customerPhone ? { phone: customerPhone } : {}),
        ...(customerEmail ? { email: customerEmail } : {}),
      },
      eventType: validated.eventType,
      eventDate: validated.eventDate,
      ...(validated.eventLocation ? { eventLocation: validated.eventLocation } : {}),
      services: validated.services,
      packages: validated.packages || [],
      pricing: {
        estimatedPrice: validated.estimatedPrice,
        finalConfirmedPrice: validated.finalConfirmedPrice,
        advanceAmount: validated.advanceAmount,
        advanceDate: nowIso.split("T")[0],
        installments: [],
        remainingAmount,
      },
      paymentStatus: initialPaymentStatus,
      orderStatus: initialOrderStatus,
      assignedResources,
      resourceSuggestions: suggestions,
      trackingPasskey: finalPasskey,
      passkeyPin,
      ...(validated.notifyWhatsApp !== undefined ? { notifyWhatsApp: validated.notifyWhatsApp } : {}),
      ...(validated.notifySms !== undefined ? { notifySms: validated.notifySms } : {}),
      ...(validated.notifyEmail !== undefined ? { notifyEmail: validated.notifyEmail } : {}),
      isDeleted: false,
      createdBy: decoded.name || decoded.email || "Studio Owner",
      createdByRole: "Owner",
      auditLog: [
        {
          id: `audit_${Date.now()}_created`,
          timestamp: getStudioTimestampIST(now),
          actorName: decoded.name || decoded.email || "Studio Owner",
          actorRole: "Owner",
          action: "Order Registered",
          details: `Registered confirmed order for ${validated.eventType} · Confirmed Price: ₹${validated.finalConfirmedPrice.toLocaleString()}`,
        },
        ...(validated.advanceAmount > 0
          ? [
              {
                id: `audit_${Date.now() + 1000}_adv`,
                timestamp: getStudioTimestampIST(new Date(now.getTime() + 1000)),
                actorName: decoded.name || decoded.email || "Studio Owner",
                actorRole: "Owner" as const,
                action: "Advance Payment Recorded",
                details: `Recorded advance payment of ₹${validated.advanceAmount.toLocaleString()}`,
              },
            ]
          : []),
        ...(assignedResources.length > 0
          ? [
              {
                id: `audit_${Date.now() + 2000}_auto_crew`,
                timestamp: getStudioTimestampIST(new Date(now.getTime() + 2000)),
                actorName: "Studio Automation",
                actorRole: "System" as const,
                action: "Crew Auto-Assigned",
                details: `Auto-assigned available crew based on skill match: ${assignedResources
                  .map((r) => `${r.memberName} (${r.skill})`)
                  .join(", ")}`,
              },
            ]
          : []),
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const studioOwner = getFreeWorkflowTaskAssignee(hasErp, {
      memberId: studio?.ownerId || decoded.uid,
      memberName: studio?.ownerName || decoded.name || decoded.email || "Studio Owner",
    });
    const workflowTasks = generateWorkflowTasks(orderId, validated.studioId, validated.services).map(
      (t, idx) => {
        const { dateStamp, timeStamp } = generateTimestampDigits(now);
        const seqSuffix = String(idx + 1).padStart(2, "0");
        const matchedCrew =
          autoAssignEnabled && assignedResources.length > 0
            ? assignedResources.find((r) => r.skill.includes(t.serviceCategory)) || assignedResources[0]
            : undefined;

        return {
          ...t,
          id: `TSK-${studioPrefix}-${dateStamp}-${timeStamp}-${seqSuffix}`,
          assignedMemberId: matchedCrew?.memberId || studioOwner?.memberId || t.assignedMemberId || "",
          assignedMemberName: matchedCrew?.memberName || studioOwner?.memberName || t.assignedMemberName || "Unassigned",
          createdAt: nowIso,
          updatedAt: nowIso,
          isDeleted: false,
        };
      }
    );

    const customerPersistence = matchedCustomer
      ? updateCustomer(matchedCustomer.id, {
          ...(customerPhone && !matchedCustomer.phone ? { phone: customerPhone } : {}),
          ...(customerEmail && !matchedCustomer.email ? { email: customerEmail } : {}),
          ...(validated.eventLocation && !matchedCustomer.address
            ? { address: validated.eventLocation }
            : {}),
        })
      : saveCustomer({
          id: customerId,
          studioId: validated.studioId.toLowerCase(),
          name: validated.customerName,
          ...(customerPhone ? { phone: customerPhone } : {}),
          ...(customerEmail ? { email: customerEmail } : {}),
          ...(validated.eventLocation ? { address: validated.eventLocation } : {}),
          isDeleted: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

    await Promise.all([
      saveOrder(newOrder),
      saveTasks(workflowTasks),
      customerPersistence,
    ]);

    if (customerEmail) {
      void (async () => {
        try {
          const studio = await getStudioBySlug(validated.studioId);
          await sendOrderConfirmedCustomerEmail({
            toEmail: customerEmail,
            customerName: validated.customerName,
            orderId: newOrder.id,
            eventTitle: validated.eventType,
            eventDate: validated.eventDate,
            passkey: finalPasskey,
            studioName: studio?.name || validated.studioId,
            studioPhone: studio?.ownerPhone,
          });
        } catch (emailErr) {
          console.error("[createOrderAction] Customer confirmation email dispatch failed:", emailErr);
        }
      })();
    }

    return { success: true, order: newOrder, tasks: workflowTasks };
  } catch (err: unknown) {
    console.error("[createOrderAction] Error:", err);
    return {
      success: false,
      error:
        (err as any)?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : "Failed to create order"),
    };
  }
}

export async function getStudioOrdersCore(
  studioSlug: string,
  idToken: string
): Promise<Order[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  const orders = await getOrdersByStudio(studioSlug);
  const todayStr = getStudioCalendarDate();

  const updatedOrders: Order[] = [];
  for (const order of orders) {
    if (order.orderStatus === "AWAITING_EVENT" && order.eventDate < todayStr) {
      const transitioned: Order = {
        ...order,
        orderStatus: "POST_EVENT_IN_PROGRESS",
        updatedAt: new Date().toISOString(),
      };
      void updateOrder(order.id, { orderStatus: "POST_EVENT_IN_PROGRESS" });
      updatedOrders.push(transitioned);
    } else {
      updatedOrders.push(order);
    }
  }

  return updatedOrders;
}

export async function getDeletedStudioOrdersCore(
  studioSlug: string,
  idToken: string
): Promise<Order[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  return await getDeletedOrdersByStudio(studioSlug);
}

export async function getOrderCore(
  orderId: string,
  studioSlug: string,
  idToken: string
): Promise<{ order: Order | null; tasks: Task[] }> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    await requireStudioOwner(decoded.uid, studioSlug);

    const order = await getOrderById(orderId);
    if (!order) return { order: null, tasks: [] };
    if (order.studioId.toLowerCase() !== studioSlug.toLowerCase()) {
      return { order: null, tasks: [] };
    }
    const todayStr = getStudioCalendarDate();
    let currentOrder = order;
    if (order.orderStatus === "AWAITING_EVENT" && order.eventDate < todayStr) {
      const autoEventLog: OrderAuditEntry = {
        id: `audit_${Date.now()}_auto_event`,
        timestamp: `${order.eventDate} 00:00`,
        actorName: "Automated System",
        actorRole: "System",
        action: "Event Date Passed",
        details: `Event date reached — Post-event production workflow started automatically`,
      };
      const existingAudit = order.auditLog || [];
      const updatedAudit = existingAudit.some((a) => a.action === "Event Date Passed")
        ? existingAudit
        : [...existingAudit, autoEventLog];
      currentOrder = {
        ...order,
        orderStatus: "POST_EVENT_IN_PROGRESS",
        auditLog: updatedAudit,
        updatedAt: new Date().toISOString(),
      };
      void updateOrder(order.id, {
        orderStatus: "POST_EVENT_IN_PROGRESS",
        auditLog: updatedAudit,
      });
    }
    const tasks = await getTasksByOrder(order.id);
    return { order: currentOrder, tasks };
  } catch (err) {
    console.error("[getOrderAction] Error:", err);
    return { order: null, tasks: [] };
  }
}

export async function getOrderTasksCore(
  orderId: string,
  studioSlug: string,
  idToken: string
): Promise<Task[]> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    const membership = await requireStudioMember(decoded.uid, studioSlug);
    const order = await getOrderById(orderId);
    if (!order || order.studioId.toLowerCase() !== studioSlug.toLowerCase()) {
      return [];
    }
    const member = await requireAssignedOrderAccess(
      membership,
      decoded.email,
      studioSlug,
      order
    );
    const tasks = await getTasksByOrder(order.id);
    return member
      ? tasks.filter((task) => task.assignedMemberId === member.id)
      : tasks;
  } catch (err) {
    console.error("[getOrderTasksAction] Error:", err);
    return [];
  }
}

export async function updateOrderCore(input: {
  orderId: string;
  studioId: string;
  updates: Partial<
    Pick<Order, "eventType" | "eventDate" | "eventLocation" | "services" | "packages">
  >;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const existing = await getOrderById(input.orderId);
    if (!existing) {
      return { success: false, error: "Order not found." };
    }
    if (existing.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    const updated = await updateOrder(input.orderId, input.updates);
    return { success: true, order: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateOrderAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update order",
    };
  }
}

export async function deleteOrderCore(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const existing = await getOrderById(input.orderId);
    if (!existing) {
      return { success: false, error: "Order not found." };
    }
    if (existing.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    await softDeleteOrder(input.orderId, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    console.error("[deleteOrderAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete order",
    };
  }
}

export async function restoreOrderCore(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const order = await getOrderByIdIncludeDeleted(input.orderId);
    if (!order || order.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Order not found in the authorized studio." };
    }

    await restoreOrder(input.orderId);
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreOrderAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restore order",
    };
  }
}

export async function cancelOrderCore(input: {
  orderId: string;
  studioId: string;
  cancellationReason: string;
  refundNotes?: string;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const existingOrder = await getOrderById(input.orderId);
    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }
    if (existingOrder.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    const cancelLog: OrderAuditEntry = {
      id: `audit_${Date.now()}_cancelled`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: decoded.name || decoded.email || "Studio Owner",
      actorRole: "Owner",
      action: "Order Cancelled",
      details: `Cancelled order — Reason: "${
        input.cancellationReason?.trim() || "Cancelled by studio owner"
      }"`,
    };

    const updated = await updateOrder(input.orderId, {
      orderStatus: "CANCELLED",
      auditLog: [...(existingOrder.auditLog || []), cancelLog],
      cancellationInfo: {
        cancellationReason: input.cancellationReason?.trim() || "Cancelled by studio owner",
        cancelledBy: decoded.name || decoded.email || "Studio Owner",
        cancelledAt: new Date().toISOString(),
        refundNotes: input.refundNotes,
      },
    });

    return { success: true, order: updated || undefined };
  } catch (err: unknown) {
    console.error("[cancelOrderAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel order",
    };
  }
}
