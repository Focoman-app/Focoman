import "server-only";
import { AssignResourceSchema } from "@focoman/validation";
import { getStudioTimestampIST } from "@focoman/domain";
import {
  getMemberById,
  getMembershipByUidAndStudio,
  getOrderById,
  getStudioBySlug,
  getTaskById,
  updateOrder,
  updateStudio,
  updateTask,
} from "@focoman/db";
import type { Order, OrderAuditEntry, Task } from "@focoman/types";
import {
  requireStudioMember,
  requireStudioOwner,
  requireVerifiedUser,
} from "@/lib/serverAuth";
import { sendCrewShootAssignedEmail } from "@/services/emailService";
import { findActiveMemberRecord } from "./orderAccessHelpers";

export async function assignResourceCore(rawInput: unknown): Promise<{
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
    )
      .trim()
      .toLowerCase();

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

    if (
      !isUnassign &&
      (validated.memberId.startsWith("temp_") || validated.memberId.startsWith("temp-"))
    ) {
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
        console.warn(
          "[assignResourceAction] Failed to persist temporary crew to studio:",
          tempErr
        );
      }
    }

    if (
      !isUnassign &&
      validated.memberId &&
      !validated.memberId.startsWith("temp_") &&
      !validated.memberId.startsWith("temp-")
    ) {
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
          console.warn(
            "[assignResourceAction] Shoot assignment email notification error:",
            assignMailErr
          );
        }
      })();
    }

    return { success: true, order: updatedOrder || undefined };
  } catch (err: unknown) {
    console.error("[assignResourceAction] Error:", err);
    return {
      success: false,
      error:
        (err as any)?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : "Failed to assign resource"),
    };
  }
}

export async function assignTaskCrewCore(rawInput: {
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

export async function confirmResourceAvailabilityCore(
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
      const isAssigned =
        member &&
        existingOrder.assignedResources?.some(
          (resource) => resource.memberId === member.id
        );
      if (!isAssigned || member?.id !== memberId) {
        return {
          success: false,
          error: "Access denied: You can only confirm your own assigned availability.",
        };
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
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update availability",
    };
  }
}

export async function checkIsStudioStaffCore(input: {
  studioId: string;
  idToken: string;
}): Promise<{ isStaff: boolean; role?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const membership = await getMembershipByUidAndStudio(decoded.uid, input.studioId);
    if (membership && membership.status === "ACTIVE" && !membership.isDeleted) {
      return { isStaff: true, role: membership.role };
    }
    return { isStaff: false };
  } catch {
    return { isStaff: false };
  }
}
