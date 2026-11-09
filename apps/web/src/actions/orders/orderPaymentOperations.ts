import "server-only";
import { UpdatePaymentSchema } from "@focoman/validation";
import {
  canCompleteOrder,
  getStudioCalendarDate,
  getStudioTimestampIST,
} from "@focoman/domain";
import {
  getOrderById,
  getStudioBySlug,
  getTasksByOrder,
  updateOrder,
} from "@focoman/db";
import type {
  Order,
  OrderAuditEntry,
  OrderInstallment,
  OrderStatus,
  PaymentStatus,
} from "@focoman/types";
import { requireStudioOwner, requireVerifiedUser } from "@/lib/serverAuth";
import { sendPaymentReminderCustomerEmail } from "@/services/emailService";

export async function updatePaymentStatusCore(rawInput: unknown): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  try {
    const validated = UpdatePaymentSchema.parse(rawInput);

    const decoded = await requireVerifiedUser((validated as any).idToken);
    await requireStudioOwner(decoded.uid, (validated as any).studioId);

    const existingOrder = await getOrderById(validated.orderId);
    if (!existingOrder) {
      return { success: false, error: "Order not found" };
    }
    if (existingOrder.studioId !== (validated as any).studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    const currentPricing = existingOrder.pricing;
    const newConfirmed =
      validated.finalConfirmedPrice !== undefined
        ? validated.finalConfirmedPrice
        : currentPricing.finalConfirmedPrice;
    let calculatedStatus: PaymentStatus | undefined = validated.paymentStatus as
      | PaymentStatus
      | undefined;
    const newAdvance =
      validated.advanceAmount !== undefined
        ? validated.advanceAmount
        : currentPricing.advanceAmount;
    let previousAdvance =
      currentPricing.previousAdvanceAmount ??
      (currentPricing.advanceAmount < currentPricing.finalConfirmedPrice
        ? currentPricing.advanceAmount
        : 0);
    const newInstallments =
      validated.installments !== undefined
        ? validated.installments
        : currentPricing.installments || [];

    if (validated.advanceAmount !== undefined && validated.advanceAmount < newConfirmed) {
      previousAdvance = validated.advanceAmount;
    }

    let finalInstallments = [...newInstallments];
    let installmentsTotal = finalInstallments.reduce(
      (sum, inst) => sum + (inst.amount || 0),
      0
    );

    if (calculatedStatus === "PAID") {
      const currentPaid = newAdvance + installmentsTotal;
      const remainingToPay = Math.max(0, newConfirmed - currentPaid);
      if (remainingToPay > 0 && validated.installments === undefined) {
        const autoPayment: OrderInstallment = {
          id: `inst_${Date.now()}_auto`,
          amount: remainingToPay,
          date: new Date().toISOString().split("T")[0],
          notes: "Final Payment (Marked Paid)",
          createdAt: new Date().toISOString(),
          recordedBy: decoded.name || decoded.email || "Studio Owner",
          recordedByRole: "Owner",
        };
        finalInstallments = [...finalInstallments, autoPayment];
        installmentsTotal += remainingToPay;
      }
    } else if (
      calculatedStatus === "PENDING" &&
      existingOrder.paymentStatus === "PAID" &&
      validated.advanceAmount === undefined
    ) {
      finalInstallments = finalInstallments.filter(
        (inst) => !inst.notes?.includes("Marked Paid")
      );
      installmentsTotal = finalInstallments.reduce(
        (sum, inst) => sum + (inst.amount || 0),
        0
      );
      const totalPaid = newAdvance + installmentsTotal;
      calculatedStatus =
        totalPaid > 0 && totalPaid < newConfirmed
          ? finalInstallments.length > 0
            ? "PARTIAL"
            : "ADVANCE_RECEIVED"
          : totalPaid >= newConfirmed && newConfirmed > 0
          ? "PAID"
          : "PENDING";
    } else if (!calculatedStatus) {
      const totalPaid = newAdvance + installmentsTotal;
      if (totalPaid >= newConfirmed && newConfirmed > 0) {
        calculatedStatus = "PAID";
      } else if (finalInstallments.length > 0) {
        calculatedStatus = "PARTIAL";
      } else if (newAdvance > 0) {
        calculatedStatus = "ADVANCE_RECEIVED";
      } else {
        calculatedStatus = "PENDING";
      }
    }

    const newRemaining = Math.max(0, newConfirmed - (newAdvance + installmentsTotal));

    const actorName = decoded.name || decoded.email || "Studio Owner";
    const newAuditEntries: OrderAuditEntry[] = [];
    const nowStamp = getStudioTimestampIST(new Date());

    if (calculatedStatus === "PAID" && existingOrder.paymentStatus !== "PAID") {
      newAuditEntries.push({
        id: `audit_${Date.now()}_paid`,
        timestamp: nowStamp,
        actorName,
        actorRole: "Owner",
        action: "Order Marked Paid",
        details: `Recorded final payment and marked order as Paid. Total confirmed: ₹${newConfirmed.toLocaleString()}`,
      });
    } else if (
      finalInstallments.length > (existingOrder.pricing.installments?.length || 0)
    ) {
      const latestInst = finalInstallments[finalInstallments.length - 1];
      newAuditEntries.push({
        id: `audit_${Date.now()}_inst`,
        timestamp: getStudioTimestampIST(latestInst.createdAt || new Date()),
        actorName,
        actorRole: "Owner",
        action: "Payment Recorded",
        details: `Recorded installment payment of ₹${latestInst.amount.toLocaleString()}${
          latestInst.notes ? ` (${latestInst.notes})` : ""
        }`,
      });
    } else if (newConfirmed !== currentPricing.finalConfirmedPrice) {
      newAuditEntries.push({
        id: `audit_${Date.now()}_price`,
        timestamp: nowStamp,
        actorName,
        actorRole: "Owner",
        action: "Confirmed Price Updated",
        details: `Updated confirmed price from ₹${currentPricing.finalConfirmedPrice.toLocaleString()} to ₹${newConfirmed.toLocaleString()}`,
      });
    } else if (newAdvance !== currentPricing.advanceAmount) {
      newAuditEntries.push({
        id: `audit_${Date.now()}_adv_upd`,
        timestamp: nowStamp,
        actorName,
        actorRole: "Owner",
        action: "Advance Payment Updated",
        details: `Updated advance payment from ₹${currentPricing.advanceAmount.toLocaleString()} to ₹${newAdvance.toLocaleString()}`,
      });
    }

    const updatedAuditLog = [...(existingOrder.auditLog || []), ...newAuditEntries];

    const updatedOrder = await updateOrder(validated.orderId, {
      paymentStatus: calculatedStatus,
      updatedBy: actorName,
      updatedByRole: "Owner",
      auditLog: updatedAuditLog,
      pricing: {
        ...currentPricing,
        finalConfirmedPrice: newConfirmed,
        advanceAmount: newAdvance,
        advanceDate:
          validated.advanceDate ||
          currentPricing.advanceDate ||
          existingOrder.createdAt?.split("T")[0] ||
          new Date().toISOString().split("T")[0],
        installments: finalInstallments,
        remainingAmount: newRemaining,
        previousAdvanceAmount: previousAdvance,
      },
    });

    if (updatedOrder) {
      const allTasks = await getTasksByOrder(validated.orderId);
      if (
        canCompleteOrder(calculatedStatus, allTasks) &&
        updatedOrder.orderStatus !== "COMPLETED"
      ) {
        await updateOrder(validated.orderId, { orderStatus: "COMPLETED" });
        updatedOrder.orderStatus = "COMPLETED";
      } else if (
        !canCompleteOrder(calculatedStatus, allTasks) &&
        existingOrder.orderStatus === "COMPLETED"
      ) {
        const todayStr = getStudioCalendarDate();
        const fallbackStatus: OrderStatus =
          existingOrder.eventDate < todayStr
            ? "POST_EVENT_IN_PROGRESS"
            : "AWAITING_EVENT";
        await updateOrder(validated.orderId, { orderStatus: fallbackStatus });
        updatedOrder.orderStatus = fallbackStatus;
      }
    }

    return { success: true, order: updatedOrder || undefined };
  } catch (err: unknown) {
    console.error("[updatePaymentStatusAction] Error:", err);
    return {
      success: false,
      error:
        (err as any)?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : "Failed to update payment status"),
    };
  }
}

