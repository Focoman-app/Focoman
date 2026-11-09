import type { BillingKind, BillingProfile, Order, ReceiptSource, Studio } from '@focoman/types';

export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amounts must be finite and nonnegative.');
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(minor)) throw new Error('Amount exceeds the supported currency range.');
  return minor;
}

export function getOrderFinancials(order: Pick<Order, 'pricing'>) {
  const confirmed = toMinorUnits(order.pricing.finalConfirmedPrice);
  const advance = toMinorUnits(order.pricing.advanceAmount);
  const ids = new Set<string>();
  const installmentsTotal = (order.pricing.installments ?? []).reduce((sum, payment) => {
    if (!payment.id || ids.has(payment.id)) throw new Error('Payment entries must have unique identifiers.');
    ids.add(payment.id);
    return sum + toMinorUnits(payment.amount);
  }, 0);
  const paid = advance + installmentsTotal;
  if (!Number.isSafeInteger(paid)) throw new Error('Payment total exceeds the supported currency range.');
  return { confirmed, advance, installmentsTotal, paid, remaining: Math.max(confirmed - paid, 0), overpayment: Math.max(paid - confirmed, 0) };
}

export function isBillingDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export interface ReceiptSourceInfo {
  source: ReceiptSource;
  key: string;
  label: string;
  amountMinor: number;
  paymentDate?: string;
  requiresConfirmation: boolean;
}

export function getReceiptSources(order: Pick<Order, 'pricing'>): ReceiptSourceInfo[] {
  const amounts = getOrderFinancials(order);
  const sources: ReceiptSourceInfo[] = [];
  if (amounts.advance > 0) {
    const date = order.pricing.advanceDate;
    sources.push({ source: { kind: 'ADVANCE' }, key: 'advance', label: 'Advance', amountMinor: amounts.advance,
      ...(date && isBillingDate(date) ? { paymentDate: date } : {}), requiresConfirmation: !date || !isBillingDate(date) });
  }
  for (const payment of order.pricing.installments ?? []) {
    const amountMinor = toMinorUnits(payment.amount);
    if (amountMinor === 0) continue;
    const validDate = isBillingDate(payment.date);
    const automatic = payment.id.endsWith('_auto') || payment.notes === 'Final Payment (Marked Paid)';
    sources.push({ source: { kind: 'INSTALLMENT', id: payment.id }, key: `installment:${payment.id}`, label: payment.notes || 'Payment', amountMinor,
      ...(validDate ? { paymentDate: payment.date } : {}), requiresConfirmation: automatic || !validDate });
  }
  return sources;
}

export function receiptSourceKey(source?: ReceiptSource): string {
  if (!source) throw new Error('Select a recorded payment.');
  return source.kind === 'ADVANCE' ? 'advance' : `installment:${source.id}`;
}

export function getBillingProfile(studio: Pick<Studio, 'issuedBillingProfile' | 'billingProfile' | 'name'>): BillingProfile {
  const legacy = studio.billingProfile;
  return studio.issuedBillingProfile ?? { displayName: legacy?.issuerName || studio.name,
    ...(legacy?.address ? { address: legacy.address } : {}),
    ...(legacy?.phone ? { phone: legacy.phone } : {}),
    ...(legacy?.email ? { email: legacy.email } : {}),
    ...(legacy?.footerNotes ? { notes: legacy.footerNotes } : {}),
    ...(legacy?.bankDetails || legacy?.upiId ? { paymentInstructions: [legacy.bankDetails, legacy.upiId].filter(Boolean).join('\n') } : {}) };
}

export function getBillingSourceFingerprint(order: Order, studio: Studio, kind: BillingKind, source?: ReceiptSource): string {
  const financials = getOrderFinancials(order);
  const payment = kind === 'RECEIPT' ? getReceiptSources(order).find(item => item.key === receiptSourceKey(source)) : undefined;
  if (kind === 'RECEIPT' && !payment) throw new Error('Recorded payment no longer exists.');
  return JSON.stringify({ studioId: studio.id, orderId: order.id, kind, issuer: getBillingProfile(studio), customer: order.customer,
    orderNumber: order.orderNumber, eventType: order.eventType, services: order.services, packages: order.packages, financials, payment });
}

/** Fonts cover Latin, Tamil and common punctuation/currency. Other scripts require another registered font. */
export function assertBillingTextSupported(value: string): void {
  if (/[^\u0009\u000a\u000d\u0020-\u024f\u0b80-\u0bff\u1e00-\u1eff\u2000-\u206f\u20a0-\u20cf]/u.test(value)) {
    throw new Error('Billing PDFs currently support Latin and Tamil text. Remove unsupported symbols or scripts.');
  }
}
