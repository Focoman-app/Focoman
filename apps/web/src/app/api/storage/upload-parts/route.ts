import { NextResponse } from "next/server";
import { z } from "zod";
import { getCloudUploadSession, updateCloudUploadSession } from "@focoman/db";
import { cloudPartLength, CLOUD_URL_SECONDS } from "@focoman/domain";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { createPresignedUploadPartUrl } from "@/services/r2StorageService";
import { authorizeCloudUploadSession } from "@/lib/cloudUploadAuthorization";

const schema = z.object({ sessionId: z.string().min(1), partNumbers: z.array(z.number().int().positive()).min(1).max(8) });
function token(req: Request) { const h = req.headers.get("authorization") || ""; return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined; }
export async function POST(req: Request) {
  try {
    const decoded = await requireVerifiedUser(token(req)); const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid part request." }, { status: 400 });
    const session = await getCloudUploadSession(parsed.data.sessionId);
    if (!session || session.actorUid !== decoded.uid || !session.multipartUploadId || !session.uploadSizeBytes || !session.partCount || new Date(session.expiresAt).getTime() < Date.now()) return NextResponse.json({ error: "Upload session is unavailable." }, { status: 404 });
    await authorizeCloudUploadSession(session, decoded);
    if (session.state !== "RESERVED" && session.state !== "UPLOADING") return NextResponse.json({ error: "Upload session cannot accept parts." }, { status: 409 });
    const unique = [...new Set(parsed.data.partNumbers)];
    const parts = await Promise.all(unique.map(async (partNumber) => ({ partNumber, sizeBytes: cloudPartLength(session.uploadSizeBytes!, partNumber), url: await createPresignedUploadPartUrl({ objectKey: session.objectKey, uploadId: session.multipartUploadId!, partNumber, expiresInSeconds: CLOUD_URL_SECONDS }), expiresAt: new Date(Date.now() + CLOUD_URL_SECONDS * 1000).toISOString() })));
    await updateCloudUploadSession(session.id, { state: "UPLOADING", lastSignedUrlExpiresAt: parts[0]?.expiresAt });
    return NextResponse.json({ parts });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to sign upload parts." }, { status: 500 }); }
}
