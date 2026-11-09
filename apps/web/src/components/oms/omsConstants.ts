import type { Order, OrderStatus, TaskStatus } from "@focoman/types";
import { calculateOrderPaymentBreakdown } from "@focoman/domain";
import { exportWorkbookToExcel } from "@/utils/excelExport";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_EVENT: "Awaiting Event",
  POST_EVENT_IN_PROGRESS: "Post-Event In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  AWAITING_EVENT: "badge-brand-blue",
  POST_EVENT_IN_PROGRESS: "badge-brand-orange",
  COMPLETED: "badge-status-success",
  CANCELLED: "badge-status-error",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  AWAITING_EVENT: "bg-blue-50 text-blue-700 border border-blue-200",
  ASSIGNED: "badge-status-neutral",
  IN_PROGRESS: "badge-brand-blue",
  REVIEW: "badge-brand-purple",
  REWORK: "badge-status-error",
  COMPLETED: "badge-status-success",
};

export const PRESET_EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Engagement",
  "Housewarming Ceremony",
  "Ear Piercing Ceremony",
  "Baby Shower",
  "Birthday Celebration",
  "Traditional Occasion",
  "Corporate Event",
  "Pre-Wedding / Outdoor Shoot",
  "Other",
] as const;

export const PRESET_STUDIO_SERVICES = [
  "Traditional Photography",
  "Candid Photography",
  "Traditional Videography",
  "Cinematic Video / Teaser",
  "Drone Aerial Shoots",
  "Pre-Wedding Photoshoot",
  "Post-Wedding Photoshoot",
  "Premium Photobook Album",
] as const;

export const DEFAULT_ORDER_FORM = {
  customerName: "",
  countryCode: "+91",
  customerPhone: "",
  customerEmail: "",
  passkeyPin: "",
  notifyWhatsApp: true,
  notifyEmail: true,
  eventType: "Wedding",
  customEventType: "",
  eventDate: "",
  eventLocation: "",
  services: [] as string[],
  customServiceInput: "",
  finalConfirmedPrice: "" as unknown as number,
  advanceAmount: "" as unknown as number,
};

export type NewOrderFormState = typeof DEFAULT_ORDER_FORM;

export function exportOmsOrdersToExcel(studioSlug: string, filtered: Order[]) {
  const paymentRows: Array<{
    receiptNumber: string;
    orderNumber: string;
    customerName: string;
    eventType: string;
    paymentType: string;
    paymentDate: string;
    amount: number;
    notes: string;
  }> = [];

  filtered.forEach((order) => {
    const breakdown = calculateOrderPaymentBreakdown(order);
    breakdown.receipts.forEach((rcp) => {
      paymentRows.push({
        receiptNumber: rcp.receiptNumber,
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        eventType: order.eventType,
        paymentType: rcp.label,
        paymentDate: rcp.date || "-",
        amount: rcp.amount,
        notes: rcp.notes || "",
      });
    });
  });

  exportWorkbookToExcel(`${studioSlug}_OMS_Orders_And_Payments`, [
    {
      name: "Orders Summary",
      rows: filtered,
      columns: [
        { header: "Order ID", key: "orderNumber", width: 22 },
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
        {
          header: "Customer Email",
          key: "customerEmail",
          width: 26,
          getValue: (o) => o.customer.email || "-",
        },
        { header: "Event Type", key: "eventType", width: 20 },
        { header: "Event Date", key: "eventDate", width: 14 },
        {
          header: "Services Included",
          key: "services",
          width: 34,
          getValue: (o) => (o.services || []).join(", "),
        },
        {
          header: "Order Status",
          key: "orderStatus",
          width: 22,
          getValue: (o: Order) => STATUS_LABELS[o.orderStatus] || o.orderStatus,
        },
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
      name: "Payments & Receipts",
      rows: paymentRows,
      columns: [
        { header: "Receipt No", key: "receiptNumber", width: 24 },
        { header: "Order ID", key: "orderNumber", width: 22 },
        { header: "Customer Name", key: "customerName", width: 24 },
        { header: "Event Type", key: "eventType", width: 20 },
        { header: "Payment Type", key: "paymentType", width: 18 },
        { header: "Payment Date", key: "paymentDate", width: 14 },
        {
          header: "Amount Received (INR)",
          key: "amount",
          type: "currency",
          width: 20,
          sumInTotals: true,
        },
        { header: "Notes", key: "notes", width: 28 },
      ],
    },
  ]);
}
