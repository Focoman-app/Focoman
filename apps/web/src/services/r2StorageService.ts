import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let r2ClientInstance: S3Client | null = null;

function getR2Env() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucketName = (process.env.R2_BUCKET_NAME || "").trim();
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  const platformCapGbRaw = Number(process.env.R2_PLATFORM_CAP_GB || 500);
  const platformCapGb =
    Number.isFinite(platformCapGbRaw) && platformCapGbRaw > 0 ? platformCapGbRaw : 500;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
    platformCapGb,
  };
}

export function isR2Configured(): boolean {
  const env = getR2Env();
  return Boolean(
    env.accountId && env.accessKeyId && env.secretAccessKey && env.bucketName
  );
}

export function getR2ConfigStatus() {
  const env = getR2Env();
  return {
    configured: isR2Configured(),
    bucketName: env.bucketName || null,
    hasPublicBaseUrl: Boolean(env.publicBaseUrl),
    platformCapGb: env.platformCapGb,
  };
}

function getR2Client(): S3Client {
  const env = getR2Env();
  if (!env.accountId || !env.accessKeyId || !env.secretAccessKey || !env.bucketName) {
    throw new Error(
      "Cloud Proofing Storage (R2) is not configured yet. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME."
    );
  }
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
      // R2 does not support AWS SDK default flexible checksum headers cleanly on browser PUT CORS
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return r2ClientInstance;
}

export function sanitizeStorageFileName(fileName: string): string {
  const justName = (fileName || "photo.webp").split(/[\\/]/).pop() || "photo.webp";
  return justName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "photo.webp";
}

export function buildPhotoObjectKey(
  studioId: string,
  orderId: string,
  photoId: string,
  fileName: string
): string {
  const cleanStudio = studioId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const cleanOrder = orderId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanPhotoId = photoId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeName = sanitizeStorageFileName(fileName);
  return `studios/${cleanStudio}/orders/${cleanOrder}/${cleanPhotoId}_${safeName}`;
}

export async function createPresignedPhotoUploadUrl(input: {
  objectKey: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const env = getR2Env();
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: env.bucketName,
    Key: input.objectKey,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  return await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 600, // 10 minutes
  });
}

export async function createPresignedPhotoReadUrl(input: {
  objectKey: string;
  expiresInSeconds?: number;
  responseContentDisposition?: string;
}): Promise<string> {
  const env = getR2Env();
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: env.bucketName,
    Key: input.objectKey,
    ...(input.responseContentDisposition
      ? { ResponseContentDisposition: input.responseContentDisposition }
      : {}),
  });
  return await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 3600, // 1 hour
  });
}

export async function deleteR2Objects(objectKeys: string[]): Promise<{
  deletedCount: number;
  skipped: boolean;
}> {
  const cleanKeys = Array.from(
    new Set(objectKeys.map((k) => k.trim()).filter(Boolean))
  );
  if (cleanKeys.length === 0) {
    return { deletedCount: 0, skipped: false };
  }
  if (!isR2Configured()) {
    return { deletedCount: 0, skipped: true };
  }

  const env = getR2Env();
  const client = getR2Client();
  let deletedCount = 0;

  for (let i = 0; i < cleanKeys.length; i += 1000) {
    const chunk = cleanKeys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: env.bucketName,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
    deletedCount += chunk.length;
  }

  return { deletedCount, skipped: false };
}

export async function headR2Object(objectKey: string): Promise<{
  exists: boolean;
  sizeBytes?: number;
  etag?: string;
  contentType?: string;
}> {
  if (!isR2Configured()) {
    return { exists: false };
  }
  const env = getR2Env();
  const client = getR2Client();
  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: env.bucketName,
        Key: objectKey,
      })
    );
    return {
      exists: true,
      sizeBytes: res.ContentLength,
      etag: res.ETag?.replace(/"/g, ""),
      contentType: res.ContentType,
    };
  } catch (err: unknown) {
    return { exists: false };
  }
}

export async function createMultipartUpload(input: {
  objectKey: string;
  contentType: string;
}): Promise<string> {
  const env = getR2Env();
  const client = getR2Client();
  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: env.bucketName,
      Key: input.objectKey,
      ContentType: input.contentType,
    })
  );
  if (!res.UploadId) {
    throw new Error("Failed to initialize multipart upload.");
  }
  return res.UploadId;
}

export async function createPresignedUploadPartUrl(input: {
  objectKey: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const env = getR2Env();
  const client = getR2Client();
  const command = new UploadPartCommand({
    Bucket: env.bucketName,
    Key: input.objectKey,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  });
  return await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 600,
  });
}

export async function completeMultipartUpload(input: {
  objectKey: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
}): Promise<{ etag?: string }> {
  const env = getR2Env();
  const client = getR2Client();
  const sortedParts = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
  const res = await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: env.bucketName,
      Key: input.objectKey,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
          PartNumber: p.partNumber,
          ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
        })),
      },
    })
  );
  return { etag: res.ETag?.replace(/"/g, "") };
}

export async function abortMultipartUpload(input: {
  objectKey: string;
  uploadId: string;
}): Promise<void> {
  if (!isR2Configured()) return;
  const env = getR2Env();
  const client = getR2Client();
  try {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: env.bucketName,
        Key: input.objectKey,
        UploadId: input.uploadId,
      })
    );
  } catch {
    // Non-fatal if upload was already completed or expired
  }
}
