"use server";

import { generateOrderIdentifiers, generateTimestampDigits, prefixLetters } from "@/lib/invitationPasscode";
import {
  CreateOrderSchema,
  AssignResourceSchema,
  UpdateTaskStatusSchema,
  UpdatePaymentSchema,
} from "@focoman/validation";
import { canCompleteOrder, generateWorkflowTasks, toCustomerTrackingView, getStudioCalendarDate, getStudioTimestampIST, isContactMatch } from "@focoman/domain";
import {
  getOrdersByStudio,
  getDeletedOrdersByStudio,
  getOrderById,
  getOrderByIdIncludeDeleted,
  getOrderByPasskey,
  getOrdersByCustomerUid,
  getStudioBySlug,
  saveOrder,
  updateOrder,
  updateStudio,
  softDeleteOrder,
  restoreOrder,
  getTasksByOrder,
  getTasksByMember,
  saveTasks,
  saveTask,
  updateTask,
  softDeleteTask,
  restoreTask,
  getTaskById,
  getTaskByIdIncludeDeleted,
  getMembersByStudio,
  getMembershipsByStudio,
  getMembershipByUidAndStudio,
  saveCustomer,
  getCustomersByStudio,
  updateCustomer,
  getMemberById,
} from "@focoman/db";
import { CustomerTrackingView, Order, Task, StudioMember, OrderStatus, TaskStatus, PaymentStatus, OrderCollaborator, OrderInstallment, OrderAuditEntry, OrderDriveDeliverable } from "@focoman/types";
import { requireVerifiedUser, requireStudioMember, requireStudioOwner, getAdminAuthInstance } from "@/lib/serverAuth";
import { sendOrderConfirmedCustomerEmail, sendCrewShootAssignedEmail, sendPipelineStatusUpdateEmail, sendGalleryReadyCustomerEmail, sendPaymentReminderCustomerEmail } from "@/services/emailService";

/**
 * Server Actions for Order Lifecycle, Tasks & Post-Event Production Pipeline (OMS)
 * Full CRUD, soft-delete, and restoration for both Orders and Tasks.
 * Enforces authenticated identity, authorized studio, and resource ownership.
 */

async function findActiveMemberRecord(studioId: string, email?: string): Promise<StudioMember | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const members = await getMembersByStudio(studioId);
  return members.find((member) =>
    member.status === "ACTIVE" && member.email.trim().toLowerCase() === normalizedEmail
  ) || null;
}

async function requireAssignedOrderAccess(
  membership: Awaited<ReturnType<typeof requireStudioMember>>,
  email: string | undefined,
  studioId: string,
  order: Order
): Promise<StudioMember | null> {
  if (membership.role === "STUDIO_OWNER") {
    return null;
  }
  const member = await findActiveMemberRecord(studioId, email);
  if (!member) throw new Error("No active crew profile is linked to this account.");

  const tasks = await getTasksByMember(studioId, member.id);
  const isAssigned = order.assignedResources?.some((resource) => resource.memberId === member.id)
    || tasks.some((task) => task.orderId === order.id);
  if (!isAssigned) throw new Error("Access denied: This order is not assigned to your crew profile.");
  return member;
}

export async function createOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  tasks?: Task[];
  error?: string;
}> {
  try {
    const validated = CreateOrderSchema.parse(rawInput);

    const decoded = await requireVerifiedUser(validated.idToken);
    await requireStudioOwner(decoded.uid, validated.studioId);

    const now = new Date();
    const { orderId, passkey, customerId } = generateOrderIdentifiers(validated.studioId, now);
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
    const passkeyPin = validated.passkeyPin?.trim() || undefined;

    const studioPrefix = prefixLetters(validated.studioId);
    const finalPasskey = orderId;

    const todayStr = getStudioCalendarDate(now);
    const initialOrderStatus: OrderStatus =
      validated.eventDate < todayStr ? "POST_EVENT_IN_PROGRESS" : "AWAITING_EVENT";

    // Deduplicate/link customer by phone or email
    const existingCustomers = await getCustomersByStudio(validated.studioId);
    const matchedCustomer = existingCustomers.find((c) =>
      isContactMatch(
        { phone: customerPhone, email: customerEmail },
        { phone: c.phone, email: c.email }
      )
    );
    const effectiveCustomerId = matchedCustomer ? matchedCustomer.id : customerId;

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
      assignedResources: [],
      trackingPasskey: finalPasskey,
      ...(passkeyPin ? { passkeyPin } : {}),
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
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const workflowTasks = generateWorkflowTasks(orderId, validated.studioId, validated.services).map((t, idx) => {
      const { dateStamp, timeStamp } = generateTimestampDigits(now);
      const seqSuffix = String(idx + 1).padStart(2, "0");

      return {
        ...t,
        id: `TSK-${studioPrefix}-${dateStamp}-${timeStamp}-${seqSuffix}`,
        assignedMemberId: t.assignedMemberId || "",
        assignedMemberName: t.assignedMemberName || "Unassigned",
        createdAt: nowIso,
        updatedAt: nowIso,
        isDeleted: false,
      };
    });

    const customerPersistence = matchedCustomer
      ? updateCustomer(matchedCustomer.id, {
          ...(customerPhone && !matchedCustomer.phone ? { phone: customerPhone } : {}),
          ...(customerEmail && !matchedCustomer.email ? { email: customerEmail } : {}),
          ...(validated.eventLocation && !matchedCustomer.address ? { address: validated.eventLocation } : {}),
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
      error: (err as any)?.errors?.[0]?.message || (err instanceof Error ? err.message : "Failed to create order"),
    };
  }
}

export async function getStudioOrdersAction(
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

export async function getDeletedStudioOrdersAction(
  studioSlug: string,
  idToken: string
): Promise<Order[]> {
  const decoded = await requireVerifiedUser(idToken);
  await requireStudioOwner(decoded.uid, studioSlug);
  return await getDeletedOrdersByStudio(studioSlug);
}

export async function getOrderAction(
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
      void updateOrder(order.id, { orderStatus: "POST_EVENT_IN_PROGRESS", auditLog: updatedAudit });
    }
    const tasks = await getTasksByOrder(order.id);
    return { order: currentOrder, tasks };
  } catch (err) {
    console.error("[getOrderAction] Error:", err);
    return { order: null, tasks: [] };
  }
}

