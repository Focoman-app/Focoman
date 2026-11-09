"use client";

import type { Order, Studio, Task } from "@focoman/types";
import { getStudioCalendarDate, getStudioTimestampIST } from "@focoman/domain";

export function OmsAuditHistorySection({
  order,
  tasks,
  studio,
}: {
  order: Order;
  tasks: Task[];
  studio: Studio;
}) {
  const formatAuditStamp = (val?: string | null): string => {
    if (!val) return "-";
    return getStudioTimestampIST(val);
  };

  const logEntries: Array<{
    id: string;
    timestamp: string;
    actorName: string;
    actorRole: "Owner" | "Member" | "Customer" | "System";
    action: string;
    details: string;
  }> = [];

  // 1. Explicitly recorded audit logs in the order
  if (order.auditLog && order.auditLog.length > 0) {
    order.auditLog.forEach((entry) => {
      logEntries.push({
        id: entry.id,
        timestamp: formatAuditStamp(entry.timestamp),
        actorName: entry.actorName,
        actorRole: entry.actorRole,
        action: entry.action,
        details: entry.details,
      });
    });
  }

  // 2. Synthesize Order Registration if not already logged
  if (!logEntries.some((e) => e.action.includes("Order Registered"))) {
    logEntries.push({
      id: "synth_reg",
      timestamp: formatAuditStamp(order.createdAt),
      actorName: order.bookingRequestId
        ? order.customer.name
        : order.createdBy || studio?.ownerName || "Studio Owner",
      actorRole: order.bookingRequestId ? "Customer" : "Owner",
      action: "Order Registered",
      details: `Registered confirmed order for ${order.eventType} · Confirmed Price: ₹${order.pricing.finalConfirmedPrice.toLocaleString()}`,
    });
  }

  // 3. Synthesize Advance Payment Recorded
  if (
    order.pricing.advanceAmount > 0 &&
    !logEntries.some((e) => e.action.includes("Advance Payment"))
  ) {
    const regStamp = formatAuditStamp(order.createdAt);
    const isSameDay = order.pricing.advanceDate === order.createdAt.split("T")[0];
    const advStamp = isSameDay
      ? getStudioTimestampIST(new Date(new Date(order.createdAt).getTime() + 1000))
      : order.pricing.advanceDate
      ? `${order.pricing.advanceDate} 12:00`
      : regStamp;

    logEntries.push({
      id: "synth_adv",
      timestamp: advStamp,
      actorName: order.createdBy || studio?.ownerName || "Studio Owner",
      actorRole: "Owner",
      action: "Advance Payment Recorded",
      details: `Recorded advance payment of ₹${order.pricing.advanceAmount.toLocaleString()}`,
    });
  }

  // 4. Synthesize Pre-Flight Operational Check
  if (
    order.preflightReport &&
    !logEntries.some((e) => e.action.includes("Pre-Flight"))
  ) {
    logEntries.push({
      id: "synth_preflight",
      timestamp: formatAuditStamp(order.preflightReport.evaluatedAt || order.createdAt),
      actorName: "Automated System",
      actorRole: "System",
      action: "Pre-Flight Check Evaluated",
      details: order.preflightReport.hasConflicts
        ? "Schedule conflict warning detected during pre-flight check"
        : "All operational pre-flight checks clear (0 schedule conflicts)",
    });
  }

  // 5. Synthesize Event Date Passed (System Action)
  const todayCalendar = getStudioCalendarDate();
  if (
    (order.eventDate < todayCalendar || order.orderStatus !== "AWAITING_EVENT") &&
    !logEntries.some((e) => e.action.includes("Event Date Passed"))
  ) {
    logEntries.push({
      id: "synth_event_passed",
      timestamp: `${order.eventDate} 00:00`,
      actorName: "Automated System",
      actorRole: "System",
      action: "Event Date Passed",
      details: `Event date (${order.eventDate}) reached — Post-event production workflow started automatically`,
    });
  }

  // 6. Synthesize Installments and Payments
  if (order.pricing.installments && order.pricing.installments.length > 0) {
    order.pricing.installments.forEach((inst, i) => {
      const isPaidAuto = inst.notes?.includes("Marked Paid");
      const instDetail = isPaidAuto
        ? `Recorded final balance payment of ₹${inst.amount.toLocaleString()}. Order marked as Paid.`
        : `Recorded payment of ₹${inst.amount.toLocaleString()}${
            inst.notes ? ` · Note: ${inst.notes}` : ""
          }`;
      if (
        !logEntries.some(
          (e) => e.id === inst.id || e.details.includes(`₹${inst.amount.toLocaleString()}`)
        )
      ) {
        logEntries.push({
          id: inst.id || `synth_inst_${i}`,
          timestamp: inst.createdAt
            ? formatAuditStamp(inst.createdAt)
            : inst.date
            ? `${inst.date} 00:00`
            : "-",
          actorName: inst.recordedBy || studio?.ownerName || "Studio Owner",
          actorRole:
            (inst.recordedByRole as "Owner" | "Member" | "Customer" | "System") || "Owner",
          action: isPaidAuto ? "Order Marked Paid" : "Payment Recorded",
          details: instDetail,
        });
      }
    });
  }

  // 7. Synthesize Assigned Resources (Staff assignments)
  if (order.assignedResources && order.assignedResources.length > 0) {
    order.assignedResources.forEach((res) => {
      if (
        !logEntries.some(
          (e) => e.details.includes(res.memberName) && e.details.includes(res.skill)
        )
      ) {
        logEntries.push({
          id: `synth_assign_${res.memberId}_${res.skill}`,
          timestamp: formatAuditStamp(order.createdAt),
          actorName: studio?.ownerName || "Studio Owner",
          actorRole: "Owner",
          action: "Crew Assigned",
          details: `Assigned ${res.memberName} for ${res.skill}`,
        });
      }
    });
  }

  // 8. Synthesize Meaningful Task Progress
  if (tasks && tasks.length > 0) {
    tasks.forEach((t) => {
      const hasAssignee =
        Boolean(t.assignedMemberName) &&
        !t.assignedMemberName.toLowerCase().includes("unassigned");
      if (
        hasAssignee &&
        !logEntries.some((e) =>
          e.details.includes(`Assigned task "${t.title}" to ${t.assignedMemberName}`)
        )
      ) {
        logEntries.push({
          id: `synth_task_assign_${t.id}`,
          timestamp: formatAuditStamp(t.createdAt || order.createdAt),
          actorName: studio?.ownerName || "Studio Owner",
          actorRole: "Owner",
          action: "Task Assigned",
          details: `Assigned task "${t.title}" (${t.serviceCategory}) to ${t.assignedMemberName}`,
        });
      }

      if (
        t.status !== "ASSIGNED" &&
        t.status !== "AWAITING_EVENT" &&
        !logEntries.some(
          (e) => e.details.includes(t.title) && e.details.includes(t.status)
        )
      ) {
        logEntries.push({
          id: `synth_task_status_${t.id}`,
          timestamp: formatAuditStamp(t.updatedAt || order.createdAt),
          actorName: hasAssignee
            ? t.assignedMemberName
            : studio?.ownerName || "Studio Owner",
          actorRole: hasAssignee ? "Member" : "Owner",
          action: "Task Status Updated",
          details: `Updated task "${t.title}" status to ${t.status}${
            t.reworkNotes ? ` · Notes: ${t.reworkNotes}` : ""
          }`,
        });
      }
    });
  }

  // 9. Synthesize Order Cancellation if cancelled
  if (
    order.orderStatus === "CANCELLED" &&
    !logEntries.some((e) => e.action.includes("Order Cancelled"))
  ) {
    logEntries.push({
      id: "synth_cancelled",
      timestamp: formatAuditStamp(
        order.cancellationInfo?.cancelledAt || order.updatedAt
      ),
      actorName:
        order.cancellationInfo?.cancelledBy || studio?.ownerName || "Studio Owner",
      actorRole: "Owner",
      action: "Order Cancelled",
      details: `Order cancelled — Reason: "${
        order.cancellationInfo?.cancellationReason || "Cancelled by studio owner"
      }"`,
    });
  }

  const sortedLogs = [...logEntries].sort((a, b) => {
    const cmp = a.timestamp.localeCompare(b.timestamp);
    if (cmp !== 0) return cmp;
    if (a.action === "Order Registered") return -1;
    if (b.action === "Order Registered") return 1;
    if (a.action === "Advance Payment Recorded") return -1;
    if (b.action === "Advance Payment Recorded") return 1;
    return 0;
  });

  return (
    <div className="mt-3 rounded-2xl border border-border-default bg-[#F8FAFC] p-3.5 space-y-3 shadow-xs animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-2 border-b border-border-default">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-primary">
            Order Audit Trail and Activity Logs
          </span>
          <span className="text-[10px] text-text-tertiary">#{order.orderNumber}</span>
        </div>
        <span className="text-[10px] text-text-secondary bg-white px-2 py-0.5 rounded-lg border border-border-default font-semibold shadow-2xs">
          {sortedLogs.length} events logged
        </span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {sortedLogs.length > 0 ? (
          sortedLogs.map((log, index) => (
            <div
              key={log.id || index}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-border-default/80 hover:border-slate-300 transition shadow-2xs"
            >
              <div className="w-24 shrink-0 pt-0.5">
                <span className="font-mono text-[10px] font-bold text-slate-700 block">
                  {log.timestamp.split(" ")[0]}
                </span>
                <span className="font-mono text-[10px] text-slate-400 block">
                  {log.timestamp.split(" ")[1] || "00:00"}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">{log.action}</span>
                  <span className="text-[10px] text-slate-400">·</span>
                  <span className="text-[11px] font-medium text-slate-600">
                    {log.actorName}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 ${
                      log.actorRole === "Owner"
                        ? "bg-amber-400/10 text-amber-700 border border-amber-400/30"
                        : log.actorRole === "System"
                        ? "bg-purple-400/10 text-purple-700 border border-purple-400/30"
                        : log.actorRole === "Member"
                        ? "bg-blue-400/10 text-blue-700 border border-blue-400/30"
                        : "bg-emerald-400/10 text-emerald-700 border border-emerald-400/30"
                    }`}
                  >
                    {log.actorRole}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  {log.details}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-xs text-text-tertiary">
            No audit history entries recorded for this order yet.
          </div>
        )}
      </div>
    </div>
  );
}
