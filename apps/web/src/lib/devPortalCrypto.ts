import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const DEV_PORTAL_SESSION_SECONDS = 4 * 60 * 60;
/** Temporary password-free access requires an explicit development-only opt-in. */
export function isDevPortalPasswordFreePreview(
  nodeEnv = process.env.NODE_ENV,
  optIn = process.env.DEV_PORTAL_ALLOW_UNAUTHENTICATED,
): boolean {
  return nodeEnv === 'development' && optIn === 'true';
}
function sessionSecret(): string | null {
  const value = process.env.DEV_PORTAL_SESSION_SECRET;
  return value && Buffer.byteLength(value, 'utf8') >= 32 ? value : null;
}
function passwordParts(): { salt: Buffer; digest: Buffer } | null {
  const match = /^scrypt:([0-9a-f]{32,}):([0-9a-f]{128})$/i.exec(process.env.DEV_PORTAL_PASSWORD_HASH || '');
  if (!match || match[1].length % 2) return null;
  return { salt: Buffer.from(match[1], 'hex'), digest: Buffer.from(match[2], 'hex') };
}
export function isDevPortalConfigured(): boolean { return Boolean(sessionSecret() && passwordParts()); }
export async function verifyDevPortalPassword(password: string): Promise<boolean> {
  const parts = passwordParts();
  if (!parts || !password || password.length > 256) return false;
  const result = await scrypt(password, parts.salt, parts.digest.length) as Buffer;
  return timingSafeEqual(result, parts.digest);
}
export function createDevPortalSession(): string {
  const secret = sessionSecret();
  if (!secret || !passwordParts()) throw new Error('Dev portal is not configured.');
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DEV_PORTAL_SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function validDevPortalSession(token: string | undefined): boolean {
  const secret = sessionSecret();
  if (!secret || !passwordParts() || !token || token.length > 1024) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return false;
  const signature = Buffer.from(parts[1], 'base64url');
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp > Date.now() && payload.exp <= Date.now() + DEV_PORTAL_SESSION_SECONDS * 1000;
  } catch { return false; }
}
