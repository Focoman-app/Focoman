"use server";

import {
  getCloudPhotosByOrder,
  getCloudPhotoById,
  getMembershipByUidAndStudio,
  getOrderById,
  getOrderByPasskey,
  getStudioBySlug,
  getTasksByMember,
  getTasksByOrder,
  updateCloudPhoto,
  updateOrder,
  updateTask,
  updateOrderCloudStorageSettings,
  cancelJobsForOrder,
  beginCloudPhotoDeletion,
  finalizeCloudPhotoDeletion,
} from "@focoman/db";
import {
  getStudioTimestampIST,
  resolveCloudStorageSettings,
  resolvePhotoSelectionStatus,
  validatePhotoTags,
  validatePhotoSelectionStatus,
} from "@focoman/domain";
import type { Order, OrderAuditEntry, OrderCloudPhoto, CloudStorageSettings } from "@focoman/types";
import { requireStudioMember, requireVerifiedUser } from "@/lib/serverAuth";
import { findActiveMemberRecord, requireAssignedOrderAccess } from "@/actions/orders/orderAccessHelpers";
import { resolveStudioStorageQuota, formatStorageBytes, type StudioStorageQuota } from "@/lib/storageQuota";
import {
  createPresignedPhotoReadUrl,
  deleteR2Objects,
  isR2Configured,
} from "@/services/r2StorageService";
import { dispatchOrderStageWhatsAppNotification } from "@/services/whatsappService";

export interface HydratedCloudPhoto extends OrderCloudPhoto {
  previewUrl: string;
}
function matchesOrderPasskey(order: Order, rawPasskey?: string): boolean {
  if (!rawPasskey || !rawPasskey.trim()) return false;
  const cleanInput = rawPasskey.trim().toUpperCase();
  const numericPinMatch =
    order.trackingPasskey?.match(/\d{6}/g) ||
    order.orderNumber.match(/\d{6}/g) ||
    [];
  return Boolean(
    (order.passkeyPin && cleanInput === order.passkeyPin.toUpperCase()) ||
      (order.trackingPasskey &&
        cleanInput === order.trackingPasskey.toUpperCase()) ||
      cleanInput === order.orderNumber.toUpperCase() ||
      cleanInput === order.id.toUpperCase() ||
      numericPinMatch.some((pin) => cleanInput === pin)
  );
}

async function authorizePhotoGalleryAccess(input: {
  orderId: string;
  passkey?: string;
  idToken?: string;
  requireEdit?: boolean;
}): Promise<{
  order: Order;
  actorName: string;
  isStaff: boolean;
  canEdit: boolean;
}> {
  const order = await getOrderById(input.orderId);
  if (!order || order.isDeleted) {
    throw new Error("Order not found.");
  }

  if (input.idToken) {
    try {
      const decoded = await requireVerifiedUser(input.idToken);
      const userEmail = decoded.email?.toLowerCase();
      const customerEmail = order.customer.email?.toLowerCase();

      try {
        const m = await getMembershipByUidAndStudio(decoded.uid, order.studioId);
        if (m && m.status === "ACTIVE") {
          if (m.role !== "STUDIO_OWNER") {
            const memberRecord = await findActiveMemberRecord(order.studioId, decoded.email);
            if (memberRecord) {
              const tasks = await getTasksByMember(order.studioId, memberRecord.id);
              const isAssigned =
                order.assignedResources?.some((r) => r.memberId === memberRecord.id) ||
                tasks.some((t) => t.orderId === order.id);
              if (!isAssigned) {
                throw new Error("Access denied: You are not assigned to this order.");
              }
            }
          }
          return {
            order,
            actorName: decoded.name || decoded.email || "Studio Staff",
            isStaff: true,
            canEdit: true,
          };
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Access denied")) {
          throw err;
        }
        // continue checking customer/collaborator
      }

      const isPrimaryCustomer = Boolean(
        (userEmail && customerEmail && userEmail === customerEmail) ||
          (order.customer.uid && order.customer.uid === decoded.uid)
      );
      if (isPrimaryCustomer) {
        return {
          order,
          actorName: decoded.name || decoded.email || order.customer.name || "Customer",
          isStaff: false,
          canEdit: true,
        };
      }

      const collab = userEmail
        ? (order.collaborators || []).find(
            (c) => c.email.toLowerCase() === userEmail
          )
        : undefined;
      if (collab) {
        if (input.requireEdit && collab.role !== "EDITOR") {
          throw new Error(
            "You have View-Only permission on this gallery. Ask the primary customer for Can Edit access."
          );
        }
        return {
          order,
          actorName: decoded.name || decoded.email || "Family Member",
          isStaff: false,
          canEdit: collab.role === "EDITOR",
        };
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes("View-Only permission") || err.message.includes("Access denied"))) {
        throw err;
      }
      // Fall through to passkey check
    }
  }

  if (matchesOrderPasskey(order, input.passkey)) {
    const hasEmailLock = Boolean(order.customer.email && order.customer.email.trim());
    if (input.requireEdit && hasEmailLock) {
      throw new Error(
        "Please sign in with the customer or editor email account to select photos."
      );
    }
    return {
      order,
      actorName: order.customer.name || "Customer",
      isStaff: false,
      canEdit: !hasEmailLock,
    };
  }

  throw new Error("Unauthorized access to order photo gallery.");
}

