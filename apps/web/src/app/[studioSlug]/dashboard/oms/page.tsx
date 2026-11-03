"use client";

import { useMemo, useState, useEffect, useCallback, use, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OrderStatus, TaskStatus, Order, Task, PaymentStatus, ResourceSuggestion, Customer, OrderInstallment, StudioMember, StudioServiceConfig, StudioPackage } from "@focoman/types";
import {
  getStudioOrdersAction,
  getOrderTasksAction,
  createOrderAction,
  updateTaskStatusAction,
  updatePaymentStatusAction,
  assignResourceAction,
  assignTaskCrewAction,
  cancelOrderAction,
  deleteOrderAction,
  sendManualPaymentReminderAction,
} from "@/actions/orderActions";
import { getStudioMembersAction } from "@/actions/memberActions";
import { getStudioCustomersAction } from "@/actions/customerActions";
import { getStudioServicesAction } from "@/actions/studioActions";
import { DEFAULT_STUDIO_SERVICES } from "@/lib/studioServices";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { AddCrewMemberModal } from "@/components/AddCrewMemberModal";
import { OrderVerticalWorkflow } from "@/components/workflow/OrderVerticalWorkflow";
import { getEventDaysRemaining, calculateOrderAging, calculateTaskAgeBadge } from "@/utils/dateUtils";
import { getStudioTimestampIST, getStudioCalendarDate } from "@focoman/domain";

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

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  AWAITING_EVENT: "bg-blue-50 text-blue-700 border border-blue-200",
  ASSIGNED: "badge-status-neutral",
  IN_PROGRESS: "badge-brand-blue",
  REVIEW: "badge-brand-purple",
  REWORK: "badge-status-error",
  COMPLETED: "badge-status-success",
};

