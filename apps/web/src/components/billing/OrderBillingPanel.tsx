'use client';
import { useCallback, useEffect, useState } from 'react';
import type { BillingDocument, BillingProfile } from '@focoman/types';
import { getOrderBillingContextAction, issueBillingDocumentAction, saveBillingProfileAction, voidBillingDocumentAction } from '@/actions/billingActions';
import { getCurrentUserIdToken } from '@/lib/firebaseAuth';

type Context = Extract<Awaited<ReturnType<typeof getOrderBillingContextAction>>, { success: true }>['data'];
const control = 'rounded-xl border border-border-default bg-white px-3 py-2 text-xs text-text-primary';

export function OrderBillingPanel({
  studioId,
  orderId,
  mode,
  initialSelection,
}: {
  studioId: string;
  orderId: string;
  mode?: 'INVOICE' | 'RECEIPT';
  initialSelection?: string;
}) {
  const isInvoiceOnly = mode === 'INVOICE';
  const isReceiptOnly = mode === 'RECEIPT';
  const defaultSel = isInvoiceOnly ? 'invoice' : initialSelection || 'advance';
  const [context, setContext] = useState<Context>();
  const [profile, setProfile] = useState<BillingProfile>({ displayName: '' });
  const [selection, setSelection] = useState(defaultSel);
  const [paymentDate, setPaymentDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const load = useCallback(async () => {
    const result = await getOrderBillingContextAction({ studioId, orderId, idToken: (await getCurrentUserIdToken()) || undefined });
    if (!result.success) throw new Error(result.error);
    setContext(result.data);
    setProfile(result.data.profile);
    if (isInvoiceOnly) {
      setSelection('invoice');
    } else if (initialSelection && result.data.sources.some((s) => s.key === initialSelection)) {
      setSelection(initialSelection);
    } else if (isReceiptOnly && result.data.sources.length > 0) {
      setSelection(result.data.sources[0].key);
    }
  }, [studioId, orderId, isInvoiceOnly, isReceiptOnly, initialSelection]);

  useEffect(() => {
    setContext(undefined);
    load().catch((e) => setError(e instanceof Error ? e.message : 'Unable to load billing.'));
  }, [load]);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Billing request failed.');
    } finally {
      setBusy(false);
    }
  }

  const source = isInvoiceOnly ? undefined : context?.sources.find((s) => s.key === selection);
  const previous = context?.documents
    .filter((d) => (isInvoiceOnly ? d.kind === 'INVOICE' : d.sourceKey === selection))
    .sort((a, b) => b.revision - a.revision)[0];
  const visibleDocuments =
    context?.documents.filter((d) =>
      isInvoiceOnly ? d.kind === 'INVOICE' : isReceiptOnly ? d.kind === 'RECEIPT' : true
    ) ?? [];
  const finalInvoiceUnavailable = Boolean(context && !context.canIssueFinalInvoice);
  const money = (value: number) => `INR ${(value / 100).toFixed(2)}`;

  async function download(doc: BillingDocument) {
    const token = await getCurrentUserIdToken();
    const response = await fetch(`/api/billing/${doc.id}/pdf?studioId=${encodeURIComponent(studioId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('PDF unavailable. Sign in as the studio owner and retry.');
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.number}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <section className="space-y-4 text-xs">
      <div>
        <h2 className="text-base font-bold text-text-primary">
          {isInvoiceOnly ? 'Order Invoice' : isReceiptOnly ? 'Payment Receipt' : 'Issued invoices and payment receipts'}
        </h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          Issued documents preserve the values at issuance. Later order edits do not change them. Currency: INR.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      {!context ? (
        <button className={control} onClick={() => run(load)} disabled={busy}>
          {busy ? 'Loading...' : 'Load billing'}
        </button>
      ) : (
        <>
          <details className="rounded-xl border border-border-default bg-surface-app p-3">
            <summary className="cursor-pointer font-bold text-text-primary">Issuer details (optional contact fields)</summary>
            <div className="grid gap-3 py-3 sm:grid-cols-2">
              {(['displayName', 'address', 'phone', 'email', 'website', 'paymentInstructions', 'notes'] as const).map((key) => (
                <label key={key} className="grid gap-1 text-xs font-medium text-text-secondary">
                  {key === 'displayName' ? 'Issuer name (required)' : key}
                  <textarea
                    className={control}
                    value={profile[key] || ''}
                    maxLength={
                      key === 'notes'
                        ? 2000
                        : key === 'address' || key === 'paymentInstructions'
                        ? 1000
                        : key === 'displayName'
                        ? 160
                        : key === 'phone'
                        ? 80
                        : 254
                    }
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <button
              disabled={busy}
              className="btn-brand-outline text-xs"
              onClick={() =>
                run(async () => {
                  const result = await saveBillingProfileAction({
                    studioId,
                    profile,
                    idToken: (await getCurrentUserIdToken()) || undefined,
                  });
                  if (!result.success) throw new Error(result.error);
                  await load();
                })
              }
            >
              Save issuer details
            </button>
          </details>

          {isInvoiceOnly ? (
            <div className="rounded-xl border border-border-default bg-surface-app p-3">
              <p className="font-bold text-text-primary">
                Final Invoice · {money(context.financials.confirmed)}
              </p>
              <p className="mt-1 text-text-secondary">
                Recorded paid: {money(context.financials.paid)} · Balance: {money(context.financials.remaining)}
                {context.financials.overpayment > 0 ? ` · Overpayment: ${money(context.financials.overpayment)}` : ''}
              </p>
            </div>
          ) : (
            <>
              <label className="grid gap-1 font-semibold text-text-primary">
                {isReceiptOnly ? 'Recorded Payment' : 'Document'}
                <select
                  className={control}
                  value={selection}
                  onChange={(e) => {
                    setSelection(e.target.value);
                    setConfirmed(false);
                    setPaymentDate('');
                  }}
                >
                  {!isReceiptOnly && (
                    <option value="invoice" disabled={finalInvoiceUnavailable}>
                      Final Invoice · {money(context.financials.confirmed)}
                      {finalInvoiceUnavailable ? ' (available after full payment)' : ''}
                    </option>
                  )}
                  {context.sources.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} receipt · {money(s.amountMinor)}
                      {s.paymentMethod ? ` · ${s.paymentMethod.replace(/_/g, ' ')}` : ''}
                      {s.paymentReference ? ` (Ref: ${s.paymentReference})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {source && (source.paymentMethod || source.paymentReference || source.notes) && (
                <div className="rounded-xl border border-border-default bg-surface-app p-2.5 text-text-secondary space-y-0.5">
                  {source.paymentMethod && (
                    <p>
                      <span className="font-semibold text-text-primary">Payment Mode:</span>{' '}
                      {source.paymentMethod.replace(/_/g, ' ')}
                    </p>
                  )}
                  {source.paymentReference && (
                    <p>
                      <span className="font-semibold text-text-primary">Transaction Reference:</span>{' '}
                      <span className="font-mono">{source.paymentReference}</span>
                    </p>
                  )}
                  {source.notes && (
                    <p>
                      <span className="font-semibold text-text-primary">Payment Note:</span> {source.notes}
                    </p>
                  )}
                </div>
              )}
              <p className="text-text-secondary">
                Recorded paid: {money(context.financials.paid)} · Balance: {money(context.financials.remaining)}
                {context.financials.overpayment > 0 ? ` · Overpayment: ${money(context.financials.overpayment)}` : ''}
              </p>
            </>
          )}

          {selection === 'invoice' && finalInvoiceUnavailable && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Final invoice becomes available after every recorded payment is saved and the order is paid in full.
            </p>
          )}

          {source?.requiresConfirmation && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p>
                The payment date is missing or this entry was created by marking an order paid. Confirm the actual receipt of{' '}
                {money(source.amountMinor)}.
              </p>
              <label className="block font-semibold">
                Actual payment date
                <input className={`${control} mt-1 block w-full`} type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>I confirm this amount was received on this date.</span>
              </label>
            </div>
          )}

          {selection === 'invoice' && (
            <label className="block font-semibold text-text-primary">
              Due date (optional)
              <input className={`${control} mt-1 block w-full`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          )}

          <label className="grid gap-1 font-semibold text-text-primary">
            Document notes (optional)
            <textarea className={control} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <button
            className="btn-brand-blue py-2 px-4 text-xs font-bold disabled:opacity-50"
            disabled={
              busy ||
              !context.canIssue ||
              (selection === 'invoice' && finalInvoiceUnavailable) ||
              previous?.status === 'ISSUED' ||
              Boolean(source?.requiresConfirmation && (!confirmed || !paymentDate))
            }
            onClick={() =>
              run(async () => {
                const result = await issueBillingDocumentAction({
                  studioId,
                  orderId,
                  kind: source ? 'RECEIPT' : 'INVOICE',
                  source: source?.source,
                  expectedSourceFingerprint: source?.fingerprint || context.invoiceFingerprint,
                  optionalFields: {
                    notes: notes || source?.notes || undefined,
                    dueDate: selection === 'invoice' ? dueDate || undefined : undefined,
                    paymentMethod: source?.paymentMethod || undefined,
                    paymentReference: source?.paymentReference || undefined,
                  },
                  receiptConfirmation: source?.requiresConfirmation
                    ? { confirmed: true, amountMinor: source.amountMinor, paymentDate }
                    : undefined,
                  replacementOf: previous?.status === 'VOID' ? previous.id : undefined,
                  idToken: (await getCurrentUserIdToken()) || undefined,
                });
                if (!result.success) throw new Error(result.error);
                await load();
              })
            }
          >
            {busy
              ? 'Working…'
              : previous?.status === 'ISSUED'
              ? 'Already issued — download below'
              : previous
              ? 'Issue replacement'
              : isInvoiceOnly
              ? 'Issue Invoice'
              : isReceiptOnly
              ? 'Issue Receipt'
              : 'Issue document'}
          </button>

          <div className="pt-2 border-t border-border-default space-y-2">
            <h3 className="font-bold text-text-primary">
              {isInvoiceOnly ? 'Issued invoice history' : isReceiptOnly ? 'Issued receipt history' : 'Issued history'}
            </h3>
            {!visibleDocuments.length && <p className="text-text-tertiary">No issued documents.</p>}
            {visibleDocuments.length > 0 && (
              <label className="grid gap-1 font-semibold text-text-primary">
                Void reason (required when voiding)
                <input className={control} value={voidReason} maxLength={500} onChange={(e) => setVoidReason(e.target.value)} />
              </label>
            )}
            {visibleDocuments.map((doc) => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-default bg-surface-app p-3">
                <div className="space-y-0.5">
                  <span className="font-semibold text-text-primary block">
                    {doc.number} · {doc.status} · {money(doc.amountMinor)}
                  </span>
                  {(doc.paymentMethod || doc.paymentReference) && (
                    <span className="text-[11px] text-text-secondary block">
                      {doc.paymentMethod ? `Mode: ${doc.paymentMethod.replace(/_/g, ' ')}` : ''}
                      {doc.paymentMethod && doc.paymentReference ? ' · ' : ''}
                      {doc.paymentReference ? `Ref: ${doc.paymentReference}` : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={busy} className={control} onClick={() => run(() => download(doc))}>
                    Download PDF
                  </button>
                  {doc.status === 'ISSUED' && (
                    <button
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      disabled={busy || !voidReason.trim()}
                      onClick={() =>
                        run(async () => {
                          const result = await voidBillingDocumentAction({
                            studioId,
                            documentId: doc.id,
                            reason: voidReason,
                            idToken: (await getCurrentUserIdToken()) || undefined,
                          });
                          if (!result.success) throw new Error(result.error);
                          await load();
                        })
                      }
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

