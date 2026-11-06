"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { OrderStatus, Order, BookingRequest } from "@focoman/types";
import { getStudioCalendarDate, calculateOrderPaymentBreakdown } from "@focoman/domain";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { getStudioBookingRequestsAction } from "@/actions/marketplaceActions";
import { FileSpreadsheet } from "lucide-react";
import { exportTableToExcel, exportWorkbookToExcel } from "@/utils/excelExport";

const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_EVENT: "Awaiting Event",
  POST_EVENT_IN_PROGRESS: "Post-Event In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  AWAITING_EVENT: "badge-brand-blue",
  POST_EVENT_IN_PROGRESS: "badge-brand-orange",
  COMPLETED: "badge-status-success",
  CANCELLED: "badge-status-error",
};

export type PeriodFilter =
  | "LAST_30_DAYS"
  | "LAST_3_MONTHS"
  | "LAST_6_MONTHS"
  | "THIS_YEAR"
  | "LAST_YEAR"
  | "CUSTOM";

interface CollapsedPanels {
  reports: boolean;
  orders: boolean;
  shoots: boolean;
  marketplace: boolean;
}

interface DashboardOverviewViewProps {
  studioSlug: string;
  initialOrders: Order[];
}

function parseDateOnly(dateStr: string): Date {
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const [y, m, d] = clean.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function formatCurrency(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = parseDateOnly(dateStr);
    const day = d.getDate();
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export function DashboardOverviewView({
  studioSlug,
  initialOrders,
}: DashboardOverviewViewProps) {
  const { studio, idToken } = useStudioWorkspace();
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // 1. Collapsible state with persistence
  const [collapsed, setCollapsed] = useState<CollapsedPanels>({
    reports: false,
    orders: false,
    shoots: false,
    marketplace: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`focoman_dashboard_collapsed_${studioSlug}`);
      if (stored) {
        setCollapsed((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch {
      // ignore localStorage errors
    }
  }, [studioSlug]);

  const togglePanel = (key: keyof CollapsedPanels) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`focoman_dashboard_collapsed_${studioSlug}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };


  // 2. Period Filter state
  const [period, setPeriod] = useState<PeriodFilter>("LAST_30_DAYS");
  const todayStr = useMemo(() => getStudioCalendarDate(), []);
  const todayDate = useMemo(() => parseDateOnly(todayStr), [todayStr]);

  const [customFrom, setCustomFrom] = useState(() => {
    const d = addDays(parseDateOnly(todayStr), -30);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(todayStr);

  // 3. Status filter for the ONE Orders table
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [ordersSearchQuery, setOrdersSearchQuery] = useState("");

  // 4. Marketplace Leads state (Marketplace is 100% Free for everyone)
  const isMarketplaceEnabled = true;

  const [marketplaceLeads, setMarketplaceLeads] = useState<BookingRequest[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  useEffect(() => {
    if (isMarketplaceEnabled && idToken) {
      setLeadsLoading(true);
      getStudioBookingRequestsAction(studioSlug, idToken)
        .then((res) => {
          if (res.success && res.bookingRequests) {
            setMarketplaceLeads(res.bookingRequests);
          }
        })
        .catch(() => {})
        .finally(() => setLeadsLoading(false));
    }
  }, [isMarketplaceEnabled, studioSlug, idToken]);

  // Determine date ranges for reporting
  const { currentRange, previousRange, periodLabel } = useMemo(() => {
    let currStart: Date;
    let currEnd: Date = todayDate;
    let prevStart: Date;
    let prevEnd: Date;
    let label = "Last 30 Days";

    switch (period) {
      case "LAST_30_DAYS": {
        label = "Last 30 Days";
        currStart = addDays(todayDate, -30);
        currEnd = todayDate;
        prevStart = addDays(todayDate, -60);
        prevEnd = addDays(todayDate, -30);
        break;
      }
      case "LAST_3_MONTHS": {
        label = "Last 3 Months";
        currStart = addDays(todayDate, -90);
        currEnd = todayDate;
        prevStart = addDays(todayDate, -180);
        prevEnd = addDays(todayDate, -90);
        break;
      }
      case "LAST_6_MONTHS": {
        label = "Last 6 Months";
        currStart = addDays(todayDate, -180);
        currEnd = todayDate;
        prevStart = addDays(todayDate, -360);
        prevEnd = addDays(todayDate, -180);
        break;
      }
      case "THIS_YEAR": {
        label = "This Year";
        currStart = new Date(todayDate.getFullYear(), 0, 1);
        currEnd = todayDate;
        const daysIn = Math.max(1, Math.round((currEnd.getTime() - currStart.getTime()) / 86400000));
        prevStart = new Date(todayDate.getFullYear() - 1, 0, 1);
        prevEnd = addDays(prevStart, daysIn);
        break;
      }
      case "LAST_YEAR": {
        label = "Last Year";
        currStart = new Date(todayDate.getFullYear() - 1, 0, 1);
        currEnd = new Date(todayDate.getFullYear() - 1, 11, 31);
        prevStart = new Date(todayDate.getFullYear() - 2, 0, 1);
        prevEnd = new Date(todayDate.getFullYear() - 2, 11, 31);
        break;
      }
      case "CUSTOM": {
        label = "Custom Range";
        currStart = parseDateOnly(customFrom || todayStr);
        currEnd = parseDateOnly(customTo || todayStr);
        const diffDays = Math.max(1, Math.round((currEnd.getTime() - currStart.getTime()) / 86400000));
        prevStart = addDays(currStart, -diffDays);
        prevEnd = currStart;
        break;
      }
      default: {
        currStart = addDays(todayDate, -30);
        currEnd = todayDate;
        prevStart = addDays(todayDate, -60);
        prevEnd = addDays(todayDate, -30);
      }
    }

    return {
      currentRange: { start: currStart, end: currEnd },
      previousRange: { start: prevStart, end: prevEnd },
      periodLabel: label,
    };
  }, [period, todayDate, todayStr, customFrom, customTo]);

  // Order date resolution (createdAt or eventDate)
  const getOrderRecordDate = useCallback((o: Order): Date => {
    if (o.createdAt) {
      return parseDateOnly(o.createdAt);
    }
    return parseDateOnly(o.eventDate);
  }, []);

  // Filter orders in current vs previous reporting period (excluding CANCELLED)
  const { periodOrders, prevPeriodOrders, revenueCurrent, revenuePrev } = useMemo(() => {
    let revCurr = 0;
    let revPrev = 0;
    const currList: Order[] = [];
    const prevList: Order[] = [];

    orders.forEach((o) => {
      if (o.orderStatus === "CANCELLED") return; // Cancelled orders excluded from revenue/order stats

      const d = getOrderRecordDate(o);
      const t = d.getTime();

      if (t >= currentRange.start.getTime() && t <= currentRange.end.getTime()) {
        currList.push(o);
        revCurr += o.pricing?.finalConfirmedPrice || 0;
      } else if (t >= previousRange.start.getTime() && t < previousRange.end.getTime()) {
        prevList.push(o);
        revPrev += o.pricing?.finalConfirmedPrice || 0;
      }
    });

    return {
      periodOrders: currList,
      prevPeriodOrders: prevList,
      revenueCurrent: revCurr,
      revenuePrev: revPrev,
    };
  }, [orders, currentRange, previousRange, getOrderRecordDate]);

  // Comparison percentages
  const revDiffPercent = useMemo(() => {
    if (revenuePrev === 0) {
      return revenueCurrent > 0 ? 100 : 0;
    }
    return Math.round(((revenueCurrent - revenuePrev) / revenuePrev) * 1000) / 10;
  }, [revenueCurrent, revenuePrev]);

  const ordersDiffPercent = useMemo(() => {
    if (prevPeriodOrders.length === 0) {
      return periodOrders.length > 0 ? 100 : 0;
    }
    return (
      Math.round(
        ((periodOrders.length - prevPeriodOrders.length) / prevPeriodOrders.length) * 1000
      ) / 10
    );
  }, [periodOrders.length, prevPeriodOrders.length]);

  // Order status counts across all registered orders
  const {
    totalConfirmedCount,
    awaitingEventCount,
    postEventCount,
    completedCount,
    cancelledCount,
    pendingCollectionsAmount,
  } = useMemo(() => {
    let awaiting = 0;
    let postEvent = 0;
    let completed = 0;
    let cancelled = 0;
    let pendingCollections = 0;

    orders.forEach((o) => {
      if (o.orderStatus === "CANCELLED") {
        cancelled += 1;
        return;
      }
      if (o.orderStatus === "AWAITING_EVENT") awaiting += 1;
      else if (o.orderStatus === "POST_EVENT_IN_PROGRESS") postEvent += 1;
      else if (o.orderStatus === "COMPLETED") completed += 1;

      pendingCollections += calculateOrderPaymentBreakdown(o).remainingAmount;
    });

    return {
      totalConfirmedCount: awaiting + postEvent + completed,
      awaitingEventCount: awaiting,
      postEventCount: postEvent,
      completedCount: completed,
      cancelledCount: cancelled,
      pendingCollectionsAmount: pendingCollections,
    };
  }, [orders]);

  // Combined Chart Buckets
  const chartBuckets = useMemo(() => {
    const bucketCount = period === "LAST_30_DAYS" ? 5 : 6;
    const startMs = currentRange.start.getTime();
    const endMs = currentRange.end.getTime();
    const intervalMs = (endMs - startMs) / bucketCount;

    const buckets: Array<{
      label: string;
      revenue: number;
      orders: number;
    }> = [];

    for (let i = 0; i < bucketCount; i++) {
      const bStart = startMs + i * intervalMs;
      const bEnd = i === bucketCount - 1 ? endMs + 1 : startMs + (i + 1) * intervalMs;

      let bRev = 0;
      let bOrders = 0;

      orders.forEach((o) => {
        if (o.orderStatus === "CANCELLED") return;
        const d = getOrderRecordDate(o).getTime();
        if (d >= bStart && d < bEnd) {
          bRev += o.pricing?.finalConfirmedPrice || 0;
          bOrders += 1;
        }
      });

      const sDate = new Date(bStart);
      const eDate = new Date(Math.min(bEnd, endMs));
      const sDay = sDate.getDate();
      const sMo = MONTH_NAMES[sDate.getMonth()];
      const eDay = eDate.getDate();
      const eMo = MONTH_NAMES[eDate.getMonth()];
      const label = sMo === eMo ? `${sDay} - ${eDay} ${sMo}` : `${sDay} ${sMo} - ${eDay} ${eMo}`;

      buckets.push({
        label,
        revenue: bRev,
        orders: bOrders,
      });
    }

    return buckets;
  }, [orders, currentRange, period, getOrderRecordDate]);

  const maxBucketRevenue = useMemo(
    () => Math.max(...chartBuckets.map((b) => b.revenue), 1),
    [chartBuckets]
  );
  const maxBucketOrders = useMemo(
    () => Math.max(...chartBuckets.map((b) => b.orders), 1),
    [chartBuckets]
  );

  // Status Summary Click Handler: scrolls down and selects filter
  const handleStatusSummaryClick = (status: "ALL" | OrderStatus) => {
    setOrdersStatusFilter(status);
    // Expand orders panel if collapsed
    setCollapsed((prev) => ({ ...prev, orders: false }));

    const el = document.getElementById("orders-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filtered Orders for the ONE table
  const displayedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (ordersStatusFilter === "ALL") {
        if (o.orderStatus === "CANCELLED") return false; // Default active confirmed orders
      } else {
        if (o.orderStatus !== ordersStatusFilter) return false;
      }

      if (ordersSearchQuery) {
        const query = ordersSearchQuery.toLowerCase();
        const customer = (o.customer?.name || "").toLowerCase();
        const num = (o.orderNumber || "").toLowerCase();
        const event = (o.eventType || "").toLowerCase();
        const loc = (o.eventLocation || "").toLowerCase();
        if (!customer.includes(query) && !num.includes(query) && !event.includes(query) && !loc.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [orders, ordersStatusFilter, ordersSearchQuery]);

  // Upcoming Shoots: eventDate >= today, not completed, not cancelled
  const upcomingShoots = useMemo(() => {
    return orders
      .filter((o) => {
        if (o.orderStatus === "CANCELLED" || o.orderStatus === "COMPLETED") return false;
        return (o.eventDate || "") >= todayStr;
      })
      .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  }, [orders, todayStr]);

  return (
    <div className="min-h-full bg-surface-app px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-default pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-brand-blue">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary" />
              Studio Operating System
            </span>
            <span className="badge-status-neutral">
              Studio: <strong className="font-semibold text-text-primary">{studioSlug}</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
            Studio Business Dashboard
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time business performance, confirmed order lifecycle, and operational schedule.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={`/${studioSlug}/dashboard/oms`}
            className="btn-brand-blue text-xs py-2 px-3.5"
          >
            Open OMS Module →
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. BUSINESS REPORTS / BUSINESS OVERVIEW PANEL (ONE PANEL)                   */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border-default bg-surface-app/40">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => togglePanel("reports")}
              className="rounded-lg p-1 text-text-secondary hover:bg-white hover:text-text-primary transition"
              aria-label={collapsed.reports ? "Expand Business Reports" : "Collapse Business Reports"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${collapsed.reports ? "-rotate-90" : "rotate-0"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                Business Overview & Reports
              </h2>
              <p className="text-xs text-text-secondary">
                Synchronized revenue, order pipeline volume, and collection overview
              </p>
            </div>
          </div>

          {/* Shared Period Filter & Excel Export */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-text-tertiary hidden sm:inline">Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
              className="rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-semibold text-text-primary shadow-2xs focus:border-brand-blue-primary focus:outline-none"
            >
              <option value="LAST_30_DAYS">Last 30 Days (Rolling)</option>
              <option value="LAST_3_MONTHS">Last 3 Months</option>
              <option value="LAST_6_MONTHS">Last 6 Months</option>
              <option value="THIS_YEAR">This Year</option>
              <option value="LAST_YEAR">Last Year</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
            <button
              type="button"
              onClick={() =>
                exportWorkbookToExcel(`${studioSlug}_Overview_Report_${period}`, [
                  {
                    name: "Period Orders",
                    rows: periodOrders,
                    columns: [
                      { header: "Order #", key: "orderNumber", width: 22 },
                      {
                        header: "Customer",
                        key: "customer",
                        width: 24,
                        getValue: (o) => o.customer.name,
                      },
                      { header: "Event Type", key: "eventType", width: 20 },
                      { header: "Event Date", key: "eventDate", width: 14 },
                      {
                        header: "Status",
                        key: "orderStatus",
                        width: 20,
                        getValue: (o: Order) => STATUS_LABELS[o.orderStatus] || o.orderStatus,
                      },
                      {
                        header: "Confirmed Price (INR)",
                        key: "confirmedPrice",
                        type: "currency",
                        width: 18,
                        sumInTotals: true,
                        getValue: (o) => calculateOrderPaymentBreakdown(o).confirmedPrice,
                      },
                      {
                        header: "Total Paid (INR)",
                        key: "totalPaid",
                        type: "currency",
                        width: 18,
                        sumInTotals: true,
                        getValue: (o) => calculateOrderPaymentBreakdown(o).totalPaid,
                      },
                      {
                        header: "Balance Due (INR)",
                        key: "balanceDue",
                        type: "currency",
                        width: 18,
                        sumInTotals: true,
                        getValue: (o) => calculateOrderPaymentBreakdown(o).remainingAmount,
                      },
                    ],
                  },
                  {
                    name: "Trend Breakdown",
                    rows: chartBuckets,
                    columns: [
                      { header: "Period Bucket", key: "label", width: 24 },
                      {
                        header: "Orders Count",
                        key: "orders",
                        type: "number",
                        width: 16,
                        sumInTotals: true,
                      },
                      {
                        header: "Booked Revenue (INR)",
                        key: "revenue",
                        type: "currency",
                        width: 22,
                        sumInTotals: true,
                      },
                    ],
                  },
                ])
              }
              className="rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-blue-primary hover:bg-surface-app transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Export Business Overview & Period Orders to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-brand-blue-primary" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Selector (if selected) */}
        {!collapsed.reports && period === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-brand-blue-background/20 border-b border-border-default text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-secondary">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-secondary">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs text-text-primary"
              />
            </div>
          </div>
        )}

        {/* Panel Body */}
        {!collapsed.reports && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Top Metrics Row: A. Revenue | B. Orders | E. Pending Collections */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Metric 1: Revenue */}
              <div className="rounded-xl border border-border-default bg-surface-app/40 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Revenue ({periodLabel})
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-brand-blue-primary">
                    {formatCurrency(revenueCurrent)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {revDiffPercent === 0 ? (
                    <span className="font-semibold text-text-tertiary">0% vs previous period</span>
                  ) : revDiffPercent > 0 ? (
                    <span className="font-semibold text-emerald-600">
                      ↑ {revDiffPercent}% vs previous {periodLabel.toLowerCase()}
                    </span>
                  ) : (
                    <span className="font-semibold text-status-error">
                      ↓ {Math.abs(revDiffPercent)}% vs previous {periodLabel.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 2: Orders Count */}
              <div className="rounded-xl border border-border-default bg-surface-app/40 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Orders Confirmed ({periodLabel})
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-text-primary">
                    {periodOrders.length}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {ordersDiffPercent === 0 ? (
                    <span className="font-semibold text-text-tertiary">0% vs previous period</span>
                  ) : ordersDiffPercent > 0 ? (
                    <span className="font-semibold text-emerald-600">
                      ↑ {ordersDiffPercent}% vs previous {periodLabel.toLowerCase()}
                    </span>
                  ) : (
                    <span className="font-semibold text-status-error">
                      ↓ {Math.abs(ordersDiffPercent)}% vs previous {periodLabel.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 3: Pending Collections */}
              <div className="rounded-xl border border-border-default bg-surface-app/40 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-orange-primary">
                  Pending Collections
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-brand-orange-primary">
                    {formatCurrency(pendingCollectionsAmount)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  Uncollected balances across all active confirmed orders
                </p>
              </div>
            </div>

            {/* Combined Visualization: C. Revenue + Orders Graph */}
            <div className="rounded-xl border border-border-default bg-surface-app/30 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
                    Revenue & Order Volume Trend ({periodLabel})
                  </h3>
                  <p className="text-[11px] text-text-tertiary">
                    Synchronized distribution across selected time intervals
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-brand-blue-primary" />
                    <span className="text-text-secondary">Revenue (₹)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand-orange-primary" />
                    <span className="text-text-secondary">Orders</span>
                  </div>
                </div>
              </div>

              {/* Chart SVG */}
              <div className="w-full overflow-x-auto">
                <div className="min-w-[540px]">
                  <div className="h-48 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-border-default">
                    {chartBuckets.map((b, idx) => {
                      const revHeightPct = Math.max(8, Math.round((b.revenue / maxBucketRevenue) * 100));
                      const orderCount = b.orders;

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative"
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-[10px] rounded-lg px-2 py-1 pointer-events-none whitespace-nowrap z-10 shadow-md">
                            <span className="font-bold">{formatCurrency(b.revenue)}</span> · {b.orders} Orders
                          </div>

                          {/* Orders Indicator Dot */}
                          <div
                            className="mb-1.5 flex items-center justify-center h-5 w-5 rounded-full bg-brand-orange-soft border border-brand-orange-primary text-[10px] font-bold text-brand-orange-primary shrink-0"
                            title={`${orderCount} Orders`}
                          >
                            {orderCount}
                          </div>

                          {/* Revenue Bar */}
                          <div
                            style={{ height: `${revHeightPct}%` }}
                            className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-brand-blue-primary to-brand-blue-light hover:brightness-110 transition-all duration-300"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart X-Axis Labels */}
                  <div className="flex justify-between gap-3 px-2 pt-2 text-[10px] font-semibold text-text-tertiary">
                    {chartBuckets.map((b, idx) => (
                      <div key={idx} className="flex-1 text-center truncate">
                        {b.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* D. Order Status Summary (Clickable to Filter Orders Table) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-primary">
                  Order Lifecycle Summary
                </h3>
                <span className="text-[11px] text-text-tertiary">
                  Click any status below to filter the Orders table
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Total Confirmed Orders */}
                <button
                  type="button"
                  onClick={() => handleStatusSummaryClick("ALL")}
                  className={`text-left rounded-xl border p-3 transition ${
                    ordersStatusFilter === "ALL"
                      ? "border-brand-blue-primary bg-brand-blue-background/30 ring-2 ring-brand-blue-soft"
                      : "border-border-default bg-white hover:bg-surface-app"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary block">
                    Total Confirmed
                  </span>
                  <span className="text-2xl font-extrabold text-text-primary block mt-1">
                    {totalConfirmedCount}
                  </span>
                  <span className="text-[10px] text-brand-blue-primary font-semibold block mt-0.5">
                    View All Confirmed →
                  </span>
                </button>

                {/* 2. Awaiting Event */}
                <button
                  type="button"
                  onClick={() => handleStatusSummaryClick("AWAITING_EVENT")}
                  className={`text-left rounded-xl border p-3 transition ${
                    ordersStatusFilter === "AWAITING_EVENT"
                      ? "border-brand-blue-primary bg-brand-blue-background/30 ring-2 ring-brand-blue-soft"
                      : "border-border-default bg-white hover:bg-surface-app"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-blue-primary block">
                    Awaiting Event
                  </span>
                  <span className="text-2xl font-extrabold text-brand-blue-primary block mt-1">
                    {awaitingEventCount}
                  </span>
                  <span className="text-[10px] text-text-tertiary block mt-0.5">
                    Upcoming shoot schedule
                  </span>
                </button>

                {/* 3. Post-Event Workflow */}
                <button
                  type="button"
                  onClick={() => handleStatusSummaryClick("POST_EVENT_IN_PROGRESS")}
                  className={`text-left rounded-xl border p-3 transition ${
                    ordersStatusFilter === "POST_EVENT_IN_PROGRESS"
                      ? "border-brand-orange-primary bg-brand-orange-background/30 ring-2 ring-brand-orange-soft"
                      : "border-border-default bg-white hover:bg-surface-app"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-orange-primary block">
                    Post-Event Workflow
                  </span>
                  <span className="text-2xl font-extrabold text-brand-orange-primary block mt-1">
                    {postEventCount}
                  </span>
                  <span className="text-[10px] text-text-tertiary block mt-0.5">
                    Editing & album pipeline
                  </span>
                </button>

                {/* 4. Completed */}
                <button
                  type="button"
                  onClick={() => handleStatusSummaryClick("COMPLETED")}
                  className={`text-left rounded-xl border p-3 transition ${
                    ordersStatusFilter === "COMPLETED"
                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200"
                      : "border-border-default bg-white hover:bg-surface-app"
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                    Completed
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-700 block mt-1">
                    {completedCount}
                  </span>
                  <span className="text-[10px] text-text-tertiary block mt-0.5">
                    Delivered & settled
                  </span>
                </button>
              </div>

              {cancelledCount > 0 && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-text-tertiary px-1">
                  <span>
                    Note: Cancelled orders ({cancelledCount}) are excluded from active operational totals.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStatusSummaryClick("CANCELLED")}
                    className={`font-semibold underline hover:text-status-error transition ${
                      ordersStatusFilter === "CANCELLED" ? "text-status-error font-bold" : ""
                    }`}
                  >
                    View Cancelled Records ({cancelledCount})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 2. ORDERS PANEL (ONE REUSABLE TABLE)                                      */}
      {/* ========================================================================= */}
      <section
        id="orders-panel"
        className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden"
      >
        {/* Panel Header & Controls */}
        <div className="p-5 border-b border-border-default bg-surface-app/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => togglePanel("orders")}
                className="rounded-lg p-1 text-text-secondary hover:bg-white hover:text-text-primary transition"
                aria-label={collapsed.orders ? "Expand Orders" : "Collapse Orders"}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${collapsed.orders ? "-rotate-90" : "rotate-0"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                  Confirmed Orders Table
                </h2>
                <p className="text-xs text-text-secondary">
                  Active studio contracts, client deliverables, and account balances · Showing {displayedOrders.length} orders
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={displayedOrders.length === 0}
                onClick={() =>
                  exportTableToExcel(
                    `${studioSlug}_Confirmed_Orders_${ordersStatusFilter}`,
                    "Confirmed Orders",
                    [
                      { header: "Order #", key: "orderNumber", width: 22 },
                      {
                        header: "Customer Name",
                        key: "customerName",
                        width: 24,
                        getValue: (o) => o.customer.name,
                      },
                      {
                        header: "Customer Phone",
                        key: "customerPhone",
                        width: 16,
                        getValue: (o) => o.customer.phone || "-",
                      },
                      { header: "Event Type", key: "eventType", width: 20 },
                      { header: "Event Date", key: "eventDate", width: 14 },
                      {
                        header: "Location",
                        key: "eventLocation",
                        width: 24,
                        getValue: (o) => o.eventLocation || "-",
                      },
                      {
                        header: "Lifecycle Status",
                        key: "orderStatus",
                        width: 22,
                        getValue: (o) => STATUS_LABELS[o.orderStatus] || o.orderStatus,
                      },
                      {
                        header: "Confirmed Price (INR)",
                        key: "confirmedPrice",
                        type: "currency",
                        width: 18,
                        sumInTotals: true,
                        getValue: (o) => calculateOrderPaymentBreakdown(o).confirmedPrice,
                      },
                      {
                        header: "Total Paid (INR)",
                        key: "totalPaid",
                        type: "currency",
                        width: 18,
                        sumInTotals: true,
                        getValue: (o) => calculateOrderPaymentBreakdown(o).totalPaid,
                      },
                      {
                        header: "Balance Due (INR)",
                        key: "balanceDue",
                        type: "currency",
                        width: 18,
                        sumInTotals: true,
                        getValue: (o) => calculateOrderPaymentBreakdown(o).remainingAmount,
                      },
                    ],
                    displayedOrders
                  )
                }
                className="rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-blue-primary hover:bg-surface-app transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Export displayed Confirmed Orders table to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-brand-blue-primary" />
                <span>Export Excel</span>
              </button>
              <Link
                href={`/${studioSlug}/dashboard/oms`}
                className="btn-brand-outline text-xs py-1.5 px-3"
              >
                Open OMS Pipeline →
              </Link>
            </div>
          </div>

          {!collapsed.orders && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              {/* Status Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(["ALL", "AWAITING_EVENT", "POST_EVENT_IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map(
                  (st) => {
                    const label =
                      st === "ALL"
                        ? "All Confirmed"
                        : st === "POST_EVENT_IN_PROGRESS"
                        ? "Post-Event"
                        : STATUS_LABELS[st];
                    const active = ordersStatusFilter === st;

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setOrdersStatusFilter(st)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "bg-brand-blue-primary text-white shadow-xs"
                            : "bg-white text-text-secondary border border-border-default hover:text-text-primary hover:bg-surface-app"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Search Bar */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={ordersSearchQuery}
                  onChange={(e) => setOrdersSearchQuery(e.target.value)}
                  placeholder="Search order, customer, shoot..."
                  className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Panel Body: Orders Table */}
        {!collapsed.orders && (
          <div className="overflow-x-auto">
            {displayedOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-tertiary space-y-2">
                <p>No orders found matching the selected filter criteria.</p>
                {ordersStatusFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setOrdersStatusFilter("ALL")}
                    className="btn-brand-outline text-xs py-1 px-3"
                  >
                    Reset Filter to All Confirmed
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-surface-app/40 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Event / Shoot</th>
                    <th className="py-3 px-4">Lifecycle Status</th>
                    <th className="py-3 px-4 text-right">Confirmed Price</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {displayedOrders.map((order) => {
                    const breakdown = calculateOrderPaymentBreakdown(order);
                    const price = breakdown.confirmedPrice;
                    const due = breakdown.remainingAmount;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-app/50 transition group"
                      >
                        {/* Order Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-brand-blue-primary whitespace-nowrap">
                          {order.orderNumber}
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-bold text-text-primary">{order.customer.name}</p>
                          {order.customer.phone && (
                            <p className="text-[11px] text-text-tertiary font-mono">{order.customer.phone}</p>
                          )}
                        </td>

                        {/* Event / Shoot */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-semibold text-text-primary">{order.eventType}</p>
                          <p className="text-[11px] text-text-tertiary">
                            {formatDisplayDate(order.eventDate)}
                            {order.eventLocation ? ` · ${order.eventLocation}` : ""}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={STATUS_COLORS[order.orderStatus] || "badge-status-neutral"}>
                            {STATUS_LABELS[order.orderStatus] || order.orderStatus}
                          </span>
                        </td>

                        {/* Confirmed Price */}
                        <td className="py-3.5 px-4 text-right font-bold text-text-primary whitespace-nowrap">
                          {formatCurrency(price)}
                        </td>

                        {/* Balance Due */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {due > 0 ? (
                            <span className="font-bold text-brand-orange-primary">
                              {formatCurrency(due)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Settled in Full</span>
                          )}
                        </td>

                        {/* Action Link */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Link
                            href={`/${studioSlug}/dashboard/oms`}
                            className="font-bold text-brand-blue-primary hover:underline"
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 3. UPCOMING SHOOTS PANEL (COMPACT OPERATIONAL SCHEDULE)                    */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-default bg-surface-app/40">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => togglePanel("shoots")}
              className="rounded-lg p-1 text-text-secondary hover:bg-white hover:text-text-primary transition"
              aria-label={collapsed.shoots ? "Expand Upcoming Shoots" : "Collapse Upcoming Shoots"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${collapsed.shoots ? "-rotate-90" : "rotate-0"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                Upcoming Shoots & Event Dates
              </h2>
              <p className="text-xs text-text-secondary">
                Time-sensitive production schedule · {upcomingShoots.length} upcoming engagements
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={upcomingShoots.length === 0}
            onClick={() =>
              exportTableToExcel(
                `${studioSlug}_Upcoming_Shoots`,
                "Upcoming Shoots",
                [
                  { header: "Order #", key: "orderNumber", width: 22 },
                  {
                    header: "Customer",
                    key: "customerName",
                    width: 24,
                    getValue: (o) => o.customer.name,
                  },
                  {
                    header: "Phone",
                    key: "phone",
                    width: 16,
                    getValue: (o) => o.customer.phone || "-",
                  },
                  { header: "Event Type", key: "eventType", width: 20 },
                  { header: "Event Date", key: "eventDate", width: 14 },
                  {
                    header: "Location",
                    key: "location",
                    width: 26,
                    getValue: (o) => o.eventLocation || "-",
                  },
                  {
                    header: "Confirmed Price (INR)",
                    key: "price",
                    type: "currency",
                    width: 18,
                    sumInTotals: true,
                    getValue: (o) => calculateOrderPaymentBreakdown(o).confirmedPrice,
                  },
                  {
                    header: "Balance Due (INR)",
                    key: "due",
                    type: "currency",
                    width: 18,
                    sumInTotals: true,
                    getValue: (o) => calculateOrderPaymentBreakdown(o).remainingAmount,
                  },
                ],
                upcomingShoots
              )
            }
            className="rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-blue-primary hover:bg-surface-app transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Export Upcoming Shoots schedule to Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand-blue-primary" />
            <span>Export Excel</span>
          </button>
        </div>

        {/* Panel Body */}
        {!collapsed.shoots && (
          <div className="p-5">
            {upcomingShoots.length === 0 ? (
              <p className="py-6 text-center text-xs text-text-tertiary">
                No upcoming shoots scheduled in the immediate pipeline.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingShoots.map((shoot) => {
                  const shootDate = parseDateOnly(shoot.eventDate);
                  const diffDays = Math.round(
                    (shootDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
                  );

                  let countdownLabel = `In ${diffDays} days`;
                  let countdownBadge = "badge-status-neutral";

                  if (diffDays === 0) {
                    countdownLabel = "Today";
                    countdownBadge = "badge-brand-orange font-bold";
                  } else if (diffDays === 1) {
                    countdownLabel = "Tomorrow";
                    countdownBadge = "badge-brand-blue font-bold";
                  }

                  return (
                    <div
                      key={shoot.id}
                      className="rounded-xl border border-border-default bg-surface-app/40 p-3.5 space-y-2 hover:bg-white hover:border-brand-blue-light transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-brand-blue-primary">
                          {shoot.orderNumber}
                        </span>
                        <span className={countdownBadge}>{countdownLabel}</span>
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold text-text-primary truncate">
                          {shoot.customer.name}
                        </h4>
                        <p className="text-[11px] text-text-secondary">
                          {shoot.eventType}
                        </p>
                      </div>

                      <div className="pt-1 border-t border-border-default/60 flex items-center justify-between text-[11px] text-text-tertiary">
                        <span>{formatDisplayDate(shoot.eventDate)}</span>
                        <Link
                          href={`/${studioSlug}/dashboard/oms`}
                          className="font-bold text-brand-blue-primary hover:underline text-[10px]"
                        >
                          Details →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. STUDIO MARKETPLACE LEADS PANEL (ONLY WHEN ENABLED & RELEVANT)           */}
      {/* ========================================================================= */}
      {isMarketplaceEnabled && marketplaceLeads.length > 0 && (
        <section className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-5 border-b border-border-default bg-surface-app/40">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => togglePanel("marketplace")}
                className="rounded-lg p-1 text-text-secondary hover:bg-white hover:text-text-primary transition"
                aria-label={collapsed.marketplace ? "Expand Marketplace Leads" : "Collapse Marketplace Leads"}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${collapsed.marketplace ? "-rotate-90" : "rotate-0"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">
                  Studio Marketplace Leads
                </h2>
                <p className="text-xs text-text-secondary">
                  Direct client booking requests and marketplace inquiries
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={marketplaceLeads.length === 0}
                onClick={() =>
                  exportTableToExcel(
                    `${studioSlug}_Marketplace_Leads`,
                    "Marketplace Leads",
                    [
                      {
                        header: "Client Name",
                        key: "customerName",
                        width: 24,
                        getValue: (l) => l.customerName || "Direct Client",
                      },
                      {
                        header: "Client Phone",
                        key: "customerPhone",
                        width: 16,
                        getValue: (l) => l.customerPhone || "-",
                      },
                      {
                        header: "Package / Event",
                        key: "packageName",
                        width: 26,
                        getValue: (l) => l.packageName || l.eventType || "Custom Inquiry",
                      },
                      { header: "Event Date", key: "eventDate", width: 14 },
                      { header: "Lead Status", key: "bookingStatus", width: 20 },
                      {
                        header: "Agreed / Quoted Price (INR)",
                        key: "agreedPrice",
                        type: "currency",
                        width: 22,
                        sumInTotals: true,
                        getValue: (l) => l.agreedPrice || l.originalPrice || 0,
                      },
                    ],
                    marketplaceLeads
                  )
                }
                className="rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-blue-primary hover:bg-surface-app transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                title="Export Marketplace Leads to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-brand-blue-primary" />
                <span>Export Excel</span>
              </button>
              <Link
                href={`/${studioSlug}/dashboard/marketplace`}
                className="btn-brand-outline text-xs py-1.5 px-3"
              >
                Open Marketplace →
              </Link>
            </div>
          </div>

          {/* Panel Body */}
          {!collapsed.marketplace && (
            <div className="p-5">
              {leadsLoading ? (
                <p className="py-6 text-center text-xs text-text-tertiary">
                  Loading studio marketplace inquiries...
                </p>
              ) : marketplaceLeads.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-tertiary">
                  No active marketplace booking inquiries currently pending.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-default bg-surface-app/40 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                        <th className="py-2.5 px-4">Client</th>
                        <th className="py-2.5 px-4">Requested Package / Date</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Agreed / Quoted Price</th>
                        <th className="py-2.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {marketplaceLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-surface-app/40 transition">
                          <td className="py-3 px-4 font-bold text-text-primary">
                            {lead.customerName || "Direct Client"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-text-primary">{lead.packageName || "Custom Inflow"}</span>
                            <span className="text-[11px] text-text-tertiary block">
                              {formatDisplayDate(lead.eventDate)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="badge-brand-purple">
                              {lead.bookingStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-text-primary">
                            {formatCurrency(lead.agreedPrice || lead.originalPrice || 0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Link
                              href={`/${studioSlug}/dashboard/marketplace`}
                              className="font-bold text-brand-purple-primary hover:underline"
                            >
                              Review Lead →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
