"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { Customer, Order } from "@focoman/types";
import {
  getStudioCustomersAction,
  getDeletedStudioCustomersAction,
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
  restoreCustomerAction,
} from "@/actions/customerActions";
import {
  getStudioOrdersAction,
  getDeletedStudioOrdersAction,
  restoreOrderAction,
  sendManualPaymentReminderAction,
} from "@/actions/orderActions";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { getEffectiveStudioTier, isLifetimeProEmail } from "@/lib/proEntitlements";
import { calculateOrderPaymentBreakdown } from "@focoman/domain";
import { FileSpreadsheet, Pencil, Trash2, RotateCcw, BellRing } from "lucide-react";
import { exportTableToExcel } from "@/utils/excelExport";

const STATUS_COLORS: Record<string, string> = {
  AWAITING_EVENT: "badge-brand-blue",
  POST_EVENT_IN_PROGRESS: "badge-brand-orange",
  COMPLETED: "badge-status-success",
};

const STATUS_LABELS: Record<string, string> = {
  AWAITING_EVENT: "Awaiting Event",
  POST_EVENT_IN_PROGRESS: "Post-Event In Progress",
  COMPLETED: "Completed",
};

export default function CrmPage({ params }: { params: Promise<{ studioSlug: string }> }) {
  const { studioSlug } = use(params);
  const { studio, idToken: workspaceToken, authLoading, getIdToken } = useStudioWorkspace();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<Order[]>([]);
  const [restoringOrderId, setRestoringOrderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"ACTIVE" | "DELETED">("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add / Edit Customer Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Payment Reminder state
  const [sendingReminderOrderId, setSendingReminderOrderId] = useState<string | null>(null);

  const effectiveTier = getEffectiveStudioTier(studio);
  const canExportExcel = effectiveTier === "COMPLETE";

  const showBanner = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = useCallback(async (tokenOverride?: string | null) => {
    try {
      setLoading(true);
      const token = tokenOverride ?? workspaceToken ?? (await getIdToken(false));
      if (!token) {
        setLoading(false);
        return;
      }
      const [customersData, deletedCustomersData, ordersData, deletedOrdersData] = await Promise.all([
        getStudioCustomersAction(studioSlug, token),
        getDeletedStudioCustomersAction(studioSlug, token).catch(() => [] as Customer[]),
        getStudioOrdersAction(studioSlug, token),
        getDeletedStudioOrdersAction(studioSlug, token).catch(() => [] as Order[]),
      ]);
      setCustomers(customersData);
      setDeletedCustomers(deletedCustomersData);
      setOrders(ordersData);
      setDeletedOrders(deletedOrdersData);
    } catch (err) {
      console.error("[CrmPage] Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [studioSlug, workspaceToken, getIdToken]);

  const handleRestoreOrder = async (orderId: string) => {
    try {
      setRestoringOrderId(orderId);
      const token = workspaceToken ?? (await getIdToken(false));
      if (!token) {
        showBanner("error", "Authentication session missing. Please refresh.");
        return;
      }
      const res = await restoreOrderAction({
        orderId,
        studioId: studioSlug,
        idToken: token,
      });
      if (res.success) {
        showBanner("success", "Order restored to active OMS workflows.");
        await loadData(token);
      } else {
        showBanner("error", res.error || "Failed to restore order");
      }
    } catch (err) {
      console.error("[CrmPage] Restore order error:", err);
      showBanner("error", "Failed to restore order");
    } finally {
      setRestoringOrderId(null);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      void loadData(workspaceToken);
    }
  }, [studioSlug, authLoading, workspaceToken, loadData]);

  const customerMetrics = useMemo(() => {
    const metrics: Record<string, { totalOrders: number; lifetimeValue: number; pendingReceivables: number; latestOrder: string | null }> = {};
    [...customers, ...deletedCustomers].forEach(c => {
      metrics[c.id] = { totalOrders: 0, lifetimeValue: 0, pendingReceivables: 0, latestOrder: null };
    });
    
    orders.forEach(o => {
      if (metrics[o.customer.id]) {
        metrics[o.customer.id].totalOrders += 1;
        if (o.orderStatus !== "CANCELLED") {
          const breakdown = calculateOrderPaymentBreakdown(o);
          metrics[o.customer.id].lifetimeValue += breakdown.confirmedPrice;
          metrics[o.customer.id].pendingReceivables += breakdown.remainingAmount;
        }
        
        if (!metrics[o.customer.id].latestOrder || new Date(o.createdAt) > new Date(metrics[o.customer.id].latestOrder!)) {
          metrics[o.customer.id].latestOrder = o.createdAt;
        }
      }
    });
    
    return metrics;
  }, [customers, deletedCustomers, orders]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    const token = await getIdToken(true);
    if (!token) {
      setModalError("Authentication error. Please sign in again.");
      setIsSubmitting(false);
      return;
    }

    if (editingCustomer) {
      const res = await updateCustomerAction({
        customerId: editingCustomer.id,
        studioId: studioSlug,
        updates: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
        },
        idToken: token,
      });
      setIsSubmitting(false);
      if (res.success && res.customer) {
        setShowModal(false);
        setEditingCustomer(null);
        setForm({ name: "", phone: "", email: "", address: "" });
        await loadData(token);
        setSelected(res.customer);
        showBanner("success", "Customer profile updated.");
      } else {
        setModalError(res.error || "Failed to update customer");
      }
      return;
    }

    const res = await createCustomerAction({
      idToken: token,
      studioId: studioSlug,
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
    });

    setIsSubmitting(false);

    if (res.success && res.customer) {
      setShowModal(false);
      setForm({ name: "", phone: "", email: "", address: "" });
      await loadData(token);
      setSelected(res.customer);
      showBanner("success", "Customer profile created.");
    } else {
      setModalError(res.error || "Failed to add customer");
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    const token = await getIdToken(true);
    if (!token) return;
    const res = await deleteCustomerAction({
      customerId: customer.id,
      studioId: studioSlug,
      idToken: token,
    });
    if (res.success) {
      setSelected(null);
      await loadData(token);
      showBanner("success", `Archived customer "${customer.name}".`);
    } else {
      showBanner("error", res.error || "Failed to archive customer.");
    }
  };

  const handleRestoreCustomer = async (customer: Customer) => {
    const token = await getIdToken(true);
    if (!token) return;
    const res = await restoreCustomerAction({
      customerId: customer.id,
      studioId: studioSlug,
      idToken: token,
    });
    if (res.success) {
      await loadData(token);
      setViewMode("ACTIVE");
      showBanner("success", `Restored customer "${customer.name}".`);
    } else {
      showBanner("error", res.error || "Failed to restore customer.");
    }
  };

  const handleSendPaymentReminder = async (order: Order) => {
    setSendingReminderOrderId(order.id);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await sendManualPaymentReminderAction({
        orderId: order.id,
        studioId: studioSlug,
        idToken: token,
      });
      if (res.success) {
        showBanner("success", `Payment reminder sent for Order #${order.orderNumber}.`);
      } else {
        showBanner("error", res.error || "Failed to send payment reminder.");
      }
    } finally {
      setSendingReminderOrderId(null);
    }
  };

  const activeList = viewMode === "ACTIVE" ? customers : deletedCustomers;

  const filtered = activeList.filter((c) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex flex-col h-full bg-surface-app">
      {/* Free Plan Upgrade Banner */}
      {studio && !studio.features?.crm && studio.planInfo?.plan !== "PROFESSIONAL" && studio.planInfo?.plan !== "COMPLETE" && !isLifetimeProEmail(studio.ownerEmail) && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5 flex items-center justify-between shadow-2xs z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-brand-orange-primary text-white">
              ₹999/MO PLAN
            </span>
            <span className="text-xs text-text-secondary">
              Customer Management (CRM) is included in the ₹999/month and ₹1,999/month plans. Upgrade to manage client history, receivables, and payment reminders.
            </span>
          </div>
          <Link
            href={`/checkout?studio=${studioSlug}&upgrade=crm`}
            className="text-xs font-bold text-white bg-brand-orange-primary px-3 py-1 rounded-lg hover:bg-orange-600 transition shrink-0"
          >
            Upgrade &amp; Checkout →
          </Link>
        </div>
      )}

      {statusMessage && (
        <div className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
          statusMessage.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-[11px] underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Customer List Panel */}
        <div className={`flex flex-col ${selected ? "hidden lg:flex lg:w-1/2 border-r border-border-default" : "w-full"} h-full`}>
        <header className="header-brand-orange">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="badge-brand-orange">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-orange-primary" />
                  CRM · Customer Relations
                </span>
                <span className="badge-status-neutral">
                  Studio: <strong className="font-semibold text-text-primary">{studioSlug}</strong>
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
                Customer Relationship Management
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Client records, lifetime value metrics, and booking histories · {customers.length} Confirmed Client Records
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canExportExcel ? (
                <button
                  type="button"
                  disabled={filtered.length === 0}
                  onClick={() =>
                    exportTableToExcel(
                      `${studioSlug}_Customer_CRM`,
                      "Customers",
                      [
                        { header: "Customer ID", key: "id", width: 22 },
                        { header: "Customer Name", key: "name", width: 24 },
                        {
                          header: "Phone",
                          key: "phone",
                          width: 16,
                          getValue: (c) => c.phone || "-",
                        },
                        {
                          header: "Email",
                          key: "email",
                          width: 26,
                          getValue: (c) => c.email || "-",
                        },
                        {
                          header: "Location / Address",
                          key: "address",
                          width: 26,
                          getValue: (c) => c.address || "-",
                        },
                        {
                          header: "Total Orders",
                          key: "totalOrders",
                          type: "number",
                          width: 14,
                          sumInTotals: true,
                          getValue: (c) => customerMetrics[c.id]?.totalOrders || 0,
                        },
                        {
                          header: "Lifetime Value (INR)",
                          key: "lifetimeValue",
                          type: "currency",
                          width: 20,
                          sumInTotals: true,
                          getValue: (c) => customerMetrics[c.id]?.lifetimeValue || 0,
                        },
                        {
                          header: "Pending Receivables (INR)",
                          key: "pendingReceivables",
                          type: "currency",
                          width: 22,
                          sumInTotals: true,
                          getValue: (c) => customerMetrics[c.id]?.pendingReceivables || 0,
                        },
                        {
                          header: "Latest Order Date",
                          key: "latestOrder",
                          width: 16,
                          getValue: (c) =>
                            customerMetrics[c.id]?.latestOrder
                              ? customerMetrics[c.id].latestOrder!.slice(0, 10)
                              : "-",
                        },
                      ],
                      filtered
                    )
                  }
                  className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary hover:bg-surface-app hover:border-brand-orange-primary transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Export filtered customers with LTV & pending dues to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-brand-orange-primary" />
                  <span>Export Excel</span>
                </button>
              ) : (
                <Link
                  href={`/checkout?studio=${studioSlug}&plan=COMPLETE`}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition inline-flex items-center gap-1.5"
                  title="Excel Report Exports are included in the ₹1,999/month plan"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-amber-700" />
                  <span>Export Excel (₹1,999 Plan)</span>
                </Link>
              )}
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setForm({ name: "", phone: "", email: "", address: "" });
                  setShowModal(true);
                  setModalError(null);
                }}
                className="btn-brand-orange"
              >
                + Add Customer
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              suppressHydrationWarning
              autoComplete="off"
              type="text"
              placeholder="Search by name, phone, email, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-app px-3.5 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:bg-white focus:outline-none focus:border-brand-orange-primary focus:ring-2 focus:ring-brand-orange-soft"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewMode("ACTIVE");
                  setSelected(null);
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  viewMode === "ACTIVE"
                    ? "bg-brand-orange-primary text-white"
                    : "border border-border-default bg-white text-text-secondary hover:text-text-primary"
                }`}
              >
                Active Clients ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("DELETED");
                  setSelected(null);
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  viewMode === "DELETED"
                    ? "bg-red-600 text-white"
                    : "border border-border-default bg-white text-text-secondary hover:text-text-primary"
                }`}
              >
                Archived / Deleted ({deletedCustomers.length})
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {loading && activeList.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-tertiary">Loading customers...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default bg-white p-8 text-center text-xs text-text-tertiary">
              {search
                ? `No customer found matching "${search}".`
                : viewMode === "DELETED"
                ? "No archived customers."
                : "No customers registered yet. Clients from confirmed orders appear here."}
            </div>
          ) : (
            filtered.map((cus) => {
              const metrics = customerMetrics[cus.id];
              return (
                <div
                  key={cus.id}
                  onClick={() => setSelected(cus.id === selected?.id ? null : cus)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    selected?.id === cus.id
                      ? "card-brand-orange"
                      : "border-border-default bg-white hover:border-brand-orange-light hover:shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-text-primary">{cus.name}</p>
                        {cus.isDeleted && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">{cus.phone || "No phone registered"} {cus.email ? `· ${cus.email}` : ""}</p>
                      <div className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold">
                        <span className="badge-brand-blue">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary" />
                          {metrics?.totalOrders || 0} Orders
                        </span>
                        <span className="badge-brand-orange">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-orange-primary" />
                          ₹{((metrics?.lifetimeValue || 0) / 1000).toFixed(1)}K LTV
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-2">
                      <span className="badge-status-neutral">
                        {cus.createdAt ? new Date(cus.createdAt).toLocaleDateString() : "Active"}
                      </span>
                      {cus.isDeleted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRestoreCustomer(cus);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200 transition"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Customer Detail Panel */}
      {selected && (
        <div className="w-full lg:w-1/2 flex flex-col h-full overflow-y-auto bg-white border-l border-border-default">
          <div className="sticky top-0 z-10 border-b border-border-default bg-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange-primary">Client Profile</span>
              <h2 className="font-extrabold text-base text-text-primary">{selected.name}</h2>
              <p className="text-xs text-text-secondary">{selected.phone || "No phone registered"}</p>
            </div>
            <div className="flex items-center gap-2">
              {!selected.isDeleted ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCustomer(selected);
                      setForm({
                        name: selected.name || "",
                        phone: selected.phone || "",
                        email: selected.email || "",
                        address: selected.address || "",
                      });
                      setModalError(null);
                      setShowModal(true);
                    }}
                    className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-orange-primary inline-flex items-center gap-1.5 transition"
                  >
                    <Pencil className="h-3.5 w-3.5 text-brand-orange-primary" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCustomer(selected)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Archive</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleRestoreCustomer(selected)}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Client</span>
                </button>
              )}
              <button
                onClick={() => setSelected(null)}
                className="btn-brand-outline py-1.5 px-3 text-xs flex items-center gap-1"
              >
                <span>←</span>
                <span>Back</span>
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-brand-orange-soft bg-brand-orange-background/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange-primary mb-1">Total Lifetime Value</p>
                <p className="text-2xl font-extrabold text-text-primary">₹{customerMetrics[selected.id]?.lifetimeValue?.toLocaleString() || 0}</p>
                <p className="text-xs text-text-secondary mt-1">{customerMetrics[selected.id]?.totalOrders || 0} Confirmed Orders</p>
              </div>
              <div className="rounded-2xl border border-border-default p-4 bg-surface-app">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Pending Dues</p>
                <p className={`text-2xl font-extrabold ${(customerMetrics[selected.id]?.pendingReceivables || 0) > 0 ? "text-brand-orange-primary" : "text-emerald-600"}`}>
                  ₹{customerMetrics[selected.id]?.pendingReceivables?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-text-secondary mt-1">Remaining Balance</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border-default p-4 space-y-3 bg-surface-app/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Contact Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-text-tertiary">Phone</p><p className="font-semibold text-text-primary mt-0.5">{selected.phone || "-"}</p></div>
                <div><p className="text-text-tertiary">Email</p><p className="font-semibold text-text-primary mt-0.5">{selected.email || "-"}</p></div>
                <div className="col-span-2"><p className="text-text-tertiary">Address</p><p className="font-semibold text-text-primary mt-0.5">{selected.address || "-"}</p></div>
                <div><p className="text-text-tertiary">Registered Date</p><p className="font-semibold text-text-primary mt-0.5">{selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : "-"}</p></div>
              </div>
            </div>

            <div className="rounded-2xl border border-border-default p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Order History &amp; Receivables</h3>
                <span className="text-[10px] font-semibold text-text-tertiary">
                  {orders.filter(o => o.customer.id === selected.id).length} Active
                  {deletedOrders.filter(o => o.customer.id === selected.id || (o.customer.phone && o.customer.phone === selected.phone)).length > 0 && 
                    ` · ${deletedOrders.filter(o => o.customer.id === selected.id || (o.customer.phone && o.customer.phone === selected.phone)).length} Deleted`}
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Active Orders */}
                {orders.filter(o => o.customer.id === selected.id).map(order => {
                  const breakdown = calculateOrderPaymentBreakdown(order);
                  return (
                    <div key={order.id} className="p-3.5 rounded-xl border border-border-default bg-surface-app/50 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-text-primary">{order.eventType}</p>
                          <p className="text-[11px] text-text-secondary mt-0.5 font-mono">
                            <span className="font-bold text-brand-blue-primary">{order.orderNumber}</span> · {new Date(order.eventDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-text-primary">₹{order.pricing.finalConfirmedPrice.toLocaleString()}</p>
                          <span className={`mt-1 inline-block ${STATUS_COLORS[order.orderStatus] || "badge-status-neutral"}`}>
                            {STATUS_LABELS[order.orderStatus] || order.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      {breakdown.remainingAmount > 0 && order.orderStatus !== "CANCELLED" && (
                        <div className="flex items-center justify-between pt-2 border-t border-border-default text-xs">
                          <span className="text-brand-orange-primary font-bold">
                            Balance Due: ₹{breakdown.remainingAmount.toLocaleString("en-IN")}
                          </span>
                          <div className="flex items-center gap-2">
                            {selected.email && (
                              <button
                                type="button"
                                disabled={sendingReminderOrderId === order.id}
                                onClick={() => void handleSendPaymentReminder(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-orange-soft bg-white px-2.5 py-1 text-[11px] font-bold text-brand-orange-primary hover:bg-brand-orange-background transition disabled:opacity-50"
                              >
                                <BellRing className="h-3 w-3" />
                                {sendingReminderOrderId === order.id ? "Sending..." : "Email Reminder"}
                              </button>
                            )}
                            {selected.phone && (
                              <a
                                href={`https://wa.me/${selected.phone.replace(/\D/g, "").length === 10 ? `91${selected.phone.replace(/\D/g, "")}` : selected.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                  `Hello ${selected.name}, this is a gentle reminder from ${studio?.name || studioSlug} regarding the pending balance of ₹${breakdown.remainingAmount.toLocaleString("en-IN")} for Order #${order.orderNumber} (${order.eventType}).`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                              >
                                WhatsApp Reminder
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Deleted Orders (14-Day Recovery View) */}
                {deletedOrders
                  .filter(o => o.customer.id === selected.id || (o.customer.phone && o.customer.phone === selected.phone) || (o.customer.email && o.customer.email === selected.email))
                  .map(delOrder => {
                    const deletedTimestamp = delOrder.deletedAt ? new Date(delOrder.deletedAt).getTime() : Date.now();
                    const daysElapsed = Math.floor((Date.now() - deletedTimestamp) / (1000 * 60 * 60 * 24));
                    const daysRemaining = Math.max(0, 14 - daysElapsed);
                    const isRecoverable = daysElapsed <= 14;

                    return (
                      <div key={delOrder.id} className="p-3.5 rounded-xl border border-dashed border-red-200 bg-red-50/40 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                {isRecoverable ? `Deleted (${daysRemaining}d to recover)` : "Archived / Expired"}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-text-primary">{delOrder.eventType}</p>
                            <p className="text-[11px] text-text-secondary font-mono">
                              <span className="font-semibold text-text-tertiary">{delOrder.orderNumber}</span> · {delOrder.eventDate ? new Date(delOrder.eventDate).toLocaleDateString() : "No date"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-text-secondary">₹{delOrder.pricing?.finalConfirmedPrice?.toLocaleString() || 0}</p>
                            {isRecoverable && (
                              <button
                                type="button"
                                disabled={restoringOrderId === delOrder.id}
                                onClick={() => handleRestoreOrder(delOrder.id)}
                                className="mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition"
                              >
                                {restoringOrderId === delOrder.id ? "Restoring..." : "Restore Order"}
                              </button>
                            )}
                          </div>
                        </div>
                        {!isRecoverable && (
                          <p className="text-[10px] text-text-tertiary italic">
                            14-day recovery window expired. Retained as archival reference only.
                          </p>
                        )}
                      </div>
                    );
                  })}

                {orders.filter(o => o.customer.id === selected.id).length === 0 &&
                 deletedOrders.filter(o => o.customer.id === selected.id || (o.customer.phone && o.customer.phone === selected.phone)).length === 0 && (
                  <p className="text-xs text-text-tertiary">No orders found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <div className="badge-brand-orange mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-orange-primary" />
                  Client Profile
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  {editingCustomer ? "Edit Customer Profile" : "Add Customer Profile"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingCustomer(null);
                }}
                className="text-text-tertiary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>
            {modalError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">{modalError}</div>
            )}
            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-text-primary">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anitha Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
                />
              </div>
              <div>
                <label className="block font-bold text-text-primary">Phone</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
                />
              </div>
              <div>
                <label className="block font-bold text-text-primary">Email</label>
                <input
                  type="email"
                  placeholder="client@domain.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
                />
              </div>
              <div>
                <label className="block font-bold text-text-primary">Location / Address</label>
                <input
                  type="text"
                  placeholder="City, Area"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCustomer(null);
                  }}
                  className="btn-brand-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-brand-orange"
                >
                  {isSubmitting ? "Saving..." : editingCustomer ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}