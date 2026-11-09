export type BillingKind = 'INVOICE' | 'RECEIPT';
export type ReceiptSource = { kind: 'ADVANCE' } | { kind: 'INSTALLMENT'; id: string };
export interface BillingProfile {
  displayName: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  paymentInstructions?: string;
  notes?: string;
}
export interface BillingOptionalFields {
  dueDate?: string;
  notes?: string;
  paymentMethod?: string;
  paymentReference?: string;
}
export interface ReceiptConfirmation { confirmed: true; amountMinor: number; paymentDate: string }
export interface BillingDocument {
  schemaVersion: 1;
  id: string;
  studioId: string;
  orderId: string;
  kind: BillingKind;
  number: string;
  revision: number;
  sourceKey: string;
  sourceFingerprint: string;
  issuedAt: string;
  issuedByUid: string;
  status: 'ISSUED' | 'VOID';
  issuer: BillingProfile;
  customer: { name: string; phone?: string; email?: string };
  orderNumber: string;
  description: string;
  currency: 'INR';
  amountMinor: number;
  paidMinor: number;
  remainingMinor: number;
  overpaymentMinor: number;
  dueDate?: string;
  notes?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  receiptConfirmation?: ReceiptConfirmation & { confirmedAt: string; confirmedByUid: string };
  replacementOf?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedByUid?: string;
}
