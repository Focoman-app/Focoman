'use server';

import { z } from 'zod';
import { getBillingDocument, getOrderByIdIncludeDeleted, getStudioBySlug, getFirestoreServerInstance, issueBillingDocumentTransaction, listOrderBillingDocuments, voidBillingDocumentTransaction } from '@focoman/db';
import { assertBillingTextSupported, getBillingProfile, getBillingSourceFingerprint, getOrderFinancials, getReceiptSources, isBillingDate } from '@focoman/domain';
import type { BillingKind, BillingOptionalFields, BillingProfile, ReceiptConfirmation, ReceiptSource } from '@focoman/types';
import { requireVerifiedUser, requireStudioOwner } from '@/lib/serverAuth';

const id = z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().max(max).refine(value => { try { assertBillingTextSupported(value); return true; } catch { return false; } }, 'Only Latin and Tamil text is currently supported in billing PDFs.');
const optionalText = (max: number) => text(max).transform(value => value || undefined).optional();
const optionalDate = z.string().refine(isBillingDate, 'Enter a valid date.').optional();
const profileSchema = z.object({ displayName: text(160).refine(Boolean, 'Enter an issuer name.'), address: optionalText(1000), phone: optionalText(80),
  email: z.union([z.literal(''), z.string().email().max(254)]).transform(value => value || undefined).optional(), website: optionalText(254), paymentInstructions: optionalText(1000), notes: optionalText(2000) }).strict();
const sourceSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('ADVANCE') }).strict(), z.object({ kind: z.literal('INSTALLMENT'), id: z.string().min(1).max(160) }).strict()]);
const optionalFieldsSchema = z.object({ dueDate: optionalDate, notes: optionalText(2000), paymentMethod: optionalText(80), paymentReference: optionalText(200) }).strict();
const safeError = (error: unknown) => error instanceof z.ZodError ? error.issues[0]?.message || 'Invalid billing details.' : error instanceof Error ? error.message : 'Billing request failed.';

async function authorize(studioId: string, idToken?: string) {
  id.parse(studioId);
  const actor = await requireVerifiedUser(idToken);
  await requireStudioOwner(actor.uid, studioId);
  return actor;
}

export async function getOrderBillingContextAction(input: { studioId: string; orderId: string; idToken?: string }) {
  try {
    await authorize(input.studioId, input.idToken); id.parse(input.orderId);
    const [order, studio, documents] = await Promise.all([getOrderByIdIncludeDeleted(input.orderId), getStudioBySlug(input.studioId), listOrderBillingDocuments(input.studioId, input.orderId)]);
    if (!order || !studio || order.studioId !== studio.id || studio.id !== input.studioId) throw new Error('Order unavailable.');
    const sources = getReceiptSources(order).map(source => ({ ...source, fingerprint: getBillingSourceFingerprint(order, studio, 'RECEIPT', source.source) }));
    return { success: true as const, data: { profile: getBillingProfile(studio), financials: getOrderFinancials(order), sources, documents,
      invoiceFingerprint: getBillingSourceFingerprint(order, studio, 'INVOICE'), canIssue: !order.isDeleted && !order.isHeadless,
      customerName: order.customer.name, description: [order.eventType, ...order.services].filter(Boolean).join(' · ') } };
  } catch (error) { return { success: false as const, error: safeError(error) }; }
}

export async function saveBillingProfileAction(input: { studioId: string; profile: BillingProfile; idToken?: string }) {
  try {
    await authorize(input.studioId, input.idToken);
    const profile = profileSchema.parse(input.profile);
    // Whole profile replacement removes cleared optional fields; do not merge nested stale values.
    const clean = JSON.parse(JSON.stringify(profile)) as BillingProfile;
    await getFirestoreServerInstance().collection('studios').doc(input.studioId).update({ issuedBillingProfile: clean });
    return { success: true as const, profile: clean };
  } catch (error) { return { success: false as const, error: safeError(error) }; }
}

export async function issueBillingDocumentAction(input: { studioId: string; orderId: string; kind: BillingKind; source?: ReceiptSource; expectedSourceFingerprint: string;
  optionalFields?: BillingOptionalFields; receiptConfirmation?: ReceiptConfirmation; replacementOf?: string; idToken?: string }) {
  try {
    const actor = await authorize(input.studioId, input.idToken);
    const parsed = z.object({ studioId: id, orderId: id, kind: z.enum(['INVOICE', 'RECEIPT']), source: sourceSchema.optional(),
      expectedSourceFingerprint: z.string().min(1).max(30000), optionalFields: optionalFieldsSchema.optional(),
      receiptConfirmation: z.object({ confirmed: z.literal(true), amountMinor: z.number().int().positive().safe(), paymentDate: z.string().refine(isBillingDate) }).strict().optional(),
      replacementOf: id.optional() }).parse(input);
    const document = await issueBillingDocumentTransaction({ ...parsed, actorUid: actor.uid });
    return { success: true as const, document };
  } catch (error) { return { success: false as const, error: safeError(error) }; }
}

export async function voidBillingDocumentAction(input: { studioId: string; documentId: string; reason: string; idToken?: string }) {
  try {
    const actor = await authorize(input.studioId, input.idToken); id.parse(input.documentId);
    const reason = text(500).refine(Boolean, 'A void reason is required.').parse(input.reason);
    if (!await getBillingDocument(input.studioId, input.documentId)) throw new Error('Document unavailable.');
    await voidBillingDocumentTransaction(input.studioId, input.documentId, reason, actor.uid);
    return { success: true as const };
  } catch (error) { return { success: false as const, error: safeError(error) }; }
}
