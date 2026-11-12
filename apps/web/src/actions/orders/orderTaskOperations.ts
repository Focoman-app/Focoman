import "server-only";
import { generateTimestampDigits, prefixLetters } from "@/lib/invitationPasscode";
import { UpdateTaskStatusSchema } from "@focoman/validation";
import {
  canCompleteOrder,
  getStudioCalendarDate,
  getStudioTimestampIST,
} from "@focoman/domain";
import {
  getMemberById,
  getOrderById,
  getStudioBySlug,
  getTaskById,
  getTaskByIdIncludeDeleted,
  getTasksByOrder,
  restoreTask,
  saveTask,
  softDeleteTask,
  updateOrder,
  updateTask,
} from "@focoman/db";
import type { OrderAuditEntry, OrderStatus, Task, TaskStatus } from "@focoman/types";
import {
  requireStudioMember,
  requireStudioOwner,
  requireVerifiedUser,
} from "@/lib/serverAuth";
import {
  sendGalleryReadyCustomerEmail,
  sendPaymentReminderCustomerEmail,
  sendPipelineStatusUpdateEmail,
} from "@/services/emailService";
import { dispatchOrderStageWhatsAppNotification } from "@/services/whatsappService";
import { hasStudioCapability, requireCapability } from "@/lib/entitlementAuth";
import { getFreeWorkflowTaskAssignee, requiresErpForCrewMutation } from "@/lib/erpCrewPolicy";
import { findActiveMemberRecord } from "./orderAccessHelpers";

export async function createTaskCore(input: {
  orderId: string;
  studioId: string;
  title: string;
  serviceCategory: "PHOTOGRAPHY" | "VIDEOGRAPHY" | "ALBUM" | "GENERAL";
  assignedMemberId?: string;
  assignedMemberName?: string;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const [order, studio, hasErp] = await Promise.all([
      getOrderById(input.orderId),
      getStudioBySlug(input.studioId),
      hasStudioCapability(input.studioId, "STUDIO_ERP"),
    ]);
    if (!order || order.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Order not found in authorized studio." };
    }
    if (requiresErpForCrewMutation(hasErp, input)) {
      await requireCapability(input.studioId, "STUDIO_ERP");
    }

    const existingTasks = await getTasksByOrder(input.orderId);
    const { dateStamp, timeStamp } = generateTimestampDigits();
    const taskId = `TSK-${prefixLetters(input.studioId)}-${dateStamp}-${timeStamp}`;
    const now = new Date().toISOString();

    const studioOwner = getFreeWorkflowTaskAssignee(hasErp, {
      memberId: studio?.ownerId || decoded.uid,
      memberName: studio?.ownerName || decoded.name || decoded.email || "Studio Owner",
    });
    const task: Task = {
      id: taskId,
      orderId: input.orderId,
      studioId: input.studioId.toLowerCase(),
      title: input.title.trim(),
      serviceCategory: input.serviceCategory,
      assignedMemberId: hasErp
        ? input.assignedMemberId || "unassigned"
        : studioOwner!.memberId,
      assignedMemberName: hasErp
        ? input.assignedMemberName || "Unassigned Crew"
        : studioOwner!.memberName,
      status: "ASSIGNED",
      sequenceOrder: existingTasks.length + 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await saveTask(task);
    return { success: true, task };
  } catch (err: unknown) {
    console.error("[createTaskAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create task",
    };
  }
}

/** Records a real-world proof/selection handoff without fabricating a Drive link. */
export async function markTaskOfflineReviewReadyCore(input: {
  orderId: string;
  taskId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);
    const [order, task] = await Promise.all([getOrderById(input.orderId), getTaskById(input.taskId)]);
    if (!order || !task || order.studioId.toLowerCase() !== input.studioId.toLowerCase() || task.orderId !== order.id) {
      return { success: false, error: "Task not found in authorized studio." };
    }
    if (order.eventDate >= getStudioCalendarDate() && order.orderStatus === "AWAITING_EVENT") {
      return { success: false, error: "Production tasks are locked until the event shoot date has completed." };
    }
    if (task.status !== "IN_PROGRESS") {
      return { success: false, error: "Start the production task before confirming an offline customer handoff." };
    }
    const updatedTask = await updateTask(task.id, { status: "REVIEW" });
    const audit: OrderAuditEntry = {
      id: `audit_${Date.now()}_offline_review`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: decoded.name || decoded.email || "Studio Owner",
      actorRole: "Owner",
      action: "Offline Customer Review Handoff Confirmed",
      details: `Confirmed ${task.title} was handed to the customer offline and is now pending customer review.`,
    };
    await updateOrder(order.id, { auditLog: [...(order.auditLog || []), audit] });
    return { success: true, task: updatedTask || undefined };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to record offline review handoff." };
  }
}

