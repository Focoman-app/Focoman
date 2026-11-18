export interface CloudStorageSettings {
  version: 1;
  compressionEnabled: boolean;
  proofingEnabled: boolean;
}

export type CloudProcessingStatus = 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export interface CloudPhotoPreview {
  objectKey: string;
  sizeBytes: number;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  sha256: string;
}
export type CloudUploadState = 'RESERVED' | 'UPLOADING' | 'VERIFYING' | 'COMMITTED' | 'CLEANUP_PENDING' | 'CLEANED' | 'ABORTED';
export interface CloudUploadSession {
  id: string;
  photoId: string;
  studioId: string;
  orderId: string;
  galleryId?: string;
  actorUid: string;
  actorName?: string;
  idempotencyKey?: string;
  manifestHash?: string;
  fileName?: string;
  sourceFileName: string;
  sourceSizeBytes?: number;
  sourceMimeType?: string;
  lastModified?: number;
  uploadSizeBytes?: number;
  uploadMimeType?: string;
  expectedSha256?: string;
  storageKind: 'ORIGINAL' | 'OPTIMIZED';
  settings?: CloudStorageSettings;
  objectKey: string;
  uploadId?: string;
  multipartUploadId?: string;
  partCount?: number;
  partBytes?: number;
  partSizeBytes?: number;
  state: CloudUploadState;
  status?: string;
  sizeBytes?: number;
  mimeType?: string;
  reservedBytes?: number;
  previewReservedBytes?: number;
  createdAt: string;
  expiresAt: string;
  lastSignedUrlExpiresAt?: string;
  leaseUntil?: string;
  leaseToken?: string;
  actualSizeBytes?: number;
  sha256?: string;
  errorCode?: string;
  completedParts?: { PartNumber: number; ETag: string }[];
}

export interface CloudStorageJob {
  id: string;
  kind: 'VERIFY' | 'PREVIEW' | 'CLEANUP' | 'DELETE';
  studioId: string;
  orderId: string;
  photoId?: string;
  sessionId?: string;
  state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  attempt?: number;
  attempts?: number;
  maxAttempts?: number;
  availableAt?: string;
  runAfter?: string;
  lockedBy?: string | null;
  lockedAt?: string | null;
  leaseUntil?: string;
  leaseToken?: string;
  lastError?: string;
  reservedBytes?: number;
  attemptObjectKey?: string;
  updatedAt?: string;
}

export interface CloudStoragePlatform {
  usedBytes: number;
  reservedBytes: number;
  initializedAt: string;
  inventoryVersion: 1;
  admissionsEnabled: boolean;
}
