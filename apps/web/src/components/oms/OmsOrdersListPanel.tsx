"use client";

import Link from "next/link";
import type { Order, OrderStatus } from "@focoman/types";
import { FileSpreadsheet, Lock, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FocomanSpinner } from "@/components/FocomanSpinner";
import {
  formatMultiDateDisplay,
  getEventDaysRemaining,
  getNextOrPrimaryOrderShootDate,
} from "@/utils/dateUtils";
import { STATUS_COLORS, STATUS_LABELS } from "./omsConstants";

interface OmsOrdersListPanelProps {
  studioSlug: string;
  orders: Order[];
  filtered: Order[];
  selected: Order | null;
  selectedId: string | null;
  onSelectOrder: (orderId: string) => void;
  loading: boolean;
  isRefreshing?: boolean;
  refreshError?: string | null;
  query: string;
  onChangeQuery: (query: string) => void;
  statusFilter: "ALL" | OrderStatus;
  onChangeStatusFilter: (status: "ALL" | OrderStatus) => void;
  sortBy: "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC";
  onChangeSortBy: (sort: "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC") => void;
  onExportExcel: () => void;
  canExport: boolean;
  onOpenCreateModal: () => void;
  hasLeads: boolean;
  leadsCount?: number;
  onSwitchToLeads?: () => void;
}

