import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreServerInstance } from '@focoman/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sourcePage = typeof body?.sourcePage === 'string' ? body.sourcePage.slice(0, 120) : '/';
    const services = Array.isArray(body?.services)
      ? body.services.filter((s: unknown): s is string => typeof s === 'string').slice(0, 5)
      : ['Branding and Website', 'Data Migration'];

    const now = new Date().toISOString();
    const id = `VAS-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const db = getFirestoreServerInstance();
    await db.collection('vas_inquiries').doc(id).set({
      id,
      targetPhone: '8072333075',
      services,
      sourcePage,
      createdAt: now,
    });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.warn('[vas-inquiry] Failed to record VAS inquiry log:', err);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
