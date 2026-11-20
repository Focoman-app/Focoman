import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { admitCloudUploadSessions, appendCloudStorageAudit, beginCloudMultipartInitialization, cleanFailedCloudUploadAdmission, completeCloudMultipartInitialization, getCloudPhotosByOrder, getOrderById, getStudioBySlug, markCloudUploadAdmissionCleanupPending, recordCloudMultipartInitiationUncertain } from "@focoman/db";
import { CLOUD_PART_BYTES, CLOUD_PREVIEW_BYTES, CLOUD_SESSION_MS, resolveCloudStorageSettings, validateAdmissionFile } from "@focoman/domain";
import type { CloudUploadSession } from "@focoman/types";
import { requireStudioMember, requireVerifiedUser } from "@/lib/serverAuth";
import { requireAssignedOrderAccess } from "@/actions/orders/orderAccessHelpers";
import { canStudioUploadBytes, MAX_PHOTOS_PER_BATCH, MAX_PHOTOS_PER_ORDER } from "@/lib/storageQuota";
import { buildPhotoObjectKey, createMultipartUpload, getR2ConfigStatus, hasConfiguredR2PlatformCap, isR2Configured, abortMultipartUpload, listMultipartUploadIdsForKey } from "@/services/r2StorageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fileSchema = z.object({ fileName: z.string().trim().min(1).max(200), sourceSizeBytes: z.number().int().positive(), sourceMimeType: z.string().max(100), sizeBytes: z.number().int().positive(), mimeType: z.string().max(100), sha256: z.string().length(64), lastModified: z.number().int().nonnegative(), idempotencyKey: z.string().min(16).max(100) });
const requestSchema = z.object({ studioId: z.string().trim().min(1), orderId: z.string().trim().min(1), files: z.array(fileSchema).min(1).max(MAX_PHOTOS_PER_BATCH) });
function bearer(req: Request) { const h = req.headers.get("authorization") || ""; return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined; }