export function OmsOrdersListPanel({
  studioSlug,
  orders,
  filtered,
  selected,
  selectedId,
  onSelectOrder,
  loading,
  isRefreshing = false,
  refreshError,
  query,
  onChangeQuery,
  statusFilter,
  onChangeStatusFilter,
  sortBy,
  onChangeSortBy,
  onExportExcel,
  canExport,
  onOpenCreateModal,
  hasLeads,
  leadsCount = 0,
  onSwitchToLeads,
}: OmsOrdersListPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportUpgradeHint, setExportUpgradeHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  const handleExportClick = () => {
    if (!canExport) {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      setExportUpgradeHint(true);
      hintTimerRef.current = setTimeout(() => {
        setExportUpgradeHint(false);
        hintTimerRef.current = null;
      }, 5000);
      return;
    }
    onExportExcel();
  };

  return (
    <div
      className={`flex h-full flex-col ${
        selected ? "hidden lg:flex lg:w-1/2 border-r border-border-default" : "w-full"
      }`}
    >
      <header className="header-brand-blue">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-secondary">Pending orders and open orders</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="btn-brand-blue"
            >
              + Register Confirmed Order
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="oms-order-filters"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-secondary hover:border-brand-blue-primary hover:text-text-primary transition"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-border-default pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {hasLeads ? (
              <div className="inline-flex rounded-xl border border-border-default bg-surface-app p-1">
                <button
                  type="button"
                  className="rounded-lg bg-brand-blue-primary px-3.5 py-1.5 text-xs font-extrabold text-white shadow-2xs transition cursor-pointer"
                >
                  Orders ({orders.length})
                </button>
                <button
                  type="button"
                  onClick={onSwitchToLeads}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition cursor-pointer"
                >
                  Leads ({leadsCount})
                </button>
              </div>
            ) : (
              <div className="inline-flex rounded-xl border border-border-default bg-surface-app p-1">
                <span className="rounded-lg bg-brand-blue-primary px-3.5 py-1.5 text-xs font-extrabold text-white shadow-2xs">
                  Orders ({orders.length})
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportClick}
              disabled={canExport && filtered.length === 0}
              aria-disabled={!canExport}
              className={`ml-auto rounded-xl border border-border-default px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer ${
                canExport
                  ? "bg-white text-text-primary hover:bg-surface-app hover:border-brand-blue-primary disabled:opacity-50"
                  : "bg-slate-100 text-text-tertiary opacity-50 hover:opacity-75"
              }`}
              title={
                canExport
                  ? "Export filtered orders and payment ledger to Excel (.xlsx)"
                  : "Excel export requires the Professional (₹1,999/mo) plan"
              }
            >
              <FileSpreadsheet
                className={`h-3.5 w-3.5 ${
                  canExport ? "text-brand-blue-primary" : "text-text-tertiary"
                }`}
              />
              <span>Export Excel</span>
              {!canExport && <Lock className="h-3 w-3 text-text-tertiary" />}
            </button>
          </div>

          {!canExport && exportUpgradeHint && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 flex justify-end"
            >
              <p className="max-w-full sm:max-w-md text-right text-[11px] font-medium text-red-700 whitespace-normal break-words leading-relaxed">
                Excel export is available only on the Professional (₹1,999/mo) plan.{" "}
                <Link
                  href={`/checkout?studio=${studioSlug}&plan=professional`}
                  className="font-bold underline hover:text-red-900"
                >
                  Subscribe to Professional
                </Link>
              </p>
            </div>
          )}
        </div>

        {filtersOpen && (
          <div id="oms-order-filters" className="mt-3 flex flex-col sm:flex-row gap-2.5">
            <input
              suppressHydrationWarning
              autoComplete="off"
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Search by customer, order number, event..."
              className="flex-1 rounded-xl border border-border-default bg-surface-app px-3.5 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
            />
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <select
                suppressHydrationWarning
                value={statusFilter}
                onChange={(e) =>
                  onChangeStatusFilter(e.target.value as "ALL" | OrderStatus)
                }
                className="min-w-0 w-full rounded-xl border border-border-default bg-surface-app px-3 py-2 text-xs font-semibold text-text-primary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft sm:w-auto"
              >
                <option value="ALL">All States</option>
                {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABELS[key]}
                  </option>
                ))}
              </select>
              <select
                suppressHydrationWarning
                value={sortBy}
                onChange={(e) =>
                  onChangeSortBy(
                    e.target.value as "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC"
                  )
                }
                aria-label="Sort orders"
                className="min-w-0 w-full rounded-xl border border-border-default bg-surface-app px-3 py-2 text-xs font-semibold text-text-primary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft sm:w-auto"
              >
                <option value="DATE_ASC">Earliest Date First</option>
                <option value="DATE_DESC">Latest Date First</option>
                <option value="PRICE_DESC">Price: High to Low</option>
                <option value="PRICE_ASC">Price: Low to High</option>
              </select>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {isRefreshing ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
            <FocomanSpinner size="md" />
            <div>
              <p className="text-sm font-bold text-text-primary">Refreshing orders…</p>
              <p className="mt-1 text-xs text-text-tertiary">Loading the newly registered order.</p>
            </div>
          </div>
        ) : loading && orders.length === 0 ? (
          <div className="py-16 text-center text-xs text-text-tertiary">Loading orders from server...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default bg-white p-12 text-center">
            <p className="text-sm font-bold text-text-secondary">No active confirmed orders found</p>
            <p className="text-xs text-text-tertiary mt-1">
              Register a new confirmed order to start automated production workflow tracking.
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <button
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className={`w-full rounded-2xl border p-5 text-left transition ${
                selectedId === order.id
                  ? "card-brand-blue"
                  : "border-border-default bg-white hover:border-brand-blue-light hover:shadow-xs"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-text-primary">
                      {order.customer.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-brand-blue-primary">
                      {order.orderNumber}
                    </span>
                    {order.paymentStatus === "PAID" && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-status-success border border-emerald-200">
                        PAID
                      </span>
                    )}
                    {order.paymentStatus === "PARTIAL" && !!order.pricing.installments?.length && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                        PARTIAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {order.eventType} · Event Date: {formatMultiDateDisplay(order.eventDates, order.eventDate)}
                    {order.orderStatus === "AWAITING_EVENT" &&
                      (() => {
                        const d = getEventDaysRemaining(getNextOrPrimaryOrderShootDate(order));
                        return d && d.diffDays > 0 ? ` (${d.label})` : "";
                      })()}
                  </p>
                  <p className="mt-2 text-xs text-text-tertiary">
                    Services: {order.services.join(", ")}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <span className={STATUS_COLORS[order.orderStatus]}>
                    {STATUS_LABELS[order.orderStatus]}
                  </span>
                  <p className="mt-2 text-sm font-extrabold text-text-primary">
                    ₹{order.pricing.finalConfirmedPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
        {refreshError && !isRefreshing && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900" role="alert">
            {refreshError}
          </div>
        )}
      </div>
    </div>
  );
}
