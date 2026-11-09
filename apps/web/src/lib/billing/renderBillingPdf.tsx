import React from 'react';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { Document, Page, Text, View, Font, renderToBuffer } from '@react-pdf/renderer';
import type { BillingDocument } from '@focoman/types';

const fontRoot = existsSync(path.join(process.cwd(), 'src/lib/billing/fonts'))
  ? path.join(process.cwd(), 'src/lib/billing/fonts') : path.join(process.cwd(), 'apps/web/src/lib/billing/fonts');
for (const family of ['NotoSans', 'NotoSansTamil']) {
  Font.register({ family, fonts: [{ src: path.join(fontRoot, `${family}-Regular.ttf`) }, { src: path.join(fontRoot, `${family}-Bold.ttf`), fontWeight: 700 }] });
}
Font.registerHyphenationCallback(word => [word]);
function RichText({ children }: { children: string }) {
  return <Text>{children.split(/([\u0b80-\u0bff]+)/u).map((run, index) => <Text key={index} style={{ fontFamily: /[\u0b80-\u0bff]/u.test(run) ? 'NotoSansTamil' : 'NotoSans' }}>{run}</Text>)}</Text>;
}
export async function renderBillingPdf(doc: BillingDocument) {
  const money = (minor: number) => `INR ${(minor / 100).toFixed(2)}`;
  return renderToBuffer(<Document title={doc.number}>
    <Page size="A4" style={{ padding: 44, paddingBottom: 60, fontFamily: 'NotoSans', fontSize: 10, lineHeight: 1.6 }}>
      <View style={{ fontSize: 18, marginBottom: 12 }}><RichText>{doc.issuer.displayName}</RichText></View>
      <Text>{doc.kind === 'INVOICE' ? 'INVOICE' : 'PAYMENT RECEIPT'} · {doc.number}{doc.status === 'VOID' ? ' · VOID' : ''}</Text>
      <Text>Issued: {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata' }).format(new Date(doc.issuedAt))}</Text>
      {[doc.issuer.address, doc.issuer.phone, doc.issuer.email, doc.issuer.website].filter(Boolean).map((line, i) => <RichText key={i}>{line!}</RichText>)}
      <View style={{ marginTop: 18, marginBottom: 18 }}><Text>Customer</Text><RichText>{doc.customer.name}</RichText>
        {doc.customer.phone && <RichText>{doc.customer.phone}</RichText>}{doc.customer.email && <RichText>{doc.customer.email}</RichText>}
      </View>
      <RichText>{`Order: ${doc.orderNumber}`}</RichText><RichText>{doc.description}</RichText>
      <View wrap={false} style={{ marginTop: 20, borderTopWidth: 1, paddingTop: 10 }}>
        <Text>{doc.kind === 'INVOICE' ? 'Order value' : 'Receipt amount'}: {money(doc.amountMinor)}</Text>
        {doc.paymentDate && <Text>Payment date: {doc.paymentDate}</Text>}
        <Text>Recorded paid at issue: {money(doc.paidMinor)}</Text><Text>Balance at issue: {money(doc.remainingMinor)}</Text>
        {doc.overpaymentMinor > 0 && <Text>Overpayment: {money(doc.overpaymentMinor)}</Text>}
        {doc.dueDate && <Text>Due date: {doc.dueDate}</Text>}
      </View>
      {[doc.paymentMethod, doc.paymentReference, doc.issuer.paymentInstructions, doc.issuer.notes, doc.notes, doc.voidReason].filter(Boolean).map((line, i) => <View key={i} style={{ marginTop: 12 }}><RichText>{line!}</RichText></View>)}
      <Text fixed style={{ position: 'absolute', bottom: 25, left: 44, fontSize: 8 }} render={({ pageNumber, totalPages }) => `${doc.number} · ${pageNumber} / ${totalPages}`} />
    </Page>
  </Document>);
}
