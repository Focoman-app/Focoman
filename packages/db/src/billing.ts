import 'server-only';
import { createHash } from 'node:crypto';
import type { BillingDocument, BillingKind, BillingOptionalFields, Order, ReceiptConfirmation, ReceiptSource, Studio } from '@focoman/types';
import { assertBillingTextSupported, getBillingProfile, getBillingSourceFingerprint, getOrderFinancials, getReceiptSources, isBillingDate, receiptSourceKey } from '@focoman/domain';
import { getFirestoreServerInstance } from './index';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function cleanText(value: string, label: string, max = 500): string {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  assertBillingTextSupported(result);
  return result;
}
export interface IssueBillingInput {
  studioId: string; orderId: string; kind: BillingKind; source?: ReceiptSource;
  expectedSourceFingerprint: string; optionalFields?: BillingOptionalFields;
  receiptConfirmation?: ReceiptConfirmation; replacementOf?: string; actorUid: string;
}

/** All reads precede writes. The deterministic identity and counter commit atomically. */
export async function issueBillingDocumentTransaction(input: IssueBillingInput): Promise<BillingDocument> {
  const db = getFirestoreServerInstance();
  return db.runTransaction(async tx => {
    const sourceKey = input.kind === 'INVOICE' ? 'invoice' : receiptSourceKey(input.source);
    const orderRef = db.collection('orders').doc(input.orderId);
    const studioRef = db.collection('studios').doc(input.studioId);
    const [orderSnap, studioSnap] = await Promise.all([tx.get(orderRef), tx.get(studioRef)]);
    if (!orderSnap.exists || !studioSnap.exists) throw new Error('Order or studio unavailable.');
    const order = orderSnap.data() as Order;
    const studio = studioSnap.data() as Studio;
    if (order.studioId !== input.studioId || studio.id !== input.studioId || studio.isDeleted) throw new Error('Order or studio unavailable.');
    let revision = 1;
    if (input.replacementOf) {
      const previousSnap = await tx.get(db.collection('billingDocuments').doc(input.replacementOf));
      const previous = previousSnap.data() as BillingDocument | undefined;
      if (!previous || previous.studioId !== input.studioId || previous.orderId !== input.orderId || previous.kind !== input.kind || previous.sourceKey !== sourceKey || previous.status !== 'VOID') {
        throw new Error('Replacement requires a voided document for this order and payment.');
      }
      revision = previous.revision + 1;
    }
    const identity = hash(JSON.stringify([input.studioId, input.orderId, input.kind, sourceKey, revision]));
    const keyRef = db.collection('billingDocumentKeys').doc(identity);
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) {
      const existing = await tx.get(db.collection('billingDocuments').doc(keySnap.get('documentId')));
      if (!existing.exists) throw new Error('Issued document index is inconsistent. Contact support.');
      const document = existing.data() as BillingDocument;
      if (document.status === 'VOID') throw new Error('This document was voided. Select Issue replacement.');
      return document;
    }
    if (order.isDeleted || order.isHeadless || order.studioStatus === 'DELETED') throw new Error('Restore the order before issuing a document.');
    const fingerprint = getBillingSourceFingerprint(order, studio, input.kind, input.source);
    if (input.expectedSourceFingerprint !== fingerprint) throw new Error('Order or billing details changed. Refresh and review before issuing.');
    const amounts = getOrderFinancials(order);
    const issuer = { ...getBillingProfile(studio) };
    issuer.displayName = cleanText(issuer.displayName, 'Issuer name', 160);
    for (const value of Object.values(issuer)) if (value) { cleanText(value, 'Billing detail', 2000); }
    const customer = { name: cleanText(order.customer.name, 'Customer name', 160),
      ...(order.customer.phone ? { phone: cleanText(order.customer.phone, 'Customer phone', 80) } : {}),
      ...(order.customer.email ? { email: cleanText(order.customer.email, 'Customer email', 254) } : {}) };
    const description = cleanText([order.eventType, ...order.services].filter(Boolean).join(' · '), 'Service description', 2000);
    const now = new Date().toISOString();
    const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(new Date(now));
    const counterRef = db.collection('billingCounters').doc(hash(JSON.stringify([input.studioId, input.kind, year])));
    const counterSnap = await tx.get(counterRef);
    const sequence = (counterSnap.exists ? counterSnap.get('value') : 0) + 1;
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Document numbering is unavailable.');
    const number = `${input.kind === 'INVOICE' ? 'INV' : 'REC'}-${year}-${String(sequence).padStart(6, '0')}`;
    const optional = input.optionalFields ?? {};
    if (optional.dueDate && !isBillingDate(optional.dueDate)) throw new Error('Invalid due date.');
    for (const [key, value] of Object.entries(optional)) if (value) cleanText(value, key, 2000);
    const payment = input.kind === 'RECEIPT' ? getReceiptSources(order).find(item => item.key === sourceKey) : undefined;
    if (input.kind === 'RECEIPT' && !payment) throw new Error('Recorded payment is unavailable.');
    if (payment?.requiresConfirmation && (!input.receiptConfirmation?.confirmed || input.receiptConfirmation.amountMinor !== payment.amountMinor || !isBillingDate(input.receiptConfirmation.paymentDate))) {
      throw new Error('Confirm the actual payment amount and payment date before issuing its receipt.');
    }
    const document: BillingDocument = {
      schemaVersion: 1, id: identity, studioId: input.studioId, orderId: input.orderId, kind: input.kind,
      number, revision, sourceKey, sourceFingerprint: hash(fingerprint), issuedAt: now, issuedByUid: input.actorUid,
      status: 'ISSUED', issuer, customer, orderNumber: cleanText(order.orderNumber, 'Order number', 100), description,
      currency: 'INR', amountMinor: payment?.amountMinor ?? amounts.confirmed, paidMinor: amounts.paid,
      remainingMinor: amounts.remaining, overpaymentMinor: amounts.overpayment,
      ...(optional.notes ? { notes: optional.notes } : {}),
      ...(input.kind === 'INVOICE' && optional.dueDate ? { dueDate: optional.dueDate } : {}),
      ...(payment ? { paymentDate: payment.requiresConfirmation ? input.receiptConfirmation!.paymentDate : payment.paymentDate,
        ...(optional.paymentMethod ? { paymentMethod: optional.paymentMethod } : {}),
        ...(optional.paymentReference ? { paymentReference: optional.paymentReference } : {}) } : {}),
      ...(payment?.requiresConfirmation ? { receiptConfirmation: { ...input.receiptConfirmation!, confirmedAt: now, confirmedByUid: input.actorUid } } : {}),
      ...(input.replacementOf ? { replacementOf: input.replacementOf } : {}),
    };
    tx.set(counterRef, { studioId: input.studioId, kind: input.kind, year, value: sequence });
    tx.create(db.collection('billingDocuments').doc(identity), document);
    tx.create(keyRef, { studioId: input.studioId, documentId: identity });
    return document;
  });
}

