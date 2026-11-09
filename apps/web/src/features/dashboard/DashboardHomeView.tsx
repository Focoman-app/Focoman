"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Order, OrderStatus } from "@focoman/types";
import { getStudioCalendarDate } from "@focoman/domain";
import { FocomanSpinner } from "@/components/FocomanSpinner";

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = "last30d" | "last3m" | "last6m" | "ytd" | "lastyear" | "custom";

interface CustomRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface PanelCollapseState {
  businessReports: boolean;
  orders: boolean;
  marketplaceLeads: boolean;
}

interface DashboardHomeViewProps {
  studioSlug: string;
  initialOrders: Order[];
  hasMarketplace: boolean;
  userId?: string;
  planTier?: "FREE" | "PROFESSIONAL" | "COMPLETE";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_EVENT: "Awaiting Event",
  POST_EVENT_IN_PROGRESS: "Post-Event In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  AWAITING_EVENT: "badge-brand-blue",
  POST_EVENT_IN_PROGRESS: "badge-brand-orange",
  COMPLETED: "badge-status-success",
  CANCELLED: "badge-status-error",
};

const PERIOD_LABELS: Record<Period, string> = {
  last30d: "Last 30 Days",
  last3m: "Last 3 Months",
  last6m: "Last 6 Months",
  ytd: "This Year",
  lastyear: "Last Year",
  custom: "Custom Range",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(
  period: Period,
  custom: CustomRange,
): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  switch (period) {
    case "last30d":
      start.setDate(now.getDate() - 30);
      break;
    case "last3m":
      start.setMonth(now.getMonth() - 3);
      break;
    case "last6m":
      start.setMonth(now.getMonth() - 6);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "lastyear":
      start = new Date(now.getFullYear() - 1, 0, 1);
      end.setFullYear(now.getFullYear() - 1, 11, 31);
      break;
    case "custom":
      return {
        start: new Date(custom.from + "T00:00:00"),
        end: new Date(custom.to + "T23:59:59"),
      };
  }
  return { start, end };
}

function formatINR(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

function formatChangePercent(
  current: number,
  previous: number,
): { pct: number; positive: boolean } | null {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), positive: pct >= 0 };
}

