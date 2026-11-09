import "server-only";
import { getStudioTimestampIST, toCustomerTrackingView } from "@focoman/domain";
import {
  getMembersByStudio,
  getMembershipByUidAndStudio,
  getMembershipsByStudio,
  getOrderById,
  getOrderByPasskey,
  getOrdersByCustomerUid,
  getStudioBySlug,
  getTasksByOrder,
  updateOrder,
} from "@focoman/db";
import type {
  CustomerTrackingView,
  Order,
  OrderAuditEntry,
  OrderCollaborator,
  OrderDriveDeliverable,
} from "@focoman/types";
import {
  getAdminAuthInstance,
  requireStudioMember,
  requireVerifiedUser,
} from "@/lib/serverAuth";

export async function getOrderByPasskeyCore(passkey: string): Promise<{
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
    let studioOwnerEmail = studio?.ownerEmail
      ? studio.ownerEmail.toLowerCase()
      : undefined;

    if (studioOwnerEmail) staffEmails.push(studioOwnerEmail);
    if (studioOwnerId) staffUids.push(studioOwnerId);

    try {
      const memberships = await getMembershipsByStudio(cleanStudioId);
      const adminAuth = getAdminAuthInstance();
      for (const m of memberships) {
        if (m.uid) {
          staffUids.push(m.uid);
          if (m.role === "STUDIO_OWNER" && !studioOwnerId) {
            studioOwnerId = m.uid;
          }
          try {
            const userRecord = await adminAuth.getUser(m.uid);
            if (userRecord.email) {
              const emailLower = userRecord.email.toLowerCase();
              staffEmails.push(emailLower);
              if (m.role === "STUDIO_OWNER" && !studioOwnerEmail) {
                studioOwnerEmail = emailLower;
              }
            }
          } catch {
            // User not found in auth
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
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to retrieve order.",
    };
  }
}

export async function syncOrderToAccountCore(input: {
  passkey: string;
  idToken: string;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const order = await getOrderByPasskey(input.passkey);
    if (!order) {
      return { success: false, error: "Order not found for this access code." };
    }

    const studioMembership = await getMembershipByUidAndStudio(
      decoded.uid,
      order.studioId
    );
    if (studioMembership && studioMembership.status === "ACTIVE") {
      return {
        success: false,
        error:
          "Studio owners and crew members cannot claim an order as the primary customer.",
      };
    }

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
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sync order.",
    };
  }
}

export async function getMySyncedOrdersCore(idToken: string): Promise<Order[]> {
  try {
    const decoded = await requireVerifiedUser(idToken);
    return await getOrdersByCustomerUid(decoded.uid, decoded.email);
  } catch (err: unknown) {
    console.error("[getMySyncedOrdersAction] Error:", err);
    return [];
  }
}

export async function updateOrderCollaboratorsCore(input: {
  orderId: string;
  collaborators: OrderCollaborator[];
  idToken: string;
}): Promise<{
  success: boolean;
  collaborators?: OrderCollaborator[];
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
        error:
          "Unauthorized: Only the primary customer or studio staff can manage family/friend permissions.",
      };
    }

    const updated = await updateOrder(order.id, {
      collaborators: input.collaborators,
    });

    return {
      success: true,
      collaborators: updated?.collaborators || input.collaborators,
    };
  } catch (err: unknown) {
    console.error("[updateOrderCollaboratorsAction] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update collaborators.",
    };
  }
}

export async function updateOrderDriveDeliverablesCore(input: {
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

    const [existingOrder, studio] = await Promise.all([
      getOrderById(input.orderId),
      getStudioBySlug(input.studioId),
    ]);
    if (
      !existingOrder ||
      existingOrder.studioId.toLowerCase() !== input.studioId.toLowerCase()
    ) {
      return { success: false, error: "Order not found in authorized studio." };
    }

    const { getEffectiveStudioTier } = await import("@/lib/proEntitlements");
    const tier = getEffectiveStudioTier(studio?.ownerEmail || decoded.email, studio?.planInfo);
    if (tier === "FREE" && input.deliverables.length > (existingOrder.driveDeliverables?.length || 0)) {
      return {
        success: false,
        error: "Google Drive Photo Preview & Selection is included in the ₹999/month and ₹1,999/month plans. Please upgrade your studio plan to add Drive deliverables.",
      };
    }

    const actorName = decoded.name || decoded.email || "Studio Staff";
    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_drive_deliv`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: membership.role === "STUDIO_OWNER" ? "Owner" : "Member",
      action: "Google Drive Deliverables Updated",
      details: `Updated Google Drive deliverable links (${
        input.deliverables.length
      } item${input.deliverables.length === 1 ? "" : "s"})`,
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
      error:
        err instanceof Error
          ? err.message
          : "Failed to update Google Drive deliverables.",
    };
  }
}

export async function submitCustomerDeliverableReviewCore(input: {
  orderId: string;
  deliverableId: string;
  approved: boolean;
  feedback?: string;
  selectedPhotos?: string[];
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
        error:
          "Only the primary customer or an authorized editor can submit review approvals.",
      };
    }

    const nowIso = new Date().toISOString();
    const currentDeliverables = order.driveDeliverables || [];
    const targetDeliverable = currentDeliverables.find(
      (d) => d.id === input.deliverableId
    );
    if (!targetDeliverable) {
      return {
        success: false,
        error: "Deliverable item not found on this order.",
      };
    }

    const cleanSelectedPhotos = Array.isArray(input.selectedPhotos)
      ? input.selectedPhotos.map((p) => p.trim()).filter(Boolean)
      : targetDeliverable.selectedPhotos;

    const updatedDeliverables = currentDeliverables.map((d) =>
      d.id === input.deliverableId
        ? {
            ...d,
            clientApproved: input.approved,
            clientFeedback: input.feedback?.trim() || undefined,
            ...(cleanSelectedPhotos && cleanSelectedPhotos.length > 0
              ? { selectedPhotos: cleanSelectedPhotos }
              : {}),
            clientReviewedAt: nowIso,
          }
        : d
    );

    const actorName =
      decoded.name || decoded.email || order.customer.name || "Customer";
    const selectionSummary =
      cleanSelectedPhotos && cleanSelectedPhotos.length > 0
        ? ` · Selected ${cleanSelectedPhotos.length} photo(s): ${cleanSelectedPhotos.slice(0, 8).join(", ")}${
            cleanSelectedPhotos.length > 8 ? "..." : ""
          }`
        : "";
    const reviewAudit: OrderAuditEntry = {
      id: `audit_${Date.now()}_deliv_review`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: isStudioStaff ? "Owner" : "Customer",
      action: input.approved
        ? "Deliverable Approved"
        : "Deliverable Revision Requested",
      details: `${input.approved ? "Approved" : "Requested changes on"} "${
        targetDeliverable.title
      }"${selectionSummary}${
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
      error:
        err instanceof Error
          ? err.message
          : "Failed to submit deliverable review.",
    };
  }
}
