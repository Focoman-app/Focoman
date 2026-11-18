import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrderById,
  getStudioBySlug,
  commitVerifiedUploadBatch,
  releaseStudioStorageReservation,
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
import { isR2Configured, headR2Object } from "@/services/r2StorageService";

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

    const verifiedPhotos: typeof photos = [];
    let unverifiedBytes = 0;
    let unverifiedCount = 0;

    for (const p of photos) {
      const head = await headR2Object(p.objectKey);
      if (!head.exists || !head.sizeBytes || head.sizeBytes === 0) {
        unverifiedBytes += p.sizeBytes;
        unverifiedCount += 1;
        continue;
      }
      verifiedPhotos.push({
        ...p,
        sizeBytes: head.sizeBytes || p.sizeBytes,
      });
    }

    if (unverifiedCount > 0) {
      await releaseStudioStorageReservation(cleanStudioId, unverifiedBytes, unverifiedCount);
    }

    if (verifiedPhotos.length === 0) {
      return NextResponse.json(
        { error: "No uploaded objects could be verified in cloud storage." },
        { status: 400 }
      );
    }

    const totalBatchBytes = verifiedPhotos.reduce((sum, p) => sum + p.sizeBytes, 0);
    const nowIso = new Date().toISOString();
    const uploaderName = decoded.name || decoded.email || "Studio Staff";

    const records: OrderCloudPhoto[] = verifiedPhotos.map((p) => ({
      schemaVersion: 1,
      id: p.id,
      orderId,
      studioId: cleanStudioId,
      fileName: p.fileName,
      displayName: extractLightroomBaseName(p.fileName) || p.fileName,
      objectKey: p.objectKey,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      storageKind: "OPTIMIZED",
      ...(p.width ? { width: p.width } : {}),
      ...(p.height ? { height: p.height } : {}),
      selected: false,
      uploadedAt: nowIso,
      uploadedBy: uploaderName,
    }));

    await commitVerifiedUploadBatch({
      studioId: cleanStudioId,
      orderId,
      photos: records,
      sessionsToCommit: verifiedPhotos.map((p) => ({
        id: `ses_${p.id}`,
        reservedBytes: p.sizeBytes,
      })),
    });

    const [updatedStudio, orderSummary] = await Promise.all([
      getStudioBySlug(cleanStudioId),
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

    const updatedQuota = resolveStudioStorageQuota(updatedStudio || studio);

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
