import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCloudPhotosByOrder,
  getOrderById,
  getStudioBySlug,
  reserveStudioStorage,
  createCloudUploadSessions,
} from "@focoman/db";
import {
  validateCloudFileName,
  CLOUD_PART_BYTES,
} from "@focoman/domain";
import type { CloudUploadSession } from "@focoman/types";
import { requireStudioMember, requireVerifiedUser } from "@/lib/serverAuth";
import {
  ALLOWED_PROOFING_MIME_TYPES,
  MAX_PHOTOS_PER_BATCH,
  MAX_PHOTOS_PER_ORDER,
  MAX_PHOTO_UPLOAD_BYTES,
  canStudioUploadBytes,
  extractLightroomBaseName,
} from "@/lib/storageQuota";
import {
  buildPhotoObjectKey,
  createPresignedPhotoUploadUrl,
  isR2Configured,
} from "@/services/r2StorageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FileRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_UPLOAD_BYTES),
  width: z.number().int().positive().max(20000).optional(),
  height: z.number().int().positive().max(20000).optional(),
});

const PresignUploadSchema = z.object({
  studioId: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  files: z.array(FileRequestSchema).min(1).max(MAX_PHOTOS_PER_BATCH),
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
        {
          error:
            "Cloud Proofing Storage is not configured on this server yet. Please add R2 environment credentials to enable direct photo uploads.",
          code: "R2_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const token = extractBearerToken(req);
    const decoded = await requireVerifiedUser(token);

    const body = await req.json().catch(() => null);
    const parsed = PresignUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid upload request. Ensure compressed images are under 10 MB.",
        },
        { status: 400 }
      );
    }

    const { studioId, orderId, files } = parsed.data;
    const cleanStudioId = studioId.toLowerCase();

    await requireStudioMember(decoded.uid, cleanStudioId);

    const [studio, order, existingPhotos] = await Promise.all([
      getStudioBySlug(cleanStudioId),
      getOrderById(orderId),
      getCloudPhotosByOrder(orderId),
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

    if (existingPhotos.length + files.length > MAX_PHOTOS_PER_ORDER) {
      return NextResponse.json(
        {
          error: `Each order supports up to ${MAX_PHOTOS_PER_ORDER} proofing photos (currently ${existingPhotos.length}).`,
        },
        { status: 400 }
      );
    }

    let totalBatchBytes = 0;
    for (const f of files) {
      try {
        validateCloudFileName(f.fileName);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : `Invalid file "${f.fileName}".` },
          { status: 400 }
        );
      }
      if (!ALLOWED_PROOFING_MIME_TYPES.has(f.mimeType.toLowerCase())) {
        return NextResponse.json(
          {
            error: `Unsupported image type "${f.mimeType}" for ${f.fileName}. Please upload WebP, JPEG, or PNG proofing images.`,
          },
          { status: 400 }
        );
      }
      totalBatchBytes += f.sizeBytes;
    }

    const quotaCheck = canStudioUploadBytes(studio, totalBatchBytes);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: quotaCheck.reason,
          quota: quotaCheck.quota,
          code: quotaCheck.quota.isCloudStorageEnabled
            ? "STORAGE_QUOTA_EXCEEDED"
            : "PLAN_UPGRADE_REQUIRED",
        },
        { status: quotaCheck.quota.isCloudStorageEnabled ? 413 : 403 }
      );
    }

    const reservationRes = await reserveStudioStorage(
      cleanStudioId,
      totalBatchBytes,
      files.length,
      quotaCheck.quota.limitBytes
    );
    if (!reservationRes.success) {
      return NextResponse.json(
        { error: reservationRes.error || "Storage quota reservation failed." },
        { status: 413 }
      );
    }

    const sessions: CloudUploadSession[] = [];
    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

    const uploads = await Promise.all(
      files.map(async (f, index) => {
        const photoId = `pho_${Date.now()}_${index}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const sessionId = `ses_${photoId}`;
        const objectKey = buildPhotoObjectKey(
          cleanStudioId,
          orderId,
          photoId,
          f.fileName
        );
        const uploadUrl = await createPresignedPhotoUploadUrl({
          objectKey,
          contentType: f.mimeType,
          contentLength: f.sizeBytes,
          expiresInSeconds: 600,
        });

        const partCount = Math.max(1, Math.ceil(f.sizeBytes / CLOUD_PART_BYTES));
        sessions.push({
          id: sessionId,
          photoId,
          orderId,
          studioId: cleanStudioId,
          actorUid: decoded.uid,
          fileName: f.fileName,
          sourceFileName: f.fileName,
          sizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
          storageKind: "OPTIMIZED",
          objectKey,
          partCount,
          partBytes: CLOUD_PART_BYTES,
          state: "RESERVED",
          status: "RESERVED",
          expiresAt: expiryIso,
          createdAt: nowIso,
        });

        return {
          photoId,
          sessionId,
          fileName: f.fileName,
          displayName: extractLightroomBaseName(f.fileName) || f.fileName,
          objectKey,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          ...(f.width ? { width: f.width } : {}),
          ...(f.height ? { height: f.height } : {}),
          uploadUrl,
        };
      })
    );

    await createCloudUploadSessions(sessions);

    return NextResponse.json({
      uploads,
      quota: quotaCheck.quota,
    });
  } catch (err: unknown) {
    console.error("[api/storage/presign-upload] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to prepare cloud upload.";
    const status = message.toLowerCase().includes("authentication") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
