import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { createDevPortalSession, isDevPortalConfigured, isDevPortalPasswordFreePreview, validDevPortalSession, verifyDevPortalPassword } from '../apps/web/src/lib/devPortalCrypto.ts';

test('password-free portal preview is development-only', () => {
  assert.equal(isDevPortalPasswordFreePreview('development', 'true'), true);
  assert.equal(isDevPortalPasswordFreePreview('development', 'false'), false);
  assert.equal(isDevPortalPasswordFreePreview('development', ''), false);
  assert.equal(isDevPortalPasswordFreePreview('production', 'true'), false);
  assert.equal(isDevPortalPasswordFreePreview('test', 'true'), false);
});

test('dev portal fails closed, validates password and rejects forged or expired sessions', async () => {
  delete process.env.DEV_PORTAL_PASSWORD_HASH;
  delete process.env.DEV_PORTAL_SESSION_SECRET;
  assert.equal(isDevPortalConfigured(), false);
  assert.equal(validDevPortalSession('dev_session:anything'), false);
  assert.throws(createDevPortalSession);
  const password = randomBytes(32).toString('hex');
  const salt = randomBytes(16);
  process.env.DEV_PORTAL_PASSWORD_HASH = `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
  process.env.DEV_PORTAL_SESSION_SECRET = randomBytes(32).toString('hex');
  assert.equal(isDevPortalConfigured(), true);
  assert.equal(await verifyDevPortalPassword(password), true);
  assert.equal(await verifyDevPortalPassword('wrong password'), false);
  const token = createDevPortalSession();
  assert.equal(validDevPortalSession(token), true);
  assert.equal(validDevPortalSession(token + 'X'), false);
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() - 1 })).toString('base64url');
  const signature = createHmac('sha256', process.env.DEV_PORTAL_SESSION_SECRET).update(payload).digest('base64url');
  assert.equal(validDevPortalSession(`${payload}.${signature}`), false);
  process.env.DEV_PORTAL_SESSION_SECRET = randomBytes(32).toString('hex');
  assert.equal(validDevPortalSession(token), false);
});
