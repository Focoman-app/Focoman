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
import {
  getEventDaysRemaining,
  calculateTaskAgeBadge,
  normalizeDateList,
  formatMultiDateDisplay,
  getNextOrPrimaryOrderShootDate,
} from "@/utils/dateUtils";

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
  onUpdateTaskStatus?: (
    taskId: string,
    nextStatus: TaskStatus,
    reworkNotes?: string
  ) => void | Promise<void>;
  onCustomerReviewTask?: (
    taskId: string,
    decision: "COMPLETED" | "REWORK",
    reworkNotes?: string
  ) => void | Promise<void>;
  canCustomerAct?: boolean;
  studioOwnerName?: string;
  allSelectableCrew?: SelectableCrew[];
  temporaryCrewList?: Array<{ id: string; name: string; isTemporary: true }>;
  onSaveServiceCrew?: (serviceName: string, memberNames: string[]) => Promise<void>;
  onOpenErpWizard?: (serviceName: string, query?: string) => void;
  onAssignTaskCrew?: (taskId: string, memberName: string) => Promise<void>;
  onSaveSchedule?: (
    eventDate: string,
    eventLocation: string,
    eventDates?: string[],
    serviceSchedules?: Record<string, string[]>
  ) => Promise<void>;
  busyEventDates?: string[];
  hasErp?: boolean;
  canManageDriveLinks?: boolean;
  onSendTaskForReviewWithDriveLink?: (input: {
    taskId: string;
    title: string;
    driveUrl: string;
    notes?: string;
  }) => Promise<void>;
  displayMode?: "full" | "main-state-only" | "timeline-only";
}

type PhaseId = "phase_lead" | "phase_pre_event" | "phase_event_day" | "phase_post_event" | "phase_delivery";

function isDeliverableOnlyService(serviceName: string): boolean {
  const lower = (serviceName || "").trim().toLowerCase();
  return (
    lower.includes("album") ||
    lower.includes("photobook") ||
    lower.includes("hard drive") ||
    lower.includes("pen drive") ||
    lower.includes("raw footage") ||
    lower.includes("frame")
  );
}

