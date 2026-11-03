import { NextResponse } from 'next/server';
import { clearDevPortalAttempts, createDevPortalSession, DEV_PORTAL_COOKIE, DEV_PORTAL_SESSION_SECONDS, isDevPortalConfigured, reserveDevPortalAttempt, verifyDevPortalPassword } from '@/lib/devPortalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  console.log('[dev-auth] Received origin:', origin, 'request.url:', request.url);
  if (!origin) return false;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const reqHost = (request.headers.get('host') || new URL(request.url).host).toLowerCase();
    if (originHost === reqHost) return true;

    if (originHost.startsWith('localhost:') || originHost.startsWith('127.0.0.1:')) return true;

    const allowedHosts = [
      'focoman.com',
      'www.focoman.com',
      'focoman.vercel.app',
      'dev.4command.com',
    ];
    return allowedHosts.includes(originHost);
  } catch (e) {
    console.error('[dev-auth] Error validating origin:', e);
    return false;
  }
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: DEV_PORTAL_SESSION_SECONDS };
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  if (!isDevPortalConfigured()) return NextResponse.json({ error: 'Dev portal authentication is not configured.' }, { status: 503 });
  try {
    const body = await request.text();
    if (body.length > 4096) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const parsed: unknown = JSON.parse(body);
    const password = typeof parsed === 'object' && parsed !== null && 'password' in parsed ? (parsed as { password: unknown }).password : null;
    if (typeof password !== 'string' || !password || password.length > 256) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    if (!await reserveDevPortalAttempt()) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    if (!await verifyDevPortalPassword(password)) return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
    await clearDevPortalAttempts();
    const response = NextResponse.json({ success: true });
    response.cookies.set(DEV_PORTAL_COOKIE, createDevPortalSession(), cookieOptions());
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Authentication is temporarily unavailable.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.set(DEV_PORTAL_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