export async function getOrderTasksAction(
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
    const member = await requireAssignedOrderAccess(membership, decoded.email, studioSlug, order);
    const tasks = await getTasksByOrder(order.id);
    return member ? tasks.filter((task) => task.assignedMemberId === member.id) : tasks;
  } catch (err) {
    console.error("[getOrderTasksAction] Error:", err);
    return [];
  }
}

export async function updateOrderAction(input: {
  orderId: string;
  studioId: string;
  updates: Partial<Pick<Order, "eventType" | "eventDate" | "eventLocation" | "services" | "packages">>;
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
    return { success: false, error: err instanceof Error ? err.message : "Failed to update order" };
  }
}

export async function deleteOrderAction(input: {
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
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete order" };
  }
}

export async function restoreOrderAction(input: {
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
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore order" };
  }
}

export async function getOrderByPasskeyAction(passkey: string): Promise<{
  success: boolean;
  view?: CustomerTrackingView;
  error?: string;
}> {
  try {
    if (!passkey || passkey.trim().length === 0) {
      return { success: false, error: "Tracking passkey is required." };
    }

    const cleanPasskey = passkey.trim().toUpperCase();
    const order = await getOrderByPasskey(cleanPasskey);

    if (!order) {
      return {
        success: false,
        error: `No order was found for access code "${passkey}".`,
      };
    }

    const tasks = await getTasksByOrder(order.id);
    const cleanStudioId = order.studioId.toLowerCase();
    const studio = await getStudioBySlug(cleanStudioId);
    const staffEmails: string[] = [];
    const staffUids: string[] = [];

    let studioOwnerId = studio?.ownerId;
    let studioOwnerEmail = studio?.ownerEmail ? studio.ownerEmail.toLowerCase() : undefined;

    if (studioOwnerEmail) staffEmails.push(studioOwnerEmail);
    if (studioOwnerId) staffUids.push(studioOwnerId);

    // Fetch all active studio memberships to capture owner and all crew/staff members
    try {
      const memberships = await getMembershipsByStudio(cleanStudioId);
      const adminAuth = getAdminAuthInstance();
      for (const m of memberships) {
        if (m.uid) {
          staffUids.push(m.uid);
          if (m.role === 'STUDIO_OWNER' && !studioOwnerId) {
            studioOwnerId = m.uid;
          }
          try {
            const userRecord = await adminAuth.getUser(m.uid);
            if (userRecord.email) {
              const emailLower = userRecord.email.toLowerCase();
              staffEmails.push(emailLower);
              if (m.role === 'STUDIO_OWNER' && !studioOwnerEmail) {
                studioOwnerEmail = emailLower;
              }
            }
          } catch {
            // User not found in auth (e.g. deleted account)
          }
        }
      }

      const studioMembers = await getMembersByStudio(cleanStudioId);
      studioMembers.forEach((m) => {
        if (m.email) staffEmails.push(m.email.toLowerCase());
      });
    } catch (err) {
      console.warn("[getOrderByPasskeyAction] Error fetching members:", err);
    }

    const view = toCustomerTrackingView(order, studio?.name || "Studio", tasks, {
      studioId: order.studioId,
      studioOwnerId,
      studioOwnerEmail,
      studioLogoUrl: studio?.logoUrl,
      studioCity: studio?.city,
      studioPhone: studio?.ownerPhone,
      studioBillingProfile: studio?.billingProfile,
      staffEmails: Array.from(new Set(staffEmails)),
      staffUids: Array.from(new Set(staffUids)),
    });
    return { success: true, view };
  } catch (err: unknown) {
    console.error("[getOrderByPasskeyAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to retrieve order." };
  }
}

// ------------------------------------------------------------------
// TASK CRUD OPERATIONS
// ------------------------------------------------------------------

export async function createTaskAction(input: {
  orderId: string;
  studioId: string;
  title: string;
  serviceCategory: 'PHOTOGRAPHY' | 'VIDEOGRAPHY' | 'ALBUM' | 'GENERAL';
  assignedMemberId?: string;
  assignedMemberName?: string;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const order = await getOrderById(input.orderId);
    if (!order || order.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Order not found in authorized studio." };
    }

    const existingTasks = await getTasksByOrder(input.orderId);
    const { dateStamp, timeStamp } = generateTimestampDigits();
    const taskId = `TSK-${prefixLetters(input.studioId)}-${dateStamp}-${timeStamp}`;
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      orderId: input.orderId,
      studioId: input.studioId.toLowerCase(),
      title: input.title.trim(),
      serviceCategory: input.serviceCategory,
      assignedMemberId: input.assignedMemberId || 'unassigned',
      assignedMemberName: input.assignedMemberName || 'Unassigned Crew',
      status: 'ASSIGNED',
      sequenceOrder: existingTasks.length + 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await saveTask(task);
    return { success: true, task };
  } catch (err: unknown) {
    console.error("[createTaskAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create task" };
  }
}

