"use client";

import type { Order } from "@focoman/types";

interface OmsOrderActionDialogsProps {
  cancelTargetOrder: Order | null;
  onCloseCancelModal: () => void;
  cancelReason: string;
  onChangeCancelReason: (value: string) => void;
  isCancelling: boolean;
  onConfirmCancelOrder: () => void;
  deleteTargetOrder: Order | null;
  onCloseDeleteModal: () => void;
  isDeleting: boolean;
  onConfirmDeleteOrder: () => void;
}

export function OmsOrderActionDialogs({
  cancelTargetOrder,
  onCloseCancelModal,
  cancelReason,
  onChangeCancelReason,
  isCancelling,
  onConfirmCancelOrder,
  deleteTargetOrder,
  onCloseDeleteModal,
  isDeleting,
  onConfirmDeleteOrder,
}: OmsOrderActionDialogsProps) {
  return (
    <>
      {/* In-App Cancellation Dialog */}
      {cancelTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="text-base font-bold text-text-primary">Cancel Order</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Order #{cancelTargetOrder.orderNumber} · {cancelTargetOrder.customer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseCancelModal}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-app transition"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                Cancelling this order will mark it as Cancelled in the production pipeline and stop automated notifications.
              </p>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Cancellation Reason <span className="font-normal text-text-tertiary">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Client postponed indefinitely or requested cancellation"
                  value={cancelReason}
                  onChange={(e) => onChangeCancelReason(e.target.value)}
                  className="w-full rounded-xl border border-border-default p-3 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
              <button
                type="button"
                onClick={onCloseCancelModal}
                className="btn-brand-outline"
                disabled={isCancelling}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={onConfirmCancelOrder}
                disabled={isCancelling}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Soft-Delete Dialog */}
      {deleteTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="text-base font-bold text-status-error">Delete Order</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Order #{deleteTargetOrder.orderNumber} · {deleteTargetOrder.customer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseDeleteModal}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-app transition"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-4 space-y-2">
              <p className="text-xs text-text-primary font-semibold">
                Are you sure you want to soft-delete this order?
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                This order will be removed from your active dashboard. It can be fully recovered from the studio archives within 14 days before permanent purge.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
              <button
                type="button"
                onClick={onCloseDeleteModal}
                className="btn-brand-outline"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteOrder}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isDeleting ? "Deleting..." : "Delete Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
