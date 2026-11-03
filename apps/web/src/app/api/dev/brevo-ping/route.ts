import { NextResponse } from 'next/server';
import { requireDevPortalSession } from '@/lib/devPortalAuth';
import { triggerBrevoKeepAlivePing } from '@/services/brevoService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await requireDevPortalSession();
  } catch {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const recipient = typeof body?.recipient === 'string' ? body.recipient : undefined;
    const result = await triggerBrevoKeepAlivePing(recipient);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

