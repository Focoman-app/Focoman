'use client';
import { useEffect, useState } from 'react';
import type { BillingDocument, BillingProfile } from '@focoman/types';
import { getOrderBillingContextAction, issueBillingDocumentAction, saveBillingProfileAction, voidBillingDocumentAction } from '@/actions/billingActions';
import { getCurrentUserIdToken } from '@/lib/firebaseAuth';

type Context = Extract<Awaited<ReturnType<typeof getOrderBillingContextAction>>, { success: true }>['data'];
const control = 'rounded border border-border-divider bg-surface-base p-2 text-text-primary';
export function OrderBillingPanel({ studioId, orderId }: { studioId: string; orderId: string }) {
  const [context, setContext] = useState<Context>();
  const [profile, setProfile] = useState<BillingProfile>({ displayName: '' });
  const [selection, setSelection] = useState('invoice');
  const [paymentDate, setPaymentDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  async function load() {
    const result = await getOrderBillingContextAction({ studioId, orderId, idToken: await getCurrentUserIdToken() || undefined });
    if (!result.success) throw new Error(result.error);
    setContext(result.data); setProfile(result.data.profile);
  }
  useEffect(() => { setContext(undefined); load().catch(e => setError(e.message)); }, [studioId, orderId]);
  async function run(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : 'Billing request failed.'); } finally { setBusy(false); }
  }
  const source = context?.sources.find(s => s.key === selection);
  const previous = context?.documents.filter(d => d.sourceKey === selection).sort((a,b) => b.revision-a.revision)[0];
  const money = (value: number) => `INR ${(value / 100).toFixed(2)}`;
  async function download(doc: BillingDocument, print = false) {
    // Open on the user gesture so browser popup blocking does not discard a fetched document.
    const viewer = print ? window.open('', '_blank') : null;
    try {
      const token = await getCurrentUserIdToken();
      const response = await fetch(`/api/billing/${doc.id}/pdf?studioId=${encodeURIComponent(studioId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('PDF unavailable. Sign in as the studio owner and retry.');
      const url = URL.createObjectURL(await response.blob());
      if (viewer) { viewer.location.href = url; } else { const a = document.createElement('a'); a.href=url; a.download=`${doc.number}.pdf`; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { viewer?.close(); throw e; }
  }
  return <section className="space-y-4">
    <h2 className="text-lg font-semibold">Issued invoices and payment receipts</h2>
    <p className="text-sm">Issued documents preserve the values at issuance. Later order edits do not change them. Currency: INR.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {!context ? <button className={control} onClick={() => run(load)} disabled={busy}>Load billing</button> : <>
      <details><summary>Issuer details (optional contact fields)</summary><div className="grid gap-3 py-3 sm:grid-cols-2">
        {(['displayName','address','phone','email','website','paymentInstructions','notes'] as const).map(key => <label key={key} className="grid gap-1 text-sm">{key === 'displayName' ? 'Issuer name (required)' : key}<textarea className={control} value={profile[key] || ''} maxLength={key === 'notes' ? 2000 : key === 'address' || key === 'paymentInstructions' ? 1000 : key === 'displayName' ? 160 : key === 'phone' ? 80 : 254} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} /></label>)}
      </div><button disabled={busy} className={control} onClick={() => run(async () => { const result = await saveBillingProfileAction({ studioId, profile, idToken: await getCurrentUserIdToken() || undefined }); if (!result.success) throw new Error(result.error); await load(); })}>Save issuer details</button></details>
      <label className="grid gap-1">Document<select className={control} value={selection} onChange={e => { setSelection(e.target.value); setConfirmed(false); setPaymentDate(''); }}><option value="invoice">Invoice · {money(context.financials.confirmed)}</option>{context.sources.map(s => <option key={s.key} value={s.key}>{s.label} · {money(s.amountMinor)}</option>)}</select></label>
      <p>Recorded paid: {money(context.financials.paid)} · Balance: {money(context.financials.remaining)}{context.financials.overpayment > 0 ? ` · Overpayment: ${money(context.financials.overpayment)}` : ''}</p>
      {source?.requiresConfirmation && <div className="space-y-2"><p>The payment date is missing or this entry was created by marking an order paid. Confirm the actual receipt of {money(source.amountMinor)}.</p><label className="block">Actual payment date<input className={control} type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> I confirm this amount was received on this date.</label></div>}
      {selection === 'invoice' && <label className="block">Due date (optional)<input className={control} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></label>}
      <label className="grid gap-1">Document notes (optional)<textarea className={control} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <button className={control} disabled={busy || !context.canIssue || previous?.status === 'ISSUED' || Boolean(source?.requiresConfirmation && (!confirmed || !paymentDate))} onClick={() => run(async () => {
        const result = await issueBillingDocumentAction({ studioId, orderId, kind: source ? 'RECEIPT' : 'INVOICE', source: source?.source, expectedSourceFingerprint: source?.fingerprint || context.invoiceFingerprint, optionalFields: { notes: notes || undefined, dueDate: selection === 'invoice' ? dueDate || undefined : undefined }, receiptConfirmation: source?.requiresConfirmation ? { confirmed: true, amountMinor: source.amountMinor, paymentDate } : undefined, replacementOf: previous?.status === 'VOID' ? previous.id : undefined, idToken: await getCurrentUserIdToken() || undefined });
        if (!result.success) throw new Error(result.error); await load();
      })}>{busy ? 'Working…' : previous?.status === 'ISSUED' ? 'Already issued — download below' : previous ? 'Issue replacement' : 'Issue document'}</button>
      <h3 className="font-semibold">Issued history</h3><p className="text-sm">Print opens the same PDF in a new viewer; use its Print control. If the viewer is blocked, the PDF downloads for printing.</p>
      {!context.documents.length && <p>No issued documents.</p>}
      <label className="grid gap-1">Void reason (required when voiding)<input className={control} value={voidReason} maxLength={500} onChange={e=>setVoidReason(e.target.value)} /></label>
      {context.documents.map(doc => <div key={doc.id} className="flex flex-wrap items-center gap-2 border-t py-3"><span>{doc.number} · {doc.status} · {money(doc.amountMinor)}</span><button disabled={busy} className={control} onClick={()=>run(()=>download(doc))}>Download PDF</button><button disabled={busy} className={control} onClick={()=>run(()=>download(doc,true))}>Print</button>{doc.status === 'ISSUED' && <button className={control} disabled={busy || !voidReason.trim()} onClick={()=>run(async()=>{const result=await voidBillingDocumentAction({studioId,documentId:doc.id,reason:voidReason,idToken:await getCurrentUserIdToken() || undefined}); if(!result.success) throw new Error(result.error); await load();})}>Void</button>}</div>)}
    </>}
  </section>;
}