export async function updateTaskStatusAction(rawInput: unknown): Promise<{
  success: boolean;
  task?: Task;
  newOrderStatus?: OrderStatus;
  error?: string;
}> {
  try {
    const validated = UpdateTaskStatusSchema.parse(rawInput);

    const decoded = await requireVerifiedUser(validated.idToken);
    const studioId = validated.studioId;
    const membership = await requireStudioMember(decoded.uid, studioId);

    const existingTask = await getTaskById(validated.taskId);
    if (!existingTask || existingTask.studioId !== studioId.toLowerCase() || existingTask.orderId !== validated.orderId) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    const linkedOrder = await getOrderById(validated.orderId);
    if (!linkedOrder || linkedOrder.studioId !== studioId.toLowerCase()) {
      return { success: false, error: "Order not found in authorized studio." };
    }

    const todayStr = getStudioCalendarDate();
    const isEventUpcoming = linkedOrder.eventDate > todayStr || (linkedOrder.eventDate >= todayStr && linkedOrder.orderStatus === "AWAITING_EVENT");
    if (isEventUpcoming && validated.status !== "ASSIGNED" && validated.status !== "AWAITING_EVENT") {
      return {
        success: false,
        error: `Production tasks are locked until the event shoot date (${linkedOrder.eventDate}) has completed.`,
      };
    }

    // Sequential pipeline prerequisite validation
    if (validated.status && validated.status !== "ASSIGNED") {
      const allOrderTasks = await getTasksByOrder(validated.orderId);
      if (existingTask.title.toLowerCase().includes("photo editing")) {
        const rawTask = allOrderTasks.find((t) => t.title.toLowerCase().includes("raw photo"));
        if (rawTask && rawTask.status !== "COMPLETED") {
          return {
            success: false,
            error: "Cannot proceed with Photo Editing until Raw Photo Selection is completed by the customer.",
          };
        }
      }
      if (existingTask.serviceCategory === "ALBUM" || existingTask.title.toLowerCase().includes("album")) {
        const photoEditTask = allOrderTasks.find((t) => t.title.toLowerCase().includes("photo editing"));
        if (photoEditTask && photoEditTask.status !== "COMPLETED") {
          return {
            success: false,
            error: "Cannot proceed with Album Design until Photo Editing is completed and approved.",
          };
        }
      }
      if (existingTask.title.toLowerCase().includes("final delivery")) {
        const pendingOthers = allOrderTasks.filter((t) => t.id !== existingTask.id && t.status !== "COMPLETED");
        if (pendingOthers.length > 0 && validated.status === "COMPLETED") {
          return {
            success: false,
            error: `Cannot complete Final Delivery until all ${pendingOthers.length} preceding production task(s) are completed.`,
          };
        }
      }
    }

    if (membership.role !== "STUDIO_OWNER") {
      const member = await findActiveMemberRecord(studioId, decoded.email);
      if (!member || existingTask.assignedMemberId !== member.id) {
        return { success: false, error: "Access denied: This task is not assigned to your crew profile." };
      }
    }

    const updatedTask = await updateTask(validated.taskId, {
      status: validated.status as TaskStatus,
      reworkNotes: validated.reworkNotes,
    });

    if (!updatedTask) {
      return { success: false, error: "Task not found" };
    }

    const order = linkedOrder;
    let newOrderStatus: OrderStatus | undefined = undefined;

    if (order) {
      const taskAudit: OrderAuditEntry = {
        id: `audit_${Date.now()}_task`,
        timestamp: getStudioTimestampIST(new Date()),
        actorName: decoded.name || decoded.email || existingTask.assignedMemberName || "Crew Member",
        actorRole: membership.role === "STUDIO_OWNER" ? "Owner" : "Member",
        action: "Task Status Updated",
        details: `Updated task "${existingTask.title}" (${existingTask.serviceCategory}) status to ${validated.status}`,
      };

      const allTasks = await getTasksByOrder(validated.orderId);
      const isCompletable = canCompleteOrder(order.paymentStatus, allTasks);

      if (isCompletable && order.orderStatus !== "COMPLETED") {
        await updateOrder(validated.orderId, {
          orderStatus: "COMPLETED",
          auditLog: [...(order.auditLog || []), taskAudit],
        });
        newOrderStatus = "COMPLETED";
      } else if (!isCompletable && order.orderStatus === "AWAITING_EVENT") {
        const hasStarted = allTasks.some((t) => t.status !== "ASSIGNED");
        if (hasStarted) {
          await updateOrder(validated.orderId, {
            orderStatus: "POST_EVENT_IN_PROGRESS",
            auditLog: [...(order.auditLog || []), taskAudit],
          });
          newOrderStatus = "POST_EVENT_IN_PROGRESS";
        } else {
          await updateOrder(validated.orderId, {
            auditLog: [...(order.auditLog || []), taskAudit],
          });
        }
      } else {
        await updateOrder(validated.orderId, {
          auditLog: [...(order.auditLog || []), taskAudit],
        });
      }

      // Background Email Notifications for Status Change
      void (async () => {
        try {
          const studio = await getStudioBySlug(studioId);
          const studioName = studio?.name || studioId;

          // 1. Notify Customer
          if (order.customer?.email) {
            if (validated.status === "COMPLETED" && (existingTask.title.toLowerCase().includes("final delivery") || existingTask.title.toLowerCase().includes("gallery"))) {
              await sendGalleryReadyCustomerEmail({
                toEmail: order.customer.email,
                studioName,
                customerName: order.customer.name,
                orderId: order.id,
                eventTitle: order.eventType,
                passkey: order.trackingPasskey,
              });
            } else {
              await sendPipelineStatusUpdateEmail({
                toEmail: order.customer.email,
                studioName,
                studioSlug: studioId,
                recipientName: order.customer.name,
                orderId: order.id,
                eventTitle: order.eventType,
                taskTitle: existingTask.title,
                newStatus: validated.status,
                details: validated.reworkNotes,
                passkey: order.trackingPasskey,
              });
            }

            // Trigger Payment Due email if Album Design or Final Delivery workflow task is completed AND there is a pending balance
            const isAlbumOrFinalTask = existingTask.serviceCategory === "ALBUM" ||
              existingTask.title.toLowerCase().includes("album") ||
              existingTask.title.toLowerCase().includes("final delivery") ||
              existingTask.title.toLowerCase().includes("gallery");

            if (validated.status === "COMPLETED" && isAlbumOrFinalTask && order.pricing.remainingAmount > 0 && order.paymentStatus !== "PAID") {
              await sendPaymentReminderCustomerEmail({
                toEmail: order.customer.email,
                studioName,
                customerName: order.customer.name,
                orderId: order.id,
                eventTitle: order.eventType,
                amountDue: `₹${order.pricing.remainingAmount.toLocaleString()}`,
                dueDate: order.eventDate,
              });
            }
          }

          // 2. Notify Assigned Crew Member (if any)
          if (existingTask.assignedMemberId && existingTask.assignedMemberId !== "unassigned") {
            const member = await getMemberById(existingTask.assignedMemberId);
            if (member?.email) {
              await sendPipelineStatusUpdateEmail({
                toEmail: member.email,
                studioName,
                studioSlug: studioId,
                recipientName: member.name,
                orderId: order.id,
                eventTitle: order.eventType,
                taskTitle: existingTask.title,
                newStatus: validated.status,
                details: validated.reworkNotes,
              });
            }
          }

          // 3. Notify Studio Owner
          if (studio?.ownerEmail) {
            await sendPipelineStatusUpdateEmail({
              toEmail: studio.ownerEmail,
              studioName,
              studioSlug: studioId,
              recipientName: studio.ownerName || "Studio Owner",
              orderId: order.id,
              eventTitle: order.eventType,
              taskTitle: existingTask.title,
              newStatus: validated.status,
              details: validated.reworkNotes,
            });
          }
        } catch (mailErr) {
          console.warn("[updateTaskStatusAction] Status change email notification error:", mailErr);
        }
      })();
    }

    return { success: true, task: updatedTask, newOrderStatus };
  } catch (err: unknown) {
    console.error("[updateTaskStatusAction] Error:", err);
    return {
      success: false,
      error: (err as any)?.errors?.[0]?.message || (err instanceof Error ? err.message : "Failed to update task"),
    };
  }
}

