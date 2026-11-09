import { NextResponse } from 'next/server';
import {
  createSessionCookieFromIdToken,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from '@/lib/serverAuth';
import { getSessionCookieOptions, hasSameOrigin } from '@/lib/sessionSecurity';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json(
      { error: 'A valid identity token is required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (typeof idToken !== 'string' || !idToken.trim()) {
    return NextResponse.json(
      { error: 'A valid identity token is required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const sessionCookie = await createSessionCookieFromIdToken(idToken);
    const response = NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      ...getSessionCookieOptions(request),
      maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
    });
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to establish session.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const response = NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(request),
    maxAge: 0,
  });
  return response;
}