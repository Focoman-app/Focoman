"use client";

import type { Order, OrderInstallment, PaymentStatus } from "@focoman/types";
import { calculateOrderPaymentBreakdown } from "@focoman/domain";
import { FileText, Receipt } from "lucide-react";

interface OmsPaymentSummarySectionProps {
  selected: Order;
  isEditingPricing: boolean;
  onCancelEditingPricing: () => void;
  onStartEditingPricing: () => void;
  isUpdatingPayment: boolean;
  isSendingReminder: boolean;
  onUpdatePayment: (
    newPaymentStatus?: PaymentStatus,
    advanceAmount?: number,
    finalConfirmedPrice?: number,
    installments?: OrderInstallment[],
    advanceDate?: string
  ) => void;
  onSendPaymentReminder: () => void;
  onOpenBillingModal: (tab: "INVOICE" | "RECEIPT", receiptId?: string) => void;
  canManageBilling: boolean;
  editConfirmedPrice: string;
  onChangeEditConfirmedPrice: (value: string) => void;
  editAdvanceAmount: string;
  onChangeEditAdvanceAmount: (value: string) => void;
  editAdvanceDate: string;
  onChangeEditAdvanceDate: (value: string) => void;
  editInstallments: OrderInstallment[];
  onRemoveInstallment: (index: number) => void;
  showAddInstallment: boolean;
  onOpenAddInstallment: () => void;
  onCloseAddInstallment: () => void;
  newInstallmentAmount: string;
  onChangeNewInstallmentAmount: (value: string) => void;
  newInstallmentDate: string;
  onChangeNewInstallmentDate: (value: string) => void;
  newInstallmentNotes: string;
  onChangeNewInstallmentNotes: (value: string) => void;
  newInstallmentMethod: "CASH" | "UPI" | "BANK_TRANSFER";
  onChangeNewInstallmentMethod: (value: "CASH" | "UPI" | "BANK_TRANSFER") => void;
  newInstallmentReference: string;
  onChangeNewInstallmentReference: (value: string) => void;
  installmentError: string | null;
  pricingError: string | null;
  onAddInstallment: () => void | Promise<void>;
  newInstallmentProofFile: File | null;
  onChangeNewInstallmentProofFile: (file: File | null) => void;
  onSavePricing: () => void;
}