const PRESET_EVENT_TYPES = [
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

const PRESET_STUDIO_SERVICES = [
  "Traditional Photography",
  "Candid Photography",
  "Traditional Videography",
  "Cinematic Video / Teaser",
  "Drone Aerial Shoots",
  "Pre-Wedding Photoshoot",
  "Post-Wedding Photoshoot",
  "Premium Photobook Album",
] as const;

const DEFAULT_ORDER_FORM = {
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

export default function OmsPage({
  params,
}: {
  params: Promise<{ studioSlug: string }>;
}) {
  const { studioSlug } = use(params);
  const searchParams = useSearchParams();
  const { studio, user: workspaceUser, idToken: workspaceToken, authLoading, getIdToken } = useStudioWorkspace();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) || null,
    [orders, selectedId]
  );
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "MARKETPLACE" | OrderStatus>("ALL");
  const [sortBy, setSortBy] = useState<"DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC">("DATE_ASC");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<"code" | "link" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const handleCopyText = (text: string, field: "code" | "link") => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleShareText = async (url: string, title?: string) => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: title || "Focoman Order Tracking Link",
          url,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }
    handleCopyText(url, "link");
  };

  const hasWhatsappPlan = Boolean(
    studio?.features?.whatsapp ||
    studio?.planInfo?.selectedCapabilities?.some((c) => c.startsWith("WHATSAPP")) ||
    (studio as any)?.capabilities?.some((c: string) => c.startsWith("WHATSAPP"))
  );


  // New Order Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const orderIdParam = searchParams.get("orderId");
    if (orderIdParam) {
      setSelectedId(orderIdParam);
    }
    const actionParam = searchParams.get("action");
    if (actionParam === "new-order") {
      setShowCreateModal(true);
    }
  }, [searchParams]);
  const [formError, setFormError] = useState<string | null>(null);
  const [newOrderForm, setNewOrderForm] = useState(DEFAULT_ORDER_FORM);
  const [showServicesDropdown, setShowServicesDropdown] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [editConfirmedPrice, setEditConfirmedPrice] = useState("");
  const [editAdvanceAmount, setEditAdvanceAmount] = useState("");
  const [editAdvanceDate, setEditAdvanceDate] = useState("");
  const [editInstallments, setEditInstallments] = useState<OrderInstallment[]>([]);
  const [showAddInstallment, setShowAddInstallment] = useState(false);
  const [newInstallmentAmount, setNewInstallmentAmount] = useState("");
  const [newInstallmentDate, setNewInstallmentDate] = useState("");
  const [newInstallmentNotes, setNewInstallmentNotes] = useState("");
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [installmentError, setInstallmentError] = useState<string | null>(null);
  const [showAuditHistory, setShowAuditHistory] = useState(false);

  useEffect(() => {
    setIsEditingPricing(false);
    setEditConfirmedPrice("");
    setEditAdvanceAmount("");
    setEditAdvanceDate("");
    setEditInstallments([]);
    setShowAddInstallment(false);
    setNewInstallmentAmount("");
    setNewInstallmentDate("");
    setNewInstallmentNotes("");
    setPricingError(null);
    setInstallmentError(null);
    setShowAuditHistory(false);
  }, [selectedId]);

  // In-App Cancellation Dialog State
  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // In-App Soft-Delete Dialog State
  const [deleteTargetOrder, setDeleteTargetOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [studioCustomers, setStudioCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Studio Services & Packages for Order Registration
  const [studioServicesList, setStudioServicesList] = useState<StudioServiceConfig[]>(
    studio.configuredServices && studio.configuredServices.length > 0
      ? studio.configuredServices
      : DEFAULT_STUDIO_SERVICES
  );
  const [studioPackagesList, setStudioPackagesList] = useState<StudioPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");

  const activeStudioPackages = useMemo(() => {
    return studioPackagesList.filter(
      (pkg) => pkg.isPublished !== false && !pkg.isDeleted
    );
  }, [studioPackagesList]);

  // Show all current studio services (including custom services), do not show deleted ones, do not hide disabled ones
  const availableServices = useMemo(() => {
    return studioServicesList;
  }, [studioServicesList]);

  // Calculate order total based on selected package and services
  const calculateOrderPrice = useCallback(
    (selectedServices: string[], packageId?: string) => {
      const pkg = packageId ? activeStudioPackages.find((p) => p.id === packageId) : null;
      if (pkg) {
        let total = pkg.price;
        const pkgServicesLower = pkg.services.map((s) => s.toLowerCase());
        selectedServices.forEach((svcName) => {
          if (!pkgServicesLower.includes(svcName.toLowerCase())) {
            const match = studioServicesList.find(
              (s) => s.name.toLowerCase() === svcName.toLowerCase()
            );
            // Only add price if the service is enabled/active and has defaultPrice > 0
            if (match && match.enabled && match.defaultPrice > 0) {
              total += match.defaultPrice;
            }
          }
        });
        return total;
      }

      let total = 0;
      selectedServices.forEach((svcName) => {
        const match = studioServicesList.find(
          (s) => s.name.toLowerCase() === svcName.toLowerCase()
        );
        // Only add price if the service is enabled/active and has defaultPrice > 0
        if (match && match.enabled && match.defaultPrice > 0) {
          total += match.defaultPrice;
        }
      });
      return total;
    },
    [activeStudioPackages, studioServicesList]
  );

  const handleSelectPackage = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    if (!pkgId) {
      const autoPrice = calculateOrderPrice(newOrderForm.services, "");
      setNewOrderForm((prev) => ({
        ...prev,
        finalConfirmedPrice: autoPrice > 0 ? autoPrice : ("" as unknown as number),
      }));
      return;
    }

    const pkg = activeStudioPackages.find((p) => p.id === pkgId);
    if (pkg) {
      setNewOrderForm((prev) => ({
        ...prev,
        services: Array.from(new Set([...pkg.services])),
        finalConfirmedPrice: pkg.price,
      }));
    }
  };

  const [studioMembers, setStudioMembers] = useState<StudioMember[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberInitialName, setAddMemberInitialName] = useState<string>("");
  const [addMemberInitialSkills, setAddMemberInitialSkills] = useState<string[]>(["PHOTOGRAPHY"]);
  const [editingCrewService, setEditingCrewService] = useState<string | null>(null);
  const [activeCrewDropdown, setActiveCrewDropdown] = useState<string | null>(null);
  const [crewSearchQuery, setCrewSearchQuery] = useState<Record<string, string>>({});
  const [targetAssignContext, setTargetAssignContext] = useState<{
    serviceName?: string;
    taskId?: string;
  } | null>(null);

  const allSelectableCrew = useMemo(() => {
    const list: Array<{ id: string; name: string; skills: string[]; role: string }> = [];
    const ownerDisplayName = studio?.ownerName || workspaceUser?.displayName || "Studio Owner";
    if (ownerDisplayName) {
      list.push({
        id: `owner-${studio?.id || studioSlug}`,
        name: `${ownerDisplayName} (Owner)`,
        skills: ["PHOTOGRAPHY", "VIDEOGRAPHY"],
        role: "Owner",
      });
    }
    studioMembers.forEach((m) => {
      const memberName = m.name || m.ownerAssignedName || m.email || "Crew Member";
      if (!list.some((existing) => existing.id === m.id || existing.name === memberName)) {
        list.push({
          id: m.id,
          name: memberName,
          skills: m.skills || [],
          role: "Crew",
        });
      }
    });
    return list;
  }, [studio, studioSlug, studioMembers, workspaceUser]);

  const temporaryCrewList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; isTemporary: true }>();
    const ownerName = (studio?.ownerName || workspaceUser?.displayName || "").toLowerCase();

    const isOwnerCrew = (id?: string, name?: string) => {
      const n = (name || "").toLowerCase().trim();
      const i = (id || "").toLowerCase().trim();
      return (
        i.startsWith("owner-") ||
        n.includes("(owner)") ||
        (ownerName && (n === ownerName || n.includes(ownerName)))
      );
    };

    (studio?.temporaryCrew || []).forEach((t) => {
      if (isOwnerCrew(t.id, t.name)) return;
      const isRegistered = allSelectableCrew.some(
        (c) =>
          c.name.toLowerCase() === t.name.toLowerCase() ||
          c.id === t.id ||
          `${c.name.toLowerCase()} (owner)` === t.name.toLowerCase()
      );
      if (!isRegistered && t.name && !t.name.toLowerCase().includes("unassigned")) {
        map.set(t.name.toLowerCase(), {
          id: t.id || `temp_${t.name.toLowerCase()}`,
          name: t.name,
          isTemporary: true,
        });
      }
    });

    orders.forEach((o) => {
      (o.assignedResources || []).forEach((r) => {
        if (isOwnerCrew(r.memberId, r.memberName)) return;
        const isRegistered = allSelectableCrew.some(
          (c) =>
            c.name.toLowerCase() === (r.memberName || "").toLowerCase() ||
            c.id === r.memberId ||
            `${c.name.toLowerCase()} (owner)` === (r.memberName || "").toLowerCase()
        );
        if (!isRegistered && r.memberName && !r.memberName.toLowerCase().includes("unassigned")) {
          const key = r.memberName.toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              id: r.memberId || `temp_${key}`,
              name: r.memberName,
              isTemporary: true,
            });
          }
        }
      });
    });

    return Array.from(map.values());
  }, [studio, orders, allSelectableCrew, workspaceUser]);

  const handleOpenCreateModal = useCallback(() => {
    setNewOrderForm({
      ...DEFAULT_ORDER_FORM,
      services: [],
      finalConfirmedPrice: "" as unknown as number,
      advanceAmount: "" as unknown as number,
      passkeyPin: Math.floor(100000 + Math.random() * 900000).toString(),
    });
    setSelectedPackageId("");
    setFormError(null);
    setShowServicesDropdown(false);
    setShowCustomerDropdown(false);
    setShowCreateModal(true);
  }, []);

  const matchingCustomers = useMemo(() => {
    const q = newOrderForm.customerName.trim().toLowerCase();
    if (!q) return studioCustomers.slice(0, 5);
    return studioCustomers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [studioCustomers, newOrderForm.customerName]);

  const duplicateCustomerWarning = useMemo(() => {
    const name = newOrderForm.customerName.trim().toLowerCase();
    const phone = newOrderForm.customerPhone.trim().replace(/\D/g, "");
    if (!name && !phone) return null;
    return (
      studioCustomers.find((c) => {
        const cName = c.name.trim().toLowerCase();
        const cPhone = (c.phone || "").replace(/\D/g, "");
        return (
          (name && cName === name) ||
          (phone && cPhone && (cPhone === phone || cPhone.endsWith(phone) || phone.endsWith(cPhone)))
        );
      }) || null
    );
  }, [studioCustomers, newOrderForm.customerName, newOrderForm.customerPhone]);

  const selectExistingCustomer = (c: Customer) => {
    let code = "+91";
    let phoneNum = c.phone || "";
    if (phoneNum.startsWith("+")) {
      const parts = phoneNum.split(" ");
      if (parts.length > 1) {
        code = parts[0];
        phoneNum = parts.slice(1).join(" ");
      }
    }
    setNewOrderForm((prev) => ({
      ...prev,
      customerName: c.name,
      countryCode: code,
      customerPhone: phoneNum,
      customerEmail: c.email || prev.customerEmail,
      eventLocation: c.address || prev.eventLocation,
    }));
    setShowCustomerDropdown(false);
  };

  const toggleService = (svc: string) => {
    setNewOrderForm((prev) => {
      const exists = prev.services.includes(svc);
      const nextServices = exists
        ? prev.services.filter((s) => s !== svc)
        : [...prev.services, svc];
      const autoPrice = calculateOrderPrice(nextServices, selectedPackageId);
      return {
        ...prev,
        services: nextServices,
        finalConfirmedPrice: autoPrice > 0 ? autoPrice : ("" as unknown as number),
      };
    });
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    const custom = newOrderForm.customServiceInput.trim();
    if (custom && !newOrderForm.services.includes(custom)) {
      const nextServices = [...newOrderForm.services, custom];
      const autoPrice = calculateOrderPrice(nextServices, selectedPackageId);
      setNewOrderForm((prev) => ({
        ...prev,
        services: nextServices,
        customServiceInput: "",
        finalConfirmedPrice: autoPrice > 0 ? autoPrice : prev.finalConfirmedPrice,
      }));
    }
  };

  const loadOrders = useCallback(async (tokenOverride?: string | null) => {
    try {
      const token = tokenOverride ?? (await getIdToken(false)) ?? workspaceToken;
      if (!token) {
        setLoading(false);
        return;
      }
      const [data, customersData, membersData, servicesRes] = await Promise.all([
        getStudioOrdersAction(studioSlug, token),
        getStudioCustomersAction(studioSlug, token),
        getStudioMembersAction(studioSlug, token).catch(() => []),
        getStudioServicesAction(studioSlug, token).catch(() => null),
      ]);
      setOrders(data);
      setStudioCustomers(customersData);
      setStudioMembers(membersData || []);
      if (servicesRes && servicesRes.success) {
        if (Array.isArray(servicesRes.services)) {
          setStudioServicesList(servicesRes.services);
        }
        if (Array.isArray(servicesRes.packages)) {
          setStudioPackagesList(servicesRes.packages);
        }
      }
    } catch (err) {
      console.error("[OmsPage] Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, [studioSlug, workspaceToken, getIdToken]);

  useEffect(() => {
    if (!authLoading) {
      void loadOrders(workspaceToken);
    }
  }, [studioSlug, authLoading, workspaceToken, loadOrders]);

  // Load tasks when an order is selected
  useEffect(() => {
    if (selectedId) {
      if (workspaceToken) {
        void getOrderTasksAction(selectedId, studioSlug, workspaceToken).then(setSelectedTasks);
      }
    } else {
      setSelectedTasks([]);
    }
  }, [selectedId, studioSlug, workspaceToken]);

  // Check URL query parameters (e.g. ?orderId=... or ?action=new-order)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlOrderId = params.get("orderId");
    if (urlOrderId) {
      setSelectedId(urlOrderId);
    }
    const action = params.get("action");
    const newOrder = params.get("newOrder");
    if (action === "new-order" || newOrder === "true" || newOrder === "1") {
      handleOpenCreateModal();
    }
  }, [handleOpenCreateModal]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const parsedFinalPrice = Number(newOrderForm.finalConfirmedPrice) || 0;
    const parsedAdvance = Number(newOrderForm.advanceAmount) || 0;

    if (!newOrderForm.customerName.trim()) {
      setFormError("Customer full name is required.");
      setIsSubmitting(false);
      return;
    }

    if (!newOrderForm.eventDate) {
      setFormError("Event date is required.");
      setIsSubmitting(false);
      return;
    }

    if (newOrderForm.services.length === 0) {
      setFormError("Please select at least one service.");
      setIsSubmitting(false);
      return;
    }

    if (parsedAdvance > parsedFinalPrice) {
      setFormError("Advance amount cannot exceed the confirmed total price.");
      setIsSubmitting(false);
      return;
    }

    const resolvedEventType =
      newOrderForm.eventType === "Other"
        ? (newOrderForm.customEventType.trim() || "Special Occasion")
        : newOrderForm.eventType;

    const trimmedPhone = newOrderForm.customerPhone.trim();
    const resolvedPhone = trimmedPhone
      ? (trimmedPhone.startsWith("+") ? trimmedPhone : `${newOrderForm.countryCode.trim() || "+91"} ${trimmedPhone}`)
      : undefined;

    if ((newOrderForm.customerName.match(/[a-zA-Z]/g) || []).length < 3) {
      setFormError("Name must have at least 3 letters.");
      setIsSubmitting(false);
      return;
    }

    if (!/^\d{6}$/.test(newOrderForm.passkeyPin.trim())) {
      setFormError("PIN must be 6 digits.");
      setIsSubmitting(false);
      return;
    }

    // Refresh token before mutation
    const token = await getIdToken(true);
    if (!token) {
      setFormError("Authentication error. Please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const res = await createOrderAction({
      idToken: token,
      studioId: studioSlug,
      customerName: newOrderForm.customerName,
      customerPhone: resolvedPhone,
      customerEmail: newOrderForm.customerEmail || undefined,
      passkeyPin: newOrderForm.passkeyPin,
      notifyWhatsApp: Boolean(newOrderForm.notifyWhatsApp && resolvedPhone),
      notifyEmail: Boolean(newOrderForm.notifyEmail && newOrderForm.customerEmail.trim()),
      eventType: resolvedEventType,
      eventDate: newOrderForm.eventDate,
      eventLocation: newOrderForm.eventLocation.trim() || undefined,
      services: newOrderForm.services,
      estimatedPrice: parsedFinalPrice,
      finalConfirmedPrice: parsedFinalPrice,
      advanceAmount: parsedAdvance,
    });

    setIsSubmitting(false);

    if (res.success && res.order) {
      setShowCreateModal(false);
      setNewOrderForm({
        ...DEFAULT_ORDER_FORM,
        passkeyPin: Math.floor(100000 + Math.random() * 900000).toString(),
      });
      await loadOrders();
      setSelectedId(res.order.id);
      if (res.tasks) setSelectedTasks(res.tasks);
    } else {
      setFormError(res.error || "Failed to create order");
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!selected || !token) return;
    const res = await updateTaskStatusAction({
      idToken: token,
      studioId: studioSlug,
      taskId,
      orderId: selected.id,
      status: newStatus,
    });
    if (res.success && res.task) {
      setSelectedTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
      await loadOrders();
    } else if (!res.success) {
      alert(res.error || "Failed to update task status");
    }
  };

  const handleUpdatePayment = async (
    newPaymentStatus?: PaymentStatus,
    advanceAmount?: number,
    finalConfirmedPrice?: number,
    installments?: OrderInstallment[],
    advanceDate?: string
  ) => {
    if (!selected || isUpdatingPayment) return;
    setIsUpdatingPayment(true);

    const previousOrders = [...orders];
    const confirmedVal = finalConfirmedPrice !== undefined ? finalConfirmedPrice : selected.pricing.finalConfirmedPrice;
    const currentInstallments = installments !== undefined ? installments : (selected.pricing.installments || []);
    const installmentsTotal = currentInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);

    let nextInstallments = [...currentInstallments];
    const nextAdvance = advanceAmount !== undefined ? advanceAmount : selected.pricing.advanceAmount;

    // Optimistic UI update so owner sees immediate feedback
    if (newPaymentStatus === "PAID") {
      const currentPaid = selected.pricing.advanceAmount + installmentsTotal;
      const remainingToPay = Math.max(0, confirmedVal - currentPaid);
      if (remainingToPay > 0 && installments === undefined) {
        const autoPayment: OrderInstallment = {
          id: `inst_${Date.now()}_auto`,
          amount: remainingToPay,
          date: new Date().toISOString().split("T")[0],
          notes: "Final Payment (Marked Paid)",
          createdAt: new Date().toISOString(),
          recordedBy: workspaceUser?.displayName || studio?.ownerName || "Studio Owner",
          recordedByRole: "Owner",
        };
        nextInstallments = [...nextInstallments, autoPayment];
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selected.id
            ? {
                ...o,
                paymentStatus: "PAID",
                pricing: {
                  ...o.pricing,
                  finalConfirmedPrice: confirmedVal,
                  advanceAmount: nextAdvance,
                  installments: nextInstallments,
                  remainingAmount: 0,
                },
              }
            : o
        )
      );
    } else if (newPaymentStatus === "PENDING" && advanceAmount === undefined) {
      nextInstallments = nextInstallments.filter((inst) => !inst.notes?.includes("Marked Paid"));
      const newInstTotal = nextInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
      const totalPaid = nextAdvance + newInstTotal;
      const calculatedStatus: PaymentStatus =
        totalPaid > 0 && totalPaid < confirmedVal
          ? (nextInstallments.length > 0 ? "PARTIAL" : "ADVANCE_RECEIVED")
          : (totalPaid >= confirmedVal && confirmedVal > 0 ? "PAID" : "PENDING");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selected.id
            ? {
                ...o,
                paymentStatus: calculatedStatus,
                pricing: {
                  ...o.pricing,
                  finalConfirmedPrice: confirmedVal,
                  advanceAmount: nextAdvance,
                  installments: nextInstallments,
                  remainingAmount: Math.max(0, confirmedVal - totalPaid),
                },
              }
            : o
        )
      );
    } else {
      const advVal = advanceAmount !== undefined ? advanceAmount : selected.pricing.advanceAmount;
      const totalPaid = advVal + installmentsTotal;
      const statusVal =
        newPaymentStatus ||
        (totalPaid >= confirmedVal && confirmedVal > 0
          ? "PAID"
          : currentInstallments.length > 0 && totalPaid > 0
          ? "PARTIAL"
          : advVal > 0
          ? "ADVANCE_RECEIVED"
          : "PENDING");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selected.id
            ? {
                ...o,
                paymentStatus: statusVal,
                pricing: {
                  ...o.pricing,
                  finalConfirmedPrice: confirmedVal,
                  advanceAmount: advVal,
                  advanceDate: advanceDate || o.pricing.advanceDate,
                  installments: currentInstallments,
                  remainingAmount: Math.max(0, confirmedVal - totalPaid),
                  previousAdvanceAmount:
                    advVal < confirmedVal ? advVal : o.pricing.previousAdvanceAmount,
                },
              }
            : o
        )
      );
    }

    try {
      const token = (await getIdToken(true)) ?? (await getIdToken(false)) ?? workspaceToken;
      if (!token) {
        setIsUpdatingPayment(false);
        setOrders(previousOrders);
        return;
      }
      const res = await updatePaymentStatusAction({
        idToken: token,
        studioId: studioSlug,
        orderId: selected.id,
        ...(newPaymentStatus ? { paymentStatus: newPaymentStatus } : {}),
        ...(advanceAmount !== undefined ? { advanceAmount } : {}),
        ...(finalConfirmedPrice !== undefined ? { finalConfirmedPrice } : {}),
        installments: nextInstallments,
        ...(advanceDate !== undefined ? { advanceDate } : {}),
      });
      setIsUpdatingPayment(false);
      if (res.success && res.order) {
        setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
        await loadOrders();
      } else {
        setOrders(previousOrders);
        alert(res.error || "Failed to update payment status");
      }
    } catch (err: unknown) {
      setIsUpdatingPayment(false);
      setOrders(previousOrders);
      alert(err instanceof Error ? err.message : "Failed to update payment status");
    }
  };

  const handleSendPaymentReminder = async () => {
    if (!selected || isSendingReminder) return;
    setIsSendingReminder(true);
    try {
      const token = (await getIdToken(false)) ?? workspaceToken;
      if (!token) {
        alert("Authentication error. Please sign in again.");
        setIsSendingReminder(false);
        return;
      }
      const res = await sendManualPaymentReminderAction({
        orderId: selected.id,
        studioId: studioSlug,
        idToken: token,
      });
      setIsSendingReminder(false);
      if (res.success) {
        alert(res.message || "Payment reminder email sent successfully!");
        await loadOrders();
      } else {
        alert(res.error || "Failed to send payment reminder email.");
      }
    } catch (err: unknown) {
      setIsSendingReminder(false);
      alert(err instanceof Error ? err.message : "Failed to send payment reminder.");
    }
  };

  const handleStartEditingPricing = () => {
    if (!selected) return;
    setEditConfirmedPrice(String(selected.pricing.finalConfirmedPrice));
    setEditAdvanceAmount(String(selected.pricing.advanceAmount));
    setEditAdvanceDate(selected.pricing.advanceDate || (selected.createdAt ? selected.createdAt.split("T")[0] : new Date().toISOString().split("T")[0]));
    setEditInstallments(selected.pricing.installments ? [...selected.pricing.installments] : []);
    setShowAddInstallment(false);
    setNewInstallmentAmount("");
    setNewInstallmentDate(new Date().toISOString().split("T")[0]);
    setNewInstallmentNotes("");
    setPricingError(null);
    setInstallmentError(null);
    setIsEditingPricing(true);
  };

  const handleAddInstallment = () => {
    const amt = Number(newInstallmentAmount);
    if (!amt || amt <= 0) {
      setInstallmentError("Please enter a valid payment amount greater than ₹0.");
      return;
    }
    const confirmedNum = Math.max(0, Number(editConfirmedPrice) || 0);
    const advanceNum = Math.max(0, Number(editAdvanceAmount) || 0);
    const existingInstTotal = editInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const maxAllowed = Math.max(0, confirmedNum - (advanceNum + existingInstTotal));

    if (amt > maxAllowed) {
      setInstallmentError(`Payment amount (₹${amt.toLocaleString()}) exceeds the remaining balance of ₹${maxAllowed.toLocaleString()}.`);
      return;
    }

    setInstallmentError(null);
    setPricingError(null);
    const newInst: OrderInstallment = {
      id: `inst_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      amount: amt,
      date: newInstallmentDate.trim() || new Date().toISOString().split("T")[0],
      notes: newInstallmentNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      recordedBy: workspaceUser?.displayName || studio?.ownerName || "Studio Owner",
      recordedByRole: "Owner",
    };
    setEditInstallments((prev) => [...prev, newInst]);
    setNewInstallmentAmount("");
    setNewInstallmentNotes("");
    setShowAddInstallment(false);
  };

  const handleRemoveInstallment = (index: number) => {
    setEditInstallments((prev) => prev.filter((_, i) => i !== index));
    setPricingError(null);
  };

  const handleSavePricing = async () => {
    if (!selected) return;
    const confirmedNum = Math.max(0, Number(editConfirmedPrice) || 0);
    const advanceNum = Math.max(0, Number(editAdvanceAmount) || 0);
    const installmentsTotal = editInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const totalPaid = advanceNum + installmentsTotal;

    if (totalPaid > confirmedNum) {
      setPricingError(`Total payments (Advance ₹${advanceNum.toLocaleString()} + Installments ₹${installmentsTotal.toLocaleString()}) cannot exceed confirmed price (₹${confirmedNum.toLocaleString()}).`);
      return;
    }

    setPricingError(null);
    const calculatedStatus: PaymentStatus =
      totalPaid >= confirmedNum && confirmedNum > 0
        ? "PAID"
        : editInstallments.length > 0 && totalPaid > 0
        ? "PARTIAL"
        : advanceNum > 0
        ? "ADVANCE_RECEIVED"
        : "PENDING";

    await handleUpdatePayment(calculatedStatus, advanceNum, confirmedNum, editInstallments, editAdvanceDate);
    setIsEditingPricing(false);
  };

  const handleConfirmSuggestion = async (sug: ResourceSuggestion) => {
    if (!selected) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) return;

    const res = await assignResourceAction({
      orderId: selected.id,
      memberId: sug.memberId,
      memberName: sug.memberName,
      skill: sug.skill,
      studioId: studioSlug,
      idToken: token,
    });

    if (res.success && res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
    } else {
      alert(res.error || "Failed to assign resource");
    }
  };

  const openErpWizardForService = (serviceName?: string, memberName?: string) => {
    let initialSkills = ["PHOTOGRAPHY"];
    if (serviceName) {
      const s = serviceName.toLowerCase();
      if (s.includes("video") || s.includes("cinemat")) initialSkills = ["VIDEOGRAPHY"];
      else if (s.includes("album")) initialSkills = ["ALBUM_DESIGN"];
      else if (s.includes("photo")) initialSkills = ["PHOTOGRAPHY"];
    }
    setAddMemberInitialName(memberName || "");
    setAddMemberInitialSkills(initialSkills);
    setTargetAssignContext(serviceName ? { serviceName } : null);
    setShowAddMemberModal(true);
  };

  const handleCommitCrewAssignment = async (serviceName: string, enteredName: string) => {
    if (!selected || !enteredName.trim()) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) return;

    const trimmed = enteredName.trim();
    // Check if entered name matches an existing member or owner in allSelectableCrew
    const matchedMember = allSelectableCrew.find(
      (m) =>
        (m.name || "").toLowerCase() === trimmed.toLowerCase() ||
        m.id === trimmed ||
        (m.role === "Owner" &&
          (m.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            trimmed.toLowerCase().includes(m.name.replace(/\s*\(owner\)/i, "").trim().toLowerCase())))
    );

    const memberId = matchedMember ? matchedMember.id : `temp_${Date.now()}`;
    const memberName = matchedMember ? matchedMember.name : trimmed;

    const res = await assignResourceAction({
      orderId: selected.id,
      memberId,
      memberName,
      skill: serviceName,
      studioId: studioSlug,
      idToken: token,
    });

    if (res.success && res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      setCrewSearchQuery((prev) => ({ ...prev, [serviceName]: "" }));
      setEditingCrewService(null);
      setActiveCrewDropdown(null);
    } else {
      alert(res.error || "Failed to assign crew member");
    }
  };

  const handleUnassignService = async (serviceName: string) => {
    if (!selected) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) return;

    const res = await assignResourceAction({
      orderId: selected.id,
      memberId: "unassigned",
      memberName: "Unassigned",
      skill: serviceName,
      studioId: studioSlug,
      idToken: token,
    });

    if (res.success && res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      setCrewSearchQuery((prev) => ({ ...prev, [serviceName]: "" }));
      setEditingCrewService(null);
      setActiveCrewDropdown(null);
    } else {
      alert(res.error || "Failed to unassign crew member");
    }
  };

  const handleAssignServiceCrew = async (serviceName: string, memberId: string) => {
    if (!selected) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) return;

    const member = allSelectableCrew.find((m) => m.id === memberId) || studioMembers.find((m) => m.id === memberId);
    if (!member) return;

    const res = await assignResourceAction({
      orderId: selected.id,
      memberId: member.id,
      memberName: member.name,
      skill: serviceName,
      studioId: studioSlug,
      idToken: token,
    });

    if (res.success && res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      setEditingCrewService(null);
      setActiveCrewDropdown(null);
    } else {
      alert(res.error || "Failed to assign crew member");
    }
  };

  const handleAssignTaskCrew = async (taskId: string, memberIdentifier: string) => {
    if (!selected) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) return;

    const trimmed = memberIdentifier.trim();
    if (!trimmed) return;

    if (trimmed === "unassigned") {
      const res = await assignTaskCrewAction({
        orderId: selected.id,
        studioId: studioSlug,
        taskId,
        memberId: "unassigned",
        memberName: "",
        idToken: token,
      });
      if (res.success && res.task) {
        setSelectedTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
      }
      return;
    }

    const matchedMember =
      allSelectableCrew.find(
        (m) =>
          (m.name || "").toLowerCase() === trimmed.toLowerCase() ||
          m.id === trimmed ||
          (m.role === "Owner" &&
            (m.name.toLowerCase().includes(trimmed.toLowerCase()) ||
              trimmed.toLowerCase().includes(m.name.replace(/\s*\(owner\)/i, "").trim().toLowerCase())))
      ) ||
      studioMembers.find(
        (m) => (m.name || "").toLowerCase() === trimmed.toLowerCase() || m.id === trimmed
      ) ||
      temporaryCrewList.find(
        (t) => (t.name || "").toLowerCase() === trimmed.toLowerCase() || t.id === trimmed
      );

    const memberId = matchedMember ? matchedMember.id : `temp_${Date.now()}`;
    const memberName = matchedMember ? matchedMember.name : trimmed;

    const res = await assignTaskCrewAction({
      orderId: selected.id,
      studioId: studioSlug,
      taskId,
      memberId,
      memberName,
      idToken: token,
    });

    if (res.success && res.task) {
      setSelectedTasks((prev) => prev.map((t) => (t.id === taskId ? res.task! : t)));
    } else {
      alert(res.error || "Failed to assign crew to task");
    }
  };

  const handleMemberCreated = async (newMember: { id: string; name: string }) => {
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token || !selected) {
      await loadOrders();
      setShowAddMemberModal(false);
      setTargetAssignContext(null);
      setAddMemberInitialName("");
      setEditingCrewService(null);
      return;
    }

    if (targetAssignContext?.serviceName) {
      const res = await assignResourceAction({
        orderId: selected.id,
        memberId: newMember.id,
        memberName: newMember.name,
        skill: targetAssignContext.serviceName,
        studioId: studioSlug,
        idToken: token,
      });
      if (res.success && res.order) {
        setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      }
    } else if (targetAssignContext?.taskId) {
      const targetTaskId = targetAssignContext.taskId;
      const res = await assignTaskCrewAction({
        orderId: selected.id,
        studioId: studioSlug,
        taskId: targetTaskId,
        memberId: newMember.id,
        memberName: newMember.name,
        idToken: token,
      });
      if (res.success && res.task) {
        setSelectedTasks((prev) => prev.map((t) => (t.id === targetTaskId ? res.task! : t)));
      }
    }

    await loadOrders();
    setShowAddMemberModal(false);
    setTargetAssignContext(null);
    setAddMemberInitialName("");
    setEditingCrewService(null);
  };

  const handleConfirmCancelOrder = async () => {
    if (!cancelTargetOrder) return;
    setIsCancelling(true);

    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) {
      setIsCancelling(false);
      return;
    }

    const res = await cancelOrderAction({
      orderId: cancelTargetOrder.id,
      studioId: studioSlug,
      cancellationReason: cancelReason.trim() || "Cancelled by studio owner",
      idToken: token,
    });

    setIsCancelling(false);
    if (res.success && res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order!.id ? res.order! : o)));
      setCancelTargetOrder(null);
      setCancelReason("");
    } else {
      alert(res.error || "Failed to cancel order");
    }
  };

  const handleConfirmDeleteOrder = async () => {
    if (!deleteTargetOrder) return;
    setIsDeleting(true);

    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) {
      setIsDeleting(false);
      return;
    }

    const res = await deleteOrderAction({
      orderId: deleteTargetOrder.id,
      studioId: studioSlug,
      idToken: token,
    });

    setIsDeleting(false);
    if (res.success) {
      setOrders((prev) => prev.filter((o) => o.id !== deleteTargetOrder.id));
      if (selectedId === deleteTargetOrder.id) {
        setSelectedId(null);
      }
      setDeleteTargetOrder(null);
    } else {
      alert(res.error || "Failed to delete order");
    }
  };

  const filtered = useMemo(() => {
    const list = orders.filter(
      (order) =>
        (statusFilter === "ALL" || (statusFilter === "MARKETPLACE" ? Boolean(order.bookingRequestId) : order.orderStatus === statusFilter)) &&
        (!query ||
          `${order.customer.name} ${order.orderNumber} ${order.eventType}`
            .toLowerCase()
            .includes(query.toLowerCase()))
    );

    const getEventTimestamp = (dateStr?: string | null, isDesc = false): number => {
      if (!dateStr) return isDesc ? -1 : Number.MAX_SAFE_INTEGER;
      const clean = dateStr.trim();
      const parts = clean.split("T")[0].split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m, d).getTime();
        }
      }
      const parsed = new Date(clean).getTime();
      return isNaN(parsed) ? (isDesc ? -1 : Number.MAX_SAFE_INTEGER) : parsed;
    };

    return list.sort((a, b) => {
      if (sortBy === "DATE_ASC") {
        const timeA = getEventTimestamp(a.eventDate, false);
        const timeB = getEventTimestamp(b.eventDate, false);
        if (timeA !== timeB) return timeA - timeB;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdA - createdB;
      }
      if (sortBy === "DATE_DESC") {
        const timeA = getEventTimestamp(a.eventDate, true);
        const timeB = getEventTimestamp(b.eventDate, true);
        if (timeA !== timeB) return timeB - timeA;
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return createdB - createdA;
      }
      if (sortBy === "PRICE_ASC") {
        const priceA = a.pricing?.finalConfirmedPrice ?? 0;
        const priceB = b.pricing?.finalConfirmedPrice ?? 0;
        return priceA - priceB;
      }
      if (sortBy === "PRICE_DESC") {
        const priceA = a.pricing?.finalConfirmedPrice ?? 0;
        const priceB = b.pricing?.finalConfirmedPrice ?? 0;
        return priceB - priceA;
      }
      return 0;
    });
  }, [orders, statusFilter, query, sortBy]);

  return (
    <div className="flex h-full bg-surface-app">
      <div
        className={`flex h-full flex-col ${
          selected ? "hidden lg:flex lg:w-1/2 border-r border-border-default" : "w-full"
        }`}
      >
        <header className="header-brand-blue">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="badge-brand-blue">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary" />
                  OMS · Order Management
                </span>
                <span className="badge-status-neutral">
                  Studio: <strong className="font-semibold text-text-primary">{studioSlug}</strong>
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
                Order Management System
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Production lifecycle workflows, delivery milestones, and client accounts · {orders.length} Confirmed Orders
              </p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="btn-brand-blue"
            >
              + Register Confirmed Order
            </button>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <input
              suppressHydrationWarning
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by customer, order number, event..."
              className="flex-1 rounded-xl border border-border-default bg-surface-app px-3.5 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
            />
            <div className="flex gap-2">
              <select
                suppressHydrationWarning
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | "MARKETPLACE" | OrderStatus)
                }
                className="rounded-xl border border-border-default bg-surface-app px-3 py-2 text-xs font-semibold text-text-primary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
              >
                <option value="ALL">All States</option>
                <option value="MARKETPLACE">Studio Marketplace Orders</option>
                {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUS_LABELS[key]}
                  </option>
                ))}
              </select>
              <select
                suppressHydrationWarning
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC"
                  )
                }
                aria-label="Sort orders"
                className="rounded-xl border border-border-default bg-surface-app px-3 py-2 text-xs font-semibold text-text-primary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
              >
                <option value="DATE_ASC">Earliest Date First</option>
                <option value="DATE_DESC">Latest Date First</option>
                <option value="PRICE_DESC">Price: High to Low</option>
                <option value="PRICE_ASC">Price: Low to High</option>
              </select>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {loading && orders.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-tertiary">Loading orders from server...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default bg-white p-12 text-center">
              <p className="text-sm font-bold text-text-secondary">No active confirmed orders found</p>
              <p className="text-xs text-text-tertiary mt-1">
                Register a new confirmed order to start automated production workflow tracking.
              </p>
            </div>
          ) : (
            filtered.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedId(order.id)}
                className={`w-full rounded-2xl border p-5 text-left transition ${
                  selectedId === order.id
                    ? "card-brand-blue"
                    : "border-border-default bg-white hover:border-brand-blue-light hover:shadow-xs"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-text-primary">
                        {order.customer.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-brand-blue-primary">
                        {order.orderNumber}
                      </span>
                      {order.bookingRequestId && (
                        <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                          Marketplace
                        </span>
                      )}
                      {order.paymentStatus === "PAID" && (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-status-success border border-emerald-200">
                          PAID
                        </span>
                      )}
                      {(order.paymentStatus === "ADVANCE_RECEIVED" || (order.paymentStatus === "PARTIAL" && (!order.pricing.installments || order.pricing.installments.length === 0))) && (
                        <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                          ADVANCE RECEIVED
                        </span>
                      )}
                      {order.paymentStatus === "PARTIAL" && !!order.pricing.installments?.length && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          PARTIAL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {order.eventType} · Event Date: {order.eventDate}
                      {order.orderStatus === "AWAITING_EVENT" && (() => {
                        const d = getEventDaysRemaining(order.eventDate);
                        return d && d.diffDays > 0 ? ` (${d.label})` : "";
                      })()}
                    </p>
                    <p className="mt-2 text-xs text-text-tertiary">
                      Services: {order.services.join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={STATUS_COLORS[order.orderStatus]}>
                      {STATUS_LABELS[order.orderStatus]}
                    </span>
                    <p className="mt-2 text-sm font-extrabold text-text-primary">
                      ₹{order.pricing.finalConfirmedPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Selected Order Detail Drawer */}
      {selected && (
        <aside className="h-full w-full lg:w-1/2 overflow-y-auto bg-white p-6 border-l border-border-default space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-border-default">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="lg:hidden rounded-lg p-1.5 text-text-tertiary hover:bg-surface-app hover:text-text-primary mr-1 shrink-0"
                aria-label="Back to order list"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-brand-blue-primary block">{selected.orderNumber}</span>
                  {selected.bookingRequestId && (
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                      Marketplace Booking: {selected.bookingRequestId}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-extrabold text-text-primary truncate">{selected.customer.name}</h2>
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="rounded-full p-2 text-text-tertiary hover:bg-surface-app hover:text-text-primary transition shrink-0"
              aria-label="Close details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Unified Vertical Order Workflow Pipeline */}
          <OrderVerticalWorkflow
            order={selected}
            tasks={selectedTasks}
            variant="oms"
            onUpdateTaskStatus={handleUpdateTaskStatus}
            allSelectableCrew={allSelectableCrew}
            temporaryCrewList={temporaryCrewList}
            onAssignCrew={handleCommitCrewAssignment}
            onUnassignCrew={handleUnassignService}
            onOpenErpWizard={openErpWizardForService}
            onAssignTaskCrew={handleAssignTaskCrew}
          />

          {/* Production Aging and Turnaround SLA Banner (Placed below Post-Event Production Tasks) */}
          {(() => {
            const aging = calculateOrderAging(
              selected.eventDate,
              selectedTasks,
              selected.orderStatus === "COMPLETED",
              selected.updatedAt
            );
            return (
              <div className="rounded-2xl border border-border-default bg-surface-app/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      Production Turnaround and SLA Breakdown
                    </span>
                    {selected.orderStatus === "COMPLETED" ? (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 border border-emerald-200">
                        Delivered
                      </span>
                    ) : aging.isUpcoming ? (
                      <span className="rounded-full bg-blue-100 text-brand-blue-primary text-[9px] font-extrabold px-2 py-0.5 border border-blue-200">
                        Event Scheduled
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 border border-amber-200">
                        Active Production
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-text-secondary">
                    {aging.statusLabel}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Card 1: Total Overall Age */}
                  <div className="rounded-xl border border-border-default bg-white p-3 shadow-2xs">
                    <span className="text-[10px] font-semibold text-text-tertiary block">
                      {selected.orderStatus === "COMPLETED" ? "Overall Turnaround" : "Overall Order Age"}
                    </span>
                    <span className="text-base font-extrabold text-text-primary mt-0.5 block">
                      {aging.isUpcoming ? "0 d" : `${aging.totalAgeDays} Days`}
                    </span>
                    <span className="text-[9px] text-text-tertiary block mt-0.5 truncate">
                      {aging.isUpcoming ? "Starts after event" : `From ${selected.eventDate}`}
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
                  <div className={`rounded-xl border p-3 shadow-2xs ${
                    aging.customerDays > 0
                      ? "border-amber-300 bg-amber-50/70"
                      : "border-border-default bg-white"
                  }`}>
                    <span className={`text-[10px] font-semibold block ${
                      aging.customerDays > 0 ? "text-amber-900" : "text-text-tertiary"
                    }`}>
                      Pending at Customer
                    </span>
                    <span className={`text-base font-extrabold mt-0.5 block ${
                      aging.customerDays > 0 ? "text-amber-700" : "text-text-primary"
                    }`}>
                      {aging.isUpcoming ? "0 d" : `${aging.customerDays} Days`}
                    </span>
                    <span className={`text-[9px] block mt-0.5 truncate ${
                      aging.customerDays > 0 ? "text-amber-700 font-semibold" : "text-text-tertiary"
                    }`}>
                      {aging.customerDays > 0 ? "Awaiting client review" : "No pending reviews"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. Payment and Pricing Summary */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Payment and Pricing Summary
              </h3>
              <div className="flex items-center gap-1.5">
                {isEditingPricing ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-blue-primary bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    <span>✎</span> Editing
                  </span>
                ) : (
                  <>
                    {selected.paymentStatus === "PAID" ? (
                      <button
                        type="button"
                        disabled={isUpdatingPayment}
                        onClick={() => {
                          void handleUpdatePayment("PENDING");
                        }}
                        className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50/50 shadow-2xs transition disabled:opacity-50 flex items-center gap-1"
                        title="Mark order as Unpaid"
                      >
                        <span>✕</span>
                        <span>{isUpdatingPayment ? "Updating..." : "Mark Unpaid"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isUpdatingPayment}
                        onClick={() => void handleUpdatePayment("PAID")}
                        className="btn-brand-blue py-1 px-2.5 text-[11px] disabled:opacity-50 flex items-center gap-1"
                        title="Mark order as Paid"
                      >
                        <span>✓</span>
                        <span>{isUpdatingPayment ? "Updating..." : "Mark Paid"}</span>
                      </button>
                    )}
                    {selected.pricing.remainingAmount > 0 && selected.paymentStatus !== "PAID" && (
                      <button
                        type="button"
                        disabled={isSendingReminder || isUpdatingPayment}
                        onClick={() => void handleSendPaymentReminder()}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 shadow-2xs transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                        title="Send manual payment reminder email to customer"
                      >
                        <span>✉</span>
                        <span>{isSendingReminder ? "Sending..." : "Send Reminder"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isUpdatingPayment}
                      onClick={handleStartEditingPricing}
                      className="rounded-lg border border-border-default bg-white px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-brand-blue-primary hover:border-brand-blue-primary hover:bg-blue-50/50 shadow-2xs transition disabled:opacity-50 flex items-center gap-1"
                      title="Edit pricing and payment amounts"
                    >
                      <span>✎</span>
                      <span>Edit</span>
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2 space-y-2.5 rounded-2xl bg-surface-app p-4 border border-border-default text-xs">
              {isEditingPricing ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary font-medium">Confirmed Price:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-secondary font-bold">₹</span>
                      <input
                        type="number"
                        min={0}
                        value={editConfirmedPrice}
                        onChange={(e) => {
                          setEditConfirmedPrice(e.target.value);
                          setPricingError(null);
                        }}
                        className="w-28 rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs font-bold text-text-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                        placeholder="0"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-text-secondary font-medium">Advance Received:</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-text-tertiary">Recorded on:</span>
                          <input
                            type="date"
                            value={editAdvanceDate}
                            onChange={(e) => setEditAdvanceDate(e.target.value)}
                            className="rounded border border-border-default bg-white px-1 py-0.5 text-[10px] text-text-secondary focus:outline-none focus:border-brand-blue-primary"
                            title="Date advance payment was recorded"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-secondary font-bold">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={editAdvanceAmount}
                          onChange={(e) => {
                            setEditAdvanceAmount(e.target.value);
                            setPricingError(null);
                          }}
                          className="w-28 rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs font-bold text-brand-blue-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {(Number(editAdvanceAmount) || 0) > (Number(editConfirmedPrice) || 0) && (
                      <p className="text-[11px] font-semibold text-status-danger text-right">
                        Advance exceeds confirmed price of ₹{(Number(editConfirmedPrice) || 0).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Installments in edit mode */}
                  <div className="pt-2 border-t border-border-default space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-text-secondary">
                        Installments / Payments:
                      </span>
                    </div>

                    {editInstallments.length > 0 && (
                      <div className="space-y-1.5">
                        {editInstallments.map((inst, idx) => (
                          <div
                            key={inst.id || idx}
                            className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-border-default"
                          >
                            <div className="text-xs">
                              <span className="font-bold text-text-primary">
                                ₹{inst.amount.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-text-tertiary ml-2">
                                Recorded on {inst.date}{inst.notes ? ` · ${inst.notes}` : ""}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveInstallment(idx)}
                              className="text-text-tertiary hover:text-status-danger p-0.5 text-xs font-bold transition"
                              title="Remove payment"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prominent, easy-to-find + Add Payment button in solid blue color */}
                    {!showAddInstallment && (
                      <button
                        type="button"
                        onClick={() => {
                          setInstallmentError(null);
                          setNewInstallmentAmount("");
                          setNewInstallmentNotes("");
                          setNewInstallmentDate(new Date().toISOString().split("T")[0]);
                          setShowAddInstallment(true);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-brand-blue-primary hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                      >
                        <span className="text-sm font-extrabold">+</span>
                        <span>Add Payment</span>
                      </button>
                    )}

                    {showAddInstallment && (() => {
                      const confirmedNum = Math.max(0, Number(editConfirmedPrice) || 0);
                      const advanceNum = Math.max(0, Number(editAdvanceAmount) || 0);
                      const instTotal = editInstallments.reduce((sum, i) => sum + (i.amount || 0), 0);
                      const remainingForNew = Math.max(0, confirmedNum - (advanceNum + instTotal));
                      const inputAmt = Number(newInstallmentAmount) || 0;
                      const isExceeding = inputAmt > remainingForNew;

                      return (
                        <div className="rounded-xl border border-brand-blue-light bg-blue-50/50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-text-primary">Add Payment Entry</span>
                            <span className="text-[10px] text-text-tertiary font-medium">
                              Remaining balance: <span className="font-bold text-brand-orange-primary">₹{remainingForNew.toLocaleString()}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                                Payment Amount (₹)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={remainingForNew}
                                value={newInstallmentAmount}
                                onChange={(e) => {
                                  setNewInstallmentAmount(e.target.value);
                                  setInstallmentError(null);
                                }}
                                placeholder={`Up to ₹${remainingForNew.toLocaleString()}`}
                                className={`w-full rounded-lg border bg-white px-2.5 py-1 text-xs font-bold text-text-primary focus:outline-none focus:ring-1 ${
                                  isExceeding
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                    : "border-border-default focus:border-brand-blue-primary focus:ring-brand-blue-primary"
                                }`}
                                autoFocus
                              />
                            </div>
                            <div className="w-36">
                              <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                                Recorded on Date
                              </label>
                              <input
                                type="date"
                                value={newInstallmentDate}
                                onChange={(e) => setNewInstallmentDate(e.target.value)}
                                className="w-full rounded-lg border border-border-default bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                              />
                            </div>
                          </div>

                          {/* Real-time inline validation error in clear vivid red */}
                          {isExceeding && (
                            <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>Payment amount cannot exceed remaining balance of ₹{remainingForNew.toLocaleString()}.</span>
                            </p>
                          )}

                          {installmentError && (
                            <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>{installmentError}</span>
                            </p>
                          )}

                          <div>
                            <input
                              type="text"
                              value={newInstallmentNotes}
                              onChange={(e) => setNewInstallmentNotes(e.target.value)}
                              placeholder="Optional note (e.g. Cash, UPI, 2nd installment)"
                              maxLength={50}
                              className="w-full rounded-lg border border-border-default bg-white px-2.5 py-1 text-xs text-text-secondary focus:outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                            />
                          </div>

                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddInstallment(false);
                                setInstallmentError(null);
                              }}
                              className="rounded-md border border-border-default bg-white px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isExceeding || inputAmt <= 0}
                              onClick={handleAddInstallment}
                              className="btn-brand-blue py-1 px-3 text-[11px] disabled:opacity-40"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border-default">
                    <span className="text-text-secondary font-medium">Remaining Balance:</span>
                    <span className="font-bold text-brand-orange-primary">
                      {(() => {
                        const c = Math.max(0, Number(editConfirmedPrice) || 0);
                        const a = Math.max(0, Number(editAdvanceAmount) || 0);
                        const instTotal = editInstallments.reduce((sum, i) => sum + (i.amount || 0), 0);
                        return `₹${Math.max(0, c - (a + instTotal)).toLocaleString()}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border-default">
                    <span className="text-text-secondary font-medium">Payment Status:</span>
                    {(() => {
                      const c = Math.max(0, Number(editConfirmedPrice) || 0);
                      const a = Math.max(0, Number(editAdvanceAmount) || 0);
                      const instTotal = editInstallments.reduce((sum, i) => sum + (i.amount || 0), 0);
                      const totalPaid = a + instTotal;
                      const isPaid = totalPaid >= c && c > 0;
                      const hasInst = editInstallments.length > 0;
                      const isAdvance = !isPaid && !hasInst && a > 0;
                      const isPartial = !isPaid && hasInst && totalPaid > 0;

                      if (isPaid) {
                        return <span className="font-bold text-status-success">Payment Completed</span>;
                      }
                      if (isAdvance) {
                        return <span className="font-bold text-sky-700">ADVANCE RECEIVED</span>;
                      }
                      if (isPartial) {
                        return <span className="font-bold text-brand-orange-primary">PARTIAL</span>;
                      }
                      return <span className="font-bold text-text-secondary">PENDING</span>;
                    })()}
                  </div>

                  {/* Inline overall validation banner */}
                  {pricingError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-status-danger font-medium flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{pricingError}</span>
                    </div>
                  )}

                  {/* Bottom Save and Cancel Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-default">
                    <button
                      type="button"
                      disabled={isUpdatingPayment}
                      onClick={() => {
                        setIsEditingPricing(false);
                        setPricingError(null);
                        setInstallmentError(null);
                      }}
                      className="rounded-xl border border-border-default bg-white px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-subtle shadow-2xs transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        isUpdatingPayment ||
                        (Number(editAdvanceAmount) || 0) + editInstallments.reduce((sum, i) => sum + (i.amount || 0), 0) > (Number(editConfirmedPrice) || 0)
                      }
                      onClick={() => void handleSavePricing()}
                      className="btn-brand-blue py-1.5 px-4 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>✓</span>
                      <span>{isUpdatingPayment ? "Saving Changes..." : "Save Changes"}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Confirmed Price:</span>
                    <span className="font-bold text-text-primary">
                      ₹{selected.pricing.finalConfirmedPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-text-secondary">Advance Received:</span>
                      <div className="text-[10px] text-text-tertiary">
                        Recorded on {selected.pricing.advanceDate || (selected.createdAt ? selected.createdAt.split("T")[0] : "-")}
                      </div>
                    </div>
                    <span className="font-bold text-brand-blue-primary">
                      ₹{selected.pricing.advanceAmount.toLocaleString()}
                    </span>
                  </div>

                  {selected.pricing.installments && selected.pricing.installments.length > 0 && (
                    <div className="pt-2 border-t border-border-default/60 space-y-1.5">
                      {selected.pricing.installments.map((inst, idx) => (
                        <div key={inst.id || idx} className="flex justify-between items-center">
                          <div>
                            <span className="text-text-secondary font-medium">Payment:</span>
                            <span className="text-[10px] text-text-tertiary ml-1.5">
                              Recorded on {inst.date}{inst.notes ? ` · ${inst.notes}` : ""}
                            </span>
                          </div>
                          <span className="font-bold text-text-primary">
                            ₹{inst.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-border-default">
                    <span className="text-text-secondary">Remaining Balance:</span>
                    <span className="font-bold text-brand-orange-primary">
                      ₹{selected.pricing.remainingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border-default">
                    <span className="text-text-secondary">Payment Status:</span>
                    {(() => {
                      const isPaid = selected.paymentStatus === "PAID";
                      const hasInstallments = Boolean(selected.pricing.installments && selected.pricing.installments.length > 0);
                      const isAdvance = selected.paymentStatus === "ADVANCE_RECEIVED" || (!hasInstallments && selected.pricing.advanceAmount > 0 && selected.pricing.remainingAmount > 0);
                      const isPartial = !isPaid && hasInstallments && (selected.pricing.remainingAmount > 0 || selected.paymentStatus === "PARTIAL");

                      if (isPaid) {
                        return <span className="font-bold text-status-success">Payment Completed</span>;
                      }
                      if (isAdvance) {
                        return <span className="font-bold text-sky-700">ADVANCE RECEIVED</span>;
                      }
                      if (isPartial) {
                        return <span className="font-bold text-brand-orange-primary">PARTIAL</span>;
                      }
                      return <span className="font-bold text-text-secondary">PENDING</span>;
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4. Pre-flight Operational Check Report */}
          {selected.preflightReport && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Pre-flight Operational Check
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selected.preflightReport.hasConflicts
                      ? "bg-red-100 text-status-error"
                      : "bg-green-100 text-status-success"
                  }`}
                >
                  {selected.preflightReport.hasConflicts ? "Review Needed" : "Passed Clear"}
                </span>
              </div>

              {selected.preflightReport.eventDateConflicts.length > 0 && (
                <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  <p className="font-bold">Overlapping Event Conflict:</p>
                  <p className="text-[11px] mt-0.5">
                    {selected.preflightReport.eventDateConflicts.join(", ")}
                  </p>
                </div>
              )}

              {selected.preflightReport.warnings.length > 0 && (
                <div className="space-y-1">
                  {selected.preflightReport.warnings.map((w, idx) => (
                    <p key={idx} className="text-[11px] text-amber-900 flex items-center gap-1.5">
                      <span>•</span> {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. Automated Resource Suggestions (Owner Reviews and Confirms) */}
          {selected.resourceSuggestions && selected.resourceSuggestions.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Suggested Resources
                  </h4>
                  <p className="text-[10px] text-blue-700">System suggests · Owner reviews and confirms</p>
                </div>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {selected.resourceSuggestions.length} Available
                </span>
              </div>

              <div className="space-y-2">
                {selected.resourceSuggestions.map((sug) => {
                  const isAssigned = (selected.assignedResources || []).some(
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
                          onClick={() => handleConfirmSuggestion(sug)}
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
          )}

          {/* 6. Customer Order Access and Tracking Link (Sharing Option Info) */}
          <div className="rounded-2xl border border-brand-blue-soft bg-brand-blue-background/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue-primary">
                Customer Order Access and Tracking Link
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                selected.customer?.email
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-brand-blue-primary"
              }`}>
                {selected.customer?.email ? "Email Auth Active" : "6-Digit PIN Protected"}
              </span>
            </div>

            {selected.customer?.email ? (
              /* EMAIL AUTH MODE */
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
                  <div>
                    <span className="text-[10px] font-semibold text-text-tertiary block">Registered Customer Email</span>
                    <span className="font-mono text-xs font-extrabold text-text-primary tracking-wide">
                      {selected.customer.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selected.customer.email!, "code")}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
                  >
                    {copiedField === "code" ? "Copied Email!" : "Copy Email"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-text-tertiary block">Direct Tracking Link</span>
                    <span className="font-mono text-xs font-semibold text-brand-blue-primary truncate block">
                      {`${origin}/track/${selected.orderNumber}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}/track/${selected.orderNumber}`;
                        handleCopyText(link, "link");
                      }}
                      className="rounded-lg bg-brand-blue-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600 transition"
                    >
                      {copiedField === "link" ? "Copied Link!" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}/track/${selected.orderNumber}`;
                        void handleShareText(link, `Order #${selected.orderNumber} Tracking Link`);
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
                      href={`/track/${selected.orderNumber}`}
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
                  Customer email on file (<strong className="text-text-primary">{selected.customer.email}</strong>). Customer authenticates directly with this email. No PIN required.
                </p>
              </div>
            ) : (
              /* 6-DIGIT PIN GUEST PASSKEY MODE */
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
                  <div>
                    <span className="text-[10px] font-semibold text-text-tertiary block">6-Digit Guest Access PIN</span>
                    <span className="font-mono text-sm font-extrabold text-brand-blue-primary tracking-widest">
                      {selected.passkeyPin || selected.trackingPasskey.match(/\d{6}/)?.[0] || selected.orderNumber.match(/\d{6}/)?.[0] || "492015"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pin = selected.passkeyPin || selected.trackingPasskey.match(/\d{6}/)?.[0] || selected.orderNumber.match(/\d{6}/)?.[0] || "492015";
                      handleCopyText(pin, "code");
                    }}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
                  >
                    {copiedField === "code" ? "Copied PIN!" : "Copy 6-Digit PIN"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 bg-white rounded-xl p-2.5 border border-border-default">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-text-tertiary block">Direct Tracking Link</span>
                    <span className="font-mono text-xs font-semibold text-brand-blue-primary truncate block">
                      {`${origin}/track/${selected.orderNumber}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}/track/${selected.orderNumber}`;
                        handleCopyText(link, "link");
                      }}
                      className="rounded-lg bg-brand-blue-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600 transition"
                    >
                      {copiedField === "link" ? "Copied Link!" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}/track/${selected.orderNumber}`;
                        void handleShareText(link, `Order #${selected.orderNumber} Tracking Link`);
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
                      href={`/track/${selected.orderNumber}`}
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

          {/* Cancellation, Audit History and Soft-Deletion Operations */}
          <div className="border-t border-border-divider pt-4 flex items-center justify-between gap-2 flex-wrap">
            {selected.orderStatus !== "CANCELLED" && (
              <button
                type="button"
                onClick={() => {
                  setCancelTargetOrder(selected);
                  setCancelReason("");
                }}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
              >
                Cancel Order
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAuditHistory((prev) => !prev)}
              className="text-xs font-semibold text-brand-blue-primary hover:underline hover:text-sky-700 transition flex items-center gap-1 cursor-pointer mx-auto"
              title="Toggle Order Audit and Activity History"
            >
              <span>{showAuditHistory ? "Hide Audit History" : "Audit History"}</span>
              <span className="text-[10px]">{showAuditHistory ? "▴" : "▾"}</span>
            </button>

            <button
              type="button"
              onClick={() => setDeleteTargetOrder(selected)}
              className="rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 font-bold px-3.5 py-1.5 text-xs transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              title="Delete order with 14-day recovery window"
            >
              <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Order</span>
            </button>
          </div>

          {/* Audit History Activity Log */}
          {showAuditHistory && (() => {
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
            if (selected.auditLog && selected.auditLog.length > 0) {
              selected.auditLog.forEach((entry) => {
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
                timestamp: formatAuditStamp(selected.createdAt),
                actorName: selected.bookingRequestId
                  ? selected.customer.name
                  : (selected.createdBy || studio?.ownerName || "Studio Owner"),
                actorRole: selected.bookingRequestId ? "Customer" : "Owner",
                action: "Order Registered",
                details: `Registered confirmed order for ${selected.eventType} · Confirmed Price: ₹${selected.pricing.finalConfirmedPrice.toLocaleString()}`,
              });
            }

            // 3. Synthesize Advance Payment Recorded
            if (
              selected.pricing.advanceAmount > 0 &&
              !logEntries.some((e) => e.action.includes("Advance Payment"))
            ) {
              const regStamp = formatAuditStamp(selected.createdAt);
              const isSameDay = selected.pricing.advanceDate === selected.createdAt.split("T")[0];
              const advStamp = isSameDay
                ? getStudioTimestampIST(new Date(new Date(selected.createdAt).getTime() + 1000))
                : (selected.pricing.advanceDate ? `${selected.pricing.advanceDate} 12:00` : regStamp);

              logEntries.push({
                id: "synth_adv",
                timestamp: advStamp,
                actorName: selected.createdBy || studio?.ownerName || "Studio Owner",
                actorRole: "Owner",
                action: "Advance Payment Recorded",
                details: `Recorded advance payment of ₹${selected.pricing.advanceAmount.toLocaleString()}`,
              });
            }

            // 4. Synthesize Pre-Flight Operational Check
            if (
              selected.preflightReport &&
              !logEntries.some((e) => e.action.includes("Pre-Flight"))
            ) {
              logEntries.push({
                id: "synth_preflight",
                timestamp: formatAuditStamp(selected.preflightReport.evaluatedAt || selected.createdAt),
                actorName: "Automated System",
                actorRole: "System",
                action: "Pre-Flight Check Evaluated",
                details: selected.preflightReport.hasConflicts
                  ? "Schedule conflict warning detected during pre-flight check"
                  : "All operational pre-flight checks clear (0 schedule conflicts)",
              });
            }

            // 5. Synthesize Event Date Passed (System Action)
            const todayCalendar = getStudioCalendarDate();
            if (
              (selected.eventDate < todayCalendar || selected.orderStatus !== "AWAITING_EVENT") &&
              !logEntries.some((e) => e.action.includes("Event Date Passed"))
            ) {
              logEntries.push({
                id: "synth_event_passed",
                timestamp: `${selected.eventDate} 00:00`,
                actorName: "Automated System",
                actorRole: "System",
                action: "Event Date Passed",
                details: `Event date (${selected.eventDate}) reached — Post-event production workflow started automatically`,
              });
            }

            // 6. Synthesize Installments and Payments
            if (selected.pricing.installments && selected.pricing.installments.length > 0) {
              selected.pricing.installments.forEach((inst, i) => {
                const isPaidAuto = inst.notes?.includes("Marked Paid");
                const instDetail = isPaidAuto
                  ? `Recorded final balance payment of ₹${inst.amount.toLocaleString()}. Order marked as Paid.`
                  : `Recorded payment of ₹${inst.amount.toLocaleString()}${inst.notes ? ` · Note: ${inst.notes}` : ""}`;
                if (!logEntries.some((e) => e.id === inst.id || e.details.includes(`₹${inst.amount.toLocaleString()}`))) {
                  logEntries.push({
                    id: inst.id || `synth_inst_${i}`,
                    timestamp: inst.createdAt ? formatAuditStamp(inst.createdAt) : (inst.date ? `${inst.date} 00:00` : "-"),
                    actorName: inst.recordedBy || studio?.ownerName || "Studio Owner",
                    actorRole: (inst.recordedByRole as "Owner" | "Member" | "Customer" | "System") || "Owner",
                    action: isPaidAuto ? "Order Marked Paid" : "Payment Recorded",
                    details: instDetail,
                  });
                }
              });
            }

            // 7. Synthesize Assigned Resources (Staff assignments)
            if (selected.assignedResources && selected.assignedResources.length > 0) {
              selected.assignedResources.forEach((res) => {
                if (!logEntries.some((e) => e.details.includes(res.memberName) && e.details.includes(res.skill))) {
                  logEntries.push({
                    id: `synth_assign_${res.memberId}_${res.skill}`,
                    timestamp: formatAuditStamp(selected.createdAt),
                    actorName: studio?.ownerName || "Studio Owner",
                    actorRole: "Owner",
                    action: "Crew Assigned",
                    details: `Assigned ${res.memberName} for ${res.skill}`,
                  });
                }
              });
            }

            // 8. Synthesize Meaningful Task Progress (Only tasks that have actual assignments or progress)
            if (selectedTasks && selectedTasks.length > 0) {
              selectedTasks.forEach((t) => {
                const hasAssignee =
                  Boolean(t.assignedMemberName) &&
                  !t.assignedMemberName.toLowerCase().includes("unassigned");
                if (hasAssignee && !logEntries.some((e) => e.details.includes(`Assigned task "${t.title}" to ${t.assignedMemberName}`))) {
                  logEntries.push({
                    id: `synth_task_assign_${t.id}`,
                    timestamp: formatAuditStamp(t.createdAt || selected.createdAt),
                    actorName: studio?.ownerName || "Studio Owner",
                    actorRole: "Owner",
                    action: "Task Assigned",
                    details: `Assigned task "${t.title}" (${t.serviceCategory}) to ${t.assignedMemberName}`,
                  });
                }

                if (t.status !== "ASSIGNED" && t.status !== "AWAITING_EVENT" && !logEntries.some((e) => e.details.includes(t.title) && e.details.includes(t.status))) {
                  logEntries.push({
                    id: `synth_task_status_${t.id}`,
                    timestamp: formatAuditStamp(t.updatedAt || selected.createdAt),
                    actorName: hasAssignee ? t.assignedMemberName : (studio?.ownerName || "Studio Owner"),
                    actorRole: hasAssignee ? "Member" : "Owner",
                    action: "Task Status Updated",
                    details: `Updated task "${t.title}" status to ${t.status}${t.reworkNotes ? ` · Notes: ${t.reworkNotes}` : ""}`,
                  });
                }
              });
            }

            // 9. Synthesize Order Cancellation if cancelled
            if (
              selected.orderStatus === "CANCELLED" &&
              !logEntries.some((e) => e.action.includes("Order Cancelled"))
            ) {
              logEntries.push({
                id: "synth_cancelled",
                timestamp: formatAuditStamp(selected.cancellationInfo?.cancelledAt || selected.updatedAt),
                actorName: selected.cancellationInfo?.cancelledBy || studio?.ownerName || "Studio Owner",
                actorRole: "Owner",
                action: "Order Cancelled",
                details: `Order cancelled — Reason: "${selected.cancellationInfo?.cancellationReason || "Cancelled by studio owner"}"`,
              });
            }

            // Sort chronologically from earliest to latest so the timeline unfolds cleanly
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
                    <span className="text-xs font-bold text-text-primary">Order Audit Trail and Activity Logs</span>
                    <span className="text-[10px] text-text-tertiary">#{selected.orderNumber}</span>
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
                        {/* Timestamp */}
                        <div className="w-24 shrink-0 pt-0.5">
                          <span className="font-mono text-[10px] font-bold text-slate-700 block">
                            {log.timestamp.split(" ")[0]}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 block">
                            {log.timestamp.split(" ")[1] || "00:00"}
                          </span>
                        </div>

                        {/* Action, Actor and Details (No emoji/character icons for clean retro aesthetic) */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {log.action}
                            </span>
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
          })()}
        </aside>
      )}

      {/* New Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-border-default animate-in fade-in duration-150 my-auto">
            {/* Modal Header (Pinned at Top) */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border-default shrink-0">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Register Confirmed Order</h3>
                <p className="text-xs text-text-secondary">Begins automated 3-state production workflow</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-app transition"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateOrder} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto p-6 space-y-4 flex-1">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
                    {formError}
                  </div>
                )}

                {/* Customer Full Name with Autocomplete */}
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-text-primary">Customer Full Name *</label>
                    {studioCustomers.length > 0 && (
                      <span className="text-[10px] text-text-tertiary">
                        {studioCustomers.length} registered in CRM
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar (Search existing or type new)"
                      value={newOrderForm.customerName}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onChange={(e) => {
                        setNewOrderForm({ ...newOrderForm, customerName: e.target.value });
                        setShowCustomerDropdown(true);
                      }}
                      className="w-full rounded-xl border border-border-default px-3.5 py-2 pr-10 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    />
                    {studioCustomers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCustomerDropdown((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-brand-blue-primary p-0.5"
                        tabIndex={-1}
                        title="Toggle customer list"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${showCustomerDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {newOrderForm.customerName.trim().length > 0 &&
                    (newOrderForm.customerName.match(/[a-zA-Z]/g) || []).length < 3 && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600">
                        Name must have at least 3 letters.
                      </p>
                    )}

                  {/* Customer Autocomplete Dropdown */}
                  {showCustomerDropdown && matchingCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-2xl border border-border-default bg-white p-2 shadow-xl animate-in fade-in duration-100 max-h-48 overflow-y-auto">
                      <div className="flex items-center justify-between px-2 pb-1 border-b border-border-default text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                        <span>Select Existing Client or Type New</span>
                        <button
                          type="button"
                          onClick={() => setShowCustomerDropdown(false)}
                          className="text-brand-blue-primary hover:underline lowercase font-semibold"
                        >
                          close
                        </button>
                      </div>
                      <div className="space-y-0.5 pt-1">
                        {matchingCustomers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => selectExistingCustomer(c)}
                            className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-brand-blue-50/80 cursor-pointer transition text-left"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-text-primary truncate">{c.name}</p>
                              <p className="text-[10px] text-text-secondary truncate">
                                {c.phone || "No phone"} {c.email ? `· ${c.email}` : ""}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-brand-blue-primary bg-brand-blue-100/60 px-2 py-0.5 rounded-full shrink-0 ml-2">
                              CRM Link
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary">
                      Phone Number <span className="font-normal text-text-tertiary">(Optional)</span>
                    </label>
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="text"
                        placeholder="+91"
                        value={newOrderForm.countryCode}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, countryCode: e.target.value })}
                        className="w-20 rounded-xl border border-border-default bg-surface-app px-2 py-2 text-xs font-semibold text-text-primary text-center outline-none focus:border-brand-blue-primary"
                        title="Country Code (e.g. +91, +1, +44)"
                      />
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={newOrderForm.customerPhone}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, customerPhone: e.target.value })}
                        className="flex-1 min-w-0 rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-primary">
                      Customer Email <span className="font-normal text-text-tertiary">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="client@gmail.com"
                      value={newOrderForm.customerEmail}
                      onChange={(e) => setNewOrderForm({ ...newOrderForm, customerEmail: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    />
                  </div>
                </div>

                {/* Non-Blocking Duplicate Match Notice */}
                {duplicateCustomerWarning && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 flex items-start gap-2.5 animate-in fade-in duration-150">
                    <span className="text-base leading-none shrink-0 mt-0.5">ℹ️</span>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold">
                        Existing CRM Customer Match: <span className="underline">{duplicateCustomerWarning.name}</span>
                        {duplicateCustomerWarning.phone ? ` (${duplicateCustomerWarning.phone})` : ""}
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        This order will be automatically linked to their existing customer profile and lifetime bookings in CRM. You can continue without changing the name.
                      </p>
                    </div>
                  </div>
                )}

                {/* Dynamic Automated Customer Notifications (displayed only when phone or email is provided) */}
                {(Boolean(newOrderForm.customerPhone.trim()) || Boolean(newOrderForm.customerEmail.trim())) && (
                  <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-950">
                        Automated Client Notifications
                      </span>
                    </div>

                    <div className="space-y-2 pt-0.5">
                      {Boolean(newOrderForm.customerPhone.trim()) && (
                        <label className="flex items-center gap-2.5 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newOrderForm.notifyWhatsApp}
                            onChange={(e) =>
                              setNewOrderForm({ ...newOrderForm, notifyWhatsApp: e.target.checked })
                            }
                            className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary"
                          />
                          <span className="text-xs font-medium text-text-primary">
                            Send automated order updates via <strong>WhatsApp</strong>
                          </span>
                        </label>
                      )}

                      {Boolean(newOrderForm.customerEmail.trim()) && (
                        <label className="flex items-center gap-2.5 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newOrderForm.notifyEmail}
                            onChange={(e) =>
                              setNewOrderForm({ ...newOrderForm, notifyEmail: e.target.checked })
                            }
                            className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary"
                          />
                          <span className="text-xs font-medium text-text-primary">
                            Send automated order updates via <strong>Email</strong>
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Event Type Dropdown and Custom Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary">Event Type *</label>
                    <select
                      value={newOrderForm.eventType}
                      onChange={(e) => setNewOrderForm({ ...newOrderForm, eventType: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-medium text-text-primary outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    >
                      {PRESET_EVENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {newOrderForm.eventType === "Other" && (
                      <input
                        type="text"
                        placeholder="Specify event type (Optional)"
                        value={newOrderForm.customEventType}
                        onChange={(e) => setNewOrderForm({ ...newOrderForm, customEventType: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-border-default px-3 py-1.5 text-xs outline-none focus:border-brand-blue-primary"
                      />
                    )}
                  </div>

                  <div>
                    <label htmlFor="register-order-event-date" className="block text-xs font-bold text-text-primary cursor-pointer">
                      Event Date *
                    </label>
                    <input
                      id="register-order-event-date"
                      type="date"
                      required
                      value={newOrderForm.eventDate}
                      onChange={(e) => setNewOrderForm({ ...newOrderForm, eventDate: e.target.value })}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch {}
                      }}
                      className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary">
                    Event Location <span className="font-normal text-text-tertiary">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai, Bangalore"
                    value={newOrderForm.eventLocation}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, eventLocation: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                  />
                </div>

                {/* Studio Package / Combo Quick Selector */}
                {activeStudioPackages.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-text-primary">
                        Package / Combo <span className="font-normal text-text-tertiary">(Optional)</span>
                      </label>
                      <Link
                        href={`/${studioSlug}/dashboard/services`}
                        target="_blank"
                        className="text-[10px] text-brand-blue-primary font-semibold hover:underline"
                      >
                        Manage Catalog ↗
                      </Link>
                    </div>
                    <select
                      value={selectedPackageId}
                      onChange={(e) => handleSelectPackage(e.target.value)}
                      className="w-full rounded-xl border border-brand-blue-soft bg-brand-blue-50/50 px-3.5 py-2 text-xs font-semibold text-text-primary outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    >
                      <option value="">-- Custom Order (Choose Services Below) --</option>
                      {activeStudioPackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} — ₹{pkg.price.toLocaleString("en-IN")} ({pkg.services.length} services)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Studio Services and Deliverables Dropdown with Multi-Select */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-text-primary">
                      Studio Services and Deliverables *
                    </label>
                    <span className="text-[10px] font-semibold text-text-tertiary">
                      {newOrderForm.services.length} Selected
                    </span>
                  </div>

                  {/* Combobox Input Field Trigger */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Select or type custom service and press Enter..."
                      value={newOrderForm.customServiceInput}
                      onChange={(e) => {
                        setNewOrderForm({ ...newOrderForm, customServiceInput: e.target.value });
                        if (!showServicesDropdown) setShowServicesDropdown(true);
                      }}
                      onFocus={() => setShowServicesDropdown(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const custom = newOrderForm.customServiceInput.trim();
                          if (custom && !newOrderForm.services.includes(custom)) {
                            const nextServices = [...newOrderForm.services, custom];
                            const autoPrice = calculateOrderPrice(nextServices, selectedPackageId);
                            setNewOrderForm({
                              ...newOrderForm,
                              services: nextServices,
                              customServiceInput: "",
                              finalConfirmedPrice: autoPrice > 0 ? autoPrice : newOrderForm.finalConfirmedPrice,
                            });
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-border-default px-3.5 py-2 pr-10 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    />
                    <div 
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-text-tertiary hover:text-brand-blue-primary"
                      onClick={() => setShowServicesDropdown((prev) => !prev)}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${showServicesDropdown ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Dropdown Options Popup */}
                    {showServicesDropdown && (
                      <div className="absolute top-full z-20 left-0 right-0 mt-1.5 rounded-2xl border border-border-default bg-white shadow-xl p-2.5 space-y-1.5 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between px-2 pb-1 border-b border-border-default text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                          <span>Studio Services ({newOrderForm.services.length} selected)</span>
                          <button
                            type="button"
                            onClick={() => setShowServicesDropdown(false)}
                            className="text-brand-blue-primary hover:underline lowercase font-semibold"
                          >
                            done
                          </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                          {availableServices
                            .filter((svc) => svc.name.toLowerCase().includes(newOrderForm.customServiceInput.toLowerCase()))
                            .map((svc) => {
                            const isSvcSelected = newOrderForm.services.includes(svc.name);
                            return (
                              <label
                                key={svc.id}
                                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition select-none ${
                                  isSvcSelected
                                    ? "bg-brand-blue-50/80 text-brand-blue-primary"
                                    : "text-text-primary hover:bg-surface-app"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isSvcSelected}
                                    onChange={() => toggleService(svc.name)}
                                    className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary shrink-0"
                                  />
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="truncate">{svc.name}</span>
                                    {svc.isDeliverable && (
                                      <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[8px] font-bold text-amber-700">
                                        Deliverable
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {svc.enabled && svc.defaultPrice > 0 && (
                                    <span className="text-[10px] font-semibold text-text-tertiary">
                                      ₹{svc.defaultPrice.toLocaleString("en-IN")}
                                    </span>
                                  )}
                                  {isSvcSelected && (
                                    <span className="text-[10px] font-bold text-brand-blue-primary">✓</span>
                                  )}
                                </div>
                              </label>
                            );
                          })}

                          {/* Custom Services Added on the fly by User */}
                          {newOrderForm.services
                            .filter((s) => !availableServices.some((svc) => svc.name.toLowerCase() === s.toLowerCase()))
                            .map((customSvc) => (
                              <label
                                key={customSvc}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-blue-50/80 text-brand-blue-primary cursor-pointer transition select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => toggleService(customSvc)}
                                    className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary shrink-0"
                                  />
                                  <span className="truncate">{customSvc}</span>
                                </div>
                                <span className="text-[10px] font-bold text-brand-blue-primary shrink-0 ml-2">Custom</span>
                              </label>
                            ))}
                            
                          {/* Prompt to press enter if typing custom that doesn't match studio presets */}
                          {newOrderForm.customServiceInput.trim() && 
                           !availableServices.some(s => s.name.toLowerCase() === newOrderForm.customServiceInput.trim().toLowerCase()) &&
                           !newOrderForm.services.includes(newOrderForm.customServiceInput.trim()) && (
                            <div className="px-2.5 py-1.5 text-[10px] font-medium text-text-tertiary italic">
                              Press Enter to add &quot;{newOrderForm.customServiceInput.trim()}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Options Displayed Below the Input Field */}
                  {newOrderForm.services.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {newOrderForm.services.map((svc) => {
                        const matchedConfig = studioServicesList.find(s => s.name.toLowerCase() === svc.toLowerCase());
                        return (
                          <span
                            key={svc}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue-primary border border-brand-blue-soft"
                          >
                            <span>{svc}</span>
                            {matchedConfig && matchedConfig.enabled && matchedConfig.defaultPrice > 0 && (
                              <span className="text-[10px] font-normal text-text-tertiary">
                                (₹{matchedConfig.defaultPrice.toLocaleString("en-IN")})
                              </span>
                            )}
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleService(svc);
                              }}
                              className="text-xs font-bold text-brand-blue-primary hover:text-red-500 cursor-pointer ml-0.5 leading-none"
                              title={`Remove ${svc}`}
                            >
                              ×
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pricing and Advance with Validation */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-primary">Confirmed Total Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 75,000"
                      value={newOrderForm.finalConfirmedPrice ?? ""}
                      onChange={(e) =>
                        setNewOrderForm({
                          ...newOrderForm,
                          finalConfirmedPrice: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                    />
                    {/* Informative Note for Confirmed Total Price without emoji */}
                    {newOrderForm.services.length > 0 && (
                      <p className="mt-1 text-[11px] leading-tight text-text-tertiary">
                        {Number(newOrderForm.finalConfirmedPrice) > 0
                          ? "Auto-calculated from selected items above · Review and edit if needed"
                          : "Enter agreed total price for selected services"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-primary">Advance Received (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 25,000"
                      value={newOrderForm.advanceAmount ?? ""}
                      onChange={(e) =>
                        setNewOrderForm({
                          ...newOrderForm,
                          advanceAmount: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value),
                        })
                      }
                      className={`mt-1 w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:ring-1 ${
                        Number(newOrderForm.advanceAmount) > Number(newOrderForm.finalConfirmedPrice) && Number(newOrderForm.finalConfirmedPrice) > 0
                          ? "border-status-error bg-red-50/50 text-status-error focus:ring-red-400"
                          : "border-border-default focus:border-brand-blue-primary focus:ring-brand-blue-primary"
                      }`}
                    />
                  </div>
                  {Number(newOrderForm.advanceAmount) > Number(newOrderForm.finalConfirmedPrice) && Number(newOrderForm.finalConfirmedPrice) > 0 && (
                    <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] font-semibold text-status-error">
                      Advance amount cannot exceed the confirmed total price.
                    </div>
                  )}
                </div>

                {/* Payment Summary Breakdown */}
                <div className="rounded-2xl border border-border-default bg-surface-app/70 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                      Payment Summary
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      Auto-calculated breakdown
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-border-divider text-xs">
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Confirmed Total Price</span>
                      <span className="font-bold text-text-primary">
                        ₹{(Math.max(0, Number(newOrderForm.finalConfirmedPrice) || 0)).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Advance Received</span>
                      <span className="font-bold text-brand-blue-primary">
                        ₹{(Math.max(0, Number(newOrderForm.advanceAmount) || 0)).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border-divider font-bold">
                      <span className="text-text-primary">Remaining Amount</span>
                      <span
                        className={
                          Math.max(0, (Number(newOrderForm.finalConfirmedPrice) || 0) - (Number(newOrderForm.advanceAmount) || 0)) > 0
                            ? "text-brand-orange-primary font-extrabold text-sm"
                            : "text-emerald-600 font-extrabold text-sm"
                        }
                      >
                        ₹{(Math.max(0, (Number(newOrderForm.finalConfirmedPrice) || 0) - (Number(newOrderForm.advanceAmount) || 0))).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6-Digit Guest Access PIN and Tracking Passkey */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950">
                      6-Digit Guest Access PIN
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewOrderForm({
                          ...newOrderForm,
                          passkeyPin: Math.floor(100000 + Math.random() * 900000).toString(),
                        })
                      }
                      className="text-[11px] font-bold text-brand-blue-primary hover:underline"
                    >
                      Regenerate PIN
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {newOrderForm.customerEmail.trim() ? (
                      <>
                        Order tracking link will be sent to <strong className="font-semibold text-amber-950">{newOrderForm.customerEmail.trim()}</strong>. Your customer can track with their email or access instantly as a guest using this 6-digit PIN.
                      </>
                    ) : (
                      <>
                        No customer email provided. Share this 6-digit PIN with your customer for guest order tracking.
                      </>
                    )}
                  </p>
                  <div className="pt-1">
                    <input
                      type="text"
                      maxLength={6}
                      value={newOrderForm.passkeyPin}
                      onChange={(e) =>
                        setNewOrderForm({ ...newOrderForm, passkeyPin: e.target.value.replace(/\D/g, "").slice(0, 6) })
                      }
                      className={`w-32 rounded-xl bg-white px-3.5 py-1.5 font-mono text-sm font-extrabold tracking-widest text-text-primary text-center outline-none transition ${
                        newOrderForm.passkeyPin.length !== 6
                          ? "border border-rose-400 focus:border-rose-500"
                          : "border border-amber-300 focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                      }`}
                    />
                    {newOrderForm.passkeyPin.length !== 6 && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600">PIN must be 6 digits.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer (Pinned at Bottom) */}
              <div className="p-4 sm:px-6 border-t border-border-default bg-surface-app/40 shrink-0 flex gap-3 justify-end rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-brand-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (newOrderForm.customerName.match(/[a-zA-Z]/g) || []).length < 3 ||
                    newOrderForm.passkeyPin.length !== 6 ||
                    (Number(newOrderForm.advanceAmount) > Number(newOrderForm.finalConfirmedPrice) &&
                      Number(newOrderForm.finalConfirmedPrice) > 0)
                  }
                  className="btn-brand-blue disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Confirm and Save Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Cancellation Dialog */}
      {cancelTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="text-base font-bold text-text-primary">Cancel Order</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Order #{cancelTargetOrder.orderNumber} · {cancelTargetOrder.customer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-app transition"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                Cancelling this order will mark it as Cancelled in the production pipeline and stop automated notifications.
              </p>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Cancellation Reason <span className="font-normal text-text-tertiary">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Client postponed indefinitely or requested cancellation"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-xl border border-border-default p-3 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                className="btn-brand-outline"
                disabled={isCancelling}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                disabled={isCancelling}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Soft-Delete Dialog */}
      {deleteTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <h3 className="text-base font-bold text-status-error">Delete Order</h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Order #{deleteTargetOrder.orderNumber} · {deleteTargetOrder.customer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetOrder(null)}
                className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-app transition"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-4 space-y-2">
              <p className="text-xs text-text-primary font-semibold">
                Are you sure you want to soft-delete this order?
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                This order will be removed from your active dashboard. It can be fully recovered from the studio archives within 14 days before permanent purge.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
              <button
                type="button"
                onClick={() => setDeleteTargetOrder(null)}
                className="btn-brand-outline"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isDeleting ? "Deleting..." : "Delete Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studio ERP Member Wizard Dialog — Reusable Component */}
      <AddCrewMemberModal
        isOpen={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setTargetAssignContext(null);
          setAddMemberInitialName("");
        }}
        studioSlug={studioSlug}
        initialName={addMemberInitialName}
        initialSkills={addMemberInitialSkills}
        onSuccess={handleMemberCreated}
      />
    </div>
  );
}
