import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudUploadSession } from "@focoman/db";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { listMultipartUploadParts } from "@/services/r2StorageService";
import { authorizeCloudUploadSession } from "@/lib/cloudUploadAuthorization";
const schema = z.object({ sessionId: z.string().min(1) });
function token(req: Request) { const h = req.headers.get("authorization") || ""; return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined; }
export async function POST(req: Request) {
  try { const decoded = await requireVerifiedUser(token(req)); const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid session." }, { status: 400 }); const s = await getCloudUploadSession(parsed.data.sessionId); if (!s || s.actorUid !== decoded.uid || !s.multipartUploadId) return NextResponse.json({ error: "Upload session not found." }, { status: 404 }); await authorizeCloudUploadSession(s, decoded); const parts = await listMultipartUploadParts({ objectKey: s.objectKey, uploadId: s.multipartUploadId }); return NextResponse.json({ state: s.state, fileName: s.sourceFileName, sizeBytes: s.uploadSizeBytes, partCount: s.partCount, parts: parts.map((p) => ({ partNumber: p.PartNumber, sizeBytes: p.Size, etag: p.ETag })) }); } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to read upload status." }, { status: 500 }); }
}
