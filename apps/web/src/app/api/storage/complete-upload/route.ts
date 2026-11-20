import { NextResponse } from "next/server";
import { z } from "zod";
import { appendCloudStorageAudit, beginCloudUploadVerification, commitCloudUploadSession, getCloudUploadSession } from "@focoman/db";
import { randomUUID } from "crypto";
import { isRawPhoto, validatePartManifest, validateRasterSignature } from "@focoman/domain";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { authorizeCloudUploadSession } from "@/lib/cloudUploadAuthorization";
import { completeMultipartUpload, hashR2Object, headR2Object, isR2Configured, listMultipartUploadParts } from "@/services/r2StorageService";

export const runtime = "nodejs";
const schema = z.object({ sessionIds: z.array(z.string().min(1)).min(1).max(20) });
const token = (req: Request) => { const h = req.headers.get("authorization") || ""; return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined; };
export async function POST(req: Request) {
  try {
    if (!isR2Configured()) return NextResponse.json({ error: "Cloud storage is not configured." }, { status: 503 });
    const decoded = await requireVerifiedUser(token(req)); const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid completion request." }, { status: 400 });
    const results: { sessionId: string; state: string; photoId?: string; error?: string }[] = [];
    for (const sessionId of [...new Set(parsed.data.sessionIds)]) try {
      const existing = await getCloudUploadSession(sessionId);
      if (!existing || !existing.multipartUploadId || !existing.uploadSizeBytes) throw new Error("Upload session not found.");
      await authorizeCloudUploadSession(existing, decoded);
      if (existing.actorUid !== decoded.uid) throw new Error("Only the uploader can complete this session.");
      const s = await beginCloudUploadVerification({ sessionId, leaseToken: randomUUID(), leaseDurationMs: 5 * 60 * 1000 });
      if (s.state === "COMMITTED") { results.push({ sessionId, state: "COMMITTED", photoId: s.photoId }); continue; }
      if (new Date(s.expiresAt).getTime() < Date.now()) throw new Error("Upload session has expired.");
      const uploadSizeBytes = s.uploadSizeBytes;
      const multipartUploadId = s.multipartUploadId;
      const verificationLeaseToken = s.leaseToken;
      if (!uploadSizeBytes || !multipartUploadId || !verificationLeaseToken) throw new Error("Upload session is incomplete.");
      // A previous request may have completed R2 before losing its Firestore
      // response. HEAD first so a retry commits that immutable object instead
      // of attempting to consume the multipart upload again.
      let head = await headR2Object(s.objectKey);
      if (!head.exists) {
        const parts = validatePartManifest(uploadSizeBytes, await listMultipartUploadParts({ objectKey: s.objectKey, uploadId: multipartUploadId }));
        await completeMultipartUpload({ objectKey: s.objectKey, uploadId: multipartUploadId, parts: parts.map((p) => ({ partNumber: p.PartNumber, etag: p.ETag })) });
        head = await headR2Object(s.objectKey);
      }
      if (!head.exists || head.sizeBytes !== uploadSizeBytes) throw new Error("Stored object verification failed.");
      const verified = await hashR2Object(s.objectKey, uploadSizeBytes);
      if (verified.sizeBytes !== uploadSizeBytes || (s.expectedSha256 && verified.sha256 !== s.expectedSha256)) throw new Error("Stored object checksum verification failed.");
      if (!isRawPhoto(s.sourceFileName) && !validateRasterSignature(verified.signature, head.contentType || s.uploadMimeType || "")) throw new Error("Stored image signature is invalid.");
      const processingUnavailable = s.settings?.proofingEnabled && s.storageKind === "ORIGINAL" && process.env.CLOUD_STORAGE_WORKER_ENABLED !== "true";
      const committed = await commitCloudUploadSession({ sessionId, actualSizeBytes: verified.sizeBytes, actualContentType: head.contentType, actualSha256: verified.sha256, leaseToken: verificationLeaseToken, processingUnavailable });
      await appendCloudStorageAudit({ studioId: s.studioId, orderId: s.orderId, photoId: s.photoId, sessionId, actorUid: decoded.uid, action: "UPLOAD_COMMITTED", result: "SUCCESS", byteDelta: verified.sizeBytes });
      results.push({ sessionId, state: committed.photo.processingStatus === "PENDING" ? "PROCESSING" : "COMMITTED", photoId: committed.photo.id });
    } catch (err) { results.push({ sessionId, state: "FAILED", error: err instanceof Error ? err.message : "Completion failed." }); }
    return NextResponse.json({ results }, { status: results.every((r) => r.state === "FAILED") ? 400 : 200 });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to complete uploads." }, { status: 500 }); }
}