export async function updateTaskAction(input: {
  taskId: string;
  studioId: string;
  updates: Partial<Pick<Task, 'title' | 'serviceCategory' | 'assignedMemberId' | 'assignedMemberName' | 'status' | 'reworkNotes'>>;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const task = await getTaskById(input.taskId);
    if (!task || task.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    const updated = await updateTask(input.taskId, input.updates);
    return { success: true, task: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateTaskAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update task" };
  }
}

export async function deleteTaskAction(input: {
  taskId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const task = await getTaskById(input.taskId);
    if (!task || task.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    await softDeleteTask(input.taskId, decoded.uid);
    return { success: true };
  } catch (err: unknown) {
    console.error("[deleteTaskAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete task" };
  }
}

export async function restoreTaskAction(input: {
  taskId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const task = await getTaskByIdIncludeDeleted(input.taskId);
    if (!task || task.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Task not found in the authorized studio." };
    }

    await restoreTask(input.taskId);
    return { success: true };
  } catch (err: unknown) {
    console.error("[restoreTaskAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to restore task" };
  }
}

export async function updatePaymentStatusAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  try {
    const validated = UpdatePaymentSchema.parse(rawInput);

    const decoded = await requireVerifiedUser((validated as any).idToken);
    await requireStudioOwner(decoded.uid, (validated as any).studioId);

    const existingOrder = await getOrderById(validated.orderId);
    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }
    if (existingOrder.studioId !== (validated as any).studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    const currentPricing = existingOrder.pricing;
    const newConfirmed = validated.finalConfirmedPrice !== undefined ? validated.finalConfirmedPrice : currentPricing.finalConfirmedPrice;
    let calculatedStatus: PaymentStatus | undefined = validated.paymentStatus as PaymentStatus | undefined;
    let newAdvance = validated.advanceAmount !== undefined ? validated.advanceAmount : currentPricing.advanceAmount;
    let previousAdvance = currentPricing.previousAdvanceAmount ?? (currentPricing.advanceAmount < currentPricing.finalConfirmedPrice ? currentPricing.advanceAmount : 0);
    const newInstallments = validated.installments !== undefined ? validated.installments : (currentPricing.installments || []);

    if (validated.advanceAmount !== undefined && validated.advanceAmount < newConfirmed) {
      previousAdvance = validated.advanceAmount;
    }

    let finalInstallments = [...newInstallments];
    let installmentsTotal = finalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);

    if (calculatedStatus === "PAID") {
      // When marking as PAID, keep the original advance amount intact.
      // Automatically record a new payment installment for the remaining balance.
      const currentPaid = newAdvance + installmentsTotal;
      const remainingToPay = Math.max(0, newConfirmed - currentPaid);
      if (remainingToPay > 0 && validated.installments === undefined) {
        const autoPayment: OrderInstallment = {
          id: `inst_${Date.now()}_auto`,
          amount: remainingToPay,
          date: new Date().toISOString().split("T")[0],
          notes: "Final Payment (Marked Paid)",
          createdAt: new Date().toISOString(),
          recordedBy: decoded.name || decoded.email || "Studio Owner",
          recordedByRole: "Owner",
        };
        finalInstallments = [...finalInstallments, autoPayment];
        installmentsTotal += remainingToPay;
      }
    } else if (calculatedStatus === "PENDING" && existingOrder.paymentStatus === "PAID" && validated.advanceAmount === undefined) {
      // Mark Unpaid: Remove the auto-generated Final Payment installment if present
      finalInstallments = finalInstallments.filter((inst) => !inst.notes?.includes("Marked Paid"));
      installmentsTotal = finalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const totalPaid = newAdvance + installmentsTotal;
      calculatedStatus = totalPaid > 0 && totalPaid < newConfirmed
        ? (finalInstallments.length > 0 ? "PARTIAL" : "ADVANCE_RECEIVED")
        : (totalPaid >= newConfirmed && newConfirmed > 0 ? "PAID" : "PENDING");
    } else if (!calculatedStatus) {
      const totalPaid = newAdvance + installmentsTotal;
      if (totalPaid >= newConfirmed && newConfirmed > 0) {
        calculatedStatus = "PAID";
      } else if (finalInstallments.length > 0) {
        calculatedStatus = "PARTIAL";
      } else if (newAdvance > 0) {
        calculatedStatus = "ADVANCE_RECEIVED";
      } else {
        calculatedStatus = "PENDING";
      }
    }

    const newRemaining = Math.max(0, newConfirmed - (newAdvance + installmentsTotal));

    const actorName = decoded.name || decoded.email || "Studio Owner";
    const newAuditEntries: OrderAuditEntry[] = [];
    const nowStamp = getStudioTimestampIST(new Date());

    if (calculatedStatus === "PAID" && existingOrder.paymentStatus !== "PAID") {
      newAuditEntries.push({
        id: `audit_${Date.now()}_paid`,
        timestamp: nowStamp,
        actorName,
        actorRole: "Owner",
        action: "Order Marked Paid",
        details: `Recorded final payment and marked order as Paid. Total confirmed: ₹${newConfirmed.toLocaleString()}`,
      });
    } else if (finalInstallments.length > (existingOrder.pricing.installments?.length || 0)) {
      const latestInst = finalInstallments[finalInstallments.length - 1];
      newAuditEntries.push({
        id: `audit_${Date.now()}_inst`,
        timestamp: getStudioTimestampIST(latestInst.createdAt || new Date()),
        actorName,
        actorRole: "Owner",
        action: "Payment Recorded",
        details: `Recorded installment payment of ₹${latestInst.amount.toLocaleString()}${latestInst.notes ? ` (${latestInst.notes})` : ""}`,
      });
    } else if (newConfirmed !== currentPricing.finalConfirmedPrice) {
      newAuditEntries.push({
        id: `audit_${Date.now()}_price`,
        timestamp: nowStamp,
        actorName,
        actorRole: "Owner",
        action: "Confirmed Price Updated",
        details: `Updated confirmed price from ₹${currentPricing.finalConfirmedPrice.toLocaleString()} to ₹${newConfirmed.toLocaleString()}`,
      });
    } else if (newAdvance !== currentPricing.advanceAmount) {
      newAuditEntries.push({
        id: `audit_${Date.now()}_adv_upd`,
        timestamp: nowStamp,
        actorName,
        actorRole: "Owner",
        action: "Advance Payment Updated",
        details: `Updated advance payment from ₹${currentPricing.advanceAmount.toLocaleString()} to ₹${newAdvance.toLocaleString()}`,
      });
    }

    const updatedAuditLog = [...(existingOrder.auditLog || []), ...newAuditEntries];

    const updatedOrder = await updateOrder(validated.orderId, {
      paymentStatus: calculatedStatus,
      updatedBy: actorName,
      updatedByRole: "Owner",
      auditLog: updatedAuditLog,
      pricing: {
        ...currentPricing,
        finalConfirmedPrice: newConfirmed,
        advanceAmount: newAdvance,
        advanceDate: validated.advanceDate || currentPricing.advanceDate || existingOrder.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0],
        installments: finalInstallments,
        remainingAmount: newRemaining,
        previousAdvanceAmount: previousAdvance,
      },
    });

    if (updatedOrder) {
      const allTasks = await getTasksByOrder(validated.orderId);
      if (canCompleteOrder(calculatedStatus, allTasks) && updatedOrder.orderStatus !== "COMPLETED") {
        await updateOrder(validated.orderId, { orderStatus: "COMPLETED" });
        updatedOrder.orderStatus = "COMPLETED";
      } else if (!canCompleteOrder(calculatedStatus, allTasks) && existingOrder.orderStatus === "COMPLETED") {
        const todayStr = getStudioCalendarDate();
        const fallbackStatus: OrderStatus = existingOrder.eventDate < todayStr ? "POST_EVENT_IN_PROGRESS" : "AWAITING_EVENT";
        await updateOrder(validated.orderId, { orderStatus: fallbackStatus });
        updatedOrder.orderStatus = fallbackStatus;
      }
    }

    return { success: true, order: updatedOrder || undefined };
  } catch (err: unknown) {
    console.error("[updatePaymentStatusAction] Error:", err);
    return {
      success: false,
      error: (err as any)?.errors?.[0]?.message || (err instanceof Error ? err.message : "Failed to update payment status"),
    };
  }
}