export async function sendManualPaymentReminderCore(input: {
  orderId: string;
  studioId: string;
  idToken: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const decoded = await requireVerifiedUser(input.idToken);
    await requireStudioOwner(decoded.uid, input.studioId);

    const order = await getOrderById(input.orderId);
    if (!order) {
      return { success: false, error: "Order not found." };
    }
    if (order.studioId.toLowerCase() !== input.studioId.toLowerCase()) {
      return { success: false, error: "Unauthorized: Order belongs to another studio." };
    }

    if (order.paymentStatus === "PAID" || order.pricing.remainingAmount <= 0) {
      return {
        success: false,
        error: "This order has no pending balance. Payment is fully completed.",
      };
    }

    if (!order.customer?.email) {
      return {
        success: false,
        error: "No customer email address registered for this order.",
      };
    }

    const studio = await getStudioBySlug(input.studioId);
    const studioName = studio?.name || input.studioId;

    const emailRes = await sendPaymentReminderCustomerEmail({
      toEmail: order.customer.email,
      studioName,
      customerName: order.customer.name,
      orderId: order.id,
      eventTitle: order.eventType,
      amountDue: `₹${order.pricing.remainingAmount.toLocaleString()}`,
      dueDate: order.eventDate,
    });

    if (!emailRes.success) {
      return {
        success: false,
        error: emailRes.error || "Failed to send payment reminder email.",
      };
    }

    const reminderAudit: OrderAuditEntry = {
      id: `audit_${Date.now()}_payment_reminder`,
      timestamp: getStudioTimestampIST(new Date()),
      actorName: decoded.name || decoded.email || "Studio Owner",
      actorRole: "Owner",
      action: "Payment Reminder Sent",
      details: `Sent manual payment reminder email to ${
        order.customer.email
      } for pending balance of ₹${order.pricing.remainingAmount.toLocaleString()}`,
    };

    await updateOrder(order.id, {
      auditLog: [...(order.auditLog || []), reminderAudit],
    });

    return {
      success: true,
      message: `Payment reminder email sent successfully to ${order.customer.email}!`,
    };
  } catch (err: unknown) {
    console.error("[sendManualPaymentReminderAction] Error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to send payment reminder email",
    };
  }
}
