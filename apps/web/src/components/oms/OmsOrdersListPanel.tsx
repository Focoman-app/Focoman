"use client";

import type { Order, OrderStatus } from "@focoman/types";
import { FileSpreadsheet } from "lucide-react";
import { getEventDaysRemaining } from "@/utils/dateUtils";
import { STATUS_COLORS, STATUS_LABELS } from "./omsConstants";

interface OmsOrdersListPanelProps {
  studioSlug: string;
  orders: Order[];
  filtered: Order[];
  selected: Order | null;
  selectedId: string | null;
  onSelectOrder: (orderId: string) => void;
  loading: boolean;
  query: string;
  onChangeQuery: (query: string) => void;
  statusFilter: "ALL" | "MARKETPLACE" | OrderStatus;
  onChangeStatusFilter: (status: "ALL" | "MARKETPLACE" | OrderStatus) => void;
  sortBy: "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC";
  onChangeSortBy: (sort: "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC") => void;
  onExportExcel: () => void;
  onOpenCreateModal: () => void;
}

export function OmsOrdersListPanel({
  studioSlug,
  orders,
  filtered,
  selected,
  selectedId,
  onSelectOrder,
  loading,
  query,
  onChangeQuery,
  statusFilter,
  onChangeStatusFilter,
  sortBy,
  onChangeSortBy,
  onExportExcel,
  onOpenCreateModal,
}: OmsOrdersListPanelProps) {
  return (
    <div
      className={`flex h-full flex-col ${
        selected ? "hidden lg:flex lg:w-1/2 border-r border-border-default" : "w-full"
      }`}
    >
      <header className="header-brand-blue">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="badge-brand-blue">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary" />
                OMS · Order Management
              </span>
              <span className="badge-status-neutral">
                Studio: <strong className="font-semibold text-text-primary">{studioSlug}</strong>
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
              Order Management System
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Production lifecycle workflows, delivery milestones, and client accounts · {orders.length} Confirmed Orders
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportExcel}
              disabled={filtered.length === 0}
              className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary hover:bg-surface-app hover:border-brand-blue-primary transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Export filtered orders and payment ledger to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-brand-blue-primary" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={onOpenCreateModal}
              className="btn-brand-blue"
            >
              + Register Confirmed Order
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <input
            suppressHydrationWarning
            autoComplete="off"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Search by customer, order number, event..."
            className="flex-1 rounded-xl border border-border-default bg-surface-app px-3.5 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
          />
          <div className="flex gap-2">
            <select
              suppressHydrationWarning
              value={statusFilter}
              onChange={(e) =>
                onChangeStatusFilter(e.target.value as "ALL" | "MARKETPLACE" | OrderStatus)
              }
              className="rounded-xl border border-border-default bg-surface-app px-3 py-2 text-xs font-semibold text-text-primary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
            >
              <option value="ALL">All States</option>
              <option value="MARKETPLACE">Studio Marketplace Orders</option>
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
              className="rounded-xl border border-border-default bg-surface-app px-3 py-2 text-xs font-semibold text-text-primary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
            >
              <option value="DATE_ASC">Earliest Date First</option>
              <option value="DATE_DESC">Latest Date First</option>
              <option value="PRICE_DESC">Price: High to Low</option>
              <option value="PRICE_ASC">Price: Low to High</option>
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {loading && orders.length === 0 ? (
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
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-text-primary">
                      {order.customer.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-brand-blue-primary">
                      {order.orderNumber}
                    </span>
                    {order.bookingRequestId && (
                      <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                        Marketplace
                      </span>
                    )}
                    {order.paymentStatus === "PAID" && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-status-success border border-emerald-200">
                        PAID
                      </span>
                    )}
                    {(order.paymentStatus === "ADVANCE_RECEIVED" ||
                      (order.paymentStatus === "PARTIAL" &&
                        (!order.pricing.installments || order.pricing.installments.length === 0))) && (
                      <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                        ADVANCE RECEIVED
                      </span>
                    )}
                    {order.paymentStatus === "PARTIAL" && !!order.pricing.installments?.length && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                        PARTIAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {order.eventType} · Event Date: {order.eventDate}
                    {order.orderStatus === "AWAITING_EVENT" &&
                      (() => {
                        const d = getEventDaysRemaining(order.eventDate);
                        return d && d.diffDays > 0 ? ` (${d.label})` : "";
                      })()}
                  </p>
                  <p className="mt-2 text-xs text-text-tertiary">
                    Services: {order.services.join(", ")}
                  </p>
                </div>
                <div className="text-right">
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
      </div>
    </div>
  );
}