export async function assignResourceAction(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  try {
    const validated = AssignResourceSchema.parse(rawInput);

    const existingOrder = await getOrderById(validated.orderId);
    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }

    const targetStudioId = (
      validated.studioId ||
      (rawInput as any)?.studioId ||
      existingOrder.studioId ||
      ""
    ).trim().toLowerCase();

    const token = validated.idToken || (rawInput as any)?.idToken;
    const decoded = await requireVerifiedUser(token);
    if (targetStudioId) {
      await requireStudioOwner(decoded.uid, targetStudioId);
    }

    if (targetStudioId && existingOrder.studioId.toLowerCase() !== targetStudioId) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    const currentAssignments = existingOrder.assignedResources || [];
    const isUnassign =
      validated.memberId === "unassigned" ||
      validated.memberName === "Unassigned" ||
      !validated.memberId.trim();

    // Replace any previous assignment for the same service
    const filtered = currentAssignments.filter(
      (r) => (r.skill || "").toLowerCase() !== (validated.skill || "").toLowerCase()
    );

    const newAssignments = isUnassign
      ? filtered
      : [
          ...filtered,
          {
            memberId: validated.memberId,
            memberName: validated.memberName,
            skill: validated.skill,
            availabilityConfirmed: null,
          },
        ];

    const assignAudit: OrderAuditEntry = {
      id: `audit_${Date.now()}_assign`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: decoded.name || decoded.email || "Studio Owner",
      actorRole: "Owner",
      action: isUnassign ? "Crew Unassigned" : "Crew Assigned",
      details: isUnassign
        ? `Unassigned crew from ${validated.skill}`
        : `Assigned ${validated.memberName} to ${validated.skill}`,
    };

    const updatedOrder = await updateOrder(validated.orderId, {
      assignedResources: newAssignments,
      auditLog: [...(existingOrder.auditLog || []), assignAudit],
    });

    if (!isUnassign && (validated.memberId.startsWith("temp_") || validated.memberId.startsWith("temp-"))) {
      try {
        const studioDoc = targetStudioId ? await getStudioBySlug(targetStudioId) : null;
        if (studioDoc) {
          const existingTemp = studioDoc.temporaryCrew || [];
          const alreadyExists = existingTemp.some(
            (t) => t.name.toLowerCase() === validated.memberName.toLowerCase()
          );
          if (!alreadyExists) {
            const updatedTemp = [
              ...existingTemp,
              {
                id: validated.memberId,
                name: validated.memberName,
                createdAt: new Date().toISOString(),
                lastUsedService: validated.skill,
              },
            ];
            await updateStudio(studioDoc.id, { temporaryCrew: updatedTemp });
          }
        }
      } catch (tempErr) {
        console.warn("[assignResourceAction] Failed to persist temporary crew to studio:", tempErr);
      }
    }

    if (!isUnassign && validated.memberId && !validated.memberId.startsWith("temp_") && !validated.memberId.startsWith("temp-")) {
      void (async () => {
        try {
          const member = await getMemberById(validated.memberId);
          if (member?.email) {
            const studio = await getStudioBySlug(targetStudioId || existingOrder.studioId);
            await sendCrewShootAssignedEmail({
              toEmail: member.email,
              studioName: studio?.name || existingOrder.studioId,
              studioSlug: existingOrder.studioId,
              memberName: validated.memberName,
              orderNumber: existingOrder.orderNumber || existingOrder.id,
              eventType: existingOrder.eventType,
              eventDate: existingOrder.eventDate,
              skill: validated.skill,
              eventLocation: existingOrder.eventLocation,
            });
          }
        } catch (assignMailErr) {
          console.warn("[assignResourceAction] Shoot assignment email notification error:", assignMailErr);
        }
      })();
    }

    return { success: true, order: updatedOrder || undefined };
  } catch (err: unknown) {
    console.error("[assignResourceAction] Error:", err);
    return {
      success: false,
      error: (err as any)?.errors?.[0]?.message || (err instanceof Error ? err.message : "Failed to assign resource"),
    };
  }
}

