/**
 * Minimal Plain-White Vector PDF 1.4 Generator for Invoices & Payment Receipts
 * Generates a real, downloadable .pdf document directly in the browser with zero external dependencies.
 * Strictly omits any optional field that is blank.
 */

import type { OrderPaymentBreakdown, OrderReceiptEntry } from '@focoman/domain';
import type { StudioBillingProfile } from '@focoman/types';

export interface BillingDocumentInput {
  mode: 'INVOICE' | 'RECEIPT';
  documentNumber: string;
  documentDate: string;
  orderNumber: string;
  eventType: string;
  eventDate: string;
  eventLocation?: string;
  services: string[];
  packages?: string[];
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentStatus: string;
  breakdown: OrderPaymentBreakdown;
  activeReceipt?: OrderReceiptEntry;
  issuer: {
    issuerName: string;
    issuerType: 'STUDIO' | 'INDIVIDUAL';
    address?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    bankDetails?: string;
    upiId?: string;
    authorizedSignatory?: string;
    footerNotes?: string;
  };
}

function pdfEscape(text: string): string {
  // Replace rupee symbol ₹ with INR for standard Type1 Helvetica encoding compatibility in PDF 1.4
  const normalized = String(text || '')
    .replace(/₹/g, 'INR ')
    .replace(/[^\x20-\x7E]/g, ' ');
  return normalized
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatINRPlain(amount: number): string {
  const num = Math.round(Number(amount) || 0);
  return `INR ${num.toLocaleString('en-IN')}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const cleaned = String(text || '').trim();
  if (!cleaned) return [];
  const lines: string[] = [];
  for (const rawLine of cleaned.split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if ((current + ' ' + word).length <= maxChars) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export function downloadMinimalBillingPdf(doc: BillingDocumentInput): void {
  if (typeof window === 'undefined') return;

  const pageWidth = 595.28; // A4 width in pt
  const pageHeight = 841.89; // A4 height in pt
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;
  let y = pageHeight - 52;

  const commands: string[] = [];

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 10,
    bold = false,
    colorRgb: [number, number, number] = [0.06, 0.09, 0.16]
  ) => {
    const fontKey = bold ? '/F2' : '/F1';
    commands.push(
      `BT ${colorRgb[0]} ${colorRgb[1]} ${colorRgb[2]} rg ${fontKey} ${size} Tf ${x.toFixed(2)} ${yPos.toFixed(2)} Td (${pdfEscape(text)}) Tj ET`
    );
  };

  const drawRightText = (
    text: string,
    rightX: number,
    yPos: number,
    size = 10,
    bold = false,
    colorRgb: [number, number, number] = [0.06, 0.09, 0.16]
  ) => {
    const safeStr = String(text || '').replace(/₹/g, 'INR ');
    const approxWidth = safeStr.length * size * (bold ? 0.54 : 0.5);
    drawText(safeStr, Math.max(marginX, rightX - approxWidth), yPos, size, bold, colorRgb);
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    lineWidth = 0.6,
    gray = 0.82
  ) => {
    commands.push(
      `${gray} ${gray} ${gray} RG ${lineWidth} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`
    );
  };

  const drawFilledRect = (
    x: number,
    yBottom: number,
    w: number,
    h: number,
    rgb: [number, number, number]
  ) => {
    commands.push(
      `${rgb[0]} ${rgb[1]} ${rgb[2]} rg ${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`
    );
  };

  // 1. Header: Issuer Name (Left) & Document Type + Number (Right)
  const docTitle = doc.mode === 'INVOICE' ? 'INVOICE' : 'PAYMENT RECEIPT';
  drawText(doc.issuer.issuerName || 'Studio', marginX, y, 16, true);
  drawRightText(docTitle, pageWidth - marginX, y, 14, true);
  y -= 16;

  // Optional Issuer Sub-details (Left) & Document Number / Date (Right)
  const issuerLines: string[] = [];
  if (doc.issuer.address?.trim()) {
    issuerLines.push(...wrapText(doc.issuer.address.trim(), 48));
  }
  const contactParts: string[] = [];
  if (doc.issuer.phone?.trim()) contactParts.push(`Phone: ${doc.issuer.phone.trim()}`);
  if (doc.issuer.email?.trim()) contactParts.push(`Email: ${doc.issuer.email.trim()}`);
  if (contactParts.length > 0) issuerLines.push(contactParts.join('  |  '));
  if (doc.issuer.gstin?.trim()) {
    issuerLines.push(`GSTIN / Tax ID: ${doc.issuer.gstin.trim()}`);
  }

  const metaRightLines: string[] = [
    `${doc.mode === 'INVOICE' ? 'Invoice No' : 'Receipt No'}: ${doc.documentNumber}`,
    `Date: ${doc.documentDate || '-'}`,
    `Order Ref: ${doc.orderNumber}`,
  ];

  const headerRowsCount = Math.max(issuerLines.length, metaRightLines.length, 1);
  for (let i = 0; i < headerRowsCount; i++) {
    if (issuerLines[i]) {
      drawText(issuerLines[i], marginX, y, 9, false, [0.28, 0.33, 0.41]);
    }
    if (metaRightLines[i]) {
      drawRightText(metaRightLines[i], pageWidth - marginX, y, 9, i === 0, [0.2, 0.25, 0.33]);
    }
    y -= 13;
  }

  y -= 6;
  drawLine(marginX, y, pageWidth - marginX, y, 0.8, 0.15);
  y -= 20;

  // 2. Two-column Billed To / Received From & Event Details
  const leftLabel = doc.mode === 'INVOICE' ? 'BILLED TO' : 'RECEIVED FROM';
  drawText(leftLabel, marginX, y, 8, true, [0.4, 0.45, 0.53]);
  drawText('EVENT DETAILS', marginX + contentWidth * 0.52, y, 8, true, [0.4, 0.45, 0.53]);
  y -= 14;

  const clientLines: string[] = [doc.customerName || 'Client'];
  if (doc.customerPhone?.trim()) clientLines.push(`Phone: ${doc.customerPhone.trim()}`);
  if (doc.customerEmail?.trim()) clientLines.push(`Email: ${doc.customerEmail.trim()}`);

  const eventLines: string[] = [
    `${doc.eventType || 'Event'}`,
    `Event Date: ${doc.eventDate || '-'}`,
  ];
  if (doc.eventLocation?.trim()) {
    eventLines.push(`Location: ${doc.eventLocation.trim().slice(0, 44)}`);
  }

  const partyRows = Math.max(clientLines.length, eventLines.length);
  for (let i = 0; i < partyRows; i++) {
    if (clientLines[i]) {
      drawText(clientLines[i], marginX, y, i === 0 ? 10.5 : 9, i === 0);
    }
    if (eventLines[i]) {
      drawText(
        eventLines[i],
        marginX + contentWidth * 0.52,
        y,
        i === 0 ? 10.5 : 9,
        i === 0
      );
    }
    y -= 14;
  }

  y -= 8;

  if (doc.mode === 'INVOICE') {
    // 3A. INVOICE: Scope of Services & Pricing Table
    drawFilledRect(marginX, y - 6, contentWidth, 20, [0.95, 0.96, 0.98]);
    drawLine(marginX, y + 14, pageWidth - marginX, y + 14, 0.6, 0.75);
    drawLine(marginX, y - 6, pageWidth - marginX, y - 6, 0.6, 0.75);
    drawText('DESCRIPTION / INCLUDED SERVICES & PACKAGES', marginX + 8, y, 8.5, true);
    drawRightText('AMOUNT', pageWidth - marginX - 8, y, 8.5, true);
    y -= 22;

    if (doc.packages && doc.packages.length > 0) {
      drawText(`Packages: ${doc.packages.join(', ')}`, marginX + 8, y, 9.5, true);
      y -= 15;
    }

    const serviceItems =
      doc.services && doc.services.length > 0
        ? doc.services
        : [doc.eventType || 'Photography & Production Services'];

    serviceItems.forEach((svc, idx) => {
      drawText(`${idx + 1}. ${svc}`, marginX + 8, y, 9.5, false);
      if (idx === 0) {
        drawRightText(
          formatINRPlain(doc.breakdown.confirmedPrice),
          pageWidth - marginX - 8,
          y,
          9.5,
          true
        );
      } else {
        drawRightText('Included', pageWidth - marginX - 8, y, 8.5, false, [0.45, 0.5, 0.58]);
      }
      y -= 15;
    });

    y -= 4;
    drawLine(marginX, y, pageWidth - marginX, y, 0.6, 0.8);
    y -= 18;

    // Totals Block (Right aligned)
    const summaryLabelX = marginX + contentWidth * 0.52;
    drawText('Confirmed Package Total', summaryLabelX, y, 9.5, false);
    drawRightText(formatINRPlain(doc.breakdown.confirmedPrice), pageWidth - marginX - 8, y, 9.5, true);
    y -= 15;

    if (doc.breakdown.advanceAmount > 0) {
      drawText(
        `Advance Received (${doc.breakdown.advanceDate || '-'})`,
        summaryLabelX,
        y,
        9,
        false,
        [0.25, 0.3, 0.38]
      );
      drawRightText(
        formatINRPlain(doc.breakdown.advanceAmount),
        pageWidth - marginX - 8,
        y,
        9,
        false
      );
      y -= 14;
    }

    doc.breakdown.installments.forEach((inst, idx) => {
      drawText(
        `Installment #${idx + 1} (${inst.date || '-'})`,
        summaryLabelX,
        y,
        9,
        false,
        [0.25, 0.3, 0.38]
      );
      drawRightText(formatINRPlain(inst.amount), pageWidth - marginX - 8, y, 9, false);
      y -= 14;
    });

    drawLine(summaryLabelX, y + 4, pageWidth - marginX, y + 4, 0.5, 0.8);
    y -= 10;

    drawText('Total Paid to Date', summaryLabelX, y, 10, true);
    drawRightText(formatINRPlain(doc.breakdown.totalPaid), pageWidth - marginX - 8, y, 10, true);
    y -= 16;

    drawFilledRect(summaryLabelX - 6, y - 5, contentWidth * 0.48 + 6, 20, [0.95, 0.96, 0.98]);
    drawText('Balance Due', summaryLabelX, y, 10.5, true);
    drawRightText(
      formatINRPlain(doc.breakdown.remainingAmount),
      pageWidth - marginX - 8,
      y,
      10.5,
      true
    );
    y -= 28;
  } else {
    // 3B. RECEIPT: Dedicated Payment Acknowledgement Table
    const receipt = doc.activeReceipt || doc.breakdown.receipts[0] || {
      id: 'ADVANCE',
      receiptNumber: doc.documentNumber,
      type: 'ADVANCE' as const,
      label: 'Payment Received',
      amount: doc.breakdown.totalPaid,
      date: doc.documentDate,
    };

    drawFilledRect(marginX, y - 6, contentWidth, 20, [0.95, 0.96, 0.98]);
    drawLine(marginX, y + 14, pageWidth - marginX, y + 14, 0.6, 0.75);
    drawLine(marginX, y - 6, pageWidth - marginX, y - 6, 0.6, 0.75);
    drawText('PAYMENT DESCRIPTION', marginX + 8, y, 8.5, true);
    drawText('PAYMENT DATE', marginX + contentWidth * 0.52, y, 8.5, true);
    drawRightText('AMOUNT RECEIVED', pageWidth - marginX - 8, y, 8.5, true);
    y -= 22;

    drawText(`${receipt.label} - Order ${doc.orderNumber}`, marginX + 8, y, 10, true);
    drawText(receipt.date || doc.documentDate || '-', marginX + contentWidth * 0.52, y, 9.5, false);
    drawRightText(formatINRPlain(receipt.amount), pageWidth - marginX - 8, y, 10.5, true);
    y -= 15;

    if (receipt.notes?.trim()) {
      drawText(`Note: ${receipt.notes.trim()}`, marginX + 8, y, 8.5, false, [0.35, 0.4, 0.48]);
      y -= 14;
    }

    y -= 4;
    drawLine(marginX, y, pageWidth - marginX, y, 0.6, 0.8);
    y -= 20;

    // Order Account Balance Summary after this payment
    const summaryLabelX = marginX + contentWidth * 0.48;
    drawText('Total Order Value', summaryLabelX, y, 9, false, [0.28, 0.33, 0.41]);
    drawRightText(formatINRPlain(doc.breakdown.confirmedPrice), pageWidth - marginX - 8, y, 9, false);
    y -= 14;

    drawText('Receipt Amount Paid', summaryLabelX, y, 10, true);
    drawRightText(formatINRPlain(receipt.amount), pageWidth - marginX - 8, y, 10, true);
    y -= 14;

    drawText('Cumulative Total Paid on Order', summaryLabelX, y, 9, false, [0.28, 0.33, 0.41]);
    drawRightText(formatINRPlain(doc.breakdown.totalPaid), pageWidth - marginX - 8, y, 9, false);
    y -= 14;

    drawFilledRect(summaryLabelX - 6, y - 5, contentWidth * 0.52 + 6, 20, [0.95, 0.96, 0.98]);
    drawText('Remaining Order Balance', summaryLabelX, y, 10, true);
    drawRightText(
      formatINRPlain(doc.breakdown.remainingAmount),
      pageWidth - marginX - 8,
      y,
      10,
      true
    );
    y -= 28;
  }

  // 4. Optional Bank / UPI / Notes / Authorized Signatory (Strictly omitted if blank)
  const hasBank = Boolean(doc.issuer.bankDetails?.trim() || doc.issuer.upiId?.trim());
  const hasNotes = Boolean(doc.issuer.footerNotes?.trim());
  const hasSignatory = Boolean(doc.issuer.authorizedSignatory?.trim());

  if (hasBank || hasNotes || hasSignatory) {
    drawLine(marginX, y, pageWidth - marginX, y, 0.5, 0.85);
    y -= 16;

    if (hasBank) {
      drawText('PAYMENT & BANK DETAILS', marginX, y, 8, true, [0.4, 0.45, 0.53]);
      y -= 13;
      if (doc.issuer.bankDetails?.trim()) {
        for (const line of wrapText(doc.issuer.bankDetails.trim(), 70)) {
          drawText(line, marginX, y, 9, false);
          y -= 12;
        }
      }
      if (doc.issuer.upiId?.trim()) {
        drawText(`UPI ID: ${doc.issuer.upiId.trim()}`, marginX, y, 9, true);
        y -= 14;
      }
      y -= 4;
    }

    if (hasNotes) {
      drawText('NOTES / TERMS', marginX, y, 8, true, [0.4, 0.45, 0.53]);
      y -= 13;
      for (const line of wrapText(doc.issuer.footerNotes!.trim(), 75)) {
        drawText(line, marginX, y, 8.5, false, [0.28, 0.33, 0.41]);
        y -= 12;
      }
      y -= 4;
    }

    if (hasSignatory) {
      y -= 18;
      drawLine(pageWidth - marginX - 150, y + 12, pageWidth - marginX, y + 12, 0.5, 0.65);
      drawRightText(doc.issuer.authorizedSignatory!.trim(), pageWidth - marginX, y, 9.5, true);
      y -= 12;
      drawRightText('Authorized Signatory', pageWidth - marginX, y, 8, false, [0.45, 0.5, 0.58]);
    }
  }

  // Assemble valid PDF 1.4 file
  const contentStream = commands.join('\n');
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
    `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const cleanFileName = `${doc.documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  a.href = url;
  a.download = cleanFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function resolveEffectiveBillingProfile(
  studioName: string,
  studioCity?: string,
  studioPhone?: string,
  studioOwnerEmail?: string,
  savedProfile?: StudioBillingProfile | null
) {
  return {
    issuerType: savedProfile?.issuerType || ('STUDIO' as const),
    issuerName: (savedProfile?.issuerName ?? studioName) || 'Studio',
    showLogo: savedProfile?.showLogo ?? false,
    address: savedProfile?.address ?? (studioCity ? studioCity : ''),
    phone: savedProfile?.phone ?? (studioPhone || ''),
    email: savedProfile?.email ?? (studioOwnerEmail || ''),
    gstin: savedProfile?.gstin ?? '',
    bankDetails: savedProfile?.bankDetails ?? '',
    upiId: savedProfile?.upiId ?? '',
    authorizedSignatory: savedProfile?.authorizedSignatory ?? '',
    footerNotes: savedProfile?.footerNotes ?? '',
  };
}
