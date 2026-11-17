import { getEffectiveStudioTier, type StudioEntitlementShape } from "./proEntitlements.ts";

export const MB_BYTES = 1024 * 1024;
export const GB_BYTES = 1024 * 1024 * 1024;

export const FREE_STORAGE_LIMIT_BYTES = 0;
export const TRIAL_STORAGE_LIMIT_BYTES = 10 * GB_BYTES;
export const STARTER_STORAGE_LIMIT_BYTES = 20 * GB_BYTES;
export const PROFESSIONAL_STORAGE_LIMIT_BYTES = 50 * GB_BYTES;

/** Hard safety cap per uploaded compressed proofing photo (10 MB) */
export const MAX_PHOTO_UPLOAD_BYTES = 10 * MB_BYTES;
/** Max files requested in a single presign batch */
export const MAX_PHOTOS_PER_BATCH = 200;
/** Max proofing photos allowed per individual order */
export const MAX_PHOTOS_PER_ORDER = 2000;

/** Allowed proofing image MIME types */
export const ALLOWED_PROOFING_MIME_TYPES = new Set([
  "image/webp",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export interface StudioStorageShape extends StudioEntitlementShape {
  storageUsedBytes?: number | null;
  storageFileCount?: number | null;
}

export interface StudioStorageQuota {
  limitBytes: number;
  limitGb: number;
  usedBytes: number;
  remainingBytes: number;
  usedPercent: number;
  fileCount: number;
  planLabel: "Free" | "30-Day Free Trial" | "Starter" | "Professional";
  isCloudStorageEnabled: boolean;
  isTrialActive: boolean;
  isNearCap: boolean;
  isAtCap: boolean;
}

export function isStudioTrialActive(
  planInfo?: StudioEntitlementShape["planInfo"],
  now: Date = new Date()
): boolean {
  if (!planInfo?.isTrial || !planInfo?.trialExpiresAt) return false;
  const expiresAt = new Date(planInfo.trialExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return now.getTime() <= expiresAt.getTime();
}

export function resolveStudioStorageQuota(
  studio?: StudioStorageShape | null,
  now: Date = new Date()
): StudioStorageQuota {
  const tier = getEffectiveStudioTier(studio);
  const trialActive = isStudioTrialActive(studio?.planInfo, now);

  let limitBytes = FREE_STORAGE_LIMIT_BYTES;
  let planLabel: StudioStorageQuota["planLabel"] = "Free";

  if (tier === "COMPLETE") {
    if (trialActive) {
      limitBytes = TRIAL_STORAGE_LIMIT_BYTES;
      planLabel = "30-Day Free Trial";
    } else {
      limitBytes = PROFESSIONAL_STORAGE_LIMIT_BYTES;
      planLabel = "Professional";
    }
  } else if (tier === "PROFESSIONAL") {
    // Public Starter plan maps to internal PROFESSIONAL tier
    limitBytes = STARTER_STORAGE_LIMIT_BYTES;
    planLabel = "Starter";
  }

  const usedBytes = Math.max(0, Number(studio?.storageUsedBytes || 0));
  const fileCount = Math.max(0, Number(studio?.storageFileCount || 0));
  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const usedPercent =
    limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0;

  return {
    limitBytes,
    limitGb: Math.round((limitBytes / GB_BYTES) * 10) / 10,
    usedBytes,
    remainingBytes,
    usedPercent,
    fileCount,
    planLabel,
    isCloudStorageEnabled: limitBytes > 0,
    isTrialActive: trialActive,
    isNearCap: limitBytes > 0 && usedPercent >= 80,
    isAtCap: limitBytes > 0 && usedBytes >= limitBytes,
  };
}

export function canStudioUploadBytes(
  studio: StudioStorageShape | null | undefined,
  additionalBytes: number
): { allowed: boolean; reason?: string; quota: StudioStorageQuota } {
  const quota = resolveStudioStorageQuota(studio);
  if (!quota.isCloudStorageEnabled) {
    return {
      allowed: false,
      quota,
      reason:
        "Built-in Cloud Proofing Storage is included in Starter (20 GB), Professional (50 GB), and the 30-day Free Trial (10 GB). Upgrade your plan or share an external link.",
    };
  }
  if (additionalBytes <= 0) {
    return { allowed: false, quota, reason: "Invalid upload file size." };
  }
  if (quota.usedBytes + additionalBytes > quota.limitBytes) {
    return {
      allowed: false,
      quota,
      reason: `Storage cap reached (${formatStorageBytes(quota.usedBytes)} / ${quota.limitGb} GB used on ${quota.planLabel}). Delete old proofing galleries or upgrade your plan to free up space.`,
    };
  }
  return { allowed: true, quota };
}

export function formatStorageBytes(bytes: number | null | undefined): string {
  const safe = Math.max(0, Number(bytes || 0));
  if (safe === 0) return "0 MB";
  if (safe < MB_BYTES) {
    return `${Math.max(1, Math.round(safe / 1024))} KB`;
  }
  if (safe < GB_BYTES) {
    return `${(safe / MB_BYTES).toFixed(1)} MB`;
  }
  return `${(safe / GB_BYTES).toFixed(2)} GB`;
}

/**
 * Strips extension & path segments cleanly so photographers can paste directly into
 * Adobe Lightroom Classic's Library Filter -> Text -> Filename -> Contains Any.
 */
export function extractLightroomBaseName(fileName: string): string {
  const justName = (fileName || "").split(/[\\/]/).pop()?.trim() || "";
  if (!justName) return "";
  const dotIdx = justName.lastIndexOf(".");
  return dotIdx > 0 ? justName.slice(0, dotIdx) : justName;
}

export function buildLightroomFilterString(fileNames: string[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of fileNames) {
    const base = extractLightroomBaseName(name);
    if (!base) continue;
    const key = base.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(base);
    }
  }
  return unique.join(", ");
}