export async function assignTaskCrewAction(rawInput: {
  orderId: string;
  studioId: string;
  taskId: string;
  memberId: string;
  memberName: string;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(rawInput.idToken);
    let studioId = (rawInput.studioId || "").trim().toLowerCase();

    const existingTask = await getTaskById(rawInput.taskId);
    if (!existingTask || existingTask.orderId !== rawInput.orderId) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    if (!studioId) {
      studioId = (existingTask.studioId || "").toLowerCase();
    }

    if (existingTask.studioId.toLowerCase() !== studioId) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    await requireStudioMember(decoded.uid, studioId, "STUDIO_OWNER");

    const updatedTask = await updateTask(rawInput.taskId, {
      assignedMemberId: rawInput.memberId,
      assignedMemberName: rawInput.memberName,
    });

    const existingOrder = await getOrderById(rawInput.orderId);
    if (existingOrder) {
      const assignAudit: OrderAuditEntry = {
        id: `audit_${Date.now()}_task_crew`,
        timestamp: getStudioTimestampIST(new Date()),
        actorName: decoded.name || decoded.email || "Studio Owner",
        actorRole: "Owner",
        action: "Task Assigned",
        details: `Assigned task "${existingTask.title}" (${existingTask.serviceCategory}) to ${rawInput.memberName}`,
      };
      await updateOrder(rawInput.orderId, {
        auditLog: [...(existingOrder.auditLog || []), assignAudit],
      });

      if (rawInput.memberId && rawInput.memberId !== "unassigned") {
        void (async () => {
          try {
            const member = await getMemberById(rawInput.memberId);
            if (member?.email) {
              const studio = await getStudioBySlug(studioId);
              await sendCrewShootAssignedEmail({
                toEmail: member.email,
                studioName: studio?.name || studioId,
                studioSlug: studioId,
                memberName: rawInput.memberName,
                orderNumber: existingOrder.orderNumber || existingOrder.id,
                eventType: existingOrder.eventType,
                eventDate: existingOrder.eventDate,
                skill: existingTask.title,
                eventLocation: existingOrder.eventLocation,
              });
            }
          } catch (mailErr) {
            console.warn("[assignTaskCrewAction] Task assignment email error:", mailErr);
          }
        })();
      }
    }

    return { success: true, task: updatedTask || undefined };
  } catch (err: unknown) {
    console.error("[assignTaskCrewAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to assign crew to task",
    };
  }
}