export async function getStudioStorageStatusAction(input: {
  studioId: string;
  idToken: string;
}): Promise<{
  success: boolean;
  r2Configured: boolean;
  quota?: StudioStorageQuota;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const cleanStudioId = input.studioId.toLowerCase();
    await requireStudioMember(decoded.uid, cleanStudioId);
    const studio = await getStudioBySlug(cleanStudioId);
    if (!studio) {
      return {
        success: false,
        r2Configured: isR2Configured(),
        error: "Studio not found.",
      };
    }
    return {
      success: true,
      r2Configured: isR2Configured(),
      quota: resolveStudioStorageQuota(studio),
    };
  } catch (err: unknown) {
    return {
      success: false,
      r2Configured: isR2Configured(),
      error: err instanceof Error ? err.message : "Failed to load storage status.",
    };
  }
}

export async function getOrderCloudStorageSettingsAction(input: {
  studioId: string;
  orderId: string;
  idToken: string;
}): Promise<{
  success: boolean;
  settings?: CloudStorageSettings;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const cleanStudioId = input.studioId.toLowerCase();
    await requireStudioMember(decoded.uid, cleanStudioId);

    const order = await getOrderById(input.orderId);
    if (!order || order.studioId.toLowerCase() !== cleanStudioId) {
      return { success: false, error: "Order not found." };
    }

    const rawPhotos = await getCloudPhotosByOrder(order.id);
    const settings = resolveCloudStorageSettings(order, rawPhotos.length > 0);
    return { success: true, settings };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load cloud storage settings.",
    };
  }
}

