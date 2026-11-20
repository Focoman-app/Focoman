import { NextResponse } from "next/server";
import { z } from "zod";
import { beginCloudUploadCleanup, enqueueCloudStorageJob, getCloudUploadSession, updateCloudUploadSession } from "@focoman/db";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { authorizeCloudUploadSession } from "@/lib/cloudUploadAuthorization";
import { abortMultipartUpload } from "@/services/r2StorageService";
const schema = z.object({ sessionId: z.string().min(1) });
const token = (req: Request) => { const h = req.headers.get("authorization") || ""; return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined; };
export async function POST(req: Request) {
  try {
    const decoded = await requireVerifiedUser(token(req)); const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid session." }, { status: 400 });
    const s = await getCloudUploadSession(parsed.data.sessionId);
    if (!s) return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    await authorizeCloudUploadSession(s, decoded, true);
    if (s.state === "CLEANED") return NextResponse.json({ state: s.state });
    const pending = await beginCloudUploadCleanup(s.id);
    if (pending.state === "CLEANED") return NextResponse.json({ state: pending.state });
    const runAfter = new Date(Math.max(Date.now(), new Date(pending.lastSignedUrlExpiresAt || 0).getTime()) + 120_000).toISOString();
    try { if (pending.multipartUploadId) await abortMultipartUpload({ objectKey: pending.objectKey, uploadId: pending.multipartUploadId }); }
    catch (error) { await updateCloudUploadSession(pending.id, { errorCode: "ABORT_FAILED" }); throw error; }
    await enqueueCloudStorageJob({ id: `cleanup:${pending.id}`, kind: "CLEANUP", studioId: pending.studioId, orderId: pending.orderId, sessionId: pending.id, state: "PENDING", attempt: 0, maxAttempts: 4, runAfter, updatedAt: new Date().toISOString() });
    return NextResponse.json({ state: "CLEANUP_PENDING" }, { status: 202 });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to cancel upload." }, { status: 500 }); }
}
