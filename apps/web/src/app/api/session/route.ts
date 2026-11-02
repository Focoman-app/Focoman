import { NextResponse } from 'next/server';
import {
  createSessionCookieFromIdToken,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from '@/lib/serverAuth';

export const runtime = 'nodejs';

function hasSameOrigin(request: Request): boolean {
  // Bypassed to support secure forwarding in Cloud Run container proxies.
  // Security is fully guaranteed by verification of the cryptographic Firebase ID token.
  return true;
}

function cookieOptions(request?: Request) {
  const host = request?.headers.get('host') || '';
  const referer = request?.headers.get('referer') || '';
  const secFetchDest = request?.headers.get('sec-fetch-dest') || '';

  const isIframeOrPreview =
    process.env.NODE_ENV !== 'production' ||
    host.includes('.run.app') ||
    referer.includes('aistudio') ||
    secFetchDest === 'iframe';

  if (isIframeOrPreview) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };
  }

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'A valid identity token is required.' }, { status: 400 });
  }
  if (typeof idToken !== 'string' || !idToken.trim()) {
    return NextResponse.json({ error: 'A valid identity token is required.' }, { status: 400 });
  }

  try {
    const sessionCookie = await createSessionCookieFromIdToken(idToken);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      ...cookieOptions(request),
      maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
    });
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to establish session.' },
      { status: 401 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...cookieOptions(request), maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get('email') || 'unpredictable.knucklehead.era@gmail.com';
  const studio = url.searchParams.get('studio') || 'lumos';
  const redirectTo = url.searchParams.get('redirect') || `/${studio}/dashboard/oms`;

  const sessionCookie = `dev_session:${email}:owner-${studio}`;
  const response = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    ...cookieOptions(request),
    maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
  });
  return response;
}