"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Order,
  Task,
  TaskStatus,
  OrderStatus,
  CustomerTrackingView,
  ResourceAssignment,
  TemporaryCrewMember,
} from "@focoman/types";
import { getEventDaysRemaining, calculateTaskAgeBadge } from "@/utils/dateUtils";

interface SelectableCrew {
  id: string;
  name: string;
  skills: string[];
  role: string;
}

interface OrderVerticalWorkflowProps {
  order: Order | CustomerTrackingView["order"];
  tasks: Task[] | CustomerTrackingView["tasks"];
  variant: "oms" | "tracking";
  // OMS-specific callback actions
  onUpdateTaskStatus?: (taskId: string, nextStatus: TaskStatus) => void | Promise<void>;
  allSelectableCrew?: SelectableCrew[];
  temporaryCrewList?: Array<{ id: string; name: string; isTemporary: true }>;
  onAssignCrew?: (serviceName: string, memberName: string) => Promise<void>;
  onUnassignCrew?: (serviceName: string) => Promise<void>;
  onOpenErpWizard?: (serviceName: string, query?: string) => void;
  onAssignTaskCrew?: (taskId: string, memberName: string) => Promise<void>;
  hasErp?: boolean;
}

type PhaseId = "phase_lead" | "phase_pre_event" | "phase_event_day" | "phase_post_event" | "phase_delivery" | "phase_completed";

