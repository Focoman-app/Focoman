"use client";

import type { Order, ResourceSuggestion, Task } from "@focoman/types";
import { calculateOrderAging } from "@/utils/dateUtils";

export function OmsTurnaroundSlaBanner({
  order,
  tasks,
}: {
  order: Order;
  tasks: Task[];
}) {
  const aging = calculateOrderAging(
    order.eventDate,
    tasks,
    order.orderStatus === "COMPLETED",
    order.updatedAt
  );
  const upcomingReminder = aging.statusLabel === "Event upcoming in 3 days" ? aging.statusLabel : null;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-app/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
            Production Turnaround and SLA Breakdown
          </span>
          {order.orderStatus === "COMPLETED" ? (
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 border border-emerald-200">
              Delivered
            </span>
          ) : upcomingReminder ? (
            <span className="rounded-full bg-blue-100 text-brand-blue-primary text-[9px] font-extrabold px-2 py-0.5 border border-blue-200">
              {upcomingReminder}
            </span>
          ) : !aging.isUpcoming ? (
            <span className="rounded-full bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 border border-amber-200">
              Active Production
            </span>
          ) : null}
        </div>
        {!aging.isUpcoming && (
          <span className="text-[10px] font-bold text-text-secondary">
            {aging.statusLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {/* Card 1: Total Overall Age */}
        <div className="rounded-xl border border-border-default bg-white p-3 shadow-2xs">
          <span className="text-[10px] font-semibold text-text-tertiary block">
            {order.orderStatus === "COMPLETED" ? "Overall Turnaround" : "Overall Order Age"}
          </span>
          <span className="text-base font-extrabold text-text-primary mt-0.5 block">
            {aging.isUpcoming ? "0 d" : `${aging.totalAgeDays} Days`}
          </span>
          <span className="text-[9px] text-text-tertiary block mt-0.5 truncate">
            {aging.isUpcoming ? "Starts after event" : `From ${order.eventDate}`}
          </span>
        </div>

        {/* Card 2: Studio Working Days */}
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 shadow-2xs">
          <span className="text-[10px] font-semibold text-blue-900 block">
            Pending at Studio
          </span>
          <span className="text-base font-extrabold text-brand-blue-primary mt-0.5 block">
            {aging.isUpcoming ? "0 d" : `${aging.studioDays} Days`}
          </span>
          <span className="text-[9px] text-blue-700/80 block mt-0.5 truncate">
            Editing, culling and design
          </span>
        </div>

        {/* Card 3: Pending at Customer */}
        <div
          className={`rounded-xl border p-3 shadow-2xs ${
            aging.customerDays > 0
              ? "border-amber-300 bg-amber-50/70"
              : "border-border-default bg-white"
          }`}
        >
          <span
            className={`text-[10px] font-semibold block ${
              aging.customerDays > 0 ? "text-amber-900" : "text-text-tertiary"
            }`}
          >
            Pending at Customer
          </span>
          <span
            className={`text-base font-extrabold mt-0.5 block ${
              aging.customerDays > 0 ? "text-amber-700" : "text-text-primary"
            }`}
          >
            {aging.isUpcoming ? "0 d" : `${aging.customerDays} Days`}
          </span>
          <span
            className={`text-[9px] block mt-0.5 truncate ${
              aging.customerDays > 0 ? "text-amber-700 font-semibold" : "text-text-tertiary"
            }`}
          >
            {aging.customerDays > 0 ? "Awaiting client review" : "No pending reviews"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OmsResourceSuggestionsSection({
  order,
  onConfirmSuggestion,
}: {
  order: Order;
  onConfirmSuggestion: (sug: ResourceSuggestion) => void;
}) {
  if (!order.resourceSuggestions || order.resourceSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
            Suggested Resources
          </h4>
          <p className="text-[10px] text-blue-700">System suggests · Owner reviews and confirms</p>
        </div>
        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
          {order.resourceSuggestions.length} Available
        </span>
      </div>

      <div className="space-y-2">
        {order.resourceSuggestions.map((sug) => {
          const isAssigned = (order.assignedResources || []).some(
            (r) => r.memberId === sug.memberId
          );

          return (
            <div
              key={sug.memberId}
              className="flex items-center justify-between rounded-xl border border-blue-200 bg-white p-2.5 text-xs"
            >
              <div>
                <span className="font-bold text-text-primary">{sug.memberName}</span>
                <span className="ml-2 rounded bg-surface-app px-1.5 py-0.5 text-[10px] font-medium text-text-secondary border border-border-default">
                  {sug.skill}
                </span>
                <p className="text-[10px] text-text-tertiary mt-0.5">{sug.matchReason}</p>
              </div>

              {isAssigned ? (
                <span className="text-[10px] font-bold text-status-success bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                  Assigned
                </span>
              ) : (
                <button
                  onClick={() => onConfirmSuggestion(sug)}
                  className="rounded-lg bg-brand-blue-primary px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-600 transition"
                >
                  Confirm Assignment
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OmsCustomerAccessCard({
  order,
  origin,
  copiedField,
  onCopyText,
  onShareText,
}: {
  order: Order;
  origin: string;
  copiedField: "code" | "link" | null;
  onCopyText: (text: string, field: "code" | "link") => void;
  onShareText: (url: string, title?: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-blue-soft bg-brand-blue-background/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue-primary">
          Customer Order Access and Tracking Link
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
            order.customer?.email
              ? "bg-emerald-100 text-emerald-800"
              : "bg-blue-100 text-brand-blue-primary"
          }`}
        >
          {order.customer?.email ? "Email Auth Active" : "6-Digit PIN Protected"}
        </span>
      </div>

      {order.customer?.email ? (
        /* EMAIL AUTH MODE */
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
            <div>
              <span className="text-[10px] font-semibold text-text-tertiary block">
                Registered Customer Email
              </span>
              <span className="font-mono text-xs font-extrabold text-text-primary tracking-wide">
                {order.customer.email}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCopyText(order.customer.email!, "code")}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
            >
              {copiedField === "code" ? "Copied Email!" : "Copy Email"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-text-tertiary block">
                Direct Tracking Link
              </span>
              <span className="font-mono text-xs font-semibold text-brand-blue-primary truncate block">
                {`${origin}/track/${order.orderNumber}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const link = `${window.location.origin}/track/${order.orderNumber}`;
                  onCopyText(link, "link");
                }}
                className="rounded-lg bg-brand-blue-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600 transition"
              >
                {copiedField === "link" ? "Copied Link!" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const link = `${window.location.origin}/track/${order.orderNumber}`;
                  onShareText(link, `Order #${order.orderNumber} Tracking Link`);
                }}
                className="rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs font-bold text-text-primary hover:bg-surface-app hover:border-brand-blue-primary transition flex items-center gap-1.5"
                title="Share tracking link"
              >
                <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <a
                href={`/track/${order.orderNumber}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-brand-blue-primary bg-white px-2.5 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-blue-50 transition"
                title="Open tracking page in new tab"
              >
                Open Link
              </a>
            </div>
          </div>

          <p className="text-[11px] text-text-secondary leading-relaxed">
            Customer email on file (<strong className="text-text-primary">{order.customer.email}</strong>). Customer authenticates directly with this email. No PIN required.
          </p>
        </div>
      ) : (
        /* 6-DIGIT PIN GUEST PASSKEY MODE */
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
            <div>
              <span className="text-[10px] font-semibold text-text-tertiary block">
                6-Digit Guest Access PIN
              </span>
              <span className="font-mono text-sm font-extrabold text-brand-blue-primary tracking-widest">
                {order.passkeyPin ||
                  order.trackingPasskey.match(/\d{6}/)?.[0] ||
                  order.orderNumber.match(/\d{6}/)?.[0] ||
                  "492015"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const pin =
                  order.passkeyPin ||
                  order.trackingPasskey.match(/\d{6}/)?.[0] ||
                  order.orderNumber.match(/\d{6}/)?.[0] ||
                  "492015";
                onCopyText(pin, "code");
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
            >
              {copiedField === "code" ? "Copied PIN!" : "Copy 6-Digit PIN"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-text-tertiary block">
                Direct Tracking Link
              </span>
              <span className="font-mono text-xs font-semibold text-brand-blue-primary truncate block">
                {`${origin}/track/${order.orderNumber}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const link = `${window.location.origin}/track/${order.orderNumber}`;
                  onCopyText(link, "link");
                }}
                className="rounded-lg bg-brand-blue-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600 transition"
              >
                {copiedField === "link" ? "Copied Link!" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const link = `${window.location.origin}/track/${order.orderNumber}`;
                  onShareText(link, `Order #${order.orderNumber} Tracking Link`);
                }}
                className="rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs font-bold text-text-primary hover:bg-surface-app hover:border-brand-blue-primary transition flex items-center gap-1.5"
                title="Share tracking link"
              >
                <svg className="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <a
                href={`/track/${order.orderNumber}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-brand-blue-primary bg-white px-2.5 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-blue-50 transition"
                title="Open tracking page in new tab"
              >
                Open Link
              </a>
            </div>
          </div>

          <p className="text-[11px] text-text-secondary leading-relaxed">
            No customer email provided. Share this 6-digit PIN and tracking link with your customer for guest access.
          </p>
        </div>
      )}
    </div>
  );
}
