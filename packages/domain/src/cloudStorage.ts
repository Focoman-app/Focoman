import type { CloudStorageSettings, Order, OrderCloudPhoto } from '@focoman/types';

export const CLOUD_PART_BYTES = 16 * 1024 * 1024;
export const CLOUD_MAX_ORIGINAL_BYTES = 512 * 1024 * 1024;
export const CLOUD_MAX_OPTIMIZED_BYTES = 10 * 1024 * 1024;
export const CLOUD_PREVIEW_BYTES = 2 * 1024 * 1024;
export const CLOUD_SESSION_MS = 24 * 60 * 60 * 1000;
export const CLOUD_URL_SECONDS = 300;
export const CLOUD_MAX_PIXELS = 120_000_000;
export const NEW_CLOUD_STORAGE_SETTINGS: CloudStorageSettings = {
  version: 1,
  compressionEnabled: true,
  proofingEnabled: false,
};
export const RAW_EXTENSIONS = new Set(['cr2', 'cr3', 'nef', 'arw', 'dng']);
export const RASTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function resolveCloudStorageSettings(
  order: Pick<Order, 'cloudStorageSettings' | 'cloudReviewApproved' | 'cloudReviewNotes' | 'cloudReviewSubmittedAt'>,
  hasLegacyPhotos: boolean
): CloudStorageSettings {
  if (order.cloudStorageSettings) {
    const s = order.cloudStorageSettings;
    if (
      s.version !== 1 ||
      typeof s.compressionEnabled !== 'boolean' ||
      typeof s.proofingEnabled !== 'boolean'
    ) {
      throw new Error('Unsupported cloud storage settings.');
    }
    return { ...s };
  }
  return {
    version: 1,
    compressionEnabled: true,
    proofingEnabled:
      hasLegacyPhotos ||
      order.cloudReviewApproved !== undefined ||
      Boolean(order.cloudReviewNotes || order.cloudReviewSubmittedAt),
  };
}

export function cloudFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function isRawPhoto(name: string): boolean {
  return RAW_EXTENSIONS.has(cloudFileExtension(name));
}

export function validateCloudFileName(name: string): void {
  if (
    !name ||
    name.length > 200 ||
    /[\\/\x00-\x1f\x7f]/.test(name) ||
    name === '.' ||
    name === '..'
  ) {
    throw new Error('Invalid filename. Paths and control characters are not permitted.');
  }
  if (!new Set(['jpg', 'jpeg', 'png', 'webp', ...RAW_EXTENSIONS]).has(cloudFileExtension(name))) {
    throw new Error('Supported files: JPEG, PNG, WebP, CR2, CR3, NEF, ARW and DNG.');
  }
}

export function requireSafeCounter(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Storage accounting requires reconciliation (${label}).`);
  }
  return Number(value);
}

export function cloudPartLength(size: number, partNumber: number): number {
  if (
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > Math.ceil(size / CLOUD_PART_BYTES)
  ) {
    throw new Error('Invalid upload part.');
  }
  return Math.min(CLOUD_PART_BYTES, size - (partNumber - 1) * CLOUD_PART_BYTES);
}

export function validatePartManifest(
  size: number,
  parts: { PartNumber?: number; Size?: number; ETag?: string }[]
): { PartNumber: number; ETag: string }[] {
  if (parts.length !== Math.ceil(size / CLOUD_PART_BYTES)) {
    throw new Error('Upload is incomplete.');
  }
  return [...parts]
    .sort((a, b) => Number(a.PartNumber) - Number(b.PartNumber))
    .map((p, i) => {
      if (
        p.PartNumber !== i + 1 ||
        p.Size !== cloudPartLength(size, i + 1) ||
        !p.ETag
      ) {
        throw new Error('Upload part manifest does not match the reserved file.');
      }
      return { PartNumber: p.PartNumber, ETag: p.ETag };
    });
}

export function cloudPhotoStoredBytes(photo: OrderCloudPhoto): number {
  return (
    requireSafeCounter(photo.sizeBytes, 'photo bytes') +
    (photo.preview ? requireSafeCounter(photo.preview.sizeBytes, 'preview bytes') : 0)
  );
}

export function cloudPreviewRequired(
  photo: Pick<OrderCloudPhoto, 'storageKind' | 'preview'>,
  settings: CloudStorageSettings
): boolean {
  return settings.proofingEnabled && photo.storageKind === 'ORIGINAL' && !photo.preview;
}

export function validateRasterSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
    );
  }
  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }
  return false;
}

export interface CloudAdmissionFile {
  fileName: string;
  sourceSizeBytes: number;
  sourceMimeType: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  lastModified: number;
  idempotencyKey: string;
}

export function validateAdmissionFile(
  file: CloudAdmissionFile,
  settings: CloudStorageSettings
): 'ORIGINAL' | 'OPTIMIZED' {
  validateCloudFileName(file.fileName);
  if (!/^[a-f0-9]{64}$/.test(file.sha256)) {
    throw new Error('A SHA-256 checksum is required.');
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(file.idempotencyKey)) {
    throw new Error('Invalid upload request identity.');
  }
  for (const n of [file.sourceSizeBytes, file.sizeBytes]) {
    if (!Number.isSafeInteger(n) || n <= 0 || n > CLOUD_MAX_ORIGINAL_BYTES) {
      throw new Error('Files must be between 1 byte and 512 MB.');
    }
  }
  if (!Number.isSafeInteger(file.lastModified) || file.lastModified < 0) {
    throw new Error('Invalid source file timestamp.');
  }
  const original = !settings.compressionEnabled || isRawPhoto(file.fileName);
  if (
    original &&
    (file.sizeBytes !== file.sourceSizeBytes || file.mimeType !== file.sourceMimeType)
  ) {
    throw new Error('Original uploads must preserve source size and content type.');
  }
  if (!isRawPhoto(file.fileName)) {
    const expected = ({
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    } as Record<string, string>)[cloudFileExtension(file.fileName)];
    if (file.sourceMimeType !== expected || !RASTER_TYPES.has(file.mimeType)) {
      throw new Error('Filename and image type do not match.');
    }
  } else if (
    ![
      'application/octet-stream',
      'image/x-canon-cr2',
      'image/x-canon-cr3',
      'image/x-nikon-nef',
      'image/x-sony-arw',
      'image/x-adobe-dng',
      'image/dng',
      '',
    ].includes(file.mimeType)
  ) {
    throw new Error('Unsupported RAW content type.');
  }
  if (!original && file.sizeBytes > CLOUD_MAX_OPTIMIZED_BYTES) {
    throw new Error('Optimized images must be under 10 MB.');
  }
  return original ? 'ORIGINAL' : 'OPTIMIZED';
}