export function OrderVerticalWorkflow({
  order,
  tasks = [],
  variant,
  onUpdateTaskStatus,
  allSelectableCrew = [],
  temporaryCrewList = [],
  onAssignCrew,
  onUnassignCrew,
  onOpenErpWizard,
  onAssignTaskCrew,
  hasErp = true,
}: OrderVerticalWorkflowProps) {
  const isOms = variant === "oms";
  const fullOrder = isOms ? (order as Order) : null;
  const fullTasks = tasks as Task[];

  // Event timing calculations
  const eventRem = useMemo(() => getEventDaysRemaining(order.eventDate), [order.eventDate]);
  const isFutureEvent = Boolean(eventRem && eventRem.diffDays > 0);
  const isTodayEvent = Boolean(eventRem && eventRem.diffDays === 0);
  const isPastEvent = Boolean(eventRem && eventRem.diffDays < 0);

  // Event date locking: if event is in the future, post-event tasks are locked
  const isEventLocked = Boolean(
    eventRem && (eventRem.diffDays > 0 || (eventRem.diffDays === 0 && order.orderStatus === "AWAITING_EVENT"))
  );

  // Group production tasks dynamically
  const photoTasks = useMemo(() => {
    return fullTasks
      .filter((t) => {
        const title = (t.title || "").toLowerCase();
        const cat = (t.serviceCategory || "").toUpperCase();
        return (
          cat === "PHOTOGRAPHY" ||
          cat === "ALBUM" ||
          title.includes("photo") ||
          title.includes("raw") ||
          title.includes("album") ||
          title.includes("cull")
        );
      })
      .sort((a, b) => {
        const score = (t: string) => {
          const s = (t || "").toLowerCase();
          if (s.includes("raw") || s.includes("cull")) return 1;
          if (s.includes("photo edit") || s.includes("editing")) return 2;
          if (s.includes("album")) return 3;
          return 4;
        };
        return score(a.title) - score(b.title) || (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
      });
  }, [fullTasks]);

  const videoTasks = useMemo(() => {
    return fullTasks
      .filter((t) => {
        const title = (t.title || "").toLowerCase();
        const cat = (t.serviceCategory || "").toUpperCase();
        return (
          cat === "VIDEOGRAPHY" ||
          title.includes("video") ||
          title.includes("cinematic") ||
          title.includes("teaser") ||
          title.includes("reel") ||
          title.includes("footage") ||
          title.includes("grading")
        );
      })
      .sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
  }, [fullTasks]);

  const deliveryTasks = useMemo(() => {
    return fullTasks.filter((t) => {
      const title = (t.title || "").toLowerCase();
      const cat = (t.serviceCategory || "").toUpperCase();
      return (
        cat === "GENERAL" ||
        title.includes("delivery") ||
        title.includes("handover") ||
        title.includes("final") ||
        title.includes("dispatch")
      );
    });
  }, [fullTasks]);

  const otherTasks = useMemo(() => {
    return fullTasks.filter(
      (t) => !photoTasks.includes(t) && !videoTasks.includes(t) && !deliveryTasks.includes(t)
    );
  }, [fullTasks, photoTasks, videoTasks, deliveryTasks]);

  // Task prerequisites checker (Preserves existing business logic)
  const getPrerequisite = (task: Task): { isLocked: boolean; reason?: string } => {
    if (isEventLocked) {
      return {
        isLocked: true,
        reason: `Locked until post-event date (${order.eventDate})`,
      };
    }

    const titleLower = (task.title || "").toLowerCase();

    // Photo editing requires raw photo selection completed
    if (
      titleLower.includes("photo edit") ||
      (titleLower.includes("edit") && task.serviceCategory === "PHOTOGRAPHY")
    ) {
      const rawTask = fullTasks.find((t) => (t.title || "").toLowerCase().includes("raw"));
      if (rawTask && rawTask.status !== "COMPLETED") {
        return {
          isLocked: true,
          reason: "Waiting for Raw Photo Selection completion",
        };
      }
    }

    // Album edit requires photo editing completed
    if (task.serviceCategory === "ALBUM" || titleLower.includes("album")) {
      const photoEdit = fullTasks.find(
        (t) =>
          (t.title || "").toLowerCase().includes("photo edit") ||
          ((t.title || "").toLowerCase().includes("edit") && t.serviceCategory === "PHOTOGRAPHY")
      );
      if (photoEdit && photoEdit.status !== "COMPLETED") {
        return {
          isLocked: true,
          reason: "Waiting for Photo Editing completion",
        };
      }
    }

    // Final delivery requires all preceding production tasks completed
    if (task.serviceCategory === "GENERAL" || titleLower.includes("delivery")) {
      const pending = fullTasks.filter((t) => t.id !== task.id && t.status !== "COMPLETED");
      if (pending.length > 0) {
        return {
          isLocked: true,
          reason: `Waiting for ${pending.length} preceding task(s) to complete`,
        };
      }
    }

    return { isLocked: false };
  };

  // Phase Progress Calculations
  const services = useMemo(() => order.services || [], [order.services]);
  const assignedResources = useMemo(() => fullOrder?.assignedResources || [], [fullOrder?.assignedResources]);
  const assignedServicesCount = useMemo(() => {
    return services.filter((svcName) => {
      const svcLower = svcName.trim().toLowerCase();
      return assignedResources.some(
        (r) => (r.skill || "").trim().toLowerCase() === svcLower
      );
    }).length;
  }, [services, assignedResources]);

  const preEventCompleted = services.length > 0 ? assignedServicesCount === services.length : true;

  const photoCompletedCount = photoTasks.filter((t) => t.status === "COMPLETED").length;
  const videoCompletedCount = videoTasks.filter((t) => t.status === "COMPLETED").length;
  const deliveryCompletedCount = deliveryTasks.filter((t) => t.status === "COMPLETED").length;
  const allTasksCount = fullTasks.length;
  const allTasksCompletedCount = fullTasks.filter((t) => t.status === "COMPLETED").length;

  const isProductionCompleted =
    (photoTasks.length === 0 || photoCompletedCount === photoTasks.length) &&
    (videoTasks.length === 0 || videoCompletedCount === videoTasks.length);

  const isDeliveryCompleted =
    deliveryTasks.length > 0
      ? deliveryCompletedCount === deliveryTasks.length
      : isProductionCompleted && order.orderStatus === "COMPLETED";

  // Determine active phase
  const activePhaseId = useMemo<PhaseId>(() => {
    if (order.orderStatus === "COMPLETED") return "phase_completed";
    if (order.orderStatus === "CANCELLED") return "phase_completed";

    if (order.orderStatus === "AWAITING_EVENT") {
      if (isTodayEvent) return "phase_event_day";
      if (!preEventCompleted) return "phase_pre_event";
      return "phase_pre_event";
    }

    if (order.orderStatus === "POST_EVENT_IN_PROGRESS") {
      if (isProductionCompleted) return "phase_delivery";
      return "phase_post_event";
    }

    return "phase_pre_event";
  }, [order.orderStatus, isTodayEvent, preEventCompleted, isProductionCompleted]);

  // Phase expansion state: defaults to expanding active phase and collapsing others
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseId>>(() => new Set([activePhaseId]));

  useEffect(() => {
    setExpandedPhases(new Set([activePhaseId]));
  }, [activePhaseId, order.id]);

  const togglePhase = (phaseId: PhaseId) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  // Crew search and assignment state for OMS
  const [editingCrewService, setEditingCrewService] = useState<string | null>(null);
  const [activeCrewDropdown, setActiveCrewDropdown] = useState<string | null>(null);
  const [crewSearchQuery, setCrewSearchQuery] = useState<Record<string, string>>({});

  const handleCommitCrew = async (svcName: string, crewName: string) => {
    if (onAssignCrew) {
      await onAssignCrew(svcName, crewName);
      setActiveCrewDropdown(null);
      setEditingCrewService(null);
      setCrewSearchQuery((prev) => ({ ...prev, [svcName]: "" }));
    }
  };

  const handleUnassign = async (svcName: string) => {
    if (onUnassignCrew) {
      await onUnassignCrew(svcName);
      setCrewSearchQuery((prev) => ({ ...prev, [svcName]: "" }));
    }
  };

  // Task-level crew assignment state for Phase 3
  const [editingTaskCrewId, setEditingTaskCrewId] = useState<string | null>(null);

  const getDefaultCrewForTask = (task: Task): { name: string; isAuto: boolean } | null => {
    if (task.assignedMemberName) {
      return { name: task.assignedMemberName, isAuto: false };
    }
    const cat = (task.serviceCategory || "").toUpperCase();
    const title = (task.title || "").toLowerCase();

    // 1. Photography tasks
    if (cat === "PHOTOGRAPHY" || title.includes("photo") || title.includes("raw") || title.includes("cull")) {
      const match = assignedResources.find((r) => (r.skill || "").toLowerCase().includes("photo"));
      if (match?.memberName) return { name: match.memberName, isAuto: true };
    }

    // 2. Videography tasks
    if (
      cat === "VIDEOGRAPHY" ||
      title.includes("video") ||
      title.includes("cinemat") ||
      title.includes("teaser") ||
      title.includes("reel") ||
      title.includes("footage")
    ) {
      const match = assignedResources.find(
        (r) => (r.skill || "").toLowerCase().includes("video") || (r.skill || "").toLowerCase().includes("cinemat")
      );
      if (match?.memberName) return { name: match.memberName, isAuto: true };
    }

    // 3. Album tasks
    if (cat === "ALBUM" || title.includes("album")) {
      const match =
        assignedResources.find((r) => (r.skill || "").toLowerCase().includes("album")) ||
        assignedResources.find((r) => (r.skill || "").toLowerCase().includes("photo"));
      if (match?.memberName) return { name: match.memberName, isAuto: true };
    }

    // Fallback: first available assigned resource if any
    if (assignedResources.length > 0 && assignedResources[0]?.memberName) {
      return { name: assignedResources[0].memberName, isAuto: true };
    }

    return null;
  };

  // Origin path distinction
  const hasLeadOrigin = Boolean(order.bookingRequestId);

  return (
    <div className="w-full space-y-4">
      {/* 1. Terminal State: Cancelled Order Banner (if applicable) */}
      {order.orderStatus === "CANCELLED" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white font-extrabold text-xs shadow-xs">
              ✕
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">Order Cancelled (Terminal State)</h3>
              <p className="text-xs text-rose-700">
                This order has been cancelled and is no longer moving through active production pipelines.
              </p>
            </div>
          </div>
          {fullOrder?.cancellationInfo && (
            <div className="mt-2 rounded-xl border border-rose-200/80 bg-white/80 p-3 text-xs space-y-1">
              <p className="text-text-primary">
                <span className="font-semibold text-rose-900">Reason:</span>{" "}
                {fullOrder.cancellationInfo.cancellationReason}
              </p>
              <p className="text-[11px] text-text-tertiary">
                Cancelled on {fullOrder.cancellationInfo.cancelledAt ? fullOrder.cancellationInfo.cancelledAt.split("T")[0] : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. Unified Vertical Workflow Timeline */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200/80">
        {/* PHASE 0: Lead / Inquiry & Advance Booking (Rendered ONLY if order originated from lead/booking) */}
        {hasLeadOrigin && (
          <div className="relative group">
            {/* Timeline Marker */}
            <div className="absolute -left-6 sm:-left-8 top-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-xs ring-4 ring-white shadow-2xs">
              ✓
            </div>

            <div className="rounded-2xl border border-border-default bg-white p-4 shadow-2xs transition hover:border-slate-300">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => togglePhase("phase_lead")}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      Origin Pipeline
                    </span>
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      Booking Confirmed
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-text-primary mt-0.5">
                    Lead Inquiry &amp; Advance Booking
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Original marketplace inquiry, price agreement, and advance payment verification
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Toggle Lead Phase"
                  className="rounded-lg p-1 text-text-tertiary hover:bg-slate-100 transition shrink-0"
                >
                  <svg
                    className={`h-4 w-4 transition-transform duration-200 ${
                      expandedPhases.has("phase_lead") ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {expandedPhases.has("phase_lead") && (
                <div className="mt-3.5 pt-3.5 border-t border-border-default/60 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-secondary">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-border-default/60">
                      <span className="text-[10px] uppercase font-bold text-text-tertiary block">
                        Booking Request ID
                      </span>
                      <span className="font-mono text-xs font-bold text-text-primary">
                        {order.bookingRequestId}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-border-default/60">
                      <span className="text-[10px] uppercase font-bold text-text-tertiary block">
                        Transition Status
                      </span>
                      <span className="font-semibold text-emerald-800">
                        Converted to Confirmed Production Order
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary pt-1">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Client inquiry received → terms agreed → advance verified → order created.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 1: Pre-Event Preparation */}
        <div className="relative group">
          {/* Timeline Marker */}
          <div
            className={`absolute -left-6 sm:-left-8 top-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full font-bold text-xs ring-4 ring-white shadow-2xs transition-all ${
              preEventCompleted && (order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED")
                ? "bg-emerald-500 text-white"
                : activePhaseId === "phase_pre_event"
                ? "bg-brand-blue-primary text-white shadow-sm ring-blue-100 ring-4"
                : preEventCompleted
                ? "bg-emerald-500 text-white"
                : "bg-slate-100 text-slate-500 border border-slate-300"
            }`}
          >
            {preEventCompleted && order.orderStatus !== "AWAITING_EVENT" ? "✓" : "1"}
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs transition ${
              activePhaseId === "phase_pre_event"
                ? "border-blue-200 bg-white ring-1 ring-blue-100/60"
                : "border-border-default bg-white"
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePhase("phase_pre_event")}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Phase 01
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                      preEventCompleted
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-blue-50 text-brand-blue-primary border-blue-200"
                    }`}
                  >
                    {preEventCompleted ? "Preparation Ready" : "Crew Allocation In Progress"}
                  </span>
                  {services.length > 0 && (
                    <span className="text-[10px] font-mono font-semibold text-text-tertiary">
                      ({assignedServicesCount}/{services.length} services allocated)
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">Pre-Event Preparation</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Booked services mapping, shoot crew assignment, and preparation readiness
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle Phase 1"
                className="rounded-lg p-1 text-text-tertiary hover:bg-slate-100 transition shrink-0"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedPhases.has("phase_pre_event") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedPhases.has("phase_pre_event") && (
              <div className="mt-4 pt-3.5 border-t border-border-default/60 space-y-3">
                {/* Event Schedule Info */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-2.5 border border-border-default/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                      Target Event Date
                    </span>
                    <span className="font-bold text-text-primary">
                      {order.eventDate || "Date to be scheduled"}
                    </span>
                  </div>
                  {eventRem && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                        eventRem.diffDays > 0
                          ? "bg-blue-50 text-brand-blue-primary border-blue-200"
                          : eventRem.diffDays === 0
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {eventRem.display}
                    </span>
                  )}
                </div>

                {/* Service Mapping & Crew Assignments */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                    <span>Booked Services</span>
                    <span>{isOms ? "Assigned Shoot Crew" : "Shoot Readiness"}</span>
                  </div>

                  {services.length === 0 ? (
                    <p className="text-xs text-text-tertiary py-2 italic">No services listed for this order.</p>
                  ) : (
                    <div className="divide-y divide-border-default/60 rounded-xl border border-border-default/80 bg-white overflow-hidden text-xs">
                      {services.map((svcName) => {
                        const svcLower = svcName.trim().toLowerCase();
                        const assignedRes = assignedResources.find((r) => {
                          return (r.skill || "").trim().toLowerCase() === svcLower;
                        });

                        const isOwner = Boolean(
                          assignedRes &&
                            ((assignedRes.memberId && assignedRes.memberId.startsWith("owner-")) ||
                              (assignedRes.memberName && assignedRes.memberName.toLowerCase().includes("(owner)")))
                        );

                        const isRegisteredMember =
                          isOwner ||
                          allSelectableCrew.some(
                            (c) =>
                              (assignedRes?.memberId && c.id === assignedRes.memberId) ||
                              (assignedRes?.memberName &&
                                c.name.toLowerCase() === assignedRes.memberName.toLowerCase()) ||
                              (c.role === "Owner" &&
                                assignedRes?.memberName &&
                                c.name.toLowerCase().includes(assignedRes.memberName.toLowerCase()))
                          );

                        const isTempAssigned = Boolean(
                          assignedRes &&
                            !isOwner &&
                            !isRegisteredMember &&
                            (assignedRes.memberId.startsWith("temp_") ||
                              temporaryCrewList.some(
                                (t) => t.name.toLowerCase() === assignedRes.memberName.toLowerCase()
                              ))
                        );

                        const isEditingThis = !assignedRes || editingCrewService === svcName;
                        const currentQuery = crewSearchQuery[svcName] ?? "";
                        const trimmedQuery = currentQuery.trim();

                        const matchingCrewForService = hasErp
                          ? allSelectableCrew.filter((m) => {
                              if (!trimmedQuery) return true;
                              const q = trimmedQuery.toLowerCase();
                              return (
                                (m.name || "").toLowerCase().includes(q) ||
                                (m.role || "").toLowerCase().includes(q) ||
                                (m.skills || []).some((s) => (s || "").toLowerCase().includes(q))
                              );
                            })
                          : [];

                        const matchingTemporaryCrew = temporaryCrewList.filter((t) => {
                          if (!trimmedQuery) return true;
                          return t.name.toLowerCase().includes(trimmedQuery.toLowerCase());
                        });

                        const hasExactMatch =
                          matchingCrewForService.some(
                            (c) => c.name.toLowerCase() === trimmedQuery.toLowerCase()
                          ) ||
                          matchingTemporaryCrew.some(
                            (t) => t.name.toLowerCase() === trimmedQuery.toLowerCase()
                          );

                        const isDropdownOpen = activeCrewDropdown === svcName;

                        return (
                          <div
                            key={svcName}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2 hover:bg-slate-50/50 transition"
                          >
                            <div className="font-semibold text-text-primary text-xs flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary" />
                              <span>{svcName}</span>
                            </div>

                            {/* Crew Assignment Control for OMS */}
                            {isOms ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {assignedRes && !isEditingThis ? (
                                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-800 font-bold text-xs shrink-0">
                                    <span>{assignedRes.memberName}</span>
                                    {isTempAssigned && (
                                      <span className="rounded bg-amber-100 text-amber-800 border border-amber-200 px-1 py-0.2 text-[9px] font-bold">
                                        Freelancer
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void handleUnassign(svcName)}
                                      className="text-emerald-600 hover:text-red-600 transition ml-0.5 text-xs leading-none cursor-pointer"
                                      title="Unassign crew"
                                    >
                                      ✕
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCrewService(svcName);
                                        setActiveCrewDropdown(svcName);
                                      }}
                                      className="rounded border border-border-default bg-white px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary hover:text-brand-blue-primary transition cursor-pointer ml-1"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                ) : (
                                  <div className="relative flex items-center gap-1.5">
                                    <div className="relative min-w-[200px]">
                                      <input
                                        type="text"
                                        placeholder={
                                          assignedRes
                                            ? "Change crew..."
                                            : hasErp
                                            ? "Select crew or type name..."
                                            : "Type freelancer / temporary crew name..."
                                        }
                                        value={currentQuery}
                                        onFocus={() => setActiveCrewDropdown(svcName)}
                                        onChange={(e) => {
                                          setCrewSearchQuery((prev) => ({ ...prev, [svcName]: e.target.value }));
                                          setActiveCrewDropdown(svcName);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (trimmedQuery) {
                                              void handleCommitCrew(svcName, trimmedQuery);
                                            }
                                          }
                                        }}
                                        className="w-full rounded-lg border border-border-default px-2.5 py-1 text-xs outline-none focus:border-brand-blue-primary bg-white shadow-2xs"
                                      />
                                      {isDropdownOpen && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-30"
                                            onClick={() => setActiveCrewDropdown(null)}
                                          />
                                          <div className="absolute top-full left-0 right-0 z-40 mt-1 rounded-xl border border-border-default bg-white p-1.5 shadow-xl max-h-56 overflow-y-auto">
                                            {/* 1. Quick Free Text Option */}
                                            {trimmedQuery && !hasExactMatch && (
                                              <div
                                                onClick={() => void handleCommitCrew(svcName, trimmedQuery)}
                                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-amber-50 cursor-pointer bg-amber-50/50 border border-amber-200/70 mb-1 transition"
                                              >
                                                <span className="font-semibold text-text-primary truncate">
                                                  {trimmedQuery}
                                                </span>
                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded shrink-0">
                                                  {hasErp ? "Assign" : "Assign Freelancer"}
                                                </span>
                                              </div>
                                            )}

                                            {/* 2. Registered ERP Studio Crew */}
                                            {hasErp && matchingCrewForService.length > 0 && (
                                              <div className="space-y-0.5 mb-1">
                                                <div className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary px-1 py-0.5">
                                                  Studio Crew
                                                </div>
                                                {matchingCrewForService.map((c) => (
                                                  <div
                                                    key={c.id}
                                                    onClick={() => void handleCommitCrew(svcName, c.name)}
                                                    className="flex items-center justify-between px-2 py-1 rounded-lg text-xs hover:bg-blue-50 cursor-pointer"
                                                  >
                                                    <span className="font-semibold text-text-primary truncate">
                                                      {c.name}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-brand-blue-primary bg-blue-100/60 px-1.5 py-0.2 rounded">
                                                      Assign
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* 3. Known Freelancers / Temporary Crew */}
                                            {matchingTemporaryCrew.length > 0 && (
                                              <div className="space-y-0.5 mb-1">
                                                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/70 px-1 py-0.5">
                                                  Freelancers & Temporary
                                                </div>
                                                {matchingTemporaryCrew.map((t) => (
                                                  <div
                                                    key={t.id}
                                                    onClick={() => void handleCommitCrew(svcName, t.name)}
                                                    className="flex items-center justify-between px-2 py-1 rounded-lg text-xs hover:bg-amber-100/60 cursor-pointer bg-amber-50/40"
                                                  >
                                                    <span className="font-semibold text-text-primary truncate">
                                                      {t.name} (Freelancer)
                                                    </span>
                                                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                                      Assign
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* 4. ERP Full Member Registration */}
                                            {hasErp && onOpenErpWizard && (
                                              <div
                                                onClick={() => {
                                                  setActiveCrewDropdown(null);
                                                  setEditingCrewService(null);
                                                  onOpenErpWizard(svcName, trimmedQuery || undefined);
                                                }}
                                                className="px-2 py-1.5 rounded-lg text-xs font-bold text-brand-purple-primary hover:bg-purple-50 cursor-pointer border-t border-border-default/60 mt-1 flex items-center justify-between"
                                              >
                                                <span>+ Add as Permanent ERP Member</span>
                                                <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded">
                                                  Full Profile
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    {assignedRes && editingCrewService === svcName && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCrewService(null);
                                          setActiveCrewDropdown(null);
                                        }}
                                        className="text-[11px] font-medium text-text-tertiary hover:text-text-primary px-1 py-0.5"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Customer-Safe Read-Only View (No private wages or staff emails) */
                              <div className="flex items-center gap-1.5 text-xs">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    assignedRes && assignedRes.memberId !== "unassigned"
                                      ? "bg-emerald-500"
                                      : "bg-slate-300"
                                  }`}
                                />
                                <span
                                  className={`font-semibold ${
                                    assignedRes && assignedRes.memberId !== "unassigned"
                                      ? "text-text-primary"
                                      : "text-text-tertiary"
                                  }`}
                                >
                                  {assignedRes && assignedRes.memberId !== "unassigned"
                                    ? "Crew & Equipment Confirmed"
                                    : "Unassigned"}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PHASE 2: Event Day Execution */}
        <div className="relative group">
          {/* Timeline Marker */}
          <div
            className={`absolute -left-6 sm:-left-8 top-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full font-bold text-xs ring-4 ring-white shadow-2xs transition-all ${
              order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                ? "bg-emerald-500 text-white"
                : activePhaseId === "phase_event_day"
                ? "bg-brand-blue-primary text-white shadow-sm ring-blue-100 ring-4"
                : "bg-slate-100 text-slate-400 border border-slate-300"
            }`}
          >
            {order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED" ? "✓" : "2"}
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs transition ${
              activePhaseId === "phase_event_day"
                ? "border-blue-200 bg-white ring-1 ring-blue-100/60"
                : "border-border-default bg-white"
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePhase("phase_event_day")}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Phase 02
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                      order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : isTodayEvent
                        ? "bg-blue-50 text-brand-blue-primary border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                      ? "Shoot Completed"
                      : isTodayEvent
                      ? "Shoot Active Today"
                      : isFutureEvent
                      ? "Scheduled / Locked"
                      : "Awaiting Post-Event Check-in"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">Event Day Execution</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Shoot coverage, team check-in, and raw footage safeguarding
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle Phase 2"
                className="rounded-lg p-1 text-text-tertiary hover:bg-slate-100 transition shrink-0"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedPhases.has("phase_event_day") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedPhases.has("phase_event_day") && (
              <div className="mt-4 pt-3.5 border-t border-border-default/60 space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-secondary">
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-border-default/60">
                    <span className="text-[10px] uppercase font-bold text-text-tertiary block">
                      Shoot Venue
                    </span>
                    <span className="font-semibold text-text-primary truncate block">
                      {order.eventLocation || "Client Venue / Location"}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 border border-border-default/60">
                    <span className="text-[10px] uppercase font-bold text-text-tertiary block">
                      Coverage Status
                    </span>
                    <span
                      className={`font-semibold ${
                        order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                          ? "text-emerald-800"
                          : isTodayEvent
                          ? "text-brand-blue-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                        ? "Shoot completed & wrapped up"
                        : isTodayEvent
                        ? "Event underway today"
                        : `Scheduled for ${order.eventDate}`}
                    </span>
                  </div>
                </div>

                {isFutureEvent && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-amber-900 text-[11px] flex items-center gap-2">
                    <span className="font-bold">Notice:</span>
                    <span>
                      Post-event editing and production tasks remain locked until the scheduled shoot date (
                      {order.eventDate}).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PHASE 3: Post-Event Production (Parallel Photography & Videography Streams) */}
        <div className="relative group">
          {/* Timeline Marker */}
          <div
            className={`absolute -left-6 sm:-left-8 top-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full font-bold text-xs ring-4 ring-white shadow-2xs transition-all ${
              isProductionCompleted && (order.orderStatus === "COMPLETED" || order.orderStatus === "POST_EVENT_IN_PROGRESS")
                ? "bg-emerald-500 text-white"
                : activePhaseId === "phase_post_event"
                ? "bg-brand-blue-primary text-white shadow-sm ring-blue-100 ring-4"
                : "bg-slate-100 text-slate-400 border border-slate-300"
            }`}
          >
            {isProductionCompleted && order.orderStatus === "COMPLETED" ? "✓" : "3"}
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs transition ${
              activePhaseId === "phase_post_event"
                ? "border-blue-200 bg-white ring-1 ring-blue-100/60"
                : "border-border-default bg-white"
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePhase("phase_post_event")}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Phase 03
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                      isProductionCompleted
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : order.orderStatus === "POST_EVENT_IN_PROGRESS"
                        ? "bg-blue-50 text-brand-blue-primary border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {isProductionCompleted
                      ? "Production Finished"
                      : order.orderStatus === "POST_EVENT_IN_PROGRESS"
                      ? "In Production"
                      : "Pending Event"}
                  </span>
                  {allTasksCount > 0 && (
                    <span className="text-[10px] font-mono font-semibold text-text-tertiary">
                      ({allTasksCompletedCount}/{allTasksCount} tasks completed)
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">Post-Event Production</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Parallel photography &amp; videography editing, client proofing, and color grading
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle Phase 3"
                className="rounded-lg p-1 text-text-tertiary hover:bg-slate-100 transition shrink-0"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedPhases.has("phase_post_event") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedPhases.has("phase_post_event") && (
              <div className="mt-4 pt-3.5 border-t border-border-default/60 space-y-4">
                {/* Overall Post-Event Progress Bar */}
                {allTasksCount > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-text-secondary">Overall Production Progress</span>
                      <span className="font-mono font-bold text-text-primary">
                        {Math.round((allTasksCompletedCount / allTasksCount) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-blue-primary transition-all duration-300"
                        style={{ width: `${Math.round((allTasksCompletedCount / allTasksCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Parallel Stream 1: Photography Pipeline */}
                {photoTasks.length > 0 && (
                  <div className="rounded-xl border border-border-default bg-slate-50/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary">Photography Pipeline</span>
                        <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.2 text-[9px] font-bold">
                          Stream A
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-text-secondary">
                        {photoCompletedCount}/{photoTasks.length} Done
                      </span>
                    </div>

                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-600 transition-all duration-300"
                        style={{
                          width: `${Math.round((photoCompletedCount / photoTasks.length) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {photoTasks.map((task) => renderTaskRow(task))}
                    </div>
                  </div>
                )}

                {/* Parallel Stream 2: Videography Pipeline */}
                {videoTasks.length > 0 && (
                  <div className="rounded-xl border border-border-default bg-slate-50/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary">Videography Pipeline</span>
                        <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.2 text-[9px] font-bold">
                          Stream B (Independent)
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-text-secondary">
                        {videoCompletedCount}/{videoTasks.length} Done
                      </span>
                    </div>

                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{
                          width: `${Math.round((videoCompletedCount / videoTasks.length) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {videoTasks.map((task) => renderTaskRow(task))}
                    </div>
                  </div>
                )}

                {/* Other configured tasks */}
                {otherTasks.length > 0 && (
                  <div className="rounded-xl border border-border-default bg-slate-50/50 p-3 space-y-2">
                    <span className="text-xs font-bold text-text-primary block">Additional Tasks</span>
                    <div className="space-y-1.5">{otherTasks.map((task) => renderTaskRow(task))}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PHASE 4: Final Handover & Delivery */}
        <div className="relative group">
          {/* Timeline Marker */}
          <div
            className={`absolute -left-6 sm:-left-8 top-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full font-bold text-xs ring-4 ring-white shadow-2xs transition-all ${
              order.orderStatus === "COMPLETED"
                ? "bg-emerald-500 text-white"
                : activePhaseId === "phase_delivery"
                ? "bg-brand-blue-primary text-white shadow-sm ring-blue-100 ring-4"
                : "bg-slate-100 text-slate-400 border border-slate-300"
            }`}
          >
            {order.orderStatus === "COMPLETED" ? "✓" : "4"}
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs transition ${
              activePhaseId === "phase_delivery"
                ? "border-blue-200 bg-white ring-1 ring-blue-100/60"
                : "border-border-default bg-white"
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePhase("phase_delivery")}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Phase 04
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                      order.orderStatus === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : activePhaseId === "phase_delivery"
                        ? "bg-blue-50 text-brand-blue-primary border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {order.orderStatus === "COMPLETED"
                      ? "Handover Completed"
                      : activePhaseId === "phase_delivery"
                      ? "Final Delivery in Progress"
                      : "Pending Production Completion"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">Final Handover &amp; Delivery</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Client review proofs, album printing, digital gallery handover, and delivery sign-off
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle Phase 4"
                className="rounded-lg p-1 text-text-tertiary hover:bg-slate-100 transition shrink-0"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedPhases.has("phase_delivery") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedPhases.has("phase_delivery") && (
              <div className="mt-4 pt-3.5 border-t border-border-default/60 space-y-3 text-xs">
                {deliveryTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    {deliveryTasks.map((task) => renderTaskRow(task))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3 border border-border-default/60 text-text-secondary space-y-1">
                    <p className="font-semibold text-text-primary">
                      {isProductionCompleted
                        ? "Ready for digital album and deliverable dispatch"
                        : "Waiting for photo editing and video cuts to finish before dispatch."}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      All deliverables will be presented to the client via their passkey-secured tracking link.
                    </p>
                  </div>
                )}

                {/* Payment Status Isolation Banner (Payment does NOT equal workflow state) */}
                <div className="rounded-xl border border-border-default bg-white p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                      Financial Clearance State
                    </span>
                    <span className="font-semibold text-text-primary">
                      Status: {order.paymentStatus || "PENDING"}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    (Maintained independently from delivery workflow)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PHASE 5: Completed Terminal State */}
        <div className="relative group">
          {/* Timeline Marker */}
          <div
            className={`absolute -left-6 sm:-left-8 top-0.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full font-bold text-xs ring-4 ring-white shadow-2xs transition-all ${
              order.orderStatus === "COMPLETED"
                ? "bg-emerald-500 text-white shadow-sm ring-emerald-100 ring-4"
                : "bg-slate-100 text-slate-400 border border-slate-300"
            }`}
          >
            {order.orderStatus === "COMPLETED" ? "✓" : "5"}
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs transition ${
              order.orderStatus === "COMPLETED"
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-border-default bg-white"
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePhase("phase_completed")}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Terminal State
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                      order.orderStatus === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {order.orderStatus === "COMPLETED" ? "Fulfilled & Completed" : "Pending Handover"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">Order Completion</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Full fulfillment confirmation, client acceptance, and project archive
                </p>
              </div>
              <button
                type="button"
                aria-label="Toggle Phase 5"
                className="rounded-lg p-1 text-text-tertiary hover:bg-slate-100 transition shrink-0"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedPhases.has("phase_completed") ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {expandedPhases.has("phase_completed") && (
              <div className="mt-4 pt-3.5 border-t border-border-default/60 text-xs text-text-secondary space-y-2">
                <p>
                  {order.orderStatus === "COMPLETED"
                    ? "✓ All workflow phases and deliverable handovers have been officially concluded."
                    : "Order remains active in previous phases until final delivery and completion criteria are satisfied."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Helper renderer for individual task rows
  function renderTaskRow(task: Task) {
    const prereq = getPrerequisite(task);
    const taskAge = calculateTaskAgeBadge(task);
    const displayTitle = (task.title || "").replace("&", "and");

    const effectiveStatus: TaskStatus = isEventLocked
      ? "AWAITING_EVENT"
      : task.status === "AWAITING_EVENT"
      ? "ASSIGNED"
      : task.status;

    const isDone = effectiveStatus === "COMPLETED";
    const isInProgress = effectiveStatus === "IN_PROGRESS";
    const isReview = effectiveStatus === "REVIEW";
    const isRework = effectiveStatus === "REWORK";

    const statusBadgeStyle = isEventLocked || effectiveStatus === "AWAITING_EVENT"
      ? "bg-slate-100 text-slate-600 border-slate-200"
      : isDone
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : isInProgress
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : isReview
      ? "bg-purple-100 text-purple-800 border-purple-200"
      : isRework
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

    const statusLabel = isEventLocked || effectiveStatus === "AWAITING_EVENT"
      ? "Awaiting Event"
      : isDone
      ? "Completed"
      : isInProgress
      ? "In Progress"
      : isReview
      ? "Client Review"
      : isRework
      ? "Revisions Requested"
      : "Assigned";

    return (
      <div
        key={task.id || task.title}
        className={`rounded-xl border p-2.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          isDone
            ? "bg-white border-emerald-200/80 shadow-2xs"
            : isInProgress
            ? "bg-white border-blue-200 shadow-2xs ring-1 ring-blue-50"
            : isReview
            ? "bg-purple-50/40 border-purple-200 shadow-2xs"
            : isRework
            ? "bg-amber-50/40 border-amber-200 shadow-2xs"
            : "bg-white border-border-default/80"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-text-primary text-xs">{displayTitle}</span>
            <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${statusBadgeStyle}`}>
              {statusLabel}
            </span>
            {isOms && (
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${taskAge.colorClass}`}>
                {taskAge.label}
              </span>
            )}
          </div>
          {isOms && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] text-text-tertiary">Crew:</span>
              {editingTaskCrewId === task.id ? (
                <div className="relative inline-flex items-center gap-1">
                  <select
                    autoFocus
                    defaultValue={task.assignedMemberName || getDefaultCrewForTask(task)?.name || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTaskCrewId(null);
                      if (val && onAssignTaskCrew) {
                        void onAssignTaskCrew(task.id, val);
                      }
                    }}
                    onBlur={() => setEditingTaskCrewId(null)}
                    className="rounded-md border border-border-default bg-white px-2 py-0.5 text-[10px] font-semibold text-text-primary outline-none focus:border-brand-blue-primary shadow-2xs"
                  >
                    <option value="">-- Select Crew --</option>
                    {hasErp &&
                      allSelectableCrew.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    {temporaryCrewList.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} (Freelancer)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditingTaskCrewId(null)}
                    className="text-[10px] text-text-tertiary hover:text-text-primary cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                (() => {
                  const crewInfo = getDefaultCrewForTask(task);
                  return (
                    <div className="inline-flex items-center gap-1 text-[10px]">
                      {crewInfo?.name ? (
                        <span className="font-semibold text-text-secondary bg-slate-100 rounded px-1.5 py-0.5">
                          {crewInfo.name}
                          {crewInfo.isAuto && (
                            <span className="text-[9px] text-text-tertiary font-normal ml-1">
                              (auto from Phase 1)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-text-tertiary italic">Unassigned</span>
                      )}
                      {onAssignTaskCrew && (
                        <button
                          type="button"
                          onClick={() => setEditingTaskCrewId(task.id)}
                          className="text-[10px] text-brand-blue-primary hover:underline font-medium cursor-pointer ml-0.5"
                        >
                          {crewInfo?.name ? "Change" : "Assign"}
                        </button>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        {/* Action Controls for OMS */}
        {isOms && onUpdateTaskStatus && (
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            {isEventLocked ? (
              <span className="text-[10px] text-slate-400 font-medium">Locked</span>
            ) : prereq.isLocked ? (
              <span className="text-[10px] text-slate-400 font-medium" title={prereq.reason}>
                Waiting Preceding Task
              </span>
            ) : (
              <>
                {effectiveStatus === "ASSIGNED" && (
                  <button
                    type="button"
                    onClick={() => onUpdateTaskStatus(task.id, "IN_PROGRESS")}
                    className="rounded-lg bg-brand-blue-primary text-white font-bold text-[10px] px-2.5 py-1 hover:bg-sky-600 transition cursor-pointer shadow-2xs"
                  >
                    Start
                  </button>
                )}

                {effectiveStatus === "IN_PROGRESS" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, "REVIEW")}
                      className="rounded-lg bg-purple-600 text-white font-bold text-[10px] px-2 py-1 hover:bg-purple-700 transition cursor-pointer shadow-2xs"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, "COMPLETED")}
                      className="rounded-lg bg-emerald-600 text-white font-bold text-[10px] px-2 py-1 hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                    >
                      Complete
                    </button>
                  </>
                )}

                {effectiveStatus === "REVIEW" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, "REWORK")}
                      className="rounded-lg bg-amber-600 text-white font-bold text-[10px] px-2 py-1 hover:bg-amber-700 transition cursor-pointer shadow-2xs"
                    >
                      Rework
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, "COMPLETED")}
                      className="rounded-lg bg-emerald-600 text-white font-bold text-[10px] px-2 py-1 hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                    >
                      Complete
                    </button>
                  </>
                )}

                {effectiveStatus === "REWORK" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, "REVIEW")}
                      className="rounded-lg bg-purple-600 text-white font-bold text-[10px] px-2 py-1 hover:bg-purple-700 transition cursor-pointer shadow-2xs"
                    >
                      Re-submit
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTaskStatus(task.id, "COMPLETED")}
                      className="rounded-lg bg-emerald-600 text-white font-bold text-[10px] px-2 py-1 hover:bg-emerald-700 transition cursor-pointer shadow-2xs"
                    >
                      Complete
                    </button>
                  </>
                )}

                {effectiveStatus === "COMPLETED" && (
                  <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <span>✓ Done</span>
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }
}