export async function POST(req: Request) {
  const created: { sessionId: string; objectKey: string; uploadId: string }[] = [];
  let cleanupSessionIds: string[] = [];
  const attachedSessionIds = new Set<string>();
  const uncertainProviderSessionIds = new Set<string>();
  try {
    if (!isR2Configured() || !hasConfiguredR2PlatformCap()) return NextResponse.json({ error: "Cloud storage is not configured for admissions.", code: "R2_NOT_CONFIGURED" }, { status: 503 });
    const decoded = await requireVerifiedUser(bearer(req));
    const parsed = requestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid upload request." }, { status: 400 });
    const { studioId, orderId, files } = parsed.data; const sid = studioId.toLowerCase();
    const membership = await requireStudioMember(decoded.uid, sid);
    const [studio, order, persistedPhotos] = await Promise.all([getStudioBySlug(sid), getOrderById(orderId), getCloudPhotosByOrder(orderId)]);
    if (!studio || !order || order.studioId.toLowerCase() !== sid) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    await requireAssignedOrderAccess(membership, decoded.email, sid, order);
    if (persistedPhotos.length + files.length > MAX_PHOTOS_PER_ORDER) return NextResponse.json({ error: `Each order supports up to ${MAX_PHOTOS_PER_ORDER} files.` }, { status: 400 });
    const settings = resolveCloudStorageSettings(order, persistedPhotos.length > 0);
    const kinds = files.map((file) => validateAdmissionFile(file, settings));
    const primaryBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
    const previewBytes = files.reduce((sum, _file, i) => sum + (settings.proofingEnabled && kinds[i] === "ORIGINAL" ? CLOUD_PREVIEW_BYTES : 0), 0);
    const quota = canStudioUploadBytes(studio, primaryBytes + previewBytes);
    if (!quota.allowed) return NextResponse.json({ error: quota.reason, quota: quota.quota }, { status: 413 });
    const platformCapGb = getR2ConfigStatus().platformCapGb;
    if (platformCapGb === null) return NextResponse.json({ error: "Cloud storage is not configured for admissions.", code: "R2_NOT_CONFIGURED" }, { status: 503 });
    const now = new Date(); const expiresAt = new Date(now.getTime() + CLOUD_SESSION_MS).toISOString(); const sessions: CloudUploadSession[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i]; const photoId = `pho_${randomUUID()}`; const sessionId = `ses_${randomUUID()}`; const objectKey = buildPhotoObjectKey(sid, orderId, photoId, "primary");
      const previewReservedBytes = settings.proofingEnabled && kinds[i] === "ORIGINAL" ? CLOUD_PREVIEW_BYTES : 0;
      const manifestHash = createHash("sha256").update(JSON.stringify({ fileName: file.fileName, sourceSizeBytes: file.sourceSizeBytes, sourceMimeType: file.sourceMimeType, sizeBytes: file.sizeBytes, mimeType: file.mimeType, sha256: file.sha256, lastModified: file.lastModified })).digest("hex");
      sessions.push({ id: sessionId, photoId, studioId: sid, orderId, galleryId: orderId, actorUid: decoded.uid, actorName: decoded.name || decoded.email, idempotencyKey: file.idempotencyKey, manifestHash, sourceFileName: file.fileName, sourceSizeBytes: file.sourceSizeBytes, sourceMimeType: file.sourceMimeType, lastModified: file.lastModified, uploadSizeBytes: file.sizeBytes, uploadMimeType: file.mimeType, expectedSha256: file.sha256, storageKind: kinds[i], settings, objectKey, partCount: Math.ceil(file.sizeBytes / CLOUD_PART_BYTES), partSizeBytes: CLOUD_PART_BYTES, state: "RESERVED", reservedBytes: file.sizeBytes, previewReservedBytes, createdAt: now.toISOString(), expiresAt });
    }
    const admitted = await admitCloudUploadSessions({ sessions, studioLimitBytes: quota.quota.limitBytes, platformLimitBytes: platformCapGb * 1024 * 1024 * 1024 });
    if (!admitted.reused) cleanupSessionIds = admitted.sessions.map((session) => session.id);
    const readySessions: CloudUploadSession[] = [];
    for (const session of admitted.sessions) {
      if (session.state === "COMMITTED") { readySessions.push(session); continue; }
      if (session.state !== "RESERVED" && session.state !== "UPLOADING") throw new Error("Upload retry is not available.");
      if (new Date(session.expiresAt).getTime() <= Date.now()) throw new Error("Upload session has expired.");
      if (session.multipartUploadId) { readySessions.push(session); continue; }
      const initializing = await beginCloudMultipartInitialization({ sessionId: session.id, leaseToken: randomUUID(), leaseDurationMs: 2 * 60 * 1000 });
      if (initializing.multipartUploadId) { readySessions.push(initializing); continue; }
      if (admitted.reused) cleanupSessionIds.push(session.id);
      // Neither ListMultipartUploads nor CreateMultipartUpload is safe to
      // treat as failed merely because this process lost its response.
      uncertainProviderSessionIds.add(session.id);
      const existingUploadIds = await listMultipartUploadIdsForKey(initializing.objectKey);
      if (existingUploadIds.length > 1) throw new Error("Upload multipart state requires reconciliation.");
      const uploadId = existingUploadIds[0] || await createMultipartUpload({ objectKey: initializing.objectKey, contentType: initializing.uploadMimeType || "application/octet-stream" });
      if (existingUploadIds.length === 0) created.push({ sessionId: session.id, objectKey: session.objectKey, uploadId });
      const ready = await completeCloudMultipartInitialization({ sessionId: session.id, leaseToken: initializing.leaseToken!, multipartUploadId: uploadId });
      uncertainProviderSessionIds.delete(session.id);
      attachedSessionIds.add(session.id);
      const createdIndex = created.findIndex((item) => item.sessionId === session.id);
      if (createdIndex >= 0) created.splice(createdIndex, 1);
      // The session existed before contacting R2; only this server attaches the provider ID.
      readySessions.push(ready);
    }
    const reservedBytes = admitted.sessions.reduce((sum, session) => sum + (session.reservedBytes || 0) + (session.previewReservedBytes || 0), 0);
    await appendCloudStorageAudit({ studioId: sid, orderId, actorUid: decoded.uid, action: admitted.reused ? "UPLOAD_RESUMED" : "UPLOAD_ADMITTED", result: "SUCCESS", byteDelta: admitted.reused ? 0 : reservedBytes });
    return NextResponse.json({ uploads: readySessions.map((s) => ({ sessionId: s.id, photoId: s.photoId, fileName: s.sourceFileName, sizeBytes: s.uploadSizeBytes, mimeType: s.uploadMimeType, partSizeBytes: s.partSizeBytes, partCount: s.partCount, expiresAt: s.expiresAt })), quota: quota.quota, settings });
  } catch (err) {
    const aborted = await Promise.allSettled(created.map((item) => abortMultipartUpload(item)));
    const cleanupIds = [...new Set(cleanupSessionIds)];
    const failedAborts = created.filter((_, index) => aborted[index]?.status !== "fulfilled").map((item) => item.sessionId);
    const pendingIds = [...new Set([...uncertainProviderSessionIds, ...failedAborts])];
    if (pendingIds.length > 0) await recordCloudMultipartInitiationUncertain(pendingIds).catch(() => undefined);
    const safelyCleanableIds = cleanupIds.filter((id) => !attachedSessionIds.has(id) && !pendingIds.includes(id));
    if (safelyCleanableIds.length > 0) {
      await cleanFailedCloudUploadAdmission(safelyCleanableIds).catch(() => markCloudUploadAdmissionCleanupPending(safelyCleanableIds));
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to prepare upload." }, { status: 500 });
  }
}
