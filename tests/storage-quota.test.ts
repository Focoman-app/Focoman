import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GB_BYTES,
  MB_BYTES,
  buildLightroomFilterString,
  canStudioUploadBytes,
  extractLightroomBaseName,
  formatStorageBytes,
  resolveStudioStorageQuota,
} from '../apps/web/src/lib/storageQuota.ts';

test('resolveStudioStorageQuota assigns exact tier caps: Free 0 GB, Trial 10 GB, Starter 20 GB, Pro 50 GB', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  const freeQuota = resolveStudioStorageQuota(
    { planInfo: { plan: 'FREE' }, storageUsedBytes: 0, storageFileCount: 0 },
    now
  );
  assert.equal(freeQuota.planLabel, 'Free');
  assert.equal(freeQuota.limitBytes, 0);
  assert.equal(freeQuota.isCloudStorageEnabled, false);

  const trialQuota = resolveStudioStorageQuota(
    {
      planInfo: {
        plan: 'PROFESSIONAL',
        isTrial: true,
        trialExpiresAt: '2026-06-15T00:00:00.000Z',
      },
      storageUsedBytes: 2 * GB_BYTES,
      storageFileCount: 800,
    },
    now
  );
  assert.equal(trialQuota.planLabel, '30-Day Free Trial');
  assert.equal(trialQuota.limitBytes, 10 * GB_BYTES);
  assert.equal(trialQuota.limitGb, 10);
  assert.equal(trialQuota.isCloudStorageEnabled, true);
  assert.equal(trialQuota.remainingBytes, 8 * GB_BYTES);

  const starterQuota = resolveStudioStorageQuota(
    { planInfo: { plan: 'STARTER' }, storageUsedBytes: 17 * GB_BYTES },
    now
  );
  assert.equal(starterQuota.planLabel, 'Starter');
  assert.equal(starterQuota.limitBytes, 20 * GB_BYTES);
  assert.equal(starterQuota.isNearCap, true);
  assert.equal(starterQuota.isAtCap, false);

  const proQuota = resolveStudioStorageQuota(
    { planInfo: { plan: 'PROFESSIONAL', isTrial: false }, storageUsedBytes: 50 * GB_BYTES },
    now
  );
  assert.equal(proQuota.planLabel, 'Professional');
  assert.equal(proQuota.limitBytes, 50 * GB_BYTES);
  assert.equal(proQuota.isAtCap, true);
});

test('canStudioUploadBytes enforces hard tier caps and blocks Free plan or over-quota batches', () => {
  const freeCheck = canStudioUploadBytes({ planInfo: { plan: 'FREE' } }, 5 * MB_BYTES);
  assert.equal(freeCheck.allowed, false);

  const withinTrial = canStudioUploadBytes(
    {
      planInfo: {
        plan: 'PROFESSIONAL',
        isTrial: true,
        trialExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
      },
      storageUsedBytes: 9 * GB_BYTES,
    },
    500 * MB_BYTES
  );
  assert.equal(withinTrial.allowed, true);

  const overTrial = canStudioUploadBytes(
    {
      planInfo: {
        plan: 'PROFESSIONAL',
        isTrial: true,
        trialExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
      },
      storageUsedBytes: 9.8 * GB_BYTES,
    },
    500 * MB_BYTES
  );
  assert.equal(overTrial.allowed, false);
});

test('Lightroom filter string strips extensions and deduplicates camera filenames cleanly', () => {
  assert.equal(extractLightroomBaseName('folder/sub/IMG_0042.JPG'), 'IMG_0042');
  assert.equal(extractLightroomBaseName('DSC01982.ARW'), 'DSC01982');
  assert.equal(
    buildLightroomFilterString([
      'IMG_0042.JPG',
      'DSC_0192.NEF',
      'img_0042.jpg',
      'R5_8821.CR3',
    ]),
    'IMG_0042, DSC_0192, R5_8821'
  );
});

test('formatStorageBytes formats KB, MB, and GB readably', () => {
  assert.equal(formatStorageBytes(0), '0 MB');
  assert.equal(formatStorageBytes(512 * 1024), '512 KB');
  assert.equal(formatStorageBytes(5 * MB_BYTES), '5.0 MB');
  assert.equal(formatStorageBytes(10 * GB_BYTES), '10.00 GB');
});