export function OrderVerticalWorkflow({
  order,
  tasks = [],
  variant,
  onUpdateTaskStatus,
  onCustomerReviewTask,
  canCustomerAct = true,
  studioOwnerName,
  allSelectableCrew = [],
  temporaryCrewList = [],
  onSaveServiceCrew,
  onOpenErpWizard,
  onAssignTaskCrew,
  onSaveSchedule,
  busyEventDates = [],
  hasErp = true,
  canManageDriveLinks = false,
  onSendTaskForReviewWithDriveLink,
  displayMode = "full",
}: OrderVerticalWorkflowProps) {
  const isOms = variant === "oms";
  const fullOrder = isOms ? (order as Order) : null;
  const fullTasks = tasks as Task[];

  const [reworkOpenTaskId, setReworkOpenTaskId] = useState<string | null>(null);
  const [reworkNotesDraft, setReworkNotesDraft] = useState<Record<string, string>>({});
  const [taskDriveDrafts, setTaskDriveDrafts] = useState<
    Record<string, { title?: string; driveUrl?: string; notes?: string }>
  >({});
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [actionFeedbackError, setActionFeedbackError] = useState<string | null>(null);

  // Event timing calculations
  const nextOrPrimaryShootDate = useMemo(
    () => getNextOrPrimaryOrderShootDate(order),
    [order]
  );
  const eventRem = useMemo(
    () => getEventDaysRemaining(nextOrPrimaryShootDate),
    [nextOrPrimaryShootDate]
  );
  const isFutureEvent = Boolean(eventRem && eventRem.diffDays > 0);
  const isTodayEvent = Boolean(eventRem && eventRem.diffDays === 0);

  const normalizedMainDates = useMemo(
    () =>
      normalizeDateList(
        order.eventDates && order.eventDates.length > 0
          ? order.eventDates
          : order.eventDate
          ? [order.eventDate]
          : []
      ),
    [order.eventDates, order.eventDate]
  );
  const formattedMainDates = useMemo(
    () => formatMultiDateDisplay(normalizedMainDates, order.eventDate),
    [normalizedMainDates, order.eventDate]
  );

  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDatesDraft, setScheduleDatesDraft] = useState<string[]>(normalizedMainDates);
  const [scheduleLocationDraft, setScheduleLocationDraft] = useState(order.eventLocation || "");
  const [serviceSchedulesDraft, setServiceSchedulesDraft] = useState<Record<string, string[]>>(
    order.serviceSchedules || {}
  );
  const [activeCalendarTarget, setActiveCalendarTarget] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = normalizedMainDates[0] ? new Date(`${normalizedMainDates[0]}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const busyDateCounts = useMemo(
    () =>
      busyEventDates.reduce<Record<string, number>>((acc, date) => {
        if (!date) return acc;
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}),
    [busyEventDates]
  );

  useEffect(() => {
    if (!editingSchedule) {
      setScheduleDatesDraft(normalizedMainDates);
      setScheduleLocationDraft(order.eventLocation || "");
      setServiceSchedulesDraft(order.serviceSchedules || {});
      setActiveCalendarTarget(null);
    }
  }, [normalizedMainDates, order.eventLocation, order.serviceSchedules, editingSchedule]);

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

  // Phase Progress Calculations
  const services = useMemo(() => order.services || [], [order.services]);
  const schedulableShootServices = useMemo(
    () => services.filter((svc) => !isDeliverableOnlyService(svc)),
    [services]
  );
  const assignedResources = useMemo(
    () => order.assignedResources || [],
    [order.assignedResources]
  );
  const assignedServicesCount = useMemo(() => {
    return services.filter((svcName) => {
      const svcLower = svcName.trim().toLowerCase();
      return assignedResources.some(
        (r) => (r.skill || "").trim().toLowerCase() === svcLower
      );
    }).length;
  }, [services, assignedResources]);

  const preEventCompleted = !hasErp || services.length === 0 || assignedServicesCount === services.length;

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
    if (order.orderStatus === "COMPLETED") return "phase_delivery";
    if (order.orderStatus === "CANCELLED") return "phase_delivery";

    if (order.orderStatus === "AWAITING_EVENT") {
      if (isTodayEvent) return "phase_event_day";
      if (hasErp && !preEventCompleted) return "phase_pre_event";
      return "phase_event_day";
    }

    if (order.orderStatus === "POST_EVENT_IN_PROGRESS") {
      if (isProductionCompleted) return "phase_delivery";
      return "phase_post_event";
    }

    return "phase_pre_event";
  }, [order.orderStatus, isTodayEvent, hasErp, preEventCompleted, isProductionCompleted]);

  // Phase expansion state: defaults to expanding active phase (and Phase 01/02 when awaiting event)
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseId>>(() =>
    order.orderStatus === "AWAITING_EVENT"
      ? new Set<PhaseId>(["phase_pre_event", "phase_event_day"])
      : new Set<PhaseId>([activePhaseId])
  );

  useEffect(() => {
    if (order.orderStatus === "AWAITING_EVENT") {
      setExpandedPhases(new Set<PhaseId>(["phase_pre_event", "phase_event_day"]));
    } else {
      setExpandedPhases(new Set<PhaseId>([activePhaseId]));
    }
  }, [activePhaseId, order.id, order.orderStatus]);

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

  const focusPipelinePhase = (phaseId: PhaseId) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.add(phaseId);
      return next;
    });
    if (typeof document !== "undefined") {
      const target = document.getElementById(`workflow-phase-${phaseId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const isCancelled = order.orderStatus === "CANCELLED";
  const isPhaseEventDone =
    !isCancelled &&
    (order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED");
  const isPhasePreEventDone =
    !isCancelled &&
    (order.orderStatus === "POST_EVENT_IN_PROGRESS" ||
      order.orderStatus === "COMPLETED" ||
      !hasErp ||
      preEventCompleted);
  const isPhasePostEventDone =
    !isCancelled &&
    isProductionCompleted &&
    (order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED");
  const isPhaseDeliveryDone = !isCancelled && order.orderStatus === "COMPLETED";

  const isPhasePreEventActive = !isCancelled && !isPhasePreEventDone && activePhaseId === "phase_pre_event";
  const isPhaseEventActive = !isCancelled && !isPhaseEventDone && activePhaseId === "phase_event_day";
  const isPhasePostEventActive = !isCancelled && !isPhasePostEventDone && activePhaseId === "phase_post_event";
  const isPhaseDeliveryActive = !isCancelled && !isPhaseDeliveryDone && activePhaseId === "phase_delivery";

  const pipelineStages = useMemo(() => {
    return [
      {
        id: "phase_pre_event" as PhaseId,
        stepNumber: 1,
        shortLabel: hasErp ? "Schedule & Prep" : "Schedule",
        isCompleted: isPhasePreEventDone,
        isActive: isPhasePreEventActive,
      },
      {
        id: "phase_event_day" as PhaseId,
        stepNumber: 2,
        shortLabel: "Event Day",
        isCompleted: isPhaseEventDone,
        isActive: isPhaseEventActive,
      },
      {
        id: "phase_post_event" as PhaseId,
        stepNumber: 3,
        shortLabel: "Production",
        isCompleted: isPhasePostEventDone,
        isActive: isPhasePostEventActive,
      },
      {
        id: "phase_delivery" as PhaseId,
        stepNumber: 4,
        shortLabel: "Delivery",
        isCompleted: isPhaseDeliveryDone,
        isActive: isPhaseDeliveryActive,
      },
    ];
  }, [
    hasErp,
    isPhaseDeliveryActive,
    isPhaseDeliveryDone,
    isPhaseEventActive,
    isPhaseEventDone,
    isPhasePostEventActive,
    isPhasePostEventDone,
    isPhasePreEventActive,
    isPhasePreEventDone,
  ]);

  const completedPipelineCount = pipelineStages.filter((s) => s.isCompleted).length;

  // Multi-date toggle helpers for schedule editing in Phase 01
  const toggleDraftMainDate = (isoDate: string) => {
    setScheduleDatesDraft((prev) => {
      const exists = prev.includes(isoDate);
      const next = exists ? prev.filter((d) => d !== isoDate) : [...prev, isoDate];
      return normalizeDateList(next);
    });
  };

  const toggleDraftServiceDate = (serviceName: string, isoDate: string) => {
    setServiceSchedulesDraft((prev) => {
      const current = prev[serviceName] || [];
      const exists = current.includes(isoDate);
      const next = normalizeDateList(
        exists ? current.filter((d) => d !== isoDate) : [...current, isoDate]
      );
      const updated = { ...prev };
      if (next.length > 0) {
        updated[serviceName] = next;
      } else {
        delete updated[serviceName];
      }
      return updated;
    });
  };

  const currentOrderSavedAndDraftDates = useMemo(() => {
    const savedMain = normalizedMainDates;
    const savedServices = order.serviceSchedules
      ? Object.values(order.serviceSchedules).flat()
      : [];
    const draftMain = scheduleDatesDraft;
    const draftServices = Object.values(serviceSchedulesDraft).flat();
    return new Set<string>([
      ...savedMain,
      ...savedServices,
      ...draftMain,
      ...draftServices,
    ]);
  }, [normalizedMainDates, order.serviceSchedules, scheduleDatesDraft, serviceSchedulesDraft]);

  const todayIsoValue = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, []);

  const renderInlineMultiDateCalendar = (
    selectedDates: string[],
    onToggleDate: (iso: string) => void,
    onClearDates: () => void,
    onCloseCalendar: () => void
  ) => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isCurrentEventDate = currentOrderSavedAndDraftDates.has(iso);
        const isToday = iso === todayIsoValue;
        return {
          day,
          iso,
          otherCount: busyDateCounts[iso] || 0,
          isCurrentEventDate,
          isToday,
        };
      }),
    ];

    return (
      <div className="mt-1.5 rounded-xl border border-border-default bg-white p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
            className="rounded-lg border border-border-default px-2 py-0.5 text-xs font-bold text-text-secondary hover:bg-surface-app"
          >
            ←
          </button>
          <span className="text-xs font-bold text-text-primary">
            {calendarMonth.toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
            className="rounded-lg border border-border-default px-2 py-0.5 text-xs font-bold text-text-secondary hover:bg-surface-app"
          >
            →
          </button>
        </div>
        <p className="mb-2 text-[10px] text-text-tertiary">
          Click dates to toggle selection on or off. Consecutive days format as a range; separate dates stay unblocked in between.
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-text-tertiary">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, index) =>
            cell ? (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onToggleDate(cell.iso)}
                className={`relative flex h-9 flex-col items-center justify-center rounded-lg text-[10px] font-semibold transition ${
                  selectedDates.includes(cell.iso)
                    ? "!bg-brand-blue-primary !text-white ring-2 ring-brand-blue-primary/30 hover:!bg-brand-blue-primary hover:!text-white"
                    : cell.isToday
                    ? "bg-brand-blue-50 text-brand-blue-primary ring-1 ring-brand-blue-soft hover:bg-brand-blue-100"
                    : cell.isCurrentEventDate
                    ? "bg-purple-100 text-purple-900 ring-1 ring-purple-300 hover:bg-purple-200/70"
                    : cell.otherCount > 0
                    ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                    : "text-text-primary hover:bg-surface-app"
                }`}
                title={
                  cell.isCurrentEventDate && cell.otherCount > 0
                    ? `Current event shoot date · ${cell.otherCount} other shoot(s) scheduled`
                    : cell.isCurrentEventDate
                    ? "Current event shoot date"
                    : cell.otherCount > 0
                    ? `${cell.otherCount} other shoot date(s) scheduled`
                    : cell.isToday
                    ? "Today"
                    : "Available"
                }
              >
                <span>{cell.day}</span>
                {cell.isToday && <span className="text-[7px] leading-none">Today</span>}
                {(cell.isCurrentEventDate || cell.otherCount > 0) && (
                  <span className="mx-auto mt-0.5 flex items-center justify-center gap-0.5">
                    {cell.isCurrentEventDate && (
                      <span
                        className={`block h-1 w-1 rounded-full ${
                          selectedDates.includes(cell.iso) ? "bg-purple-200" : "bg-purple-600"
                        }`}
                      />
                    )}
                    {cell.otherCount > 0 && (
                      <span
                        className={`block h-1 w-1 rounded-full ${
                          selectedDates.includes(cell.iso) ? "bg-amber-200" : "bg-amber-500"
                        }`}
                      />
                    )}
                  </span>
                )}
              </button>
            ) : (
              <span key={`empty-${index}`} />
            )
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-2 text-[10px] text-text-tertiary">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-purple-600" /> Current event shoot
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Other shoot dates
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedDates.length > 0 && (
              <button
                type="button"
                onClick={onClearDates}
                className="rounded border border-border-default px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:text-status-danger"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onCloseCalendar}
              className="rounded bg-brand-blue-primary px-2.5 py-0.5 text-[10px] font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Crew search and assignment state for OMS
  const [editingCrewService, setEditingCrewService] = useState<string | null>(null);
  const [activeCrewDropdown, setActiveCrewDropdown] = useState<string | null>(null);
  const [crewSearchQuery, setCrewSearchQuery] = useState<Record<string, string>>({});
  const [serviceCrewDrafts, setServiceCrewDrafts] = useState<Record<string, string[]>>({});
  const [savingCrewService, setSavingCrewService] = useState<string | null>(null);

  const currentServiceCrew = (serviceName: string) => assignedResources
    .filter((assignment) => assignment.skill.trim().toLowerCase() === serviceName.trim().toLowerCase())
    .map((assignment) => assignment.memberName);
  const startEditingServiceCrew = (serviceName: string) => {
    setServiceCrewDrafts((previous) => ({ ...previous, [serviceName]: currentServiceCrew(serviceName) }));
    setEditingCrewService(serviceName);
    setActiveCrewDropdown(serviceName);
  };
  const stageCrew = (serviceName: string, crewName: string) => {
    const cleaned = crewName.trim();
    if (!cleaned) return;
    setServiceCrewDrafts((previous) => {
      const draft = previous[serviceName] ?? currentServiceCrew(serviceName);
      return draft.some((name) => name.toLowerCase() === cleaned.toLowerCase()) ? previous : { ...previous, [serviceName]: [...draft, cleaned] };
    });
    setCrewSearchQuery((previous) => ({ ...previous, [serviceName]: "" }));
  };
  const removeStagedCrew = (serviceName: string, crewName: string) => setServiceCrewDrafts((previous) => ({
    ...previous,
    [serviceName]: (previous[serviceName] ?? currentServiceCrew(serviceName)).filter((name) => name.toLowerCase() !== crewName.toLowerCase()),
  }));
  const saveServiceCrew = async (serviceName: string) => {
    if (!onSaveServiceCrew) return;
    setSavingCrewService(serviceName);
    try {
      await onSaveServiceCrew(serviceName, serviceCrewDrafts[serviceName] ?? currentServiceCrew(serviceName));
      setEditingCrewService(null);
      setActiveCrewDropdown(null);
    } finally {
      setSavingCrewService(null);
    }
  };

  // Task-level crew assignment state for Phase 3
  const [editingTaskCrewId, setEditingTaskCrewId] = useState<string | null>(null);
  const [taskCrewDraft, setTaskCrewDraft] = useState<Record<string, string>>({});

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

  const activeServiceScheduleEntries = useMemo(() => {
    const map = order.serviceSchedules || {};
    return Object.entries(map).filter(
      ([svcName, dates]) => services.includes(svcName) && Array.isArray(dates) && dates.length > 0
    );
  }, [order.serviceSchedules, services]);

  // Active tasks for the Top "Current Main State" Panel during Post-Event Workflow
  const activeStreamTasks = useMemo(() => {
    if (order.orderStatus !== "POST_EVENT_IN_PROGRESS") return [];
    const items: Array<{ streamLabel: string; streamBadgeClass: string; task: Task }> = [];

    const nextPhoto = photoTasks.find((t) => t.status !== "COMPLETED");
    if (nextPhoto) {
      items.push({
        streamLabel: "Photography Pipeline",
        streamBadgeClass: "bg-sky-100 text-sky-800 border-sky-200",
        task: nextPhoto,
      });
    }

    const nextVideo = videoTasks.find((t) => t.status !== "COMPLETED");
    if (nextVideo) {
      items.push({
        streamLabel: "Videography Pipeline",
        streamBadgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
        task: nextVideo,
      });
    }

    otherTasks
      .filter((t) => t.status !== "COMPLETED")
      .forEach((t) => {
        items.push({
          streamLabel: "Additional Production",
          streamBadgeClass: "bg-slate-100 text-slate-700 border-slate-200",
          task: t,
        });
      });

    if (isProductionCompleted) {
      const nextDelivery = deliveryTasks.find((t) => t.status !== "COMPLETED");
      if (nextDelivery) {
        items.push({
          streamLabel: "Final Delivery and Order Completion",
          streamBadgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
          task: nextDelivery,
        });
      }
    }

    return items;
  }, [order.orderStatus, photoTasks, videoTasks, otherTasks, deliveryTasks, isProductionCompleted]);

  const isTaskAssignedToNonOwnerMember = (task: Task): { isMember: boolean; memberName: string } => {
    if (!hasErp) return { isMember: false, memberName: "" };
    const crewInfo = getDefaultCrewForTask(task);
    const name = (crewInfo?.name || task.assignedMemberName || "").trim();
    if (!name || name.toLowerCase() === "unassigned" || name.toLowerCase() === "unassigned crew") {
      return { isMember: false, memberName: "" };
    }
    const lowerName = name.toLowerCase();
    const ownerClean = (studioOwnerName || "").trim().toLowerCase();
    const isOwner =
      (task.assignedMemberId || "").startsWith("owner-") ||
      lowerName.includes("(owner)") ||
      lowerName === "studio owner" ||
      (ownerClean.length > 0 && (lowerName === ownerClean || lowerName.includes(ownerClean)));
    return { isMember: !isOwner, memberName: name };
  };

  return (
    <div className="w-full space-y-5">
      {/* 1. TOP CURRENT MAIN STATE PANEL (Active Action Center) */}
      {displayMode !== "timeline-only" && (order.orderStatus === "CANCELLED" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white font-extrabold text-xs shadow-xs">
              ✕
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                Current Main State
              </span>
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
      ) : order.orderStatus === "COMPLETED" ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/60 p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Current Main State
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-800">
              {allTasksCompletedCount}/{allTasksCount} Steps Done
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
              Orders Completed
            </span>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-emerald-950">
              Order Completed — All Deliverables Approved &amp; Handed Over
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5">
              All post-event workflow stages and final handovers have been completed. The pipeline below is in read-only mode for reference.
            </p>
          </div>
        </div>
      ) : order.orderStatus === "AWAITING_EVENT" ? (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-white to-slate-50 p-4 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Current Main State
            </span>
            {hasErp && services.length > 0 && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  preEventCompleted
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                Crew Readiness: {assignedServicesCount}/{services.length} Services Allocated
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                isTodayEvent
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : "border-blue-200 bg-blue-100/80 text-brand-blue-primary"
              }`}
            >
              {isTodayEvent ? "Event Shoot Active Today" : "Awaiting Event"}
            </span>
            {eventRem && (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                {eventRem.display}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-text-primary">
              {isTodayEvent
                ? `Event Shoot Underway Today (${formattedMainDates})`
                : `Awaiting Scheduled Event (${formattedMainDates || "Date TBD"})`}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {isTodayEvent
                ? "Event shoot is scheduled for today. Post-event production workflows will activate once coverage concludes."
                : isFutureEvent
                ? "Post-event production and customer review workflows remain locked until the scheduled event date."
                : "Event date has arrived. Post-event production workflows are ready to begin."}
            </p>
          </div>
        </div>
      ) : (
        /* POST_EVENT_IN_PROGRESS: Active Workflow & Customer / Studio Action Center */
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/60 via-white to-slate-50 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Current Main State
            </span>
            {allTasksCount > 0 && (
              <span className="text-[11px] font-mono font-bold text-text-secondary">
                {allTasksCompletedCount}/{allTasksCount} Steps Completed ({Math.round((allTasksCompletedCount / allTasksCount) * 100)}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-md border border-blue-200 bg-blue-100/80 px-2 py-0.5 text-[10px] font-bold text-brand-blue-primary">
              {isProductionCompleted ? "Final Delivery and Order Completion" : "Post-Event Workflow"}
            </span>
            {activeStreamTasks.some((item) => item.task.status === "REVIEW") && (
              <span className="rounded-md border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                Pending Customer Review
              </span>
            )}
          </div>

          {actionFeedbackError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {actionFeedbackError}
            </div>
          )}

          {activeStreamTasks.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              <p className="font-bold">All production tasks are completed.</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Order will automatically transition to Completed once financial clearance is recorded.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeStreamTasks.map(({ streamLabel, streamBadgeClass, task }) => {
                const displayTitle = (task.title || "").replace("&", "and");
                const titleLower = (task.title || "").toLowerCase();
                const isRawSelection =
                  titleLower.includes("raw photo") || titleLower.includes("photo selection");
                const status = task.status;
                const isReview = status === "REVIEW";
                const isRework = status === "REWORK";
                const isInProgress = status === "IN_PROGRESS";
                const { isMember, memberName } = isTaskAssignedToNonOwnerMember(task);
                const isBusy = submittingTaskId === task.id;
                const isReworkBoxOpen = reworkOpenTaskId === task.id;
                const linkedDeliverables = (order.driveDeliverables || []).filter(
                  (d) => d.linkedTaskId === task.id
                );
                const showInlineDriveForm =
                  isOms &&
                  (isInProgress || isRework) &&
                  canManageDriveLinks &&
                  Boolean(onSendTaskForReviewWithDriveLink);
                const driveDraft = taskDriveDrafts[task.id] || {};
                const draftTitle =
                  driveDraft.title !== undefined ? driveDraft.title : displayTitle;
                const draftUrl = driveDraft.driveUrl || "";
                const draftNotes = driveDraft.notes || "";

                const stateHeadline = isReview
                  ? `Pending Customer Review — ${displayTitle}`
                  : isRework
                  ? `Post-Event Workflow — Studio working on ${displayTitle} (Rework)`
                  : isInProgress
                  ? `Post-Event Workflow — Studio working on ${displayTitle}`
                  : `Post-Event Workflow — Studio ready to start ${displayTitle}`;

                return (
                  <div
                    key={task.id || task.title}
                    className={`rounded-xl border p-3.5 transition space-y-2.5 ${
                      isReview
                        ? "border-purple-200 bg-purple-50/50"
                        : isRework
                        ? "border-amber-200 bg-amber-50/50"
                        : "border-border-default bg-white"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${streamBadgeClass}`}
                          >
                            {streamLabel}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                              isReview
                                ? "border-purple-200 bg-purple-100 text-purple-800"
                                : isRework
                                ? "border-amber-200 bg-amber-100 text-amber-800"
                                : isInProgress
                                ? "border-blue-200 bg-blue-100 text-blue-800"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isReview
                              ? "Pending Customer View"
                              : isRework
                              ? "Corrections Requested"
                              : isInProgress
                              ? isRawSelection
                                ? "Gathering & Processing Photos"
                                : "In Progress"
                              : isRawSelection
                              ? "Preparing Photo Selection"
                              : "Ready to Start"}
                          </span>
                          {isOms && hasErp && !isReview && isMember && (
                            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800">
                              Pending on Member: {memberName}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-extrabold text-text-primary">
                          {stateHeadline}
                        </h4>

                        {task.reworkNotes && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-950">
                            <span className="font-bold">Rework Note:</span> {task.reworkNotes}
                          </div>
                        )}

                        {linkedDeliverables.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {linkedDeliverables.map((deliv) => (
                              <div
                                key={deliv.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-default bg-white px-2.5 py-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-text-primary truncate">
                                    {deliv.title}
                                  </p>
                                  {deliv.notes && (
                                    <p className="text-[11px] text-text-secondary">
                                      {deliv.notes}
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={deliv.driveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-brand-blue-primary bg-blue-50/60 px-2.5 py-1 text-[11px] font-bold text-brand-blue-primary hover:bg-blue-100 transition shrink-0"
                                >
                                  Open Drive Link
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-[11px] text-text-secondary">
                          {isReview
                            ? isOms
                              ? "Studio has submitted this step for customer review. Customer can mark it Completed or Rework on their tracking page, or Studio Owner can update below on behalf of customer."
                              : "Studio has shared this step for your review. Open the Drive link above, then mark it Completed or request Rework below."
                            : isOms
                            ? isMember
                              ? `Assigned to ${memberName}. Studio Owner can also update this step on behalf of ${memberName}.`
                              : showInlineDriveForm
                              ? "Add the Google Drive link below and send this step to the customer for review."
                              : "Update the current studio step below to move the workflow forward."
                            : "Studio is currently working on this step. Once updated by the studio, you will be able to review and mark Completed or Rework here."}
                        </p>
                      </div>

                      {/* ACTION CONTROLS IN TOP MAIN STATE PANEL */}
                      <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
                        {/* CASE A: Customer Tracking View & Task is in REVIEW */}
                        {!isOms && isReview && (
                          canCustomerAct && onCustomerReviewTask ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void (async () => {
                                    setActionFeedbackError(null);
                                    setSubmittingTaskId(task.id);
                                    try {
                                      await onCustomerReviewTask(task.id, "COMPLETED");
                                      setReworkOpenTaskId(null);
                                    } catch (err) {
                                      setActionFeedbackError(
                                        err instanceof Error ? err.message : "Failed to update review."
                                      );
                                    } finally {
                                      setSubmittingTaskId(null);
                                    }
                                  })()
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition shadow-2xs cursor-pointer disabled:opacity-50"
                              >
                                {isBusy ? "Updating…" : "✓ Mark Completed"}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  setReworkOpenTaskId((prev) => (prev === task.id ? null : task.id))
                                }
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                              >
                                Request Rework
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-semibold text-purple-800 bg-purple-100/80 px-2.5 py-1 rounded-lg border border-purple-200">
                              Awaiting Customer Approval
                            </span>
                          )
                        )}

                        {/* CASE B: Studio OMS View */}
                        {isOms && onUpdateTaskStatus && (
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {(status === "ASSIGNED" || status === "AWAITING_EVENT") && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void (async () => {
                                    setSubmittingTaskId(task.id);
                                    try {
                                      await onUpdateTaskStatus(task.id, "IN_PROGRESS");
                                    } finally {
                                      setSubmittingTaskId(null);
                                    }
                                  })()
                                }
                                className="rounded-lg bg-brand-blue-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-600 transition cursor-pointer shadow-2xs disabled:opacity-50"
                              >
                                {isRawSelection ? "Start Preparation" : "Start Step"}
                                {hasErp && isMember ? ` (On Behalf of ${memberName})` : ""}
                              </button>
                            )}

                            {(status === "IN_PROGRESS" || status === "REWORK") && !showInlineDriveForm && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void (async () => {
                                      setSubmittingTaskId(task.id);
                                      try {
                                        await onUpdateTaskStatus(task.id, "REVIEW");
                                      } finally {
                                        setSubmittingTaskId(null);
                                      }
                                    })()
                                  }
                                  className="rounded-lg bg-purple-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-purple-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  {status === "REWORK" ? "Re-submit for Customer Review" : "Send for Customer Review"}
                                  {hasErp && isMember ? ` (On Behalf of ${memberName})` : ""}
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void (async () => {
                                      setSubmittingTaskId(task.id);
                                      try {
                                        await onUpdateTaskStatus(task.id, "COMPLETED");
                                      } finally {
                                        setSubmittingTaskId(null);
                                      }
                                    })()
                                  }
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  Mark Completed
                                  {hasErp && isMember ? ` (On Behalf of ${memberName})` : ""}
                                </button>
                              </>
                            )}

                            {status === "REVIEW" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void (async () => {
                                      setSubmittingTaskId(task.id);
                                      try {
                                        await onUpdateTaskStatus(task.id, "COMPLETED");
                                        setReworkOpenTaskId(null);
                                      } finally {
                                        setSubmittingTaskId(null);
                                      }
                                    })()
                                  }
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                  Completed (On Behalf of Customer)
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setReworkOpenTaskId((prev) => (prev === task.id ? null : task.id))
                                  }
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                                >
                                  Rework (On Behalf of Customer)
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline 3-Field Google Drive Deliverable & Send for Customer Review (OMS Active Step) */}
                    {showInlineDriveForm && onSendTaskForReviewWithDriveLink && onUpdateTaskStatus && (
                      <div className="pt-2.5 border-t border-border-divider space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1">
                              Deliverable Title *
                            </label>
                            <input
                              type="text"
                              value={draftTitle}
                              onChange={(e) =>
                                setTaskDriveDrafts((prev) => ({
                                  ...prev,
                                  [task.id]: { ...prev[task.id], title: e.target.value },
                                }))
                              }
                              placeholder={displayTitle}
                              className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1">
                              Google Drive Link *
                            </label>
                            <input
                              type="url"
                              value={draftUrl}
                              onChange={(e) =>
                                setTaskDriveDrafts((prev) => ({
                                  ...prev,
                                  [task.id]: { ...prev[task.id], driveUrl: e.target.value },
                                }))
                              }
                              placeholder="https://drive.google.com/drive/folders/..."
                              className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-text-secondary mb-1">
                              Optional Notes
                            </label>
                            <input
                              type="text"
                              value={draftNotes}
                              onChange={(e) =>
                                setTaskDriveDrafts((prev) => ({
                                  ...prev,
                                  [task.id]: { ...prev[task.id], notes: e.target.value },
                                }))
                              }
                              placeholder="Instructions for customer (optional)"
                              className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void (async () => {
                                  setActionFeedbackError(null);
                                  const cleanUrl = draftUrl.trim();
                                  const cleanTitle = draftTitle.trim() || displayTitle;
                                  if (!cleanUrl && linkedDeliverables.length === 0) {
                                    setActionFeedbackError("Please enter a Google Drive link to share with the customer for review.");
                                    return;
                                  }
                                  if (cleanUrl) {
                                    try {
                                      new URL(cleanUrl);
                                    } catch {
                                      setActionFeedbackError("Please enter a valid Google Drive URL (starting with https://).");
                                      return;
                                    }
                                  }
                                  setSubmittingTaskId(task.id);
                                  try {
                                    await onSendTaskForReviewWithDriveLink({
                                      taskId: task.id,
                                      title: cleanTitle,
                                      driveUrl: cleanUrl,
                                      notes: draftNotes.trim() || undefined,
                                    });
                                    setTaskDriveDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[task.id];
                                      return next;
                                    });
                                  } catch (err) {
                                    setActionFeedbackError(
                                      err instanceof Error ? err.message : "Failed to submit Drive link for review."
                                    );
                                  } finally {
                                    setSubmittingTaskId(null);
                                  }
                                })()
                              }
                              className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-purple-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              {isBusy
                                ? "Sending…"
                                : isRework
                                ? "Re-submit & Send for Customer Review"
                                : "Submit & Send for Customer Review"}
                            </button>

                            {linkedDeliverables.length === 0 && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void (async () => {
                                    setActionFeedbackError(null);
                                    setSubmittingTaskId(task.id);
                                    try {
                                      await onUpdateTaskStatus(task.id, "REVIEW");
                                    } finally {
                                      setSubmittingTaskId(null);
                                    }
                                  })()
                                }
                                className="rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                              >
                                Send without Drive link
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void (async () => {
                                setSubmittingTaskId(task.id);
                                try {
                                  await onUpdateTaskStatus(task.id, "COMPLETED");
                                } finally {
                                  setSubmittingTaskId(null);
                                }
                              })()
                            }
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 transition cursor-pointer shadow-2xs disabled:opacity-50"
                          >
                            Mark Completed
                            {hasErp && isMember ? ` (On Behalf of ${memberName})` : ""}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Rework Note Box (for Customer or Studio Owner On Behalf of Customer) */}
                    {isReview && isReworkBoxOpen && (
                      <div className="pt-2 border-t border-purple-200/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={reworkNotesDraft[task.id] || ""}
                          onChange={(e) =>
                            setReworkNotesDraft((prev) => ({
                              ...prev,
                              [task.id]: e.target.value,
                            }))
                          }
                          placeholder={
                            isOms
                              ? "Optional rework note recorded on behalf of customer..."
                              : "Describe the corrections or changes needed (optional)..."
                          }
                          className="flex-1 rounded-lg border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReworkOpenTaskId(null)}
                            className="rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void (async () => {
                                setActionFeedbackError(null);
                                setSubmittingTaskId(task.id);
                                const note = (reworkNotesDraft[task.id] || "").trim();
                                try {
                                  if (isOms && onUpdateTaskStatus) {
                                    await onUpdateTaskStatus(
                                      task.id,
                                      "REWORK",
                                      note || "Rework requested on behalf of customer."
                                    );
                                  } else if (!isOms && onCustomerReviewTask) {
                                    await onCustomerReviewTask(
                                      task.id,
                                      "REWORK",
                                      note || "Customer requested rework."
                                    );
                                  }
                                  setReworkOpenTaskId(null);
                                } catch (err) {
                                  setActionFeedbackError(
                                    err instanceof Error ? err.message : "Failed to submit rework."
                                  );
                                } finally {
                                  setSubmittingTaskId(null);
                                }
                              })()
                            }
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 transition cursor-pointer disabled:opacity-50"
                          >
                            {isBusy
                              ? "Submitting…"
                              : isOms
                              ? "Confirm Rework (On Behalf of Customer)"
                              : "Submit Rework Request"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* 2. Unified Workflow Pipeline Panel */}
      {displayMode !== "main-state-only" && (() => {
        const renderVerticalConnector = (isCompleted: boolean, isActive: boolean) => (
          <div className="flex flex-1 flex-col items-center py-1" aria-hidden="true">
            <div
              className={`w-[3px] flex-1 min-h-[20px] rounded-full transition-colors duration-300 ${
                isCompleted
                  ? "bg-emerald-500"
                  : isActive
                  ? "bg-gradient-to-b from-brand-blue-primary via-sky-300 to-slate-200"
                  : "bg-slate-200"
              }`}
            />
            <svg
              className={`h-3 w-3 -mt-0.5 shrink-0 transition-colors duration-300 ${
                isCompleted ? "text-emerald-500" : isActive ? "text-sky-400" : "text-slate-300"
              }`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M6 9.5L1.75 4.5h8.5L6 9.5z" />
            </svg>
          </div>
        );

        const pipelineContent = (
          <div className="space-y-4">
            {/* Horizontal Connected Pipeline Overview (Full-width responsive, zero horizontal scroll) */}
            <div
              className="rounded-xl border border-border-default bg-slate-50/70 px-2 sm:px-3 py-2.5"
              role="navigation"
              aria-label="Pipeline stages"
            >
              <div className="grid grid-cols-4 items-start w-full">
                {pipelineStages.map((stage, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === pipelineStages.length - 1;
                  const prevStage = !isFirst ? pipelineStages[idx - 1] : null;
                  const isExpanded = expandedPhases.has(stage.id);

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => focusPipelinePhase(stage.id)}
                      className={`group flex flex-col items-center gap-1.5 rounded-lg px-1 py-1.5 text-center transition cursor-pointer min-w-0 ${
                        isExpanded ? "bg-white shadow-2xs" : "hover:bg-white/80"
                      }`}
                      title={`Jump to Phase 0${stage.stepNumber}: ${stage.shortLabel}`}
                    >
                      <div className="flex items-center w-full">
                        <div
                          className={`h-[2px] flex-1 transition-colors ${
                            isFirst
                              ? "bg-transparent"
                              : prevStage?.isCompleted
                              ? "bg-emerald-500"
                              : prevStage?.isActive
                              ? "bg-brand-blue-primary/60"
                              : "bg-slate-200"
                          }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold transition-colors shrink-0 ${
                            stage.isCompleted
                              ? "bg-emerald-500 text-white"
                              : stage.isActive
                              ? "bg-brand-blue-primary text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {stage.isCompleted ? "✓" : stage.stepNumber}
                        </span>
                        <div
                          className={`h-[2px] flex-1 transition-colors ${
                            isLast
                              ? "bg-transparent"
                              : stage.isCompleted
                              ? "bg-emerald-500"
                              : stage.isActive
                              ? "bg-brand-blue-primary/60"
                              : "bg-slate-200"
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold leading-tight w-full px-0.5 transition-colors ${
                          stage.isCompleted
                            ? "text-emerald-800"
                            : stage.isActive
                            ? "text-brand-blue-primary"
                            : "text-text-secondary group-hover:text-text-primary"
                        }`}
                      >
                        {stage.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical Segmented Pipeline Stages */}
            <div className="space-y-0">
              {/* PHASE 1: Pre-Event Schedule & Preparation (ERP) / Pre-Event Schedule (Free) */}
              <div id="workflow-phase-phase_pre_event" className="flex items-stretch gap-3 sm:gap-3.5">
                <div className="flex flex-col items-center w-7 shrink-0 pt-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-extrabold text-xs transition-all shrink-0 ${
                      isPhasePreEventDone
                        ? "bg-emerald-500 text-white shadow-2xs"
                        : isPhasePreEventActive
                        ? "bg-brand-blue-primary text-white ring-2 ring-blue-100 shadow-2xs"
                        : "bg-slate-100 text-slate-500 border border-slate-300"
                    }`}
                  >
                    {isPhasePreEventDone ? "✓" : "1"}
                  </div>
                  {renderVerticalConnector(isPhasePreEventDone, isPhasePreEventActive)}
                </div>

                <div className="flex-1 min-w-0 pb-3.5">
                  <div
                    className={`rounded-xl border p-3.5 sm:p-4 transition ${
                      isPhasePreEventDone
                        ? "border-emerald-200/90 bg-emerald-50/15"
                        : isPhasePreEventActive
                        ? "border-blue-200 bg-white ring-1 ring-blue-100/70"
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
                      isPhasePreEventDone
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-blue-50 text-brand-blue-primary border-blue-200"
                    }`}
                  >
                    {order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                      ? "Completed"
                      : !hasErp
                      ? "Scheduled"
                      : preEventCompleted
                      ? "Schedule & Prep Ready"
                      : "Crew Allocation In Progress"}
                  </span>
                  {hasErp && services.length > 0 && (
                    <span className="text-[10px] font-mono font-semibold text-text-tertiary">
                      ({assignedServicesCount}/{services.length} services allocated)
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">
                  {hasErp ? "Pre-Event Schedule & Preparation" : "Pre-Event Schedule"}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {hasErp
                    ? "Basic event details, schedule, booked services, and shoot crew assignment"
                    : "Basic event details, schedule, venue, and booked services"}
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
              <div className="mt-4 pt-3.5 border-t border-border-default/60 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    Basic Event Information &amp; Schedule
                  </span>
                  {isOms && onSaveSchedule && !editingSchedule && (
                    <button
                      type="button"
                      onClick={() => setEditingSchedule(true)}
                      className="rounded border border-border-default bg-white px-2 py-1 text-[10px] font-semibold text-brand-blue-primary hover:border-brand-blue-primary cursor-pointer"
                    >
                      Edit schedule
                    </button>
                  )}
                </div>

                {editingSchedule ? (
                  <div className="space-y-3 rounded-xl border border-brand-blue-soft bg-blue-50/40 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block">
                          Main Event Date(s)
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveCalendarTarget((prev) => (prev === "__main__" ? null : "__main__"))
                          }
                          className="mt-1 flex w-full items-center justify-between rounded border border-border-default bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-text-primary hover:border-brand-blue-primary"
                        >
                          <span className="truncate">
                            {scheduleDatesDraft.length > 0
                              ? formatMultiDateDisplay(scheduleDatesDraft)
                              : "Select one or multiple dates"}
                          </span>
                          <span className="text-[10px] font-bold text-brand-blue-primary ml-2 shrink-0">
                            {scheduleDatesDraft.length > 1
                              ? `${scheduleDatesDraft.length} days`
                              : "Calendar"}
                          </span>
                        </button>
                        {scheduleDatesDraft.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {scheduleDatesDraft.map((iso) => (
                              <span
                                key={iso}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-blue-primary"
                              >
                                {iso}
                                <button
                                  type="button"
                                  onClick={() => toggleDraftMainDate(iso)}
                                  className="font-bold hover:text-status-danger"
                                  aria-label={`Remove ${iso}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-secondary block">
                          Shoot Venue
                        </label>
                        <input
                          type="text"
                          value={scheduleLocationDraft}
                          onChange={(event) => setScheduleLocationDraft(event.target.value)}
                          placeholder="Client Venue / Location"
                          className="mt-1 w-full rounded border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-blue-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    {activeCalendarTarget === "__main__" &&
                      renderInlineMultiDateCalendar(
                        scheduleDatesDraft,
                        toggleDraftMainDate,
                        () => setScheduleDatesDraft([]),
                        () => setActiveCalendarTarget(null)
                      )}

                    {/* Separate Event / Shoot Dates for Booked Shoot Services */}
                    {schedulableShootServices.length > 0 && (
                      <div className="pt-2.5 border-t border-blue-200/70 space-y-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block">
                            Separate Event / Shoot Dates (Optional)
                          </span>
                          <span className="text-[10px] text-text-tertiary block">
                            If any booked shoot service happens on a different date than the main event, set its date(s) below. Leave blank if covered on the main event date.
                          </span>
                        </div>
                        <div className="space-y-2">
                          {schedulableShootServices.map((svcName) => {
                            const svcDates = serviceSchedulesDraft[svcName] || [];
                            const isOpen = activeCalendarTarget === `svc:${svcName}`;
                            return (
                              <div
                                key={svcName}
                                className="rounded-lg border border-border-default bg-white p-2.5 space-y-1.5"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-text-primary">
                                    {svcName}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {svcDates.length > 0 ? (
                                      svcDates.map((iso) => (
                                        <span
                                          key={iso}
                                          className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-brand-blue-primary"
                                        >
                                          {iso}
                                          <button
                                            type="button"
                                            onClick={() => toggleDraftServiceDate(svcName, iso)}
                                            className="font-bold hover:text-status-danger"
                                            aria-label={`Remove ${iso} from ${svcName}`}
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] italic text-text-tertiary">
                                        Same as main event ({formatMultiDateDisplay(scheduleDatesDraft)})
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveCalendarTarget((prev) =>
                                          prev === `svc:${svcName}` ? null : `svc:${svcName}`
                                        )
                                      }
                                      className="rounded border border-border-default bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-brand-blue-primary hover:border-brand-blue-primary"
                                    >
                                      {isOpen ? "Hide calendar" : svcDates.length > 0 ? "Edit dates" : "Set separate date"}
                                    </button>
                                  </div>
                                </div>
                                {isOpen &&
                                  renderInlineMultiDateCalendar(
                                    svcDates,
                                    (iso) => toggleDraftServiceDate(svcName, iso),
                                    () =>
                                      setServiceSchedulesDraft((prev) => {
                                        const next = { ...prev };
                                        delete next[svcName];
                                        return next;
                                      }),
                                    () => setActiveCalendarTarget(null)
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={savingSchedule}
                        onClick={() => setEditingSchedule(false)}
                        className="rounded border border-border-default bg-white px-2.5 py-1 text-[10px] font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingSchedule || scheduleDatesDraft.length === 0}
                        onClick={() =>
                          void (async () => {
                            if (!onSaveSchedule || scheduleDatesDraft.length === 0) return;
                            setSavingSchedule(true);
                            try {
                              const sortedMain = normalizeDateList(scheduleDatesDraft);
                              await onSaveSchedule(
                                sortedMain[0],
                                scheduleLocationDraft,
                                sortedMain,
                                serviceSchedulesDraft
                              );
                              setEditingSchedule(false);
                            } finally {
                              setSavingSchedule(false);
                            }
                          })()
                        }
                        className="rounded bg-brand-blue-primary px-3 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                      >
                        {savingSchedule ? "Saving…" : "Save schedule"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
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
                          Event Schedule
                        </span>
                        <span
                          className={`font-semibold block ${
                            order.orderStatus === "POST_EVENT_IN_PROGRESS" || order.orderStatus === "COMPLETED"
                              ? "text-emerald-800"
                              : isTodayEvent
                              ? "text-brand-blue-primary"
                              : "text-text-secondary"
                          }`}
                        >
                          {formattedMainDates || "Date TBD"}
                        </span>
                      </div>
                    </div>

                    {activeServiceScheduleEntries.length > 0 && (
                      <div className="rounded-xl border border-border-default/60 bg-slate-50/70 p-2.5 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                          Separate Event / Shoot Dates
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {activeServiceScheduleEntries.map(([svcName, dates]) => (
                            <div
                              key={svcName}
                              className="flex items-center justify-between rounded-lg border border-border-default/60 bg-white px-2.5 py-1.5 text-xs"
                            >
                              <span className="font-semibold text-text-primary truncate pr-2">
                                {svcName}
                              </span>
                              <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-brand-blue-primary shrink-0">
                                {formatMultiDateDisplay(dates)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasErp && services.length > 0 && (
                      <div className="rounded-xl border border-border-default/60 bg-slate-50/70 p-2.5 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                          Booked Services
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {services.map((svcName) => {
                            const separateDatesForSvc = order.serviceSchedules?.[svcName] || [];
                            return (
                              <span
                                key={svcName}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs font-semibold text-text-primary"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary shrink-0" />
                                <span>{svcName}</span>
                                {separateDatesForSvc.length > 0 && (
                                  <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-brand-blue-primary">
                                    {formatMultiDateDisplay(separateDatesForSvc)}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Crew & Service Allocation inside Phase 01 (Starter & Professional) */}
                    {hasErp && (
                      <div className="pt-2 border-t border-border-default/60 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                          <span>Booked Services</span>
                          {isOms && <span>Assigned Shoot Crew</span>}
                        </div>

                  {services.length === 0 ? (
                    <p className="text-xs text-text-tertiary py-2 italic">No services listed for this order.</p>
                  ) : (
                    <div className="relative divide-y divide-border-default/60 rounded-xl border border-border-default/80 bg-white overflow-visible text-xs">
                      {services.map((svcName) => {
                        const svcLower = svcName.trim().toLowerCase();
                        const assignedForService = assignedResources.filter((resource) => (resource.skill || "").trim().toLowerCase() === svcLower);
                        const isEditingThis = editingCrewService === svcName;
                        const displayedCrew = assignedForService.map((resource) => resource.memberName);
                        const stagedCrew = serviceCrewDrafts[svcName] ?? displayedCrew;
                        const currentQuery = crewSearchQuery[svcName] ?? "";
                        const trimmedQuery = currentQuery.trim();
                        const separateDatesForSvc = order.serviceSchedules?.[svcName] || [];

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
                            className="relative flex flex-col sm:flex-row sm:items-center justify-between p-2.5 gap-2 hover:bg-slate-50/50 transition"
                          >
                            <div className="font-semibold text-text-primary text-xs flex items-center gap-2 flex-wrap">
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary shrink-0" />
                              <span>{svcName}</span>
                              {separateDatesForSvc.length > 0 && (
                                <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue-primary">
                                  {formatMultiDateDisplay(separateDatesForSvc)}
                                </span>
                              )}
                            </div>

                            {/* Crew Assignment Control for OMS */}
                            {isOms && hasErp ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {!isEditingThis ? (
                                  <>
                                    {displayedCrew.length > 0 ? displayedCrew.map((name) => <span key={name} className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">{name}</span>) : <span className="text-[11px] italic text-text-tertiary">Unassigned</span>}
                                    {onSaveServiceCrew && <button type="button" onClick={() => startEditingServiceCrew(svcName)} className="rounded border border-border-default bg-white px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue-primary hover:border-brand-blue-primary">{displayedCrew.length ? "Edit" : "Assign crew"}</button>}
                                  </>
                                ) : (
                                  <div className="relative flex flex-col items-stretch gap-1.5 min-w-[220px]">
                                    <div className="flex flex-wrap gap-1">{stagedCrew.map((name) => <span key={name} className="inline-flex items-center gap-1 rounded bg-brand-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue-primary">{name}<button type="button" onClick={() => removeStagedCrew(svcName, name)} aria-label={`Remove ${name}`}>×</button></span>)}</div>
                                    <div className="relative min-w-[200px]">
                                      <input
                                        type="text"
                                        placeholder={hasErp ? "Add a member…" : "Type crew name…"}
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
                                              stageCrew(svcName, trimmedQuery);
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
                                                onClick={() => stageCrew(svcName, trimmedQuery)}
                                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-amber-50 cursor-pointer bg-amber-50/50 border border-amber-200/70 mb-1 transition"
                                              >
                                                <span className="font-semibold text-text-primary truncate">
                                                  {trimmedQuery}
                                                </span>
                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded shrink-0">
                                                  {hasErp ? "Add" : "Add Temp"}
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
                                                    onClick={() => stageCrew(svcName, c.name)}
                                                    className="flex items-center justify-between px-2 py-1 rounded-lg text-xs hover:bg-blue-50 cursor-pointer"
                                                  >
                                                    <span className="font-semibold text-text-primary truncate">
                                                      {c.name}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-brand-blue-primary bg-blue-100/60 px-1.5 py-0.2 rounded">
                                                      Add
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* 3. Known Freelancers / Temporary Crew */}
                                            {matchingTemporaryCrew.length > 0 && (
                                              <div className="space-y-0.5 mb-1">
                                                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-800/70 px-1 py-0.5">
                                                  Temporary Crew
                                                </div>
                                                {matchingTemporaryCrew.map((t) => (
                                                  <div
                                                    key={t.id}
                                                    onClick={() => stageCrew(svcName, t.name)}
                                                    className="flex items-center justify-between px-2 py-1 rounded-lg text-xs hover:bg-amber-100/60 cursor-pointer bg-amber-50/40"
                                                  >
                                                    <span className="font-semibold text-text-primary truncate">
                                                      {t.name} (Temp)
                                                    </span>
                                                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                                      Add
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
                                    <div className="flex justify-end gap-1"><button type="button" onClick={() => { setEditingCrewService(null); setActiveCrewDropdown(null); }} className="rounded border border-border-default bg-white px-2 py-1 text-[10px] font-semibold text-text-secondary">Cancel</button><button type="button" disabled={savingCrewService === svcName} onClick={() => void saveServiceCrew(svcName)} className="rounded bg-brand-blue-primary px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50">{savingCrewService === svcName ? "Saving…" : "Save crew assignments"}</button></div>
                                  </div>
                                )}
                              </div>
                            ) : !isOms && hasErp ? (
                              /* Customer-Safe Read-Only View (No private wages or staff emails) */
                              <div className="flex items-center gap-1.5 text-xs">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    assignedForService.length > 0
                                      ? "bg-emerald-500"
                                      : "bg-slate-300"
                                  }`}
                                />
                                <span
                                  className={`font-semibold ${
                                    assignedForService.length > 0
                                      ? "text-text-primary"
                                      : "text-text-tertiary"
                                  }`}
                                >
                                  {assignedForService.length > 0
                                    ? "Crew & Equipment Confirmed"
                                    : "Unassigned"}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
                  </div>
                </div>
              </div>

              {/* PHASE 2: Event Day (Compact Phase between Pre-Event Schedule & Post-Event Production) */}
              <div id="workflow-phase-phase_event_day" className="flex items-stretch gap-3 sm:gap-3.5">
                <div className="flex flex-col items-center w-7 shrink-0 pt-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-extrabold text-xs transition-all shrink-0 ${
                      isPhaseEventDone
                        ? "bg-emerald-500 text-white shadow-2xs"
                        : isPhaseEventActive
                        ? "bg-brand-blue-primary text-white ring-2 ring-blue-100 shadow-2xs"
                        : "bg-slate-100 text-slate-400 border border-slate-300"
                    }`}
                  >
                    {isPhaseEventDone ? "✓" : "2"}
                  </div>
                  {renderVerticalConnector(isPhaseEventDone, isPhaseEventActive)}
                </div>

                <div className="flex-1 min-w-0 pb-3.5">
                  <div
                    className={`rounded-xl border p-3.5 sm:p-4 transition ${
                      isPhaseEventDone
                        ? "border-emerald-200/90 bg-emerald-50/15"
                        : isPhaseEventActive
                        ? "border-blue-200 bg-white ring-1 ring-blue-100/70"
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
                              isPhaseEventDone
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : isTodayEvent
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-brand-blue-primary border-blue-200"
                            }`}
                          >
                            {isPhaseEventDone
                              ? "Shoot Completed"
                              : isTodayEvent
                              ? "Event Day Today"
                              : "Get Ready for Event"}
                          </span>
                          {eventRem && !isPhaseEventDone && (
                            <span className="text-[10px] font-mono font-semibold text-text-tertiary">
                              ({eventRem.display})
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-text-primary mt-0.5">Event Day</h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {isPhaseEventDone
                            ? `Event coverage concluded (${formattedMainDates}) — moved to post-event production`
                            : isTodayEvent
                            ? `Get ready for the event — scheduled today (${formattedMainDates})`
                            : `Get ready for the event on ${formattedMainDates || "scheduled date"}`}
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
                      <div className="mt-3 pt-3 border-t border-border-default/60 text-xs">
                        <div
                          className={`rounded-lg border px-3 py-2 ${
                            isPhaseEventDone
                              ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                              : isTodayEvent
                              ? "border-amber-200 bg-amber-50/60 text-amber-950"
                              : "border-blue-200/80 bg-blue-50/40 text-text-primary"
                          }`}
                        >
                          {isPhaseEventDone
                            ? `Event day completed (${formattedMainDates}). Post-event production workflow is active below.`
                            : isTodayEvent
                            ? `Get ready for the event! Today (${formattedMainDates}) is the scheduled event day${order.eventLocation ? ` at ${order.eventLocation}` : ""}. Post-event production starts automatically after the event date.`
                            : `Get ready for the event on ${formattedMainDates || "Date TBD"}${order.eventLocation ? ` · ${order.eventLocation}` : ""}.`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PHASE 3: Post-Event Production */}
              <div id="workflow-phase-phase_post_event" className="flex items-stretch gap-3 sm:gap-3.5">
                <div className="flex flex-col items-center w-7 shrink-0 pt-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-extrabold text-xs transition-all shrink-0 ${
                      isPhasePostEventDone
                        ? "bg-emerald-500 text-white shadow-2xs"
                        : isPhasePostEventActive
                        ? "bg-brand-blue-primary text-white ring-2 ring-blue-100 shadow-2xs"
                        : "bg-slate-100 text-slate-400 border border-slate-300"
                    }`}
                  >
                    {isPhasePostEventDone ? "✓" : "3"}
                  </div>
                  {renderVerticalConnector(isPhasePostEventDone, isPhasePostEventActive)}
                </div>

                <div className="flex-1 min-w-0 pb-3.5">
                  <div
                    className={`rounded-xl border p-3.5 sm:p-4 transition ${
                      isPhasePostEventDone
                        ? "border-emerald-200/90 bg-emerald-50/15"
                        : isPhasePostEventActive
                        ? "border-blue-200 bg-white ring-1 ring-blue-100/70"
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
                      : "Awaiting Event"}
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
                      {photoTasks.map((task) =>
                        renderTaskRow(task, order.orderStatus === "AWAITING_EVENT")
                      )}
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
                          Stream B
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
                      {videoTasks.map((task) =>
                        renderTaskRow(task, order.orderStatus === "AWAITING_EVENT")
                      )}
                    </div>
                  </div>
                )}

                {/* Other configured tasks */}
                {otherTasks.length > 0 && (
                  <div className="rounded-xl border border-border-default bg-slate-50/50 p-3 space-y-2">
                    <span className="text-xs font-bold text-text-primary block">Additional Tasks</span>
                    <div className="space-y-1.5">
                      {otherTasks.map((task) =>
                        renderTaskRow(task, order.orderStatus === "AWAITING_EVENT")
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
                  </div>
                </div>
              </div>

              {/* PHASE 4: Final Delivery and Order Completion */}
              <div id="workflow-phase-phase_delivery" className="flex items-stretch gap-3 sm:gap-3.5">
                <div className="flex flex-col items-center w-7 shrink-0 pt-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md font-extrabold text-xs transition-all shrink-0 ${
                      isPhaseDeliveryDone
                        ? "bg-emerald-500 text-white shadow-2xs"
                        : isPhaseDeliveryActive
                        ? "bg-brand-blue-primary text-white ring-2 ring-blue-100 shadow-2xs"
                        : "bg-slate-100 text-slate-400 border border-slate-300"
                    }`}
                  >
                    {isPhaseDeliveryDone ? "✓" : "4"}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={`rounded-xl border p-3.5 sm:p-4 transition ${
                      isPhaseDeliveryDone
                        ? "border-emerald-300 bg-emerald-50/30"
                        : isPhaseDeliveryActive
                        ? "border-blue-200 bg-white ring-1 ring-blue-100/70"
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
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : isProductionCompleted && isDeliveryCompleted && order.orderStatus !== "AWAITING_EVENT"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : isProductionCompleted && order.orderStatus !== "AWAITING_EVENT"
                        ? "bg-blue-50 text-brand-blue-primary border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {order.orderStatus === "COMPLETED"
                      ? "Orders Completed"
                      : isProductionCompleted && isDeliveryCompleted && order.orderStatus !== "AWAITING_EVENT"
                      ? "Final Delivery Done · Pending Payment Clearance"
                      : isProductionCompleted && order.orderStatus !== "AWAITING_EVENT"
                      ? "Unlocked · Final Delivery in Progress"
                      : "Locked · Complete Phase 03 First"}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-text-primary mt-0.5">
                  Final Delivery and Order Completion
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Client review proofs, album printing, digital gallery handover, and order completion
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
                    {deliveryTasks.map((task) =>
                      renderTaskRow(
                        task,
                        order.orderStatus === "AWAITING_EVENT" || !isProductionCompleted
                      )
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3 border border-border-default/60 text-text-secondary space-y-1">
                    <p className="font-semibold text-text-primary">
                      {order.orderStatus === "COMPLETED"
                        ? "✓ All workflow phases and deliverable handovers have been officially concluded."
                        : isProductionCompleted && order.orderStatus !== "AWAITING_EVENT"
                        ? "Unlocked — Ready for digital album and deliverable dispatch"
                        : "Locked until Phase 03 (Post-Event Production) is completed."}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      All deliverables will be presented to the client via their passkey-secured tracking link.
                    </p>
                  </div>
                )}

                {order.orderStatus === "COMPLETED" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-[11px] font-semibold text-emerald-900">
                    ✓ Final delivery is complete and the order status is now Orders Completed.
                  </div>
                ) : isDeliveryCompleted && isProductionCompleted && order.orderStatus !== "AWAITING_EVENT" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] font-medium text-amber-900">
                    Final delivery is complete. Order will automatically move to Orders Completed once full payment is marked Paid.
                  </div>
                ) : null}

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
              </div>
            </div>
          </div>
        );

        const orderStatusBadgeClass =
          order.orderStatus === "COMPLETED"
            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
            : order.orderStatus === "POST_EVENT_IN_PROGRESS"
            ? "bg-blue-100 text-blue-800 border border-blue-200"
            : order.orderStatus === "CANCELLED"
            ? "bg-rose-100 text-rose-800 border border-rose-200"
            : "bg-amber-100 text-amber-800 border border-amber-200";

        const orderStatusText =
          order.orderStatus === "COMPLETED"
            ? "Completed"
            : order.orderStatus === "POST_EVENT_IN_PROGRESS"
            ? "Post-Event In Progress"
            : order.orderStatus === "CANCELLED"
            ? "Cancelled"
            : "Awaiting Event";

        return displayMode === "full" ? (
          <section
            aria-label="Order Lifecycle Pipeline"
            className="rounded-2xl border border-border-default bg-white p-4 sm:p-5 shadow-2xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border-divider pb-3">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-text-primary leading-snug">
                  Order Lifecycle Pipeline
                </h3>
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  {hasErp
                    ? "End-to-end workflow across schedule & prep, event day, production, and delivery"
                    : "End-to-end workflow across schedule, event day, production, and delivery"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <span
                  className={`text-[11px] font-mono font-bold tabular-nums ${
                    completedPipelineCount === pipelineStages.length
                      ? "text-emerald-700"
                      : "text-text-secondary"
                  }`}
                >
                  {completedPipelineCount}/{pipelineStages.length}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${orderStatusBadgeClass}`}>
                  {orderStatusText}
                </span>
              </div>
            </div>
            {pipelineContent}
          </section>
        ) : (
          pipelineContent
        );
      })()}
    </div>
  );

  // Helper renderer for individual task rows
  function renderTaskRow(task: Task, isLockedPhase = false) {
    const taskAge = calculateTaskAgeBadge(task);
    const displayTitle = (task.title || "").replace("&", "and");

    const effectiveStatus: TaskStatus = task.status;

    const isDone = effectiveStatus === "COMPLETED";
    const isInProgress = effectiveStatus === "IN_PROGRESS";
    const isReview = effectiveStatus === "REVIEW";
    const isRework = effectiveStatus === "REWORK";
    const titleLower = task.title.toLowerCase();
    const isRawSelection = titleLower.includes("raw photo") || titleLower.includes("photo selection");
    const isPhotoEditing = titleLower.includes("photo editing") || titleLower.includes("retouch") || titleLower.includes("color grading");

    const statusBadgeStyle = isDone
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : isInProgress
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : isReview
      ? "bg-purple-100 text-purple-800 border-purple-200"
      : isRework
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-slate-100 text-slate-700 border-slate-200";

    const statusLabel = isLockedPhase && !isDone
      ? null
      : isDone
      ? (isRawSelection ? "Selection confirmed" : "Completed")
      : isInProgress
      ? (isRawSelection ? "Gathering & processing photos" : isPhotoEditing ? "Editing in progress" : "In Progress")
      : isReview
      ? "Pending with customer"
      : isRework
      ? "Corrections requested"
      : isRawSelection
      ? "Preparing photo selection"
      : "Ready to start";
    const nextActionOwner = isLockedPhase || isDone ? null : isReview ? "Customer" : "Studio";

    return (
      <div
        key={task.id || task.title}
        className={`rounded-xl border p-2.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          isLockedPhase && !isDone
            ? "bg-slate-50/70 border-border-default/60 opacity-75"
            : isDone
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
            {statusLabel && (
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${statusBadgeStyle}`}>
                {statusLabel}
              </span>
            )}
            {nextActionOwner && (
              <span
                className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                  nextActionOwner === "Customer"
                    ? "border-purple-200 bg-purple-50 text-purple-800"
                    : "border-brand-blue-soft bg-brand-blue-50 text-brand-blue-primary"
                }`}
              >
                Next action: {nextActionOwner}
              </span>
            )}
            {isOms && hasErp && !isLockedPhase && (
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${taskAge.colorClass}`}>
                {taskAge.label}
              </span>
            )}
          </div>
          {isOms && hasErp && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] text-text-tertiary">Crew:</span>
              {editingTaskCrewId === task.id ? (
                <div className="relative inline-flex items-center gap-1">
                  <input
                    autoFocus
                    list={`task-crew-${task.id}`}
                    value={taskCrewDraft[task.id] ?? task.assignedMemberName ?? getDefaultCrewForTask(task)?.name ?? ""}
                    onChange={(event) => setTaskCrewDraft((previous) => ({ ...previous, [task.id]: event.target.value }))}
                    placeholder="Search or type crew name"
                    className="rounded-md border border-border-default bg-white px-2 py-0.5 text-[10px] font-semibold text-text-primary outline-none focus:border-brand-blue-primary shadow-2xs"
                  />
                  <datalist id={`task-crew-${task.id}`}>
                    {hasErp && allSelectableCrew.map((crew) => <option key={crew.id} value={crew.name} />)}
                    {temporaryCrewList.map((crew) => <option key={crew.id} value={crew.name} />)}
                  </datalist>
                  <button type="button" onClick={() => { const value = (taskCrewDraft[task.id] ?? task.assignedMemberName ?? getDefaultCrewForTask(task)?.name ?? "").trim(); if (value && onAssignTaskCrew) { void onAssignTaskCrew(task.id, value); setEditingTaskCrewId(null); } }} className="rounded bg-brand-blue-primary px-1.5 py-0.5 text-[10px] font-bold text-white">Save</button>
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
                          onClick={() => { setTaskCrewDraft((previous) => ({ ...previous, [task.id]: task.assignedMemberName || getDefaultCrewForTask(task)?.name || "" })); setEditingTaskCrewId(task.id); }}
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
          {task.reworkNotes && !isLockedPhase && (
            <p className="mt-1 text-[10px] text-amber-800 font-medium">
              Rework note: {task.reworkNotes}
            </p>
          )}
        </div>

        {/* Read-Only Status Indicator in Pipeline (Actions happen in Top Current Main State Panel) */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
          {effectiveStatus === "COMPLETED" ? (
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              <span>✓ Done</span>
            </span>
          ) : !isLockedPhase ? (
            <span className="text-[10px] font-medium text-text-tertiary">
              {isReview ? "Action in top panel" : "Status view"}
            </span>
          ) : null}
        </div>
      </div>
    );
  }
}