export async function getBillingDocument(studioId: string, documentId: string): Promise<BillingDocument | null> {
  const snap = await getFirestoreServerInstance().collection('billingDocuments').doc(documentId).get();
  const document = snap.data() as BillingDocument | undefined;
  return document?.studioId === studioId ? document : null;
}

export async function listOrderBillingDocuments(studioId: string, orderId: string): Promise<BillingDocument[]> {
  // Single indexed equality query; exact studio isolation is still enforced on every result.
  const snap = await getFirestoreServerInstance().collection('billingDocuments').where('orderId', '==', orderId).get();
  return snap.docs.map(doc => doc.data() as BillingDocument).filter(doc => doc.studioId === studioId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}

export async function voidBillingDocumentTransaction(studioId: string, id: string, reason: string, actorUid: string): Promise<void> {
  const db = getFirestoreServerInstance();
  const cleanReason = cleanText(reason, 'Void reason', 500);
  await db.runTransaction(async tx => {
    const ref = db.collection('billingDocuments').doc(id);
    const snap = await tx.get(ref);
    const document = snap.data() as BillingDocument | undefined;
    if (!document || document.studioId !== studioId) throw new Error('Document unavailable.');
    if (document.status === 'VOID') return;
    tx.update(ref, { status: 'VOID', voidReason: cleanReason, voidedAt: new Date().toISOString(), voidedByUid: actorUid });
  });
}