export async function confirmResourceAvailabilityAction(
  inputOrOrderId:
    | {
        orderId: string;
        memberId: string;
        confirmed: boolean;
        idToken: string;
        studioId?: string;
      }
    | string,
  argMemberId?: string,
  argConfirmed?: boolean,
  argIdToken?: string,
  argStudioId?: string
): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    let orderId: string;
    let memberId: string;
    let confirmed: boolean;
    let idToken: string;
    let studioId: string | undefined;

    if (typeof inputOrOrderId === "object") {
      orderId = inputOrOrderId.orderId;
      memberId = inputOrOrderId.memberId;
      confirmed = inputOrOrderId.confirmed;
      idToken = inputOrOrderId.idToken;
      studioId = inputOrOrderId.studioId;
    } else {
      orderId = inputOrOrderId;
      memberId = argMemberId || "";
      confirmed = !!argConfirmed;
      idToken = argIdToken || "";
      studioId = argStudioId;
    }

    const decoded = await requireVerifiedUser(idToken);

    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }
    const targetStudioId = studioId || existingOrder.studioId;
    const membership = await requireStudioMember(decoded.uid, targetStudioId);

    if (existingOrder.studioId !== targetStudioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    if (membership.role !== "STUDIO_OWNER") {
      const member = await findActiveMemberRecord(targetStudioId, decoded.email);
      const isAssigned = member && existingOrder.assignedResources?.some((resource) => resource.memberId === member.id);
      if (!isAssigned || member?.id !== memberId) {
        return { success: false, error: "Access denied: You can only confirm your own assigned availability." };
      }
    }

    const currentAssignments = existingOrder.assignedResources || [];
    const updatedAssignments = currentAssignments.map((r) => {
      if (r.memberId === memberId) {
        return { ...r, availabilityConfirmed: confirmed };
      }
      return r;
    });

    const updatedOrder = await updateOrder(orderId, {
      assignedResources: updatedAssignments,
    });

    return { success: true, order: updatedOrder || undefined };
  } catch (err: unknown) {
    console.error("[confirmResourceAvailabilityAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update availability" };
  }
}

export async function cancelOrderAction(input: {
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
      details: `Cancelled order — Reason: "${input.cancellationReason?.trim() || "Cancelled by studio owner"}"`,
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
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel order" };
  }
}

export async function syncOrderToAccountAction(input: {
  passkey: string;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const order = await getOrderByPasskey(input.passkey);
    if (!order) {
      return { success: false, error: "Order not found for this access code." };
    }

    // 0. Studio owners and members cannot claim an order as the primary customer
    const studioMembership = await getMembershipByUidAndStudio(decoded.uid, order.studioId);
    if (studioMembership && studioMembership.status === "ACTIVE") {
      return {
        success: false,
        error: "Studio owners and crew members cannot claim an order as the primary customer.",
      };
    }

    // 1. If order already has a customer.email registered, the syncing user MUST have that same email
    if (
      order.customer.email &&
      decoded.email &&
      order.customer.email.trim().toLowerCase() !== decoded.email.trim().toLowerCase()
    ) {
      return {
        success: false,
        error: `This order is registered to ${order.customer.email}. Please sign in with ${order.customer.email} to link this order.`,
      };
    }

    // 2. If order already has a customer.uid bound, prevent another account from taking it over
    if (order.customer.uid && order.customer.uid !== decoded.uid) {
      return {
        success: false,
        error: "This order is already claimed by the primary customer account.",
      };
    }

    const updatedCustomer = {
      ...order.customer,
      uid: decoded.uid,
      email: decoded.email || order.customer.email,
    };

    const updatedOrder = await updateOrder(order.id, {
      customer: updatedCustomer,
    });

    return { success: true, order: updatedOrder || undefined };
  } catch (err: unknown) {
    console.error("[syncOrderToAccountAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to sync order." };
  }
}

export async function getMySyncedOrdersAction(idToken: string): Promise<Order[]> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    return await getOrdersByCustomerUid(decoded.uid, decoded.email);
  } catch (err: unknown) {
    console.error("[getMySyncedOrdersAction] Error:", err);
    return [];
  }
}

export async function updateOrderCollaboratorsAction(input: {
  orderId: string;
  collaborators: OrderCollaborator[];
  idToken: string;
}): Promise<{ success: boolean; collaborators?: OrderCollaborator[]; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const order = await getOrderById(input.orderId);
    if (!order) {
      return { success: false, error: "Order not found." };
    }

    const userEmail = decoded.email?.toLowerCase();
    const customerEmail = order.customer.email?.toLowerCase();
    const isPrimaryCustomer = Boolean(
      (userEmail && customerEmail && userEmail === customerEmail) ||
      (order.customer.uid && order.customer.uid === decoded.uid)
    );

    let isStudioStaff = false;
    try {
      const membership = await requireStudioMember(decoded.uid, order.studioId);
      if (membership) isStudioStaff = true;
    } catch {
      // not studio staff
    }

    if (!isPrimaryCustomer && !isStudioStaff) {
      return {
        success: false,
        error: "Unauthorized: Only the primary customer or studio staff can manage family/friend permissions.",
      };
    }

    const updated = await updateOrder(order.id, {
      collaborators: input.collaborators,
    });

    return { success: true, collaborators: updated?.collaborators || input.collaborators };
  } catch (err: unknown) {
    console.error("[updateOrderCollaboratorsAction] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update collaborators." };
  }
}

export async function checkIsStudioStaffAction(input: {
  studioId: string;
  idToken: string;
}): Promise<{ isStaff: boolean; role?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const membership = await getMembershipByUidAndStudio(decoded.uid, input.studioId);
    if (membership && membership.status === "ACTIVE") {
      return { isStaff: true, role: membership.role };
    }
    return { isStaff: false };
  } catch {
    return { isStaff: false };
  }
}