export function OmsPaymentSummarySection({
  selected,
  isEditingPricing,
  onCancelEditingPricing,
  onStartEditingPricing,
  isUpdatingPayment,
  isSendingReminder,
  onUpdatePayment,
  onSendPaymentReminder,
  onOpenBillingModal,
  canManageBilling,
  editConfirmedPrice,
  onChangeEditConfirmedPrice,
  editAdvanceAmount,
  onChangeEditAdvanceAmount,
  editAdvanceDate,
  onChangeEditAdvanceDate,
  editInstallments,
  onRemoveInstallment,
  showAddInstallment,
  onOpenAddInstallment,
  onCloseAddInstallment,
  newInstallmentAmount,
  onChangeNewInstallmentAmount,
  newInstallmentDate,
  onChangeNewInstallmentDate,
  newInstallmentNotes,
  onChangeNewInstallmentNotes,
  newInstallmentMethod,
  onChangeNewInstallmentMethod,
  newInstallmentReference,
  onChangeNewInstallmentReference,
  installmentError,
  pricingError,
  onAddInstallment,
  newInstallmentProofFile,
  onChangeNewInstallmentProofFile,
  onSavePricing,
}: OmsPaymentSummarySectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
          Payment and Pricing Summary
        </h3>
        <div className="flex items-center gap-1.5">
          {isEditingPricing ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-blue-primary bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              <span>✎</span> Editing
            </span>
          ) : (
            <>
              {selected.paymentStatus === "PAID" ? (
                <button
                  type="button"
                  disabled={isUpdatingPayment}
                  onClick={() => {
                    void onUpdatePayment("PENDING");
                  }}
                  className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50/50 shadow-2xs transition disabled:opacity-50 flex items-center gap-1"
                  title="Mark order as Unpaid"
                >
                  <span>✕</span>
                  <span>{isUpdatingPayment ? "Updating..." : "Mark Unpaid"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isUpdatingPayment}
                  onClick={() => void onUpdatePayment("PAID")}
                  className="btn-brand-blue py-1 px-2.5 text-[11px] disabled:opacity-50 flex items-center gap-1"
                  title="Mark order as Paid"
                >
                  <span>✓</span>
                  <span>{isUpdatingPayment ? "Updating..." : "Mark Paid"}</span>
                </button>
              )}
              {selected.pricing.remainingAmount > 0 && selected.paymentStatus !== "PAID" && (
                <button
                  type="button"
                  disabled={isSendingReminder || isUpdatingPayment}
                  onClick={onSendPaymentReminder}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 shadow-2xs transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  title="Send manual payment reminder email to customer"
                >
                  <span>✉</span>
                  <span>{isSendingReminder ? "Sending..." : "Send Reminder"}</span>
                </button>
              )}
              {canManageBilling && <button
                type="button"
                onClick={() => onOpenBillingModal("INVOICE")}
                className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-[11px] font-semibold text-text-primary hover:text-brand-blue-primary hover:border-brand-blue-primary hover:bg-blue-50/50 shadow-2xs transition flex items-center gap-1 cursor-pointer"
                title="Generate, print, or download Invoice & Payment Receipts (PDF)"
              >
                <FileText className="h-3 w-3 text-brand-blue-primary" />
                <span>Invoice & Receipts</span>
              </button>}
              <button
                type="button"
                disabled={isUpdatingPayment}
                onClick={onStartEditingPricing}
                className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-brand-blue-primary hover:border-brand-blue-primary hover:bg-blue-50/50 shadow-2xs transition disabled:opacity-50 flex items-center gap-1"
                title="Edit pricing and payment amounts"
              >
                <span>✎</span>
                <span>Edit</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-2.5 rounded-2xl bg-surface-app p-4 border border-border-default text-xs">
        {isEditingPricing ? (
          <>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-medium">Confirmed Price:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary font-bold">₹</span>
                <input
                  type="number"
                  min={0}
                  value={editConfirmedPrice}
                  onChange={(e) => onChangeEditConfirmedPrice(e.target.value)}
                  className="w-28 rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs font-bold text-text-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-text-secondary font-medium">Advance Received:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-text-tertiary">Recorded on:</span>
                    <input
                      type="date"
                      value={editAdvanceDate}
                      onChange={(e) => onChangeEditAdvanceDate(e.target.value)}
                      className="rounded border border-border-default bg-white px-1 py-0.5 text-[10px] text-text-secondary focus:outline-none focus:border-brand-blue-primary"
                      title="Date advance payment was recorded"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-secondary font-bold">₹</span>
                  <input
                    type="number"
                    min={0}
                    value={editAdvanceAmount}
                    onChange={(e) => onChangeEditAdvanceAmount(e.target.value)}
                    className="w-28 rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs font-bold text-brand-blue-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    placeholder="0"
                  />
                </div>
              </div>
              {(Number(editAdvanceAmount) || 0) > (Number(editConfirmedPrice) || 0) && (
                <p className="text-[11px] font-semibold text-status-danger text-right">
                  Advance exceeds confirmed price of ₹{(Number(editConfirmedPrice) || 0).toLocaleString()}
                </p>
              )}
            </div>

            {/* Installments in edit mode */}
            <div className="pt-2 border-t border-border-default space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-text-secondary">
                  Installments / Payments:
                </span>
              </div>

              {editInstallments.length > 0 && (
                <div className="space-y-1.5">
                  {editInstallments.map((inst, idx) => (
                    <div
                      key={inst.id || idx}
                      className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-border-default"
                    >
                      <div className="text-xs">
                        <span className="font-bold text-text-primary">
                          ₹{inst.amount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-text-tertiary ml-2">
                          Recorded on {inst.date}
                          {inst.method ? ` · ${inst.method.replace("_", " ")}` : ""}{inst.notes ? ` · ${inst.notes}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveInstallment(idx)}
                        className="text-text-tertiary hover:text-status-danger p-0.5 text-xs font-bold transition"
                        title="Remove payment"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!showAddInstallment && (
                <button
                  type="button"
                  onClick={onOpenAddInstallment}
                  className="w-full py-2.5 px-3 rounded-xl bg-brand-blue-primary hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <span className="text-sm font-extrabold">+</span>
                  <span>Add payment</span>
                </button>
              )}

              {showAddInstallment &&
                (() => {
                  const confirmedNum = Math.max(0, Number(editConfirmedPrice) || 0);
                  const advanceNum = Math.max(0, Number(editAdvanceAmount) || 0);
                  const instTotal = editInstallments.reduce(
                    (sum, i) => sum + (i.amount || 0),
                    0
                  );
                  const remainingForNew = Math.max(
                    0,
                    confirmedNum - (advanceNum + instTotal)
                  );
                  const inputAmt = Number(newInstallmentAmount) || 0;
                  const isExceeding = inputAmt > remainingForNew;

                  return (
                    <div className="rounded-xl border border-brand-blue-light bg-blue-50/50 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-text-primary">
                          Add Payment Entry
                        </span>
                        <span className="text-[10px] text-text-tertiary font-medium">
                          Remaining balance:{" "}
                          <span className="font-bold text-brand-orange-primary">
                            ₹{remainingForNew.toLocaleString()}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                            Payment Amount (₹)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={remainingForNew}
                            value={newInstallmentAmount}
                            onChange={(e) =>
                              onChangeNewInstallmentAmount(e.target.value)
                            }
                            placeholder={`Up to ₹${remainingForNew.toLocaleString()}`}
                            className={`w-full rounded-lg border bg-white px-2.5 py-1 text-xs font-bold text-text-primary focus:outline-none focus:ring-1 ${
                              isExceeding
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                : "border-border-default focus:border-brand-blue-primary focus:ring-brand-blue-primary"
                            }`}
                            autoFocus
                          />
                        </div>
                        <div className="w-36">
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                            Recorded on Date
                          </label>
                          <input
                            type="date"
                            value={newInstallmentDate}
                            onChange={(e) =>
                              onChangeNewInstallmentDate(e.target.value)
                            }
                            className="w-full rounded-lg border border-border-default bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                          />
                        </div>
                      </div>

                      {isExceeding && (
                        <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5">
                          <span>
                            Payment amount cannot exceed remaining balance of ₹
                            {remainingForNew.toLocaleString()}.
                          </span>
                        </p>
                      )}

                      {installmentError && (
                        <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5">
                          <span>{installmentError}</span>
                        </p>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block mb-0.5">Payment Mode</label>
                        <select
                          value={newInstallmentMethod}
                          onChange={(e) => onChangeNewInstallmentMethod(e.target.value as "CASH" | "UPI" | "BANK_TRANSFER")}
                          className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                      </div>

                      {newInstallmentMethod === "UPI" && (
                        <div>
                          <label className="text-[10px] font-bold text-text-secondary block mb-0.5">UPI Transaction ID <span className="font-normal">(Optional)</span></label>
                          <input
                            type="text"
                            value={newInstallmentReference}
                            onChange={(e) => onChangeNewInstallmentReference(e.target.value)}
                            placeholder="UTR / transaction number"
                            maxLength={200}
                            className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs text-text-secondary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                          />
                          <label className="mt-2 block text-[10px] font-bold text-text-secondary">Screenshot proof <span className="font-normal">(Optional)</span><input type="file" accept="image/*" onChange={(event) => onChangeNewInstallmentProofFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-[10px] text-text-secondary" /></label>
                          {newInstallmentProofFile && <p className="mt-1 text-[10px] text-text-tertiary">Selected: {newInstallmentProofFile.name}</p>}
                        </div>
                      )}

                      <div>
                        <input
                          type="text"
                          value={newInstallmentNotes}
                          onChange={(e) =>
                            onChangeNewInstallmentNotes(e.target.value)
                          }
                          placeholder="Optional note"
                          maxLength={50}
                          className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs text-text-secondary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                        />
                      </div>

                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={onCloseAddInstallment}
                          className="rounded-md border border-border-default bg-white px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isExceeding || inputAmt <= 0}
                          onClick={onAddInstallment}
                          className="btn-brand-blue py-1 px-3 text-[11px] disabled:opacity-40"
                        >
                          Add to unsaved payments
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border-default">
              <span className="text-text-secondary font-medium">Remaining Balance:</span>
              <span className="font-bold text-brand-orange-primary">
                {(() => {
                  const c = Math.max(0, Number(editConfirmedPrice) || 0);
                  const a = Math.max(0, Number(editAdvanceAmount) || 0);
                  const instTotal = editInstallments.reduce(
                    (sum, i) => sum + (i.amount || 0),
                    0
                  );
                  return `₹${Math.max(0, c - (a + instTotal)).toLocaleString()}`;
                })()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border-default">
              <span className="text-text-secondary font-medium">Payment Status:</span>
              {(() => {
                const c = Math.max(0, Number(editConfirmedPrice) || 0);
                const a = Math.max(0, Number(editAdvanceAmount) || 0);
                const instTotal = editInstallments.reduce(
                  (sum, i) => sum + (i.amount || 0),
                  0
                );
                const totalPaid = a + instTotal;
                const isPaid = totalPaid >= c && c > 0;
                const hasInst = editInstallments.length > 0;
                const isAdvance = !isPaid && !hasInst && a > 0;
                const isPartial = !isPaid && hasInst && totalPaid > 0;

                if (isPaid) {
                  return (
                    <span className="font-bold text-status-success">
                      Payment Completed
                    </span>
                  );
                }
                if (isAdvance) {
                  return <span className="font-bold text-sky-700">ADVANCE RECEIVED</span>;
                }
                if (isPartial) {
                  return (
                    <span className="font-bold text-brand-orange-primary">PARTIAL</span>
                  );
                }
                return <span className="font-bold text-text-secondary">PENDING</span>;
              })()}
            </div>

            {pricingError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-status-danger font-medium flex items-center gap-2">
                <span>{pricingError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
              <button
                type="button"
                disabled={isUpdatingPayment}
                onClick={onCancelEditingPricing}
                className="rounded-xl border border-border-default bg-white px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-subtle shadow-2xs transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isUpdatingPayment ||
                  (Number(editAdvanceAmount) || 0) +
                    editInstallments.reduce((sum, i) => sum + (i.amount || 0), 0) >
                    (Number(editConfirmedPrice) || 0)
                }
                onClick={onSavePricing}
                className="btn-brand-blue py-1.5 px-4 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
              >
                <span>✓</span>
                <span>{isUpdatingPayment ? "Saving payments..." : "Save payments"}</span>
              </button>
            </div>
          </>
        ) : (
          (() => {
            const breakdown = calculateOrderPaymentBreakdown(selected);
            return (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Confirmed Price:</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    ₹{breakdown.confirmedPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-text-secondary">Advance Received:</span>
                    <div className="text-[10px] text-text-tertiary">
                      Recorded on {breakdown.advanceDate || "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {breakdown.advanceAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenBillingModal("RECEIPT", "ADVANCE")}
                        className="inline-flex items-center gap-1 rounded border border-border-default bg-white px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:border-brand-blue-primary hover:text-brand-blue-primary transition cursor-pointer"
                        title="View / Download Advance Payment Receipt"
                      >
                        <Receipt className="h-2.5 w-2.5" />
                        <span>Receipt</span>
                      </button>
                    )}
                    <span className="font-mono font-bold text-brand-blue-primary tabular-nums">
                      ₹{breakdown.advanceAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {breakdown.installments.length > 0 && (
                  <div className="pt-2 border-t border-border-default/60 space-y-1.5">
                    {breakdown.installments.map((inst, idx) => {
                      const instReceiptId = inst.id || `INST_${idx + 1}`;
                      return (
                        <div
                          key={instReceiptId}
                          className="flex justify-between items-center"
                        >
                          <div>
                            <span className="text-text-secondary font-medium">
                              Installment #{idx + 1}:
                            </span>
                            <span className="text-[10px] text-text-tertiary ml-1.5">
                              Recorded on {inst.date}
                              {inst.notes ? ` · ${inst.notes}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenBillingModal("RECEIPT", instReceiptId)
                              }
                              className="inline-flex items-center gap-1 rounded border border-border-default bg-white px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:border-brand-blue-primary hover:text-brand-blue-primary transition cursor-pointer"
                              title={`View / Download Installment #${idx + 1} Receipt`}
                            >
                              <Receipt className="h-2.5 w-2.5" />
                              <span>Receipt</span>
                            </button>
                            <span className="font-mono font-bold text-text-primary tabular-nums">
                              ₹{inst.amount.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-border-default">
                  <span className="text-text-secondary font-medium">
                    Total Paid to Date:
                  </span>
                  <span className="font-mono font-bold text-status-success tabular-nums">
                    ₹{breakdown.totalPaid.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border-default">
                  <span className="text-text-secondary">Remaining Balance:</span>
                  <span className="font-mono font-bold text-brand-orange-primary tabular-nums">
                    ₹{breakdown.remainingAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border-default">
                  <span className="text-text-secondary">Payment Status:</span>
                  {(() => {
                    const isPaid =
                      selected.paymentStatus === "PAID" ||
                      (breakdown.remainingAmount === 0 &&
                        breakdown.confirmedPrice > 0);
                    const hasInstallments = breakdown.installments.length > 0;
                    const isAdvance =
                      !isPaid && !hasInstallments && breakdown.advanceAmount > 0;
                    const isPartial =
                      !isPaid && hasInstallments && breakdown.totalPaid > 0;

                    if (isPaid) {
                      return (
                        <span className="font-bold text-status-success">
                          Payment Completed
                        </span>
                      );
                    }
                    if (isAdvance) {
                      return (
                        <span className="font-bold text-sky-700">
                          ADVANCE RECEIVED
                        </span>
                      );
                    }
                    if (isPartial) {
                      return (
                        <span className="font-bold text-brand-orange-primary">
                          PARTIAL
                        </span>
                      );
                    }
                    return (
                      <span className="font-bold text-text-secondary">
                        PENDING
                      </span>
                    );
                  })()}
                </div>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
