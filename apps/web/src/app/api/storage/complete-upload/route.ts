import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adjustStudioStorageUsage,
  getOrderById,
  getStudioBySlug,
  saveCloudPhotosBatch,
  syncOrderCloudPhotoSummary,
  updateOrder,
} from "@focoman/db";
import { getStudioTimestampIST } from "@focoman/domain";
import type { OrderAuditEntry, OrderCloudPhoto } from "@focoman/types";
import { requireStudioMember, requireVerifiedUser } from "@/lib/serverAuth";
import {
  MAX_PHOTOS_PER_BATCH,
  MAX_PHOTO_UPLOAD_BYTES,
  canStudioUploadBytes,
  extractLightroomBaseName,
  formatStorageBytes,
  resolveStudioStorageQuota,
} from "@/lib/storageQuota";
import { isR2Configured } from "@/services/r2StorageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CompletedPhotoSchema = z.object({
  id: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(200),
  objectKey: z.string().trim().min(1).max(400),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_UPLOAD_BYTES),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

const CompleteUploadSchema = z.object({
  studioId: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  photos: z.array(CompletedPhotoSchema).min(1).max(MAX_PHOTOS_PER_BATCH),
});

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "Cloud Proofing Storage is not configured on this server." },
        { status: 503 }
      );
    }

    const token = extractBearerToken(req);
    const decoded = await requireVerifiedUser(token);

    const body = await req.json().catch(() => null);
    const parsed = CompleteUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid photo completion payload." },
        { status: 400 }
      );
    }

    const { studioId, orderId, photos } = parsed.data;
    const cleanStudioId = studioId.toLowerCase();
    const membership = await requireStudioMember(decoded.uid, cleanStudioId);

    const [studio, order] = await Promise.all([
      getStudioBySlug(cleanStudioId),
      getOrderById(orderId),
    ]);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found." }, { status: 404 });
    }
    if (!order || order.studioId.toLowerCase() !== cleanStudioId) {
      return NextResponse.json(
        { error: "Order not found in this studio workspace." },
        { status: 404 }
      );
    }

    const expectedPrefix = `studios/${cleanStudioId.replace(/[^a-z0-9_-]/g, "_")}/orders/${orderId.replace(/[^a-zA-Z0-9_-]/g, "_")}/`;
    for (const p of photos) {
      if (!p.objectKey.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: `Invalid storage object key for photo ${p.fileName}.` },
          { status: 400 }
        );
      }
    }

    const totalBatchBytes = photos.reduce((sum, p) => sum + p.sizeBytes, 0);
    const quotaCheck = canStudioUploadBytes(studio, totalBatchBytes);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: quotaCheck.reason, quota: quotaCheck.quota },
        { status: 413 }
      );
    }

    const nowIso = new Date().toISOString();
    const uploaderName = decoded.name || decoded.email || "Studio Staff";

    const records: OrderCloudPhoto[] = photos.map((p) => ({
      id: p.id,
      orderId,
      studioId: cleanStudioId,
      fileName: p.fileName,
      displayName: extractLightroomBaseName(p.fileName) || p.fileName,
      objectKey: p.objectKey,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      ...(p.width ? { width: p.width } : {}),
      ...(p.height ? { height: p.height } : {}),
      selected: false,
      uploadedAt: nowIso,
      uploadedBy: uploaderName,
    }));

    await saveCloudPhotosBatch(records);

    const [usageAfter, orderSummary] = await Promise.all([
      adjustStudioStorageUsage(cleanStudioId, totalBatchBytes, records.length),
      syncOrderCloudPhotoSummary(orderId),
    ]);

    const auditEntry: OrderAuditEntry = {
      id: `audit_${Date.now()}_cloud_upload`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: uploaderName,
      actorRole: membership.role === "STUDIO_OWNER" ? "Owner" : "Member",
      action: "Proofing Photos Uploaded",
      details: `Uploaded ${records.length} proofing photo${records.length === 1 ? "" : "s"} (${formatStorageBytes(totalBatchBytes)}) to Cloud Storage`,
    };

    await updateOrder(orderId, {
      auditLog: [...(order.auditLog || []), auditEntry],
    });

    const updatedQuota = resolveStudioStorageQuota({
      ...studio,
      storageUsedBytes: usageAfter.storageUsedBytes,
      storageFileCount: usageAfter.storageFileCount,
    });

    return NextResponse.json({
      savedCount: records.length,
      quota: updatedQuota,
      orderSummary,
    });
  } catch (err: unknown) {
    console.error("[api/storage/complete-upload] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to finalize cloud upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
