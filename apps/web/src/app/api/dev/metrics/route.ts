import { NextResponse } from 'next/server';
import { getFirestoreServerInstance } from '@focoman/db';
import { requireDevPortalSession } from '@/lib/devPortalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Platform aggregates only. Never send documents or identifying fields to the client. */
export async function GET() {
  try {
    await requireDevPortalSession();
  } catch {
    return NextResponse.json({ error: 'Authentication required.' }, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const emptyMetrics = {
    studioRecords: null,
    customerRecords: null,
    orderRecords: null,
    ordersThisMonth: null,
    verifiedPaymentRecords: null,
    pendingPaymentRecords: null,
  };

  try {
    const db = getFirestoreServerInstance();
    const queries = [
      db.collection('studios').count().get(),
      db.collection('customers').count().get(),
      db.collection('orders').count().get(),
      db.collection('orders').where('createdAt', '>=', start).where('createdAt', '<', end).count().get(),
      db.collection('payments').where('verificationStatus', '==', 'VERIFIED').count().get(),
      db.collection('payments').where('verificationStatus', '==', 'PENDING_VERIFICATION').count().get(),
    ];
    const results = await Promise.allSettled(queries);
    const count = (index: number): number | null => {
      const result = results[index];
      return result.status === 'fulfilled' ? result.value.data().count : null;
    };
    return NextResponse.json({
      generatedAt: now.toISOString(),
      metrics: {
        studioRecords: count(0),
        customerRecords: count(1),
        orderRecords: count(2),
        ordersThisMonth: count(3),
        verifiedPaymentRecords: count(4),
        pendingPaymentRecords: count(5),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ generatedAt: now.toISOString(), metrics: emptyMetrics }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
