"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Order, Task, StudioMember } from "@focoman/types";
import { calculateOrderPaymentBreakdown } from "@focoman/domain";
import { FileSpreadsheet, TrendingUp, Lock, Users } from "lucide-react";
import { exportWorkbookToExcel } from "@/utils/excelExport";
import type { StudioSubscriptionTier } from "@/lib/proEntitlements";

interface BusinessReportsViewProps {
  studioSlug: string;
  initialOrders: Order[];
  initialTasks?: Task[];
  initialMembers?: StudioMember[];
  studioTier?: StudioSubscriptionTier;
}

type Timeframe = "all" | "ytd" | "last6m" | "last30d";

export function BusinessReportsView({
  studioSlug,
  initialOrders,
  initialTasks = [],
  initialMembers = [],
  studioTier = "COMPLETE",
}: BusinessReportsViewProps) {
  const [orders] = useState<Order[]>(initialOrders);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  const isCompleteTier = studioTier === "COMPLETE";

  // Filter orders by timeframe
  const filteredOrders = useMemo(() => {
    if (timeframe === "all") return orders;

    const now = new Date();
    return orders.filter((o) => {
      const orderDate = new Date(o.eventDate || o.createdAt);
      if (isNaN(orderDate.getTime())) return true;

      if (timeframe === "last30d") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return orderDate >= thirtyDaysAgo;
      }

      if (timeframe === "last6m") {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        return orderDate >= sixMonthsAgo;
      }

      if (timeframe === "ytd") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return orderDate >= startOfYear;
      }

      return true;
    });
  }, [orders, timeframe]);

  const activeFilteredOrders = useMemo(
    () => filteredOrders.filter((o) => o.orderStatus !== "CANCELLED"),
    [filteredOrders]
  );

  const totalRevenue = useMemo(
    () =>
      activeFilteredOrders.reduce(
        (sum, o) => sum + calculateOrderPaymentBreakdown(o).confirmedPrice,
        0
      ),
    [activeFilteredOrders]
  );

  const collectedRevenue = useMemo(
    () =>
      activeFilteredOrders.reduce(
        (sum, o) => sum + calculateOrderPaymentBreakdown(o).totalPaid,
        0
      ),
    [activeFilteredOrders]
  );

  const pendingReceivables = useMemo(
    () =>
      activeFilteredOrders.reduce(
        (sum, o) => sum + calculateOrderPaymentBreakdown(o).remainingAmount,
        0
      ),
    [activeFilteredOrders]
  );

  const totalOrdersCount = filteredOrders.length;
  const completedOrdersCount = filteredOrders.filter((o) => o.orderStatus === "COMPLETED").length;
  const inProgressOrdersCount = filteredOrders.filter(
    (o) => o.orderStatus === "POST_EVENT_IN_PROGRESS" || o.orderStatus === "AWAITING_EVENT"
  ).length;
  const avgOrderValue =
    activeFilteredOrders.length > 0 ? Math.round(totalRevenue / activeFilteredOrders.length) : 0;
  const collectionRate = totalRevenue > 0 ? Math.round((collectedRevenue / totalRevenue) * 100) : 0;

  // Period-over-Period Growth Metrics (RPT-002: Last 30d vs Prior 30d)
  const periodGrowth = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const last30Start = now - 30 * dayMs;
    const prev30Start = now - 60 * dayMs;

    let currentRev = 0;
    let prevRev = 0;
    let currentCount = 0;
    let prevCount = 0;

    orders
      .filter((o) => o.orderStatus !== "CANCELLED")
      .forEach((o) => {
        const ts = new Date(o.createdAt || o.eventDate).getTime();
        if (isNaN(ts)) return;
        const rev = calculateOrderPaymentBreakdown(o).confirmedPrice;
        if (ts >= last30Start) {
          currentRev += rev;
          currentCount += 1;
        } else if (ts >= prev30Start && ts < last30Start) {
          prevRev += rev;
          prevCount += 1;
        }
      });

    const revPct =
      prevRev > 0
        ? Math.round(((currentRev - prevRev) / prevRev) * 100)
        : currentRev > 0
        ? 100
        : 0;
    const orderPct =
      prevCount > 0
        ? Math.round(((currentCount - prevCount) / prevCount) * 100)
        : currentCount > 0
        ? 100
        : 0;

    return { revPct, orderPct, currentCount, prevCount };
  }, [orders]);

  // Pending balance orders
  const pendingOrders = useMemo(() => {
    return activeFilteredOrders
      .filter((o) => calculateOrderPaymentBreakdown(o).remainingAmount > 0)
      .sort(
        (a, b) =>
          calculateOrderPaymentBreakdown(b).remainingAmount -
          calculateOrderPaymentBreakdown(a).remainingAmount
      );
  }, [activeFilteredOrders]);

  // Shoot Category Breakdown
  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();

    filteredOrders.forEach((o) => {
      const type = o.eventType || "Other Photography";
      const current = map.get(type) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += o.pricing?.finalConfirmedPrice || 0;
      map.set(type, current);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
        pct: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, totalRevenue]);

  // Crew Productivity Analytics (RPT-002)
  const crewProductivity = useMemo(() => {
    const map = new Map<
      string,
      {
        memberId: string;
        name: string;
        skills: string;
        shootsAssigned: number;
        tasksAssigned: number;
        tasksCompleted: number;
        reworkCount: number;
        turnaroundDaysTotal: number;
        turnaroundSamples: number;
      }
    >();

    initialMembers.forEach((m) => {
      map.set(m.id, {
        memberId: m.id,
        name: m.name,
        skills: (m.skills || []).join(", ") || "General",
        shootsAssigned: 0,
        tasksAssigned: 0,
        tasksCompleted: 0,
        reworkCount: 0,
        turnaroundDaysTotal: 0,
        turnaroundSamples: 0,
      });
    });

    filteredOrders.forEach((o) => {
      (o.assignedResources || []).forEach((r) => {
        if (!r.memberId || r.memberId === "unassigned") return;
        const existing = map.get(r.memberId) || {
          memberId: r.memberId,
          name: r.memberName || "Crew Member",
          skills: r.skill || "General",
          shootsAssigned: 0,
          tasksAssigned: 0,
          tasksCompleted: 0,
          reworkCount: 0,
          turnaroundDaysTotal: 0,
          turnaroundSamples: 0,
        };
        existing.shootsAssigned += 1;
        map.set(r.memberId, existing);
      });
    });

    const filteredOrderIds = new Set(filteredOrders.map((o) => o.id));

    initialTasks.forEach((t) => {
      if (!filteredOrderIds.has(t.orderId)) return;
      if (!t.assignedMemberId || t.assignedMemberId === "unassigned") return;
      const existing = map.get(t.assignedMemberId) || {
        memberId: t.assignedMemberId,
        name: t.assignedMemberName || "Crew Member",
        skills: t.serviceCategory || "General",
        shootsAssigned: 0,
        tasksAssigned: 0,
        tasksCompleted: 0,
        reworkCount: 0,
        turnaroundDaysTotal: 0,
        turnaroundSamples: 0,
      };
      existing.tasksAssigned += 1;
      if (t.status === "COMPLETED") {
        existing.tasksCompleted += 1;
        const created = new Date(t.createdAt).getTime();
        const updated = new Date(t.updatedAt).getTime();
        if (!isNaN(created) && !isNaN(updated) && updated >= created) {
          const days = Math.max(0.5, (updated - created) / (1000 * 60 * 60 * 24));
          existing.turnaroundDaysTotal += days;
          existing.turnaroundSamples += 1;
        }
      }
      if (t.status === "REWORK" || (t.reworkNotes && t.reworkNotes.trim().length > 0)) {
        existing.reworkCount += 1;
      }
      map.set(t.assignedMemberId, existing);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        completionRate:
          item.tasksAssigned > 0 ? Math.round((item.tasksCompleted / item.tasksAssigned) * 100) : 100,
        avgTurnaroundDays:
          item.turnaroundSamples > 0
            ? Number((item.turnaroundDaysTotal / item.turnaroundSamples).toFixed(1))
            : 1.5,
      }))
      .sort((a, b) => b.tasksCompleted + b.shootsAssigned - (a.tasksCompleted + a.shootsAssigned));
  }, [initialMembers, filteredOrders, initialTasks]);

  // Monthly Revenue Chart
  const monthlyRevenueData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result: { month: string; revenue: number; orders: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const mName = months[mIdx];
      const y = d.getFullYear();

      const matching = orders.filter((o) => {
        const od = new Date(o.eventDate || o.createdAt);
        return od.getMonth() === mIdx && od.getFullYear() === y;
      });

      const rev = matching.reduce((sum, o) => sum + (o.pricing?.finalConfirmedPrice || 0), 0);
      result.push({
        month: `${mName} '${y.toString().slice(2)}`,
        revenue: rev,
        orders: matching.length,
      });
    }

    return result;
  }, [orders]);

  const maxMonthRev = Math.max(...monthlyRevenueData.map((m) => m.revenue), 10000);

  const handlePrint = () => {
    window.print();
  };

  const handleExportReportsExcel = useCallback(() => {
    if (!isCompleteTier) return;
    exportWorkbookToExcel(`${studioSlug}_Business_Report_${timeframe}`, [
      {
        name: "Orders & Payments Ledger",
        rows: filteredOrders,
        columns: [
          { header: "Order ID", key: "orderNumber", width: 22 },
          {
            header: "Customer Name",
            key: "customerName",
            width: 24,
            getValue: (o) => o.customer?.name || "Client",
          },
          { header: "Event Type", key: "eventType", width: 20 },
          { header: "Event Date", key: "eventDate", width: 14 },
          { header: "Order Status", key: "orderStatus", width: 22 },
          { header: "Payment Status", key: "paymentStatus", width: 18 },
          {
            header: "Confirmed Price (INR)",
            key: "confirmedPrice",
            type: "currency",
            width: 18,
            sumInTotals: true,
            getValue: (o) => calculateOrderPaymentBreakdown(o).confirmedPrice,
          },
          {
            header: "Advance Paid (INR)",
            key: "advancePaid",
            type: "currency",
            width: 18,
            sumInTotals: true,
            getValue: (o) => calculateOrderPaymentBreakdown(o).advanceAmount,
          },
          {
            header: "Installments Paid (INR)",
            key: "installmentsPaid",
            type: "currency",
            width: 20,
            sumInTotals: true,
            getValue: (o) => calculateOrderPaymentBreakdown(o).installmentsTotal,
          },
          {
            header: "Total Collected (INR)",
            key: "totalPaid",
            type: "currency",
            width: 20,
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
        name: "Pending Receivables",
        rows: pendingOrders,
        columns: [
          { header: "Order ID", key: "orderNumber", width: 22 },
          {
            header: "Customer Name",
            key: "customerName",
            width: 24,
            getValue: (o) => o.customer?.name || "Client",
          },
          {
            header: "Phone",
            key: "phone",
            width: 16,
            getValue: (o) => o.customer?.phone || "-",
          },
          { header: "Event Type", key: "eventType", width: 20 },
          { header: "Event Date", key: "eventDate", width: 14 },
          {
            header: "Total Amount (INR)",
            key: "total",
            type: "currency",
            width: 18,
            sumInTotals: true,
            getValue: (o) => calculateOrderPaymentBreakdown(o).confirmedPrice,
          },
          {
            header: "Total Paid (INR)",
            key: "paid",
            type: "currency",
            width: 18,
            sumInTotals: true,
            getValue: (o) => calculateOrderPaymentBreakdown(o).totalPaid,
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
      },
      {
        name: "Category Breakdown",
        rows: categoryStats,
        columns: [
          { header: "Event Category", key: "name", width: 26 },
          {
            header: "Shoots Booked",
            key: "count",
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
          {
            header: "Revenue Share (%)",
            key: "pct",
            width: 18,
            getValue: (c) => `${c.pct}%`,
          },
        ],
      },
      {
        name: "Monthly Revenue Trend",
        rows: monthlyRevenueData,
        columns: [
          { header: "Month", key: "month", width: 18 },
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
      {
        name: "Crew Productivity",
        rows: crewProductivity,
        columns: [
          { header: "Crew Member", key: "name", width: 24 },
          { header: "Skills", key: "skills", width: 28 },
          { header: "Shoots Assigned", key: "shootsAssigned", type: "number", width: 18, sumInTotals: true },
          { header: "Tasks Assigned", key: "tasksAssigned", type: "number", width: 18, sumInTotals: true },
          { header: "Tasks Completed", key: "tasksCompleted", type: "number", width: 18, sumInTotals: true },
          {
            header: "Completion Rate",
            key: "completionRate",
            width: 16,
            getValue: (c) => `${c.completionRate}%`,
          },
          { header: "Rework Count", key: "reworkCount", type: "number", width: 16, sumInTotals: true },
          {
            header: "Avg Turnaround (Days)",
            key: "avgTurnaroundDays",
            type: "number",
            width: 22,
          },
        ],
      },
    ]);
  }, [
    isCompleteTier,
    studioSlug,
    timeframe,
    filteredOrders,
    pendingOrders,
    categoryStats,
    monthlyRevenueData,
    crewProductivity,
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-divider pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
              {isCompleteTier ? "Business Reports & Analytics" : "Basic Business Overview"}
            </h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-amber-800 border border-amber-200">
              {isCompleteTier ? "₹1,999 Complete Analytics" : "₹999 Basic Overview"}
            </span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-text-secondary leading-relaxed">
            {isCompleteTier
              ? "Track gross studio revenue, period-over-period growth, crew productivity, and outstanding client balances."
              : "Order counts, revenue overview, and pending payment overview for your studio."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Timeframe Filter */}
          <div className="inline-flex rounded-xl border border-border-default bg-white p-1 shadow-2xs text-xs">
            <button
              onClick={() => setTimeframe("all")}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                timeframe === "all"
                  ? "bg-amber-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeframe("ytd")}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                timeframe === "ytd"
                  ? "bg-amber-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              YTD
            </button>
            <button
              onClick={() => setTimeframe("last6m")}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                timeframe === "last6m"
                  ? "bg-amber-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setTimeframe("last30d")}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${
                timeframe === "last30d"
                  ? "bg-amber-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              30 Days
            </button>
          </div>

          {isCompleteTier ? (
            <button
              type="button"
              onClick={handleExportReportsExcel}
              className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary shadow-2xs hover:bg-slate-50 hover:border-brand-blue-primary transition flex items-center gap-1.5 cursor-pointer"
              title="Export multi-sheet Business Report to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 text-brand-blue-primary" />
              <span>Export Excel</span>
            </button>
          ) : (
            <Link
              href={`/checkout?studio=${studioSlug}&plan=COMPLETE`}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition flex items-center gap-1.5"
              title="Excel Report Exports are included in the ₹1,999/month plan"
            >
              <Lock className="h-3.5 w-3.5 text-amber-700" />
              <span>Export Excel (₹1,999 Plan)</span>
            </Link>
          )}

          <button
            onClick={handlePrint}
            className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary shadow-2xs hover:bg-slate-50 transition flex items-center gap-1.5"
            title="Print or Export Summary"
          >
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards with Period-over-Period Growth Badges (RPT-002) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Booked Revenue */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
            <span>Total Booked Revenue</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              {periodGrowth.revPct >= 0 ? `+${periodGrowth.revPct}%` : `${periodGrowth.revPct}%`} 30d
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-text-primary">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            Across {totalOrdersCount} confirmed photo orders
          </p>
        </div>

        {/* Cash Collected */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
            <span>Cash Collected (Total Paid)</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-brand-blue-primary font-bold text-xs">
              ✓
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-brand-blue-primary tabular-nums">
              ₹{collectedRevenue.toLocaleString("en-IN")}
            </span>
            <span className="text-xs font-bold text-emerald-600 tabular-nums">
              ({collectionRate}%)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            Advances and recorded installments
          </p>
        </div>

        {/* Outstanding Balance Due */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-brand-orange-primary">
            <span>Pending Balance Due</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-brand-orange-primary font-bold text-xs">
              !
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-brand-orange-primary">
              ₹{pendingReceivables.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-brand-orange-primary/80 font-medium">
            Collect before releasing final albums
          </p>
        </div>

        {/* Order Count & AOV */}
        <div className="rounded-2xl border border-border-default bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
            <span>Avg Order Value (AOV)</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-brand-purple-primary">
              {periodGrowth.orderPct >= 0 ? `+${periodGrowth.orderPct}%` : `${periodGrowth.orderPct}%`} orders
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-text-primary">
              ₹{avgOrderValue.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            {completedOrdersCount} completed · {inProgressOrdersCount} in production
          </p>
        </div>
      </div>

      {/* Advanced Business Reports & Analytics (Gated to ₹1,999/month COMPLETE Plan — RPT-001, RPT-002) */}
      {isCompleteTier ? (
        <>
          {/* Monthly Revenue Curves & Shoot Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Revenue Bars (2 Columns) */}
            <div className="lg:col-span-2 rounded-2xl border border-border-default bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">
                      Monthly Studio Revenue Trend
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Monthly booked shoot earnings and peak wedding season performance
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-text-secondary uppercase">
                    Last 6 Months
                  </span>
                </div>

                {/* Visual Bar Chart */}
                <div className="mt-8 grid grid-cols-6 gap-2 sm:gap-4 items-end h-48 border-b border-border-divider pb-3">
                  {monthlyRevenueData.map((item, idx) => {
                    const heightPct = Math.max(12, Math.round((item.revenue / maxMonthRev) * 100));
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                        <span className="text-[10px] font-extrabold text-text-secondary opacity-0 group-hover:opacity-100 transition">
                          ₹{item.revenue > 0 ? (item.revenue / 1000).toFixed(0) + "k" : "0"}
                        </span>
                        <div className="w-full max-w-[48px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-full">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t-lg transition-all duration-300 ${
                              item.revenue > 0
                                ? "bg-amber-500 group-hover:bg-amber-600 shadow-xs"
                                : "bg-slate-200"
                            }`}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-text-primary truncate">
                          {item.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border-divider/50 flex flex-wrap items-center justify-between text-xs text-text-secondary gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-amber-500 inline-block" />
                  <span>Confirmed Shoot Revenue</span>
                </div>
                <span>High season tips: Advance bookings secure cash flow for off-season months.</span>
              </div>
            </div>

            {/* Most Profitable Shoot Categories (1 Column) */}
            <div className="rounded-2xl border border-border-default bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">
                  Shoot Category Profitability
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Which photography packages generate the highest revenue
                </p>

                <div className="mt-6 space-y-4">
                  {categoryStats.length === 0 ? (
                    <p className="text-xs text-text-secondary py-8 text-center">No shoot category data available</p>
                  ) : (
                    categoryStats.map((cat, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-text-primary">{cat.name}</span>
                          <span className="font-extrabold text-text-primary">
                            ₹{cat.revenue.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            style={{ width: `${cat.pct}%` }}
                            className={`h-full rounded-full ${
                              idx === 0
                                ? "bg-amber-500"
                                : idx === 1
                                ? "bg-brand-blue-primary"
                                : idx === 2
                                ? "bg-brand-purple-primary"
                                : "bg-slate-400"
                            }`}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-text-secondary">
                          <span>{cat.count} shoots booked</span>
                          <span>{cat.pct}% of total studio sales</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border-divider">
                <p className="text-[11px] text-text-secondary">
                  <strong>Pro Tip:</strong> Focus marketing on your highest margin package categories to maximize studio net profits.
                </p>
              </div>
            </div>
          </div>

          {/* Crew Productivity & Operational Efficiency Table (RPT-002) */}
          <div className="rounded-2xl border border-border-default bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-purple-primary" />
                  <span>Crew Productivity &amp; Turnaround Analytics</span>
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Evaluate team workload, post-event task completion rate, rework frequency, and average delivery turnaround.
                </p>
              </div>
              <span className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold text-brand-purple-primary">
                {crewProductivity.length} Active Crew Tracked
              </span>
            </div>

            {crewProductivity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-default p-8 text-center text-xs text-text-secondary">
                No crew assignments or production tasks recorded yet. Assign crew in OMS or ERP to track productivity.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-divider bg-slate-50 text-[11px] font-bold text-text-secondary uppercase">
                    <tr>
                      <th className="py-3 px-4">Crew Member</th>
                      <th className="py-3 px-4">Certified Skills</th>
                      <th className="py-3 px-4">Shoots Assigned</th>
                      <th className="py-3 px-4">Tasks Completed</th>
                      <th className="py-3 px-4">Completion Rate</th>
                      <th className="py-3 px-4">Rework Count</th>
                      <th className="py-3 px-4 text-right">Avg Turnaround</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-divider">
                    {crewProductivity.map((row) => (
                      <tr key={row.memberId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-bold text-text-primary">{row.name}</td>
                        <td className="py-3 px-4 text-text-secondary">{row.skills}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-text-primary tabular-nums">
                          {row.shootsAssigned}
                        </td>
                        <td className="py-3 px-4 font-mono text-text-primary tabular-nums">
                          {row.tasksCompleted} / {row.tasksAssigned}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              row.completionRate >= 80
                                ? "bg-emerald-100 text-emerald-800"
                                : row.completionRate >= 50
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.completionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          {row.reworkCount > 0 ? (
                            <span className="text-amber-700 font-bold">{row.reworkCount} revision(s)</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-text-primary tabular-nums">
                          {row.avgTurnaroundDays}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
              <Lock className="h-3 w-3" />
              ₹1,999/month Complete Plan Feature
            </span>
            <h3 className="text-base font-extrabold text-text-primary">
              Unlock Advanced Business Reports, Crew Productivity Analytics &amp; Excel Exports
            </h3>
            <p className="text-xs text-text-secondary max-w-2xl">
              Your ₹999/month plan includes the Basic Business Dashboard (Order counts, Revenue overview, and Pending payment overview). Upgrade to the ₹1,999/month plan for Monthly Revenue Trends, Shoot Category Profitability, Crew Productivity Analytics, and multi-sheet Excel Report Exports.
            </p>
          </div>
          <Link
            href={`/checkout?studio=${studioSlug}&plan=COMPLETE`}
            className="rounded-xl bg-brand-blue-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition shrink-0"
          >
            Upgrade to ₹1,999/mo →
          </Link>
        </div>
      )}

      {/* Actionable Receivables Pipeline: Orders with Balance Due */}
      <div className="rounded-2xl border border-border-default bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <span>Pending Receivables Pipeline</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold text-brand-orange-primary">
                {pendingOrders.length} Dues
              </span>
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Orders with pending client balances. Secure balance payment before releasing final albums or raw drive links.
            </p>
          </div>

          <span className="text-xs font-bold text-text-secondary">
            Total Pending: <strong className="text-brand-orange-primary">₹{pendingReceivables.toLocaleString("en-IN")}</strong>
          </span>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default p-8 text-center text-xs text-text-secondary">
            All confirmed orders have zero outstanding balance dues! Cash flow is fully collected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-divider bg-slate-50 text-[11px] font-bold text-text-secondary uppercase">
                <tr>
                  <th className="py-3 px-4">Order ID &amp; Client</th>
                  <th className="py-3 px-4">Event Date</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Total Paid</th>
                  <th className="py-3 px-4 text-brand-orange-primary">Balance Due</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-divider">
                {pendingOrders.map((ord) => {
                  const breakdown = calculateOrderPaymentBreakdown(ord);
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text-primary">{ord.customer?.name || "Client"}</div>
                        <div className="text-[11px] text-text-secondary font-mono">
                          {ord.orderNumber || ord.id.slice(0, 8)} · {ord.eventType}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary tabular-nums">
                        {ord.eventDate || "Date TBD"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-text-primary tabular-nums">
                        ₹{breakdown.confirmedPrice.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 font-semibold tabular-nums">
                        ₹{breakdown.totalPaid.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-brand-orange-primary text-sm tabular-nums">
                        ₹{breakdown.remainingAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/${studioSlug}/dashboard/oms?orderId=${ord.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs font-bold text-text-primary shadow-2xs hover:border-brand-blue-primary hover:text-brand-blue-primary transition"
                        >
                          <span>View Order</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
