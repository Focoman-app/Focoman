"use client";
import { calculateOrderPaymentBreakdown } from '@focoman/domain';
import type { Order, StudioBillingProfile } from '@focoman/types';
import { OrderBillingPanel } from './OrderBillingPanel';

export interface MinimalBillingOrderInput {
  id: string;
  orderNumber: string;
  eventType: string;
  eventDate: string;
  eventLocation?: string;
  services: string[];
  packages?: string[];
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentStatus: Order["paymentStatus"];
  pricing: Order["pricing"];
  createdAt?: string;
}
export interface MinimalBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: MinimalBillingOrderInput;
  studioId?: string;
  studioName: string;
  studioLogoUrl?: string;
  studioCity?: string;
  studioPhone?: string;
  studioEmail?: string;
  initialProfile?: StudioBillingProfile;
  initialTab?: "INVOICE" | "RECEIPT";
  initialReceiptId?: string;
  canEditProfile?: boolean;
  onSaveBillingProfile?: (profile: StudioBillingProfile) => Promise<void> | void;
}


export function MinimalBillingModal({ isOpen, onClose, order, studioId, studioName, canEditProfile = true }: MinimalBillingModalProps) {
  if (!isOpen) return null;
  const breakdown = calculateOrderPaymentBreakdown({ ...order, createdAt: order.createdAt || '', eventDate: order.eventDate });
  const money = (amount: number) => `INR ${amount.toFixed(2)}`;
  return <div role="dialog" aria-modal="true" aria-label="Order billing" className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 print:static print:bg-white">
    <div className="mx-auto my-8 max-w-3xl rounded-xl bg-surface-base p-5 text-text-primary">
      <button className="mb-4 rounded border px-3 py-2 print:hidden" onClick={onClose}>Close billing</button>
      {canEditProfile && studioId ? <OrderBillingPanel studioId={studioId} orderId={order.id} /> : <section className="space-y-3">
        <h2 className="text-xl font-semibold">Order account statement</h2>
        <p>{studioName} · {order.orderNumber}</p><p>{order.customerName}</p><p>{order.eventType} · {order.eventDate}</p>
        <p>{order.services.join(', ')}</p><p>Order value: {money(breakdown.confirmedPrice)}</p>
        <p>Recorded paid: {money(breakdown.totalPaid)}</p><p>Remaining balance: {money(breakdown.remainingAmount)}</p>
        <p className="text-sm">This statement reflects current order records. Request an issued invoice or payment receipt from your studio.</p>
        <button className="rounded border px-3 py-2 print:hidden" onClick={()=>window.print()}>Print / Save statement as PDF</button>
      </section>}
    </div>
  </div>;
}