function getOrderDate(order: Order): Date {
  const raw = order.createdAt || order.eventDate;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PanelHeader({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-left group"
        aria-expanded={!collapsed}
      >
        <svg
          className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <h2 className="text-sm font-bold text-text-primary group-hover:text-brand-blue-primary transition">
          {title}
        </h2>
      </button>
      {children}
    </div>
  );
}

function TrendBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const change = formatChangePercent(current, previous);
  if (!change) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
        change.positive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {change.positive ? "↑" : "↓"} {change.pct}%
    </span>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

interface ChartBucket {
  label: string;
  value: number;
}

function MetricChart({
  data,
  colorClass,
  label,
  formatValue,
}: {
  data: ChartBucket[];
  colorClass: string;
  label: string;
  formatValue: (val: number) => string;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const strokeColor = colorClass.includes("orange") ? "#f97316" : "#3b82f6";

  return (
    <div className="mt-4">
      <div className="relative h-32 border-b border-border-divider pb-2 flex items-end">
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            points={data
              .map(
                (d, i) =>
                  `${(i / (data.length - 1 || 1)) * 100},${100 - (d.value / maxVal) * 100}`,
              )
              .join(" ")}
          />
          {data.map((d, i) => (
            <circle
              key={i}
              cx={(i / (data.length - 1 || 1)) * 100}
              cy={100 - (d.value / maxVal) * 100}
              r="3"
              fill="white"
              stroke={strokeColor}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Tooltip Overlay */}
        <div className="absolute inset-0 flex w-full h-full">
          {data.map((item, i) => (
            <div key={i} className="flex-1 h-full group relative">
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none left-1/2 -translate-x-1/2">
                <div className="rounded-lg bg-slate-800 text-white text-[10px] px-2 py-1.5 shadow-lg whitespace-nowrap">
                  <div className="font-bold">{item.label}</div>
                  <div className="text-white">
                    {label}: {formatValue(item.value)}
                  </div>
                </div>
                <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex mt-1 justify-between">
        {data.map((item, i) => (
          <div key={i} className="text-center flex-1">
            <span className="text-[9px] sm:text-[10px] text-text-tertiary font-medium truncate block">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardHomeView({
  studioSlug,
  initialOrders,
  hasMarketplace,
  userId,
  planTier = "COMPLETE",
}: DashboardHomeViewProps) {
  // ── Orders state ──
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // ── Revenue Period filter ──
  const [revPeriod, setRevPeriod] = useState<Period>("last30d");
  const [revCustomRange, setRevCustomRange] = useState<CustomRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [showRevCustomPicker, setShowRevCustomPicker] = useState(false);
  const [showRevPeriodMenu, setShowRevPeriodMenu] = useState(false);

  // ── Orders Period filter ──
  const [ordPeriod, setOrdPeriod] = useState<Period>("last30d");
  const [ordCustomRange, setOrdCustomRange] = useState<CustomRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [showOrdCustomPicker, setShowOrdCustomPicker] = useState(false);
  const [showOrdPeriodMenu, setShowOrdPeriodMenu] = useState(false);

  // ── Status filter for orders table ──
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    "ALL" | OrderStatus
  >("ALL");

  // ── Panel collapse state ──
  const COLLAPSE_KEY = `focoman_dash_collapse_${studioSlug}_${userId || "default"}`;
  const [collapsed, setCollapsed] = useState<PanelCollapseState>({
    businessReports: false,
    orders: false,
    marketplaceLeads: false,
  });
  const [collapseLoaded, setCollapseLoaded] = useState(false);

  // ── Load persisted collapse state ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored) {
        setCollapsed(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setCollapseLoaded(true);
  }, [COLLAPSE_KEY]);

  const togglePanel = useCallback(
    (panel: keyof PanelCollapseState) => {
      setCollapsed((prev) => {
        const next = { ...prev, [panel]: !prev[panel] };
        try {
          localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [COLLAPSE_KEY],
  );


  // ── Period calculations ──
  const getPrevRange = (start: Date, end: Date) => {
    const duration = end.getTime() - start.getTime();
    return {
      start: new Date(start.getTime() - duration),
      end: new Date(start.getTime() - 1),
    };
  };

  const revRange = useMemo(
    () => getDateRange(revPeriod, revCustomRange),
    [revPeriod, revCustomRange],
  );
  const revPrevRange = useMemo(
    () => getPrevRange(revRange.start, revRange.end),
    [revRange],
  );

  const ordRange = useMemo(
    () => getDateRange(ordPeriod, ordCustomRange),
    [ordPeriod, ordCustomRange],
  );
  const ordPrevRange = useMemo(
    () => getPrevRange(ordRange.start, ordRange.end),
    [ordRange],
  );

  // ── Filtered orders ──
  const revOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = getOrderDate(o);
        return (
          d >= revRange.start &&
          d <= revRange.end &&
          o.orderStatus !== "CANCELLED"
        );
      }),
    [orders, revRange],
  );
  const revPrevOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = getOrderDate(o);
        return (
          d >= revPrevRange.start &&
          d <= revPrevRange.end &&
          o.orderStatus !== "CANCELLED"
        );
      }),
    [orders, revPrevRange],
  );

  const ordOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = getOrderDate(o);
        return (
          d >= ordRange.start &&
          d <= ordRange.end &&
          o.orderStatus !== "CANCELLED"
        );
      }),
    [orders, ordRange],
  );
  const ordPrevOrders = useMemo(
    () =>
      orders.filter((o) => {
        const d = getOrderDate(o);
        return (
          d >= ordPrevRange.start &&
          d <= ordPrevRange.end &&
          o.orderStatus !== "CANCELLED"
        );
      }),
    [orders, ordPrevRange],
  );

  // ── KPIs ──
  const revenue = useMemo(
    () =>
      revOrders.reduce((s, o) => s + (o.pricing?.finalConfirmedPrice || 0), 0),
    [revOrders],
  );
  const prevRevenue = useMemo(
    () =>
      revPrevOrders.reduce(
        (s, o) => s + (o.pricing?.finalConfirmedPrice || 0),
        0,
      ),
    [revPrevOrders],
  );

  const orderCount = ordOrders.length;
  const prevOrderCount = ordPrevOrders.length;

  // ── Chart Helper ──
  const generateChartData = (
    period: Period,
    customRange: CustomRange,
    filteredOrders: Order[],
    isRevenue: boolean,
  ): ChartBucket[] => {
    const buckets: ChartBucket[] = [];
    const now = new Date();

    if (period === "last30d") {
      // 4 weekly buckets approx
      for (let i = 3; i >= 0; i--) {
        const bucketEnd = new Date(now);
        bucketEnd.setDate(now.getDate() - i * 7);
        const bucketStart = new Date(bucketEnd);
        bucketStart.setDate(bucketEnd.getDate() - 6);
        const matching = filteredOrders.filter((o) => {
          const d = getOrderDate(o);
          return d >= bucketStart && d <= bucketEnd;
        });
        buckets.push({
          label: `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`,
          value: isRevenue
            ? matching.reduce(
                (s, o) => s + (o.pricing?.finalConfirmedPrice || 0),
                0,
              )
            : matching.length,
        });
      }
    } else if (
      period === "last3m" ||
      period === "last6m" ||
      period === "ytd" ||
      period === "lastyear"
    ) {
      let months = period === "last3m" ? 3 : period === "last6m" ? 6 : 12;
      const year =
        period === "ytd" || period === "last3m" || period === "last6m"
          ? now.getFullYear()
          : now.getFullYear() - 1;
      const startMonth =
        period === "ytd" || period === "lastyear"
          ? 0
          : now.getMonth() - months + 1;

      for (let i = 0; i < months; i++) {
        let m = startMonth + i;
        let y = year;
        if (m < 0) {
          m += 12;
          y -= 1;
        }
        const d = new Date(y, m, 1);
        const mEnd = new Date(y, m + 1, 0, 23, 59, 59);
        const label = d.toLocaleString("default", { month: "short" });
        const matching = filteredOrders.filter((o) => {
          const od = getOrderDate(o);
          return od >= d && od <= mEnd;
        });
        buckets.push({
          label,
          value: isRevenue
            ? matching.reduce(
                (s, o) => s + (o.pricing?.finalConfirmedPrice || 0),
                0,
              )
            : matching.length,
        });
      }
    } else {
      const start = new Date(customRange.from + "T00:00:00");
      const end = new Date(customRange.to + "T23:59:59");
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const mEnd = new Date(
          cursor.getFullYear(),
          cursor.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        const label = cursor.toLocaleString("default", {
          month: "short",
          year: "2-digit",
        });
        const matching = filteredOrders.filter((o) => {
          const od = getOrderDate(o);
          return od >= cursor && od <= mEnd;
        });
        buckets.push({
          label,
          value: isRevenue
            ? matching.reduce(
                (s, o) => s + (o.pricing?.finalConfirmedPrice || 0),
                0,
              )
            : matching.length,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    return buckets;
  };

  const revChartData = useMemo(
    () => generateChartData(revPeriod, revCustomRange, revOrders, true),
    [revPeriod, revCustomRange, revOrders],
  );
  const ordChartData = useMemo(
    () => generateChartData(ordPeriod, ordCustomRange, ordOrders, false),
    [ordPeriod, ordCustomRange, ordOrders],
  );

  // ── Order status counts (all-time, not period-filtered) ──
  const activeOrders = useMemo(
    () => orders.filter((o) => o.orderStatus !== "CANCELLED"),
    [orders],
  );
  const totalConfirmed = activeOrders.length;
  const awaitingEvent = useMemo(
    () => orders.filter((o) => o.orderStatus === "AWAITING_EVENT").length,
    [orders],
  );
  const postEvent = useMemo(
    () =>
      orders.filter((o) => o.orderStatus === "POST_EVENT_IN_PROGRESS").length,
    [orders],
  );
  const completedCount = useMemo(
    () => orders.filter((o) => o.orderStatus === "COMPLETED").length,
    [orders],
  );

  // ── Pending collections (all-time, active orders) ──
  const pendingCollections = useMemo(
    () =>
      activeOrders.reduce(
        (s, o) => s + Math.max(0, o.pricing?.remainingAmount || 0),
        0,
      ),
    [activeOrders],
  );

  // ── Orders table (status-filtered) ──
  const displayedOrders = useMemo(() => {
    if (orderStatusFilter === "ALL") return activeOrders;
    return orders.filter((o) => o.orderStatus === orderStatusFilter);
  }, [orders, activeOrders, orderStatusFilter]);

  const handleStatusClick = useCallback(
    (status: "ALL" | OrderStatus) => {
      setOrderStatusFilter(status);
      if (collapsed.orders) {
        setCollapsed((prev) => {
          const next = { ...prev, orders: false };
          try {
            localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
      setTimeout(() => {
        document.getElementById("dashboard-orders-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    },
    [collapsed.orders, COLLAPSE_KEY],
  );

  // Prevent flash of wrong collapse state
  if (!collapseLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <FocomanSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* ══════════════════════════════════════
              PANEL 1: BUSINESS REPORTS
          ══════════════════════════════════════ */}
          <section className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border-divider">
          <PanelHeader
            title={planTier === "PROFESSIONAL" ? "Basic Business Dashboard" : "Business Overview & Reports"}
            collapsed={collapsed.businessReports}
            onToggle={() => togglePanel("businessReports")}
          >
            <div className="flex items-center gap-2">
              {planTier === "PROFESSIONAL" ? (
                <Link
                  href={`/checkout?studio=${studioSlug}&upgrade=reports`}
                  className="text-[10px] font-bold text-brand-orange-primary bg-brand-orange-background border border-brand-orange-soft px-2.5 py-1 rounded-lg hover:bg-orange-100/70 transition"
                >
                  Unlock Advanced Reports &amp; Excel Export (₹1,999/mo) →
                </Link>
              ) : (
                <Link
                  href={`/${studioSlug}/dashboard/reports`}
                  className="text-[11px] font-semibold text-brand-blue-primary hover:underline"
                >
                  Advanced Reports &amp; Excel Export →
                </Link>
              )}
            </div>
          </PanelHeader>
        </div>

        {!collapsed.businessReports && (
          <div className="p-3.5 sm:p-5 space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {/* --- REVENUE SECTION --- */}
              <div className="rounded-xl border border-border-default bg-surface-app/40 p-3.5 sm:p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                      Revenue
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-text-primary">
                      {formatINR(revenue)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <TrendBadge current={revenue} previous={prevRevenue} />
                      <span className="text-[10px] text-text-tertiary">
                        vs previous
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowRevPeriodMenu((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-white px-2.5 py-1 text-[10px] font-bold text-text-primary shadow-xs hover:border-brand-blue-primary transition"
                    >
                      <span className="max-w-[80px] truncate">
                        {revPeriod === "custom"
                          ? `${revCustomRange.from} – ${revCustomRange.to}`
                          : PERIOD_LABELS[revPeriod]}
                      </span>
                      <svg
                        className="h-3 w-3 text-text-tertiary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {showRevPeriodMenu && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-border-default bg-white shadow-lg overflow-hidden">
                        {(
                          Object.entries(PERIOD_LABELS) as [Period, string][]
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setRevPeriod(key as Period);
                              setShowRevPeriodMenu(false);
                              setShowRevCustomPicker(key === "custom");
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[10px] font-medium transition ${revPeriod === key ? "bg-brand-blue-primary text-white" : "text-text-primary hover:bg-surface-app"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {showRevCustomPicker && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-white p-3 mb-3">
                    <input
                      type="date"
                      value={revCustomRange.from}
                      onChange={(e) =>
                        setRevCustomRange((r) => ({
                          ...r,
                          from: e.target.value,
                        }))
                      }
                      className="text-[10px] p-1 border rounded"
                    />
                    <input
                      type="date"
                      value={revCustomRange.to}
                      onChange={(e) =>
                        setRevCustomRange((r) => ({ ...r, to: e.target.value }))
                      }
                      className="text-[10px] p-1 border rounded"
                    />
                    <button
                      onClick={() => setShowRevCustomPicker(false)}
                      className="bg-brand-blue-primary text-white text-[10px] py-1 rounded"
                    >
                      Apply
                    </button>
                  </div>
                )}
                {revChartData.length > 0 && (
                  <MetricChart
                    data={revChartData}
                    colorClass="bg-brand-blue-primary"
                    label="Revenue"
                    formatValue={formatINR}
                  />
                )}
              </div>

              {/* --- ORDERS SECTION --- */}
              <div className="rounded-xl border border-border-default bg-surface-app/40 p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                      Orders
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-text-primary">
                      {orderCount}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <TrendBadge
                        current={orderCount}
                        previous={prevOrderCount}
                      />
                      <span className="text-[10px] text-text-tertiary">
                        vs previous
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowOrdPeriodMenu((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-white px-2.5 py-1 text-[10px] font-bold text-text-primary shadow-xs hover:border-brand-orange-primary transition"
                    >
                      <span className="max-w-[80px] truncate">
                        {ordPeriod === "custom"
                          ? `${ordCustomRange.from} – ${ordCustomRange.to}`
                          : PERIOD_LABELS[ordPeriod]}
                      </span>
                      <svg
                        className="h-3 w-3 text-text-tertiary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {showOrdPeriodMenu && (
                      <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl border border-border-default bg-white shadow-lg overflow-hidden">
                        {(
                          Object.entries(PERIOD_LABELS) as [Period, string][]
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setOrdPeriod(key as Period);
                              setShowOrdPeriodMenu(false);
                              setShowOrdCustomPicker(key === "custom");
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[10px] font-medium transition ${ordPeriod === key ? "bg-brand-orange-primary text-white" : "text-text-primary hover:bg-surface-app"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {showOrdCustomPicker && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-white p-3 mb-3">
                    <input
                      type="date"
                      value={ordCustomRange.from}
                      onChange={(e) =>
                        setOrdCustomRange((r) => ({
                          ...r,
                          from: e.target.value,
                        }))
                      }
                      className="text-[10px] p-1 border rounded"
                    />
                    <input
                      type="date"
                      value={ordCustomRange.to}
                      onChange={(e) =>
                        setOrdCustomRange((r) => ({ ...r, to: e.target.value }))
                      }
                      className="text-[10px] p-1 border rounded"
                    />
                    <button
                      onClick={() => setShowOrdCustomPicker(false)}
                      className="bg-brand-orange-primary text-white text-[10px] py-1 rounded"
                    >
                      Apply
                    </button>
                  </div>
                )}
                {ordChartData.length > 0 && (
                  <MetricChart
                    data={ordChartData}
                    colorClass="bg-brand-orange-primary"
                    label="Orders"
                    formatValue={(v) => v.toString()}
                  />
                )}
              </div>

              {/* --- QUICK ACTIONS SECTION (BESIDE GRAPHS) --- */}
              <div className="rounded-xl border border-border-default bg-surface-app/40 p-3.5 sm:p-5 md:col-span-2 xl:col-span-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                        Quick Actions
                      </p>
                      <p className="text-xs font-bold text-text-primary mt-1">
                        Frequently Used Shortcuts
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-brand-blue-primary bg-brand-blue-background px-2 py-0.5 rounded border border-brand-blue-soft">
                      Shortcuts
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
                    {/* Action 1: Register Order */}
                    <Link
                      href={`/${studioSlug}/dashboard/oms?action=new-order`}
                      id="quick-action-register-order"
                      className="group flex items-center gap-3 rounded-xl border border-border-default bg-white p-2.5 sm:p-3 transition hover:border-brand-blue-primary hover:bg-brand-blue-50/40 hover:shadow-2xs"
                    >
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-brand-blue-soft bg-brand-blue-background text-brand-blue-primary shadow-2xs group-hover:bg-brand-blue-primary group-hover:text-white transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-text-primary group-hover:text-brand-blue-primary transition">
                          Register Order
                        </span>
                        <span className="block text-[10px] text-text-tertiary truncate">
                          Confirmed booking in OMS
                        </span>
                      </div>
                      <span className="text-xs font-bold text-text-tertiary group-hover:text-brand-blue-primary group-hover:translate-x-0.5 transition">
                        →
                      </span>
                    </Link>

                    {/* Action 2: Add Crew Member */}
                    <Link
                      href={`/${studioSlug}/dashboard/erp?action=add-crew`}
                      id="quick-action-add-crew"
                      className="group flex items-center gap-3 rounded-xl border border-border-default bg-white p-2.5 sm:p-3 transition hover:border-brand-purple-primary hover:bg-brand-purple-50/40 hover:shadow-2xs"
                    >
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-brand-purple-soft bg-brand-purple-background text-brand-purple-primary shadow-2xs group-hover:bg-brand-purple-primary group-hover:text-white transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-text-primary group-hover:text-brand-purple-primary transition">
                          Add Crew Member
                        </span>
                        <span className="block text-[10px] text-text-tertiary truncate">
                          Invite team member in ERP
                        </span>
                      </div>
                      <span className="text-xs font-bold text-text-tertiary group-hover:text-brand-purple-primary group-hover:translate-x-0.5 transition">
                        →
                      </span>
                    </Link>

                    {/* Action 3: New Customer */}
                    <Link
                      href={`/${studioSlug}/dashboard/crm?action=new-customer`}
                      id="quick-action-new-customer"
                      className="group flex items-center gap-3 rounded-xl border border-border-default bg-white p-2.5 sm:p-3 transition hover:border-emerald-600 hover:bg-emerald-50/40 hover:shadow-2xs"
                    >
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-text-primary group-hover:text-emerald-700 transition">
                          New Customer
                        </span>
                        <span className="block text-[10px] text-text-tertiary truncate">
                          Create client in CRM
                        </span>
                      </div>
                      <span className="text-xs font-bold text-text-tertiary group-hover:text-emerald-700 group-hover:translate-x-0.5 transition">
                        →
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border-divider mt-8 mb-8"></div>

            {/* D: Order Status Summary */}
            <div>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2 sm:mb-3">
                Order Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <button
                  onClick={() => handleStatusClick("ALL")}
                  className={`rounded-xl border p-2.5 sm:p-3.5 text-left transition hover:shadow-sm group ${
                    orderStatusFilter === "ALL"
                      ? "border-brand-blue-primary bg-brand-blue-background shadow-xs"
                      : "border-border-default bg-surface-app/50 hover:border-brand-blue-light hover:bg-white"
                  }`}
                >
                  <p className="text-[10px] sm:text-[11px] font-semibold text-text-secondary">
                    Total Confirmed
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-extrabold text-text-primary">
                    {totalConfirmed}
                  </p>
                  <p className="mt-0.5 text-[9px] sm:text-[10px] text-text-tertiary">
                    All active orders
                  </p>
                </button>

                <button
                  onClick={() => handleStatusClick("AWAITING_EVENT")}
                  className={`rounded-xl border p-2.5 sm:p-3.5 text-left transition hover:shadow-sm group ${
                    orderStatusFilter === "AWAITING_EVENT"
                      ? "border-brand-blue-primary bg-brand-blue-background shadow-xs"
                      : "border-border-default bg-surface-app/50 hover:border-brand-blue-light hover:bg-white"
                  }`}
                >
                  <p className="text-[10px] sm:text-[11px] font-semibold text-text-secondary">
                    Awaiting Event
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-extrabold text-brand-blue-primary">
                    {awaitingEvent}
                  </p>
                  <p className="mt-0.5 text-[9px] sm:text-[10px] text-text-tertiary">
                    Upcoming shoots
                  </p>
                </button>

                <button
                  onClick={() => handleStatusClick("POST_EVENT_IN_PROGRESS")}
                  className={`rounded-xl border p-2.5 sm:p-3.5 text-left transition hover:shadow-sm group ${
                    orderStatusFilter === "POST_EVENT_IN_PROGRESS"
                      ? "border-brand-orange-primary bg-brand-orange-background shadow-xs"
                      : "border-border-default bg-surface-app/50 hover:border-brand-orange-light hover:bg-white"
                  }`}
                >
                  <p className="text-[10px] sm:text-[11px] font-semibold text-text-secondary">
                    Post-Event
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-extrabold text-brand-orange-primary">
                    {postEvent}
                  </p>
                  <p className="mt-0.5 text-[9px] sm:text-[10px] text-text-tertiary">
                    In production
                  </p>
                </button>

                <button
                  onClick={() => handleStatusClick("COMPLETED")}
                  className={`rounded-xl border p-2.5 sm:p-3.5 text-left transition hover:shadow-sm group ${
                    orderStatusFilter === "COMPLETED"
                      ? "border-emerald-500 bg-emerald-50 shadow-xs"
                      : "border-border-default bg-surface-app/50 hover:border-emerald-200 hover:bg-white"
                  }`}
                >
                  <p className="text-[10px] sm:text-[11px] font-semibold text-text-secondary">
                    Completed
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-extrabold text-emerald-700">
                    {completedCount}
                  </p>
                  <p className="mt-0.5 text-[9px] sm:text-[10px] text-text-tertiary">
                    Delivered &amp; closed
                  </p>
                </button>
              </div>
              <p className="mt-2 text-[10px] text-text-tertiary">
                Click a status to filter the Orders table below.
              </p>
            </div>

            {/* E: Pending Collections */}
            <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/40 px-4 py-3 sm:px-5 sm:py-4">
              <div>
                <p className="text-xs font-semibold text-brand-orange-primary">
                  Pending Collections
                </p>
                <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-extrabold text-brand-orange-primary">
                  {formatINR(pendingCollections)}
                </p>
                <p className="mt-0.5 text-[10px] sm:text-[11px] text-brand-orange-primary/70">
                  Outstanding balance from active orders
                </p>
              </div>
              <svg
                className="h-7 w-7 sm:h-8 sm:w-8 text-brand-orange-primary/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════
          PANEL 2: ORDERS TABLE
      ══════════════════════════════════════ */}
      <section
        id="dashboard-orders-panel"
        className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border-divider">
          <PanelHeader
            title="Orders"
            collapsed={collapsed.orders}
            onToggle={() => togglePanel("orders")}
          >
            <div className="flex items-center gap-2">
              {orderStatusFilter !== "ALL" && (
                <span
                  className={`${STATUS_BADGE[orderStatusFilter as OrderStatus]} text-[11px] flex items-center gap-1`}
                >
                  {STATUS_LABELS[orderStatusFilter as OrderStatus]}
                  <button
                    onClick={() => setOrderStatusFilter("ALL")}
                    className="opacity-60 hover:opacity-100"
                    aria-label="Clear filter"
                  >
                    ×
                  </button>
                </span>
              )}
              <Link
                href={`/${studioSlug}/dashboard/oms`}
                className="text-[11px] font-semibold text-brand-blue-primary hover:underline"
              >
                Open OMS →
              </Link>
            </div>
          </PanelHeader>
        </div>

        {!collapsed.orders && (
          <div>
            {displayedOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-tertiary">
                {orderStatusFilter === "ALL"
                  ? "No confirmed orders yet. Use Order Management (OMS) to register your first order."
                  : `No orders with status “${STATUS_LABELS[orderStatusFilter as OrderStatus]}”.`}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-divider bg-surface-app/70 text-[11px] font-bold text-text-secondary uppercase">
                    <tr>
                      <th className="py-3 px-4">Order</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 hidden sm:table-cell">
                        Event / Shoot
                      </th>
                      <th className="py-3 px-4 hidden md:table-cell">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right hidden sm:table-cell">
                        Amount
                      </th>
                      <th className="py-3 px-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-divider">
                    {displayedOrders.slice(0, 20).map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-surface-app/50 transition cursor-pointer"
                        onClick={() => {
                          window.location.href = `/${studioSlug}/dashboard/oms?orderId=${order.id}`;
                        }}
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-brand-blue-primary font-bold">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary truncate max-w-[120px]">
                          {order.customer?.name || "\u2014"}
                        </td>
                        <td className="py-3 px-4 text-text-secondary hidden sm:table-cell truncate max-w-[140px]">
                          {order.eventType}
                          {order.eventLocation
                            ? ` · ${order.eventLocation}`
                            : ""}
                        </td>
                        <td className="py-3 px-4 text-text-tertiary hidden md:table-cell">
                          {order.eventDate || "\u2014"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={
                              STATUS_BADGE[order.orderStatus] ||
                              "badge-status-neutral"
                            }
                          >
                            {STATUS_LABELS[order.orderStatus] ||
                              order.orderStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-text-primary hidden sm:table-cell">
                          {formatINR(order.pricing?.finalConfirmedPrice || 0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(order.pricing?.remainingAmount || 0) > 0 ? (
                            <span className="font-bold text-brand-orange-primary">
                              {formatINR(order.pricing.remainingAmount)}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium text-[11px]">
                              Paid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {displayedOrders.length > 20 && (
                  <div className="px-4 py-3 border-t border-border-divider text-center">
                    <Link
                      href={`/${studioSlug}/dashboard/oms`}
                      className="text-xs font-bold text-brand-blue-primary hover:underline"
                    >
                      View all {displayedOrders.length} orders in Order
                      Management →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════
          PANEL 4: MARKETPLACE LEADS (conditional)
      ══════════════════════════════════════ */}
      {hasMarketplace && (
        <section className="rounded-2xl border border-border-default bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-border-divider">
            <PanelHeader
              title="Studio Marketplace Leads"
              collapsed={collapsed.marketplaceLeads}
              onToggle={() => togglePanel("marketplaceLeads")}
            >
              <Link
                href={`/${studioSlug}/dashboard/marketplace`}
                className="text-[11px] font-semibold text-brand-blue-primary hover:underline"
              >
                Manage →
              </Link>
            </PanelHeader>
          </div>

          {!collapsed.marketplaceLeads && (
            <div className="p-5">
              <div className="rounded-xl border border-dashed border-border-default p-6 text-center">
                <svg
                  className="h-8 w-8 text-text-tertiary mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <p className="text-xs font-semibold text-text-primary">
                  Marketplace Active
                </p>
                <p className="text-[11px] text-text-secondary mt-1">
                  View and manage incoming booking leads from the Studio
                  Marketplace.
                </p>
                <Link
                  href={`/${studioSlug}/dashboard/marketplace`}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-primary shadow-2xs hover:border-brand-blue-primary hover:text-brand-blue-primary transition"
                >
                  Open Marketplace Profile →
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