export async function updateOrderCloudStorageSettingsAction(input: {
  studioId: string;
  orderId: string;
  settings: {
    compressionEnabled: boolean;
    proofingEnabled: boolean;
  };
  idToken: string;
}): Promise<{
  success: boolean;
  settings?: CloudStorageSettings;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const cleanStudioId = input.studioId.toLowerCase();
    await requireStudioMember(decoded.uid, cleanStudioId, "STUDIO_OWNER");

    const order = await getOrderById(input.orderId);
    if (!order || order.studioId.toLowerCase() !== cleanStudioId) {
      return { success: false, error: "Order not found." };
    }

    const nextSettings: CloudStorageSettings = {
      version: 1,
      compressionEnabled: Boolean(input.settings.compressionEnabled),
      proofingEnabled: Boolean(input.settings.proofingEnabled),
    };

    const actorName = decoded.name || decoded.email || "Studio Owner";
    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_storage_settings`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: "Owner",
      action: "Cloud Storage Settings Updated",
      details: `Compression: ${nextSettings.compressionEnabled ? "Enabled" : "Disabled"} · Proofing: ${nextSettings.proofingEnabled ? "Enabled" : "Disabled"}`,
    };

    await Promise.all([
      updateOrderCloudStorageSettings(order.id, nextSettings),
      updateOrder(order.id, {
        auditLog: [...(order.auditLog || []), auditEntry],
      }),
      !nextSettings.proofingEnabled ? cancelJobsForOrder(order.id) : Promise.resolve(),
    ]);

    return { success: true, settings: nextSettings };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update cloud storage settings.",
    };
  }
}

export async function getOrderCloudPhotosAction(input: {
  orderId: string;
  passkey?: string;
  idToken?: string;
}): Promise<{
  success: boolean;
  photos: HydratedCloudPhoto[];
  canEdit: boolean;
  isStaff: boolean;
  r2Configured: boolean;
  error?: string;
}> {
  try {
    const auth = await authorizePhotoGalleryAccess({
      orderId: input.orderId,
      passkey: input.passkey,
      idToken: input.idToken,
      requireEdit: false,
    });

    const configured = isR2Configured();
    const rawPhotos = await getCloudPhotosByOrder(auth.order.id);
    const settings = resolveCloudStorageSettings(auth.order, rawPhotos.length > 0);

    // If caller is a customer or family member, enforce proofing toggle
    if (!auth.isStaff && !settings.proofingEnabled) {
      return {
        success: false,
        photos: [],
        canEdit: false,
        isStaff: false,
        r2Configured: configured,
        error: "Client photo proofing is currently not enabled for this gallery.",
      };
    }

    const photos: HydratedCloudPhoto[] = await Promise.all(
      rawPhotos.map(async (p) => {
        let previewUrl = "";
        // A primary ORIGINAL is never a customer preview. Missing derivatives are
        // deliberately represented as processing/unavailable rather than leaked.
        // Only derivatives may represent an ORIGINAL. Optimized uploads and
        // pre-schema legacy records are proof assets, never reconstructed originals.
        const customerMayUsePrimary = p.storageKind === "OPTIMIZED" || p.schemaVersion === undefined;
        const previewKey = auth.isStaff ? (p.preview?.objectKey || p.objectKey) : (p.preview?.objectKey || (customerMayUsePrimary ? p.objectKey : undefined));
        if (configured && previewKey) {
          try {
            previewUrl = await createPresignedPhotoReadUrl({
              objectKey: previewKey,
              expiresInSeconds: auth.isStaff ? 900 : 300,
            });
          } catch {
            previewUrl = "";
          }
        }
        if (!auth.isStaff) {
          return {
            id: p.id,
            orderId: p.orderId,
            studioId: p.studioId,
            fileName: p.sourceFileName || p.fileName,
            displayName: p.displayName || p.sourceFileName || p.fileName,
            sizeBytes: p.preview?.sizeBytes || p.sizeBytes,
            mimeType: p.preview?.mimeType || p.mimeType,
            objectKey: "",
            uploadedAt: p.uploadedAt,
            selected: p.selected,
            selectedBy: p.selectedBy,
            selectedAt: p.selectedAt,
            selectionStatus: resolvePhotoSelectionStatus(p),
            tags: p.tags || [],
            comment: p.comment,
            previewUrl,
          };
        }
        return {
          ...p,
          displayName: p.displayName || p.sourceFileName || p.fileName,
          selectionStatus: resolvePhotoSelectionStatus(p),
          tags: p.tags || [],
          previewUrl,
        };
      })
    );

    return {
      success: true,
      photos,
      canEdit: auth.canEdit,
      isStaff: auth.isStaff,
      r2Configured: configured,
    };
  } catch (err: unknown) {
    return {
      success: false,
      photos: [],
      canEdit: false,
      isStaff: false,
      r2Configured: isR2Configured(),
      error: err instanceof Error ? err.message : "Failed to load proofing gallery.",
    };
  }
}

export async function getOrderCloudPhotosByPasskeyAction(input: {
  passkey: string;
  idToken?: string;
}): Promise<{
  success: boolean;
  order?: {
    id: string;
    orderNumber: string;
    eventType: string;
    customerName: string;
    studioName: string;
    studioId: string;
    trackingPasskey: string;
    cloudReviewApproved?: boolean;
    cloudReviewNotes?: string;
    cloudReviewSubmittedAt?: string;
  };
  photos: HydratedCloudPhoto[];
  canEdit: boolean;
  isStaff: boolean;
  r2Configured: boolean;
  error?: string;
}> {
  try {
    const order = await getOrderByPasskey(input.passkey.trim().toUpperCase());
    if (!order || order.isDeleted) {
      return {
        success: false,
        photos: [],
        canEdit: false,
        isStaff: false,
        r2Configured: isR2Configured(),
        error: "Order not found for this gallery link.",
      };
    }

    const [studio, galleryRes] = await Promise.all([
      getStudioBySlug(order.studioId),
      getOrderCloudPhotosAction({
        orderId: order.id,
        passkey: input.passkey,
        idToken: input.idToken,
      }),
    ]);

    if (!galleryRes.success) {
      return {
        success: false,
        photos: [],
        canEdit: false,
        isStaff: false,
        r2Configured: galleryRes.r2Configured,
        error: galleryRes.error,
      };
    }

    return {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        eventType: order.eventType,
        customerName: order.customer.name,
        studioName: studio?.name || "Studio",
        studioId: order.studioId,
        trackingPasskey: order.trackingPasskey,
        cloudReviewApproved: order.cloudReviewApproved,
        cloudReviewNotes: order.cloudReviewNotes,
        cloudReviewSubmittedAt: order.cloudReviewSubmittedAt,
      },
      photos: galleryRes.photos,
      canEdit: galleryRes.canEdit,
      isStaff: galleryRes.isStaff,
      r2Configured: galleryRes.r2Configured,
    };
  } catch (err: unknown) {
    return {
      success: false,
      photos: [],
      canEdit: false,
      isStaff: false,
      r2Configured: isR2Configured(),
      error: err instanceof Error ? err.message : "Failed to load gallery.",
    };
  }
}

export async function updateCloudPhotoSelectionAction(input: {
  orderId: string;
  photoId: string;
  selected?: boolean;
  selectionStatus?: 'NOT_REVIEWED' | 'SELECTED' | 'REJECTED';
  tags?: string[];
  comment?: string;
  passkey?: string;
  idToken?: string;
}): Promise<{ success: boolean; photo?: OrderCloudPhoto; error?: string }> {
  try {
    const auth = await authorizePhotoGalleryAccess({
      orderId: input.orderId,
      passkey: input.passkey,
      idToken: input.idToken,
      requireEdit: true,
    });

    const settings = resolveCloudStorageSettings(auth.order, true);
    if (!auth.isStaff && !settings.proofingEnabled) {
      return { success: false, error: "Photo selection is not currently open for this gallery." };
    }

    // Scoped photo lookup rather than fetching entire order photo list
    const target = await getCloudPhotoById(input.photoId);
    if (!target || target.orderId !== auth.order.id) {
      return { success: false, error: "Photo not found in this order gallery." };
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<Pick<OrderCloudPhoto, "selected" | "selectedBy" | "selectedAt" | "selectionStatus" | "tags" | "comment">> = {};

    if (input.selectionStatus !== undefined) {
      const validStatus = validatePhotoSelectionStatus(input.selectionStatus);
      updates.selectionStatus = validStatus;
      updates.selected = validStatus === "SELECTED";
      updates.selectedBy = validStatus === "SELECTED" ? auth.actorName : undefined;
      updates.selectedAt = validStatus === "SELECTED" ? nowIso : undefined;
    } else if (input.selected !== undefined) {
      updates.selected = input.selected;
      updates.selectionStatus = input.selected ? "SELECTED" : "NOT_REVIEWED";
      updates.selectedBy = input.selected ? auth.actorName : undefined;
      updates.selectedAt = input.selected ? nowIso : undefined;
    }

    if (input.tags !== undefined) {
      updates.tags = validatePhotoTags(input.tags);
    }

    if (input.comment !== undefined) {
      updates.comment = input.comment.trim() ? input.comment.trim().slice(0, 500) : "";
    }

    const updated = await updateCloudPhoto(target.id, updates) || target;
    if (!auth.isStaff) {
      return { success: true, photo: {
        ...updated,
        selectionStatus: resolvePhotoSelectionStatus(updated),
        tags: updated.tags || [],
        objectKey: "",
        preview: undefined,
        sha256: undefined,
        processingError: undefined,
      } };
    }
    return {
      success: true,
      photo: {
        ...updated,
        selectionStatus: resolvePhotoSelectionStatus(updated),
        tags: updated.tags || [],
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save photo selection.",
    };
  }
}

export async function submitCloudGalleryReviewAction(input: {
  orderId: string;
  approved: boolean;
  notes?: string;
  passkey?: string;
  idToken?: string;
}): Promise<{
  success: boolean;
  selectedCount?: number;
  submittedAt?: string;
  error?: string;
}> {
  try {
    const auth = await authorizePhotoGalleryAccess({
      orderId: input.orderId,
      passkey: input.passkey,
      idToken: input.idToken,
      requireEdit: true,
    });

    const photos = await getCloudPhotosByOrder(auth.order.id);
    const settings = resolveCloudStorageSettings(auth.order, photos.length > 0);
    if (!auth.isStaff && !settings.proofingEnabled) {
      return { success: false, error: "Photo selection is not currently open for this gallery." };
    }

    const selectedPhotos = photos.filter((p) => p.selected);
    const nowIso = new Date().toISOString();
    const cleanNotes = input.notes?.trim().slice(0, 1000) || undefined;

    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_gallery_review`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: auth.actorName,
      actorRole: auth.isStaff ? "Owner" : "Customer",
      action: input.approved
        ? "Cloud Photo Selection Submitted"
        : "Cloud Photo Gallery Revision Requested",
      details: `${selectedPhotos.length} photo${selectedPhotos.length === 1 ? "" : "s"} selected${cleanNotes ? ` — Note: "${cleanNotes}"` : ""}`,
    };

    await updateOrder(auth.order.id, {
      cloudReviewApproved: input.approved,
      ...(cleanNotes ? { cloudReviewNotes: cleanNotes } : { cloudReviewNotes: "" }),
      cloudReviewSubmittedAt: nowIso,
      auditLog: [...(auth.order.auditLog || []), auditEntry],
    });

    // If a photo selection task is currently awaiting client review, advance it cleanly
    try {
      const tasks = await getTasksByOrder(auth.order.id);
      const reviewSelectionTask = tasks.find(
        (t) =>
          t.status === "REVIEW" &&
          t.title.toLowerCase().includes("photo selection")
      );
      if (reviewSelectionTask) {
        const nextStatus = input.approved ? "COMPLETED" : "REWORK";
        await updateTask(reviewSelectionTask.id, {
          status: nextStatus,
          ...(input.approved
            ? { reworkNotes: undefined }
            : { reworkNotes: cleanNotes || "Customer requested gallery changes." }),
        });
        void dispatchOrderStageWhatsAppNotification({
          studioId: auth.order.studioId,
          order: auth.order,
          taskTitle: reviewSelectionTask.title,
          newStatus: nextStatus,
        });
      }
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      selectedCount: selectedPhotos.length,
      submittedAt: nowIso,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit photo selection.",
    };
  }
}

