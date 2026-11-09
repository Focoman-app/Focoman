import { NextRequest } from 'next/server';
import { getBillingDocument } from '@focoman/db';
import { requireVerifiedUser, requireStudioOwner } from '@/lib/serverAuth';
import { renderBillingPdf } from '@/lib/billing/renderBillingPdf';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, context: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await context.params;
  const studioId = request.nextUrl.searchParams.get('studioId') || '';
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(studioId) || !/^[a-f0-9]{64}$/.test(documentId)) return new Response('Invalid document request.', { status: 400 });
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    const actor = await requireVerifiedUser(token);
    await requireStudioOwner(actor.uid, studioId);
  } catch { return new Response('Document unavailable.', { status: 403 }); }
  const document = await getBillingDocument(studioId, documentId);
  if (!document) return new Response('Document unavailable.', { status: 404 });
  const bytes = await renderBillingPdf(document);
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="${document.number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"` } });
}