export async function updateTaskStatusCore(rawInput: unknown): Promise<{
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
    if (
      !existingTask ||
      existingTask.studioId !== studioId.toLowerCase() ||
      existingTask.orderId !== validated.orderId
    ) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    const linkedOrder = await getOrderById(validated.orderId);
    if (!linkedOrder || linkedOrder.studioId !== studioId.toLowerCase()) {
      return { success: false, error: "Order not found in authorized studio." };
    }

    const todayStr = getStudioCalendarDate();
    const isEventUpcoming =
      linkedOrder.eventDate > todayStr ||
      (linkedOrder.eventDate >= todayStr &&
        linkedOrder.orderStatus === "AWAITING_EVENT");
    if (
      isEventUpcoming &&
      validated.status !== "ASSIGNED" &&
      validated.status !== "AWAITING_EVENT"
    ) {
      return {
        success: false,
        error: `Production tasks are locked until the event shoot date (${linkedOrder.eventDate}) has completed.`,
      };
    }

    if (validated.status && validated.status !== "ASSIGNED") {
      const allOrderTasks = await getTasksByOrder(validated.orderId);
      if (existingTask.title.toLowerCase().includes("photo editing")) {
        const rawTask = allOrderTasks.find((t) =>
          t.title.toLowerCase().includes("raw photo")
        );
        if (rawTask && rawTask.status !== "COMPLETED") {
          return {
            success: false,
            error:
              "Cannot proceed with Photo Editing until Raw Photo Selection is completed by the customer.",
          };
        }
      }
      const requiresCustomerProof = validated.status === "REVIEW" && (
        existingTask.title.toLowerCase().includes("raw photo") ||
        existingTask.title.toLowerCase().includes("photo editing")
      );
      if (requiresCustomerProof && !(linkedOrder.driveDeliverables || []).some((deliverable) => deliverable.linkedTaskId === existingTask.id)) {
        return { success: false, error: "Add and link a Google Drive proof first, or use Confirm offline handoff for an offline review." };
      }
      if (
        existingTask.serviceCategory === "ALBUM" ||
        existingTask.title.toLowerCase().includes("album")
      ) {
        const photoEditTask = allOrderTasks.find((t) =>
          t.title.toLowerCase().includes("photo editing")
        );
        if (photoEditTask && photoEditTask.status !== "COMPLETED") {
          return {
            success: false,
            error:
              "Cannot proceed with Album Design until Photo Editing is completed and approved.",
          };
        }
      }
      if (existingTask.title.toLowerCase().includes("final delivery")) {
        const pendingOthers = allOrderTasks.filter(
          (t) => t.id !== existingTask.id && t.status !== "COMPLETED"
        );
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
        return {
          success: false,
          error: "Access denied: This task is not assigned to your crew profile.",
        };
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
        actorName:
          decoded.name ||
          decoded.email ||
          existingTask.assignedMemberName ||
          "Crew Member",
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

      void (async () => {
        try {
          const studio = await getStudioBySlug(studioId);
          const studioName = studio?.name || studioId;

          if (order.customer?.email) {
            if (
              validated.status === "COMPLETED" &&
              (existingTask.title.toLowerCase().includes("final delivery") ||
                existingTask.title.toLowerCase().includes("gallery"))
            ) {
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

            const isAlbumOrFinalTask =
              existingTask.serviceCategory === "ALBUM" ||
              existingTask.title.toLowerCase().includes("album") ||
              existingTask.title.toLowerCase().includes("final delivery") ||
              existingTask.title.toLowerCase().includes("gallery");

            if (
              validated.status === "COMPLETED" &&
              isAlbumOrFinalTask &&
              order.pricing.remainingAmount > 0 &&
              order.paymentStatus !== "PAID"
            ) {
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

          if (
            existingTask.assignedMemberId &&
            existingTask.assignedMemberId !== "unassigned"
          ) {
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

          await dispatchOrderStageWhatsAppNotification({
            studioId,
            order,
            taskTitle: existingTask.title,
            newStatus: validated.status,
          });
        } catch (mailErr) {
          console.warn(
            "[updateTaskStatusAction] Status change email notification error:",
            mailErr
          );
        }
      })();
    }

    return { success: true, task: updatedTask, newOrderStatus };
  } catch (err: unknown) {
    console.error("[updateTaskStatusAction] Error:", err);
    return {
      success: false,
      error:
        (err as any)?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : "Failed to update task"),
    };
  }
}

export async function updateTaskCore(input: {
  taskId: string;
  studioId: string;
  updates: Partial<
    Pick<
      Task,
      | "title"
      | "serviceCategory"
      | "assignedMemberId"
      | "assignedMemberName"
      | "status"
      | "reworkNotes"
    >
  >;
  idToken: string;
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const task = await getTaskById(input.taskId);
    if (!task || task.studioId !== input.studioId.toLowerCase()) {
      return { success: false, error: "Task not found in authorized studio." };
    }

    if (
      Object.prototype.hasOwnProperty.call(input.updates, "assignedMemberId") ||
      Object.prototype.hasOwnProperty.call(input.updates, "assignedMemberName")
    ) {
      await requireCapability(input.studioId, "STUDIO_ERP");
    }

    const updated = await updateTask(input.taskId, input.updates);
    return { success: true, task: updated || undefined };
  } catch (err: unknown) {
    console.error("[updateTaskAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update task",
    };
  }
}

export async function deleteTaskCore(input: {
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
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete task",
    };
  }
}

export async function restoreTaskCore(input: {
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
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restore task",
    };
  }
}
