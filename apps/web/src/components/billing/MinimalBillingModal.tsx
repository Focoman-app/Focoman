"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Download,
  Printer,
  FileText,
  Receipt,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import {
  calculateOrderPaymentBreakdown,
  type OrderReceiptEntry,
} from "@focoman/domain";
import type { Order, StudioBillingProfile } from "@focoman/types";
import {
  downloadMinimalBillingPdf,
  resolveEffectiveBillingProfile,
  type BillingDocumentInput,
} from "@/utils/invoicePdfGenerator";

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

function formatINR(amount: number): string {
  return `₹${Math.round(Number(amount) || 0).toLocaleString("en-IN")}`;
}

export function MinimalBillingModal({
  isOpen,
  onClose,
  order,
  studioId,
  studioName,
  studioLogoUrl,
  studioCity,
  studioPhone,
  studioEmail,
  initialProfile,
  initialTab = "INVOICE",
  initialReceiptId,
  canEditProfile = true,
  onSaveBillingProfile,
}: MinimalBillingModalProps) {
  const breakdown = useMemo(
    () =>
      calculateOrderPaymentBreakdown({
        orderNumber: order.orderNumber,
        pricing: order.pricing,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt || order.eventDate,
        eventDate: order.eventDate,
      }),
    [order]
  );

  const [activeMode, setActiveMode] = useState<"INVOICE" | "RECEIPT">(initialTab);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>(
    initialReceiptId || breakdown.receipts[0]?.id || "ADVANCE"
  );
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const storageKey = `focoman_billing_profile_${(studioId || studioName || "default").toLowerCase()}`;

  const [profile, setProfile] = useState<Required<StudioBillingProfile>>(() =>
    resolveEffectiveBillingProfile(
      studioName,
      studioCity,
      studioPhone,
      studioEmail,
      initialProfile
    )
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveMode(initialTab);
    if (initialReceiptId) {
      setSelectedReceiptId(initialReceiptId);
    } else if (breakdown.receipts.length > 0) {
      setSelectedReceiptId(breakdown.receipts[0].id);
    }
  }, [isOpen, initialTab, initialReceiptId, breakdown.receipts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = window.localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as StudioBillingProfile;
        setProfile(
          resolveEffectiveBillingProfile(
            studioName,
            studioCity,
            studioPhone,
            studioEmail,
            { ...initialProfile, ...parsed }
          )
        );
        return;
      }
    } catch {
      // ignore localStorage read errors
    }
    setProfile(
      resolveEffectiveBillingProfile(
        studioName,
        studioCity,
        studioPhone,
        studioEmail,
        initialProfile
      )
    );
  }, [studioName, studioCity, studioPhone, studioEmail, initialProfile, storageKey]);

  if (!isOpen) return null;

  const activeReceipt: OrderReceiptEntry | undefined =
    breakdown.receipts.find((r) => r.id === selectedReceiptId) ||
    breakdown.receipts[0];

  const cleanOrderNum = (order.orderNumber || "ORD").replace(/\s+/g, "");
  const documentNumber =
    activeMode === "INVOICE"
      ? `INV-${cleanOrderNum}`
      : activeReceipt?.receiptNumber || `RCP-${cleanOrderNum}-01`;

  const documentDate =
    activeMode === "INVOICE"
      ? (order.createdAt ? order.createdAt.slice(0, 10) : breakdown.advanceDate || order.eventDate)
      : activeReceipt?.date || breakdown.advanceDate || order.eventDate;

  const docInput: BillingDocumentInput = {
    mode: activeMode,
    documentNumber,
    documentDate,
    orderNumber: order.orderNumber,
    eventType: order.eventType,
    eventDate: order.eventDate,
    eventLocation: order.eventLocation,
    services: order.services || [],
    packages: order.packages || [],
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    paymentStatus: order.paymentStatus,
    breakdown,
    activeReceipt,
    issuer: {
      issuerName: profile.issuerName.trim() || studioName || "Studio",
      issuerType: profile.issuerType,
      address: profile.address.trim() || undefined,
      phone: profile.phone.trim() || undefined,
      email: profile.email.trim() || undefined,
      gstin: profile.gstin.trim() || undefined,
      bankDetails: profile.bankDetails.trim() || undefined,
      upiId: profile.upiId.trim() || undefined,
      authorizedSignatory: profile.authorizedSignatory.trim() || undefined,
      footerNotes: profile.footerNotes.trim() || undefined,
    },
  };

  const handleSaveOptionalFields = async () => {
    setSavingProfile(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(profile));
      }
      if (onSaveBillingProfile) {
        await onSaveBillingProfile(profile);
      }
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadMinimalBillingPdf(docInput);
  };

  const serviceList =
    order.services && order.services.length > 0
      ? order.services
      : [order.eventType || "Photography & Production Services"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-6 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0">
      <div className="relative w-full max-w-4xl rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-auto print:max-w-none print:border-0 print:bg-white print:shadow-none">
        {/* Top Action Bar (Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-3.5 sm:px-6 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMode("INVOICE")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeMode === "INVOICE"
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Invoice ({`INV-${cleanOrderNum}`})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("RECEIPT")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeMode === "RECEIPT"
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>
                Payment Receipts ({breakdown.receipts.length})
              </span>
            </button>

            {activeMode === "RECEIPT" && breakdown.receipts.length > 1 && (
              <select
                value={activeReceipt?.id || ""}
                onChange={(e) => setSelectedReceiptId(e.target.value)}
                aria-label="Select Payment Receipt"
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                {breakdown.receipts.map((rcp) => (
                  <option key={rcp.id} value={rcp.id}>
                    {rcp.label} — {formatINR(rcp.amount)} ({rcp.date || "-"})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditProfile && (
              <button
                type="button"
                onClick={() => setShowCustomizePanel((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  showCustomizePanel
                    ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-300"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Optional Fields</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close billing modal"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Optional Fields Customizer (Hidden in Print) */}
        {canEditProfile && showCustomizePanel && (
          <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-4 sm:px-6 print:hidden">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Issuer & Optional Document Fields
                </h4>
                <p className="text-[11px] text-slate-400">
                  Use your Studio name or Individual/Freelancer name. Any optional field left blank is completely omitted from the document.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveOptionalFields}
                disabled={savingProfile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>
                  {savedFeedback
                    ? "Saved Defaults"
                    : savingProfile
                    ? "Saving..."
                    : "Save as Default"}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Issuer Type
                </label>
                <select
                  value={profile.issuerType}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      issuerType: e.target.value as "STUDIO" | "INDIVIDUAL",
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="STUDIO">Studio / Business Name</option>
                  <option value="INDIVIDUAL">Individual / Freelancer Name</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Issuer Name (Studio or Individual) *
                </label>
                <input
                  type="text"
                  value={profile.issuerName}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, issuerName: e.target.value }))
                  }
                  placeholder="e.g. Lumos Studio or Rahul Sharma"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  GSTIN / Tax ID (Optional — leave blank if none)
                </label>
                <input
                  type="text"
                  value={profile.gstin}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, gstin: e.target.value }))
                  }
                  placeholder="Optional"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="Optional contact number"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Email (Optional)
                </label>
                <input
                  type="text"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="Optional email"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Address / City (Optional)
                </label>
                <input
                  type="text"
                  value={profile.address}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Optional address or city"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  UPI ID (Optional)
                </label>
                <input
                  type="text"
                  value={profile.upiId}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, upiId: e.target.value }))
                  }
                  placeholder="Optional UPI ID"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Bank Account Details (Optional)
                </label>
                <input
                  type="text"
                  value={profile.bankDetails}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, bankDetails: e.target.value }))
                  }
                  placeholder="Bank Name, A/C No, IFSC (Optional)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Authorized Signatory Name (Optional)
                </label>
                <input
                  type="text"
                  value={profile.authorizedSignatory}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      authorizedSignatory: e.target.value,
                    }))
                  }
                  placeholder="Optional signatory name"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Footer Notes / Terms (Optional)
                </label>
                <input
                  type="text"
                  value={profile.footerNotes}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, footerNotes: e.target.value }))
                  }
                  placeholder="Optional thank-you note or payment terms"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {studioLogoUrl && (
                <div className="flex items-end pb-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.showLogo)}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, showLogo: e.target.checked }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                    />
                    <span>Show Logo on Document</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Receipt Selector Strip when in RECEIPT mode */}
        {activeMode === "RECEIPT" && breakdown.receipts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 sm:px-6 print:hidden">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Select Payment Record:
            </span>
            {breakdown.receipts.map((rcp) => {
              const isSelected = rcp.id === activeReceipt?.id;
              return (
                <button
                  key={rcp.id}
                  type="button"
                  onClick={() => setSelectedReceiptId(rcp.id)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {rcp.label}: {formatINR(rcp.amount)} ({rcp.date || "-"})
                </button>
              );
            })}
          </div>
        )}

        {/* Plain White Minimal Document Canvas (#FFFFFF) */}
        <div className="max-h-[75vh] overflow-y-auto bg-slate-950/50 p-4 sm:p-8 print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <div
            id="minimal-billing-printable"
            className="mx-auto max-w-3xl rounded-sm border border-slate-200 bg-white p-6 sm:p-10 text-slate-900 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none"
          >
            {/* Header Row */}
            <div className="flex flex-col justify-between gap-4 border-b border-slate-900 pb-5 sm:flex-row sm:items-start">
              <div className="space-y-1">
                {profile.showLogo && studioLogoUrl && (
                  <img
                    src={studioLogoUrl}
                    alt={docInput.issuer.issuerName}
                    className="mb-2 h-10 w-auto object-contain"
                  />
                )}
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  {docInput.issuer.issuerName}
                </h2>
                {docInput.issuer.address && (
                  <p className="text-xs text-slate-600 whitespace-pre-line">
                    {docInput.issuer.address}
                  </p>
                )}
                {(docInput.issuer.phone || docInput.issuer.email) && (
                  <p className="text-xs text-slate-600 tabular-nums">
                    {[
                      docInput.issuer.phone ? `Phone: ${docInput.issuer.phone}` : null,
                      docInput.issuer.email ? `Email: ${docInput.issuer.email}` : null,
                    ]
                      .filter(Boolean)
                      .join("  |  ")}
                  </p>
                )}
                {docInput.issuer.gstin && (
                  <p className="text-xs font-medium text-slate-700 tabular-nums">
                    GSTIN / Tax ID: {docInput.issuer.gstin}
                  </p>
                )}
              </div>

              <div className="sm:text-right space-y-1">
                <div className="text-base font-bold uppercase tracking-wider text-slate-950">
                  {activeMode === "INVOICE" ? "INVOICE" : "PAYMENT RECEIPT"}
                </div>
                <div className="text-xs font-semibold text-slate-800 tabular-nums">
                  {activeMode === "INVOICE" ? "Invoice No" : "Receipt No"}:{" "}
                  <span className="font-mono">{documentNumber}</span>
                </div>
                <div className="text-xs text-slate-600 tabular-nums">
                  Date: <span className="font-mono">{documentDate || "-"}</span>
                </div>
                <div className="text-xs text-slate-600 tabular-nums">
                  Order ID: <span className="font-mono">{order.orderNumber}</span>
                </div>
              </div>
            </div>

            {/* Client & Event Metadata */}
            <div className="grid grid-cols-1 gap-6 border-b border-slate-200 py-5 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {activeMode === "INVOICE" ? "Billed To" : "Received From"}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {order.customerName || "Client"}
                </div>
                {order.customerPhone && (
                  <div className="mt-0.5 text-xs text-slate-600 tabular-nums">
                    Phone: {order.customerPhone}
                  </div>
                )}
                {order.customerEmail && (
                  <div className="mt-0.5 text-xs text-slate-600">
                    Email: {order.customerEmail}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Event Details
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {order.eventType || "Photography Event"}
                </div>
                <div className="mt-0.5 text-xs text-slate-600 tabular-nums">
                  Event Date: <span className="font-mono">{order.eventDate || "-"}</span>
                </div>
                {order.eventLocation && (
                  <div className="mt-0.5 text-xs text-slate-600">
                    Location: {order.eventLocation}
                  </div>
                )}
              </div>
            </div>

            {/* Document Body: INVOICE vs RECEIPT */}
            {activeMode === "INVOICE" ? (
              <div className="py-5">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-y border-slate-300 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      <th className="py-2.5 pl-3 pr-2 w-10">#</th>
                      <th className="py-2.5 px-2">
                        Description / Included Services & Packages
                      </th>
                      <th className="py-2.5 pl-2 pr-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {order.packages && order.packages.length > 0 && (
                      <tr>
                        <td className="py-2.5 pl-3 pr-2 font-mono text-slate-500">
                          PKG
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-900">
                          Package(s): {order.packages.join(", ")}
                        </td>
                        <td className="py-2.5 pl-2 pr-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatINR(breakdown.confirmedPrice)}
                        </td>
                      </tr>
                    )}
                    {serviceList.map((service, index) => {
                      const showAmountHere =
                        (!order.packages || order.packages.length === 0) &&
                        index === 0;
                      return (
                        <tr key={`${service}-${index}`}>
                          <td className="py-2.5 pl-3 pr-2 font-mono text-slate-500 tabular-nums">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-2 text-slate-800">{service}</td>
                          <td className="py-2.5 pl-2 pr-3 text-right font-mono tabular-nums text-slate-700">
                            {showAmountHere ? (
                              <span className="font-semibold text-slate-900">
                                {formatINR(breakdown.confirmedPrice)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                Included
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Financial Summary & Payment Ledger */}
                <div className="mt-6 flex flex-col items-end">
                  <div className="w-full sm:w-80 space-y-2 text-xs">
                    <div className="flex justify-between py-1 text-slate-700">
                      <span>Confirmed Total</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatINR(breakdown.confirmedPrice)}
                      </span>
                    </div>

                    {breakdown.advanceAmount > 0 && (
                      <div className="flex justify-between py-0.5 text-slate-600">
                        <span>
                          Advance Paid ({breakdown.advanceDate || "-"})
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatINR(breakdown.advanceAmount)}
                        </span>
                      </div>
                    )}

                    {breakdown.installments.map((inst, idx) => (
                      <div
                        key={inst.id || idx}
                        className="flex justify-between py-0.5 text-slate-600"
                      >
                        <span>
                          Installment #{idx + 1} ({inst.date || "-"})
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatINR(inst.amount)}
                        </span>
                      </div>
                    ))}

                    <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
                      <span>Total Paid to Date</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(breakdown.totalPaid)}
                      </span>
                    </div>

                    <div className="flex justify-between border-y border-slate-900 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-950">
                      <span>Balance Due</span>
                      <span className="font-mono tabular-nums">
                        {formatINR(breakdown.remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* RECEIPT MODE */
              <div className="py-5">
                {breakdown.receipts.length === 0 ? (
                  <div className="rounded border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
                    No recorded advance or installment payments found for this order yet.
                  </div>
                ) : (
                  <>
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-y border-slate-300 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          <th className="py-2.5 pl-3 pr-2">Receipt Description</th>
                          <th className="py-2.5 px-2">Payment Date</th>
                          <th className="py-2.5 pl-2 pr-3 text-right">
                            Amount Received
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        <tr>
                          <td className="py-3 pl-3 pr-2">
                            <div className="font-semibold text-slate-900">
                              {activeReceipt?.label || "Payment"} — Order{" "}
                              {order.orderNumber}
                            </div>
                            {activeReceipt?.notes && (
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                Note: {activeReceipt.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 font-mono text-slate-700 tabular-nums">
                            {activeReceipt?.date || documentDate || "-"}
                          </td>
                          <td className="py-3 pl-2 pr-3 text-right font-mono text-sm font-bold text-slate-950 tabular-nums">
                            {formatINR(activeReceipt?.amount || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-6 flex flex-col items-end">
                      <div className="w-full sm:w-80 space-y-2 text-xs">
                        <div className="flex justify-between py-0.5 text-slate-600">
                          <span>Total Confirmed Order Value</span>
                          <span className="font-mono tabular-nums">
                            {formatINR(breakdown.confirmedPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 font-semibold text-slate-900">
                          <span>This Receipt Amount</span>
                          <span className="font-mono tabular-nums">
                            {formatINR(activeReceipt?.amount || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-slate-700">
                          <span>Cumulative Total Paid on Order</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {formatINR(breakdown.totalPaid)}
                          </span>
                        </div>
                        <div className="flex justify-between border-y border-slate-900 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-950">
                          <span>Remaining Order Balance</span>
                          <span className="font-mono tabular-nums">
                            {formatINR(breakdown.remainingAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Optional Footer Sections (Strictly omitted when blank) */}
            {(docInput.issuer.bankDetails ||
              docInput.issuer.upiId ||
              docInput.issuer.footerNotes ||
              docInput.issuer.authorizedSignatory) && (
              <div className="mt-4 border-t border-slate-200 pt-5 text-xs">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    {(docInput.issuer.bankDetails || docInput.issuer.upiId) && (
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Payment & Bank Details
                        </div>
                        {docInput.issuer.bankDetails && (
                          <p className="whitespace-pre-line text-slate-700">
                            {docInput.issuer.bankDetails}
                          </p>
                        )}
                        {docInput.issuer.upiId && (
                          <p className="mt-0.5 font-mono font-medium text-slate-800">
                            UPI ID: {docInput.issuer.upiId}
                          </p>
                        )}
                      </div>
                    )}

                    {docInput.issuer.footerNotes && (
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Notes
                        </div>
                        <p className="whitespace-pre-line text-slate-600">
                          {docInput.issuer.footerNotes}
                        </p>
                      </div>
                    )}
                  </div>

                  {docInput.issuer.authorizedSignatory && (
                    <div className="flex flex-col justify-end sm:items-end">
                      <div className="mt-6 w-48 border-t border-slate-400 pt-1.5 sm:text-right">
                        <div className="font-semibold text-slate-900">
                          {docInput.issuer.authorizedSignatory}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                          Authorized Signatory
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