export async function deleteOrderCloudPhotosAction(input: {
  studioId: string;
  orderId: string;
  photoIds: string[];
  idToken: string;
}): Promise<{
  success: boolean;
  deletedCount?: number;
  freedBytes?: number;
  quota?: StudioStorageQuota;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const cleanStudioId = input.studioId.toLowerCase();
    const membership = await requireStudioMember(decoded.uid, cleanStudioId);

    const [studio, order, orderPhotos] = await Promise.all([
      getStudioBySlug(cleanStudioId),
      getOrderById(input.orderId),
      getCloudPhotosByOrder(input.orderId),
    ]);

    if (!studio || !order || order.studioId.toLowerCase() !== cleanStudioId) {
      return { success: false, error: "Order not found in authorized studio." };
    }
    await requireAssignedOrderAccess(membership, decoded.email, cleanStudioId, order);

    const idSet = new Set(input.photoIds);
    const toDelete = orderPhotos.filter((p) => idSet.has(p.id));
    if (toDelete.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        freedBytes: 0,
        quota: resolveStudioStorageQuota(studio),
      };
    }

    const started = await beginCloudPhotoDeletion({ jobId: `delete_${crypto.randomUUID()}`, studioId: cleanStudioId, orderId: order.id, photoIds: toDelete.map((p) => p.id), actorUid: decoded.uid });
    await deleteR2Objects(started.objectKeys);
    const usageAfter = await finalizeCloudPhotoDeletion({ jobId: started.jobId });
    const freedBytes = usageAfter.freedBytes;

    const actorName = decoded.name || decoded.email || "Studio Staff";
    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_cloud_delete`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: membership.role === "STUDIO_OWNER" ? "Owner" : "Member",
      action: "Proofing Photos Deleted",
      details: `Removed ${usageAfter.deletedCount} proofing photo${usageAfter.deletedCount === 1 ? "" : "s"} (${formatStorageBytes(freedBytes)} freed)`,
    };

    await updateOrder(order.id, {
      auditLog: [...(order.auditLog || []), auditEntry],
    });

    const quota = resolveStudioStorageQuota({
      ...studio,
      storageUsedBytes: usageAfter.storageUsedBytes,
      storageFileCount: usageAfter.storageFileCount,
    });

    return {
      success: true,
      deletedCount: usageAfter.deletedCount,
      freedBytes,
      quota,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete proofing photos.",
    };
  }
}

export async function getOriginalPhotoDownloadUrlAction(input: {
  studioId: string;
  orderId: string;
  photoId: string;
  idToken: string;
}): Promise<{
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    const cleanStudioId = input.studioId.toLowerCase();
    const membership = await requireStudioMember(decoded.uid, cleanStudioId);

    const [order, rawPhotos] = await Promise.all([
      getOrderById(input.orderId),
      getCloudPhotosByOrder(input.orderId),
    ]);

    if (!order || order.studioId.toLowerCase() !== cleanStudioId) {
      return { success: false, error: "Order not found in authorized studio." };
    }

    if (membership.role !== "STUDIO_OWNER") {
      const memberRecord = await findActiveMemberRecord(cleanStudioId, decoded.email);
      if (!memberRecord) {
        return { success: false, error: "Active crew profile not found." };
      }
      const tasks = await getTasksByMember(cleanStudioId, memberRecord.id);
      const isAssigned =
        order.assignedResources?.some((r) => r.memberId === memberRecord.id) ||
        tasks.some((t) => t.orderId === order.id);
      if (!isAssigned) {
        return { success: false, error: "Access denied: This order is not assigned to your crew profile." };
      }
    }

    const targetPhoto = rawPhotos.find((p) => p.id === input.photoId);
    if (!targetPhoto || !targetPhoto.objectKey) {
      return { success: false, error: "Photo not found." };
    }

    const downloadFileName = targetPhoto.sourceFileName || targetPhoto.fileName;
    const downloadUrl = await createPresignedPhotoReadUrl({
      objectKey: targetPhoto.objectKey,
      expiresInSeconds: 900,
      responseContentDisposition: `attachment; filename="${downloadFileName}"`,
    });

    const actorName = decoded.name || decoded.email || "Studio Staff";
    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_original_download`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName,
      actorRole: membership.role === "STUDIO_OWNER" ? "Owner" : "Member",
      action: "Original Photo Downloaded",
      details: `Downloaded original file "${downloadFileName}"`,
    };

    await updateOrder(order.id, {
      auditLog: [...(order.auditLog || []), auditEntry],
    });

    return {
      success: true,
      downloadUrl,
      fileName: downloadFileName,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate original download URL.",
    };
  }
}

