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


export function MinimalBillingModal({
  isOpen,
  onClose,
  order,
  studioId,
  studioName,
  initialTab,
  initialReceiptId,
  canEditProfile = true,
}: MinimalBillingModalProps) {
  if (!isOpen) return null;
  const breakdown = calculateOrderPaymentBreakdown({
    ...order,
    createdAt: order.createdAt || '',
    eventDate: order.eventDate,
  });
  const money = (amount: number) => `INR ${amount.toFixed(2)}`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={initialTab === 'INVOICE' ? 'Order invoice' : initialTab === 'RECEIPT' ? 'Payment receipt' : 'Order billing'}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs print:static print:bg-white"
    >
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-border-default bg-white p-6 text-text-primary shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3 print:hidden">
          <div>
            <p className="font-mono text-xs font-bold text-brand-blue-primary">{order.orderNumber}</p>
            <p className="text-sm font-bold text-text-primary">{order.customerName}</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-app hover:text-text-primary transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {canEditProfile && studioId ? (
          <OrderBillingPanel
            studioId={studioId}
            orderId={order.id}
            mode={initialTab}
            initialSelection={initialReceiptId}
          />
        ) : (
          <section className="space-y-3 text-xs">
            <h2 className="text-base font-bold">Order account statement</h2>
            <p>{studioName} · {order.orderNumber}</p>
            <p>{order.customerName}</p>
            <p>{order.eventType} · {order.eventDate}</p>
            <p>{order.services.join(', ')}</p>
            <p>Order value: {money(breakdown.confirmedPrice)}</p>
            <p>Recorded paid: {money(breakdown.totalPaid)}</p>
            <p>Remaining balance: {money(breakdown.remainingAmount)}</p>
            {breakdown.receipts.length > 0 && (
              <div className="rounded-2xl border border-border-default bg-surface-app p-3 space-y-2">
                <p className="font-bold text-text-primary">Recorded payment receipts</p>
                {breakdown.receipts.map((rcp) => (
                  <div key={rcp.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-2 first:border-t-0 first:pt-0">
                    <div>
                      <p className="font-semibold text-text-primary">
                        {rcp.label} ({rcp.receiptNumber})
                      </p>
                      <p className="text-[11px] text-text-secondary">
                        Date: {rcp.date}
                        {rcp.method ? ` · Mode: ${rcp.method.replace(/_/g, ' ')}` : ''}
                        {rcp.referenceNumber ? ` · Ref: ${rcp.referenceNumber}` : ''}
                        {rcp.notes ? ` · ${rcp.notes}` : ''}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-text-primary">{money(rcp.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-text-secondary">
              This statement reflects current order records. Request an issued invoice or payment receipt from your studio.
            </p>
            <button
              type="button"
              className="rounded-xl border border-border-default bg-white px-3 py-2 text-xs font-semibold print:hidden"
              onClick={() => window.print()}
            >
              Print / Save statement as PDF
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

