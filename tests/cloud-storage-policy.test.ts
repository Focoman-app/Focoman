import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLOUD_PART_BYTES,
  NEW_CLOUD_STORAGE_SETTINGS,
  resolveCloudStorageSettings,
  validateCloudFileName,
  validateAdmissionFile,
  cloudPartLength,
  validatePartManifest,
  isRawPhoto,
} from '../packages/domain/src/cloudStorage.ts';

test('resolveCloudStorageSettings assigns new gallery default to compression ON and proofing OFF', () => {
  const emptyOrder = {
    cloudStorageSettings: undefined,
    cloudReviewApproved: undefined,
    cloudReviewNotes: undefined,
    cloudReviewSubmittedAt: undefined,
  };
  const settings = resolveCloudStorageSettings(emptyOrder, false);
  assert.equal(settings.version, 1);
  assert.equal(settings.compressionEnabled, true);
  assert.equal(settings.proofingEnabled, false);
  assert.deepEqual(settings, NEW_CLOUD_STORAGE_SETTINGS);
});

test('resolveCloudStorageSettings preserves legacy populated and reviewed galleries with proofing ON', () => {
  // Legacy order with populated photos
  const populatedOrder = {
    cloudStorageSettings: undefined,
    cloudReviewApproved: undefined,
    cloudReviewNotes: undefined,
    cloudReviewSubmittedAt: undefined,
  };
  const settings1 = resolveCloudStorageSettings(populatedOrder, true);
  assert.equal(settings1.proofingEnabled, true);

  // Legacy order with recorded review
  const reviewedOrder = {
    cloudStorageSettings: undefined,
    cloudReviewApproved: true,
    cloudReviewNotes: 'Looking great',
    cloudReviewSubmittedAt: '2026-11-01T10:00:00Z',
  };
  const settings2 = resolveCloudStorageSettings(reviewedOrder, false);
  assert.equal(settings2.proofingEnabled, true);
});

test('resolveCloudStorageSettings honors explicit saved settings', () => {
  const explicitOrder = {
    cloudStorageSettings: {
      version: 1 as const,
      compressionEnabled: false,
      proofingEnabled: true,
    },
    cloudReviewApproved: undefined,
    cloudReviewNotes: undefined,
    cloudReviewSubmittedAt: undefined,
  };
  const settings = resolveCloudStorageSettings(explicitOrder, false);
  assert.equal(settings.compressionEnabled, false);
  assert.equal(settings.proofingEnabled, true);
});

test('validateCloudFileName accepts valid names and rejects path traversal or control characters', () => {
  assert.doesNotThrow(() => validateCloudFileName('IMG_0001.JPG'));
  assert.doesNotThrow(() => validateCloudFileName('wedding-raw-01.CR3'));
  assert.doesNotThrow(() => validateCloudFileName('shot_55.arw'));

  assert.throws(() => validateCloudFileName('../etc/passwd'), /Invalid filename/);
  assert.throws(() => validateCloudFileName('dir/file.jpg'), /Invalid filename/);
  assert.throws(() => validateCloudFileName('file\x00.jpg'), /Invalid filename/);
  assert.throws(() => validateCloudFileName('executable.exe'), /Supported files/);
});

test('isRawPhoto correctly identifies camera RAW formats', () => {
  assert.equal(isRawPhoto('photo.CR2'), true);
  assert.equal(isRawPhoto('photo.cr3'), true);
  assert.equal(isRawPhoto('photo.nef'), true);
  assert.equal(isRawPhoto('photo.ARW'), true);
  assert.equal(isRawPhoto('photo.dng'), true);
  assert.equal(isRawPhoto('photo.jpg'), false);
  assert.equal(isRawPhoto('photo.png'), false);
});

test('validateAdmissionFile assigns ORIGINAL or OPTIMIZED according to settings and file format', () => {
  // RAW file is always ORIGINAL regardless of compression setting
  const rawFile = {
    fileName: 'capture.CR3',
    sourceSizeBytes: 45 * 1024 * 1024,
    sourceMimeType: 'image/x-canon-cr3',
    sizeBytes: 45 * 1024 * 1024,
    mimeType: 'image/x-canon-cr3',
    sha256: 'a'.repeat(64),
    lastModified: Date.now(),
    idempotencyKey: 'session-unique-key-1234567890',
  };
  const kind1 = validateAdmissionFile(rawFile, { version: 1, compressionEnabled: true, proofingEnabled: false });
  assert.equal(kind1, 'ORIGINAL');

  // JPEG with compression ON is OPTIMIZED
  const compressedJpg = {
    fileName: 'photo.jpg',
    sourceSizeBytes: 12 * 1024 * 1024,
    sourceMimeType: 'image/jpeg',
    sizeBytes: 3 * 1024 * 1024,
    mimeType: 'image/jpeg',
    sha256: 'b'.repeat(64),
    lastModified: Date.now(),
    idempotencyKey: 'session-unique-key-1234567890',
  };
  const kind2 = validateAdmissionFile(compressedJpg, { version: 1, compressionEnabled: true, proofingEnabled: false });
  assert.equal(kind2, 'OPTIMIZED');

  // JPEG with compression OFF must be ORIGINAL and match source size
  const originalJpg = {
    fileName: 'photo.jpg',
    sourceSizeBytes: 12 * 1024 * 1024,
    sourceMimeType: 'image/jpeg',
    sizeBytes: 12 * 1024 * 1024,
    mimeType: 'image/jpeg',
    sha256: 'c'.repeat(64),
    lastModified: Date.now(),
    idempotencyKey: 'session-unique-key-1234567890',
  };
  const kind3 = validateAdmissionFile(originalJpg, { version: 1, compressionEnabled: false, proofingEnabled: false });
  assert.equal(kind3, 'ORIGINAL');
});

test('cloudPartLength calculates exact part lengths for 16MB chunking', () => {
  const size = 35 * 1024 * 1024; // 35 MB
  // Part 1: 16 MB
  assert.equal(cloudPartLength(size, 1), CLOUD_PART_BYTES);
  // Part 2: 16 MB
  assert.equal(cloudPartLength(size, 2), CLOUD_PART_BYTES);
  // Part 3: 3 MB (35 - 32)
  assert.equal(cloudPartLength(size, 3), 3 * 1024 * 1024);
});

test('validatePartManifest verifies complete ordered parts and valid ETags', () => {
  const size = 35 * 1024 * 1024;
  const parts = [
    { PartNumber: 1, Size: CLOUD_PART_BYTES, ETag: '"etag1"' },
    { PartNumber: 2, Size: CLOUD_PART_BYTES, ETag: '"etag2"' },
    { PartNumber: 3, Size: 3 * 1024 * 1024, ETag: '"etag3"' },
  ];
  const manifest = validatePartManifest(size, parts);
  assert.equal(manifest.length, 3);
  assert.equal(manifest[0].PartNumber, 1);
  assert.equal(manifest[2].PartNumber, 3);

  // Incomplete parts throw
  assert.throws(() => validatePartManifest(size, parts.slice(0, 2)), /Upload is incomplete/);
});