export async function sendManualPaymentReminderAction(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const order = await getOrderById(input.orderId);
    if (!order) {
      return { success: false, error: "Order not found." };
    }
    if (order.studioId.toLowerCase() !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    if (order.paymentStatus === "PAID" || order.pricing.remainingAmount <= 0) {
      return { success: false, error: "This order has no pending balance. Payment is fully completed." };
    }

    if (!order.customer?.email) {
      return { success: false, error: "No customer email address registered for this order." };
    }

    const studio = await getStudioBySlug(input.studioId);
    const studioName = studio?.name || input.studioId;

    const emailRes = await sendPaymentReminderCustomerEmail({
      toEmail: order.customer.email,
      studioName,
      customerName: order.customer.name,
      orderId: order.id,
      eventTitle: order.eventType,
      amountDue: `₹${order.pricing.remainingAmount.toLocaleString()}`,
      dueDate: order.eventDate,
    });

    if (!emailRes.success) {
      return { success: false, error: emailRes.error || "Failed to send payment reminder email." };
    }

    const reminderAudit: OrderAuditEntry = {
      id: `audit_${Date.now()}_payment_reminder`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: decoded.name || decoded.email || "Studio Owner",
      actorRole: "Owner",
      action: "Payment Reminder Sent",
      details: `Sent manual payment reminder email to ${order.customer.email} for pending balance of ₹${order.pricing.remainingAmount.toLocaleString()}`,
    };

    await updateOrder(order.id, {
      auditLog: [...(order.auditLog || []), reminderAudit],
    });

    return {
      success: true,
      message: `Payment reminder email sent successfully to ${order.customer.email}!`,
    };
  } catch (err: unknown) {
    console.error("[sendManualPaymentReminderAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send payment reminder email",
    };
  }
}

export async function updateOrderDriveDeliverablesAction(input: {
  orderId: string;
  studioId: string;
  deliverables: OrderDriveDeliverable[];
  idToken: string;
}): Promise<{
  success: boolean;
  order?: Order;
  deliverables?: OrderDriveDeliverable[];
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const membership = await requireStudioMember(decoded.uid, input.studioId);

    const existingOrder = await getOrderById(input.orderId);
    if (!existingOrder || existingOrder.studioId.toLowerCase() !== input.studioId.toLowerCase()) {
      return { success: false, error: "Order not found in authorized studio." };
    }

    const actorName = decoded.name || decoded.email || "Studio Staff";
    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_drive_deliv`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: membership.role === "STUDIO_OWNER" ? "Owner" : "Member",
      action: "Google Drive Deliverables Updated",
      details: `Updated Google Drive deliverable links (${input.deliverables.length} item${input.deliverables.length === 1 ? "" : "s"})`,
    };

    const updatedOrder = await updateOrder(existingOrder.id, {
      driveDeliverables: input.deliverables,
      auditLog: [...(existingOrder.auditLog || []), auditEntry],
    });

    return {
      success: true,
      order: updatedOrder || undefined,
      deliverables: updatedOrder?.driveDeliverables || input.deliverables,
    };
  } catch (err: unknown) {
    console.error("[updateOrderDriveDeliverablesAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update Google Drive deliverables.",
    };
  }
}

export async function submitCustomerDeliverableReviewAction(input: {
  orderId: string;
  deliverableId: string;
  approved: boolean;
  feedback?: string;
  idToken: string;
}): Promise<{
  success: boolean;
  deliverables?: OrderDriveDeliverable[];
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const order = await getOrderById(input.orderId);
    if (!order) {
      return { success: false, error: "Order not found." };
    }

    const userEmail = decoded.email?.toLowerCase();
    const customerEmail = order.customer.email?.toLowerCase();
    const isPrimaryCustomer = Boolean(
      (userEmail && customerEmail && userEmail === customerEmail) ||
        (order.customer.uid && order.customer.uid === decoded.uid)
    );
    const isEditorCollaborator = Boolean(
      userEmail &&
        (order.collaborators || []).some(
          (c) => c.email.toLowerCase() === userEmail && c.role === "EDITOR"
        )
    );

    let isStudioStaff = false;
    try {
      const m = await getMembershipByUidAndStudio(decoded.uid, order.studioId);
      if (m && m.status === "ACTIVE") isStudioStaff = true;
    } catch {
      // ignore
    }

    if (!isPrimaryCustomer && !isEditorCollaborator && !isStudioStaff) {
      return {
        success: false,
        error: "Only the primary customer or an authorized editor can submit review approvals.",
      };
    }

    const nowIso = new Date().toISOString();
    const currentDeliverables = order.driveDeliverables || [];
    const targetDeliverable = currentDeliverables.find((d) => d.id === input.deliverableId);
    if (!targetDeliverable) {
      return { success: false, error: "Deliverable item not found on this order." };
    }

    const updatedDeliverables = currentDeliverables.map((d) =>
      d.id === input.deliverableId
        ? {
            ...d,
            clientApproved: input.approved,
            clientFeedback: input.feedback?.trim() || undefined,
            clientReviewedAt: nowIso,
          }
        : d
    );

    const actorName = decoded.name || decoded.email || order.customer.name || "Customer";
    const reviewAudit: OrderAuditEntry = {
      id: `audit_${Date.now()}_deliv_review`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: isStudioStaff ? "Owner" : "Customer",
      action: input.approved ? "Deliverable Approved" : "Deliverable Revision Requested",
      details: `${input.approved ? "Approved" : "Requested changes on"} "${targetDeliverable.title}"${
        input.feedback?.trim() ? ` — Note: "${input.feedback.trim()}"` : ""
      }`,
    };

    const updated = await updateOrder(order.id, {
      driveDeliverables: updatedDeliverables,
      auditLog: [...(order.auditLog || []), reviewAudit],
    });

    return {
      success: true,
      deliverables: updated?.driveDeliverables || updatedDeliverables,
    };
  } catch (err: unknown) {
    console.error("[submitCustomerDeliverableReviewAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit deliverable review.",
    };
  }
}



