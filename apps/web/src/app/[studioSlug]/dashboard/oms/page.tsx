"use client";

import { useMemo, useState, useEffect, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import {
  OrderStatus,
  TaskStatus,
  Order,
  Task,
  PaymentStatus,
  ResourceSuggestion,
  Customer,
  OrderInstallment,
  StudioMember,
  StudioServiceConfig,
  StudioPackage,
  OrderDriveDeliverable,
  StudioBillingProfile,
  StudioLead,
  StudioLeadWebhookConfig,
} from "@focoman/types";
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
  saveServiceCrewAssignmentsAction,
  markTaskOfflineReviewReadyAction,
  updateOrderAction,
  updateOrderDriveDeliverablesAction,
} from "@/actions/orderActions";
import { getStudioMembersAction } from "@/actions/memberActions";
import { getStudioCustomersAction } from "@/actions/customerActions";
import { getStudioServicesAction, updateStudioAction } from "@/actions/studioActions";
import { getStudioLeadsAction } from "@/actions/leadActions";
import { DEFAULT_STUDIO_SERVICES } from "@/lib/studioServices";
import { uploadPaymentProof } from "@/lib/paymentProofUpload";
import { getEffectiveStudioFeatures } from "@/lib/proEntitlements";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { AddCrewMemberModal } from "@/components/AddCrewMemberModal";
import { OrderVerticalWorkflow } from "@/components/workflow/OrderVerticalWorkflow";
import { OrderBillingPanel } from "@/components/billing/OrderBillingPanel";
import { GoogleDriveDeliverablesSection } from "@/components/deliverables/GoogleDriveDeliverablesSection";
import {
  DEFAULT_ORDER_FORM,
  exportOmsOrdersToExcel,
} from "@/components/oms/omsConstants";
import { OmsOrdersListPanel } from "@/components/oms/OmsOrdersListPanel";
import { OmsLeadsPanel } from "@/components/oms/OmsLeadsPanel";
import {
  OmsCustomerAccessCard,
  OmsPreflightCheckSection,
  OmsResourceSuggestionsSection,
  OmsTurnaroundSlaBanner,
} from "@/components/oms/OmsOrderSubsections";
import { OmsAuditHistorySection } from "@/components/oms/OmsAuditHistorySection";
import { OmsPaymentSummarySection } from "@/components/oms/OmsPaymentSummarySection";
import { OmsCreateOrderModal } from "@/components/oms/OmsCreateOrderModal";
import { OmsOrderActionDialogs } from "@/components/oms/OmsOrderActionDialogs";

export default function OmsPage({
  params,
}: {
  params: Promise<{ studioSlug: string }>;
}) {
  const { studioSlug } = use(params);
  const searchParams = useSearchParams();
  const {
    studio,
    user: workspaceUser,
    idToken: workspaceToken,
    authLoading,
    getIdToken,
  } = useStudioWorkspace();
  const effectiveFeatures = getEffectiveStudioFeatures(
    studio?.ownerEmail,
    studio?.features,
    studio?.planInfo
  );
  const hasCrm = Boolean(studio?.features?.crm);
  const hasErp = effectiveFeatures.erp;
  const hasWhatsAppOperations = effectiveFeatures.whatsapp;
  const hasDriveReview = Boolean(studio?.features?.driveReview);
  const [orders, setOrders] = useState<Order[]>([]);
  const [omsSection, setOmsSection] = useState<"ORDERS" | "LEADS">("ORDERS");
  const [leads, setLeads] = useState<StudioLead[]>([]);
  const [webhookConfig, setWebhookConfig] =
    useState<StudioLeadWebhookConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) || null,
    [orders, selectedId]
  );
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "MARKETPLACE" | OrderStatus
  >("ALL");
  const [sortBy, setSortBy] = useState<
    "DATE_ASC" | "DATE_DESC" | "PRICE_ASC" | "PRICE_DESC"
  >("DATE_ASC");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isOrdersRefreshing, setIsOrdersRefreshing] = useState(false);
  const [ordersRefreshError, setOrdersRefreshError] = useState<string | null>(null);
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
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
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

  // New Order Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingModalState, setBillingModalState] = useState<{
    isOpen: boolean;
    tab: "INVOICE" | "RECEIPT";
    receiptId?: string;
  }>({ isOpen: false, tab: "INVOICE" });

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
  const [newInstallmentMethod, setNewInstallmentMethod] = useState<"CASH" | "UPI" | "BANK_TRANSFER">("CASH");
  const [newInstallmentReference, setNewInstallmentReference] = useState("");
  const [newInstallmentProofFile, setNewInstallmentProofFile] = useState<File | null>(null);
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

  const availableServices = useMemo(() => {
    return studioServicesList.filter((service) => service.enabled);
  }, [studioServicesList]);

  const calculateOrderPrice = useCallback(
    (selectedServices: string[], packageId?: string) => {
      const pkg = packageId
        ? activeStudioPackages.find((p) => p.id === packageId)
        : null;
      if (pkg) {
        let total = pkg.price;
        const pkgServicesLower = pkg.services.map((s) => s.toLowerCase());
        selectedServices.forEach((svcName) => {
          if (!pkgServicesLower.includes(svcName.toLowerCase())) {
            const match = studioServicesList.find(
              (s) => s.name.toLowerCase() === svcName.toLowerCase()
            );
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
        finalConfirmedPrice:
          autoPrice > 0 ? autoPrice : ("" as unknown as number),
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
  const [addMemberInitialSkills, setAddMemberInitialSkills] = useState<string[]>([
    "PHOTOGRAPHY",
  ]);
  const [, setEditingCrewService] = useState<string | null>(null);
  const [, setActiveCrewDropdown] = useState<string | null>(null);
  const [, setCrewSearchQuery] = useState<Record<string, string>>({});
  const [targetAssignContext, setTargetAssignContext] = useState<{
    serviceName?: string;
    taskId?: string;
  } | null>(null);

  const allSelectableCrew = useMemo(() => {
    if (!hasErp) return [];
    const list: Array<{ id: string; name: string; skills: string[]; role: string }> =
      [];
    const ownerDisplayName =
      studio?.ownerName || workspaceUser?.displayName || "Studio Owner";
    if (ownerDisplayName) {
      list.push({
        id: `owner-${studio?.id || studioSlug}`,
        name: `${ownerDisplayName} (Owner)`,
        skills: ["PHOTOGRAPHY", "VIDEOGRAPHY"],
        role: "Owner",
      });
    }
    studioMembers.forEach((m) => {
      const memberName =
        m.name || m.ownerAssignedName || m.email || "Crew Member";
      if (
        !list.some(
          (existing) => existing.id === m.id || existing.name === memberName
        )
      ) {
        list.push({
          id: m.id,
          name: memberName,
          skills: m.skills || [],
          role: "Crew",
        });
      }
    });
    return list;
  }, [hasErp, studio, studioSlug, studioMembers, workspaceUser]);

  const temporaryCrewList = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; isTemporary: true }
    >();
    const ownerName = (
      studio?.ownerName ||
      workspaceUser?.displayName ||
      ""
    ).toLowerCase();

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
      if (
        !isRegistered &&
        t.name &&
        !t.name.toLowerCase().includes("unassigned")
      ) {
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
            `${c.name.toLowerCase()} (owner)` ===
              (r.memberName || "").toLowerCase()
        );
        if (
          !isRegistered &&
          r.memberName &&
          !r.memberName.toLowerCase().includes("unassigned")
        ) {
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
    if (!hasCrm) return [];
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
  }, [hasCrm, studioCustomers, newOrderForm.customerName]);

  const duplicateCustomerWarning = useMemo(() => {
    if (!hasCrm) return null;
    const name = newOrderForm.customerName.trim().toLowerCase();
    const phone = newOrderForm.customerPhone.trim().replace(/\D/g, "");
    if (!name && !phone) return null;
    return (
      studioCustomers.find((c) => {
        const cName = c.name.trim().toLowerCase();
        const cPhone = (c.phone || "").replace(/\D/g, "");
        return (
          (name && cName === name) ||
          (phone &&
            cPhone &&
            (cPhone === phone ||
              cPhone.endsWith(phone) ||
              phone.endsWith(cPhone)))
        );
      }) || null
    );
  }, [hasCrm, studioCustomers, newOrderForm.customerName, newOrderForm.customerPhone]);

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
        finalConfirmedPrice:
          autoPrice > 0 ? autoPrice : ("" as unknown as number),
      };
    });
  };

  const loadOrders = useCallback(
    async (tokenOverride?: string | null) => {
      try {
        const token =
          tokenOverride ?? (await getIdToken(false)) ?? workspaceToken;
        if (!token) {
          setLoading(false);
          return false;
        }
        const [data, customersData, membersData, servicesRes, leadsRes] =
          await Promise.all([
            getStudioOrdersAction(studioSlug, token),
            getStudioCustomersAction(studioSlug, token),
            getStudioMembersAction(studioSlug, token).catch(() => []),
            getStudioServicesAction(studioSlug, token).catch(() => null),
            getStudioLeadsAction(studioSlug, token).catch(() => null),
          ]);
        setOrders(data);
        setStudioCustomers(customersData);
        setStudioMembers(membersData || []);
        if (leadsRes) {
          setLeads(leadsRes.leads || []);
          setWebhookConfig(leadsRes.webhookConfig || null);
        }
        if (servicesRes && servicesRes.success) {
          if (Array.isArray(servicesRes.services)) {
            setStudioServicesList(servicesRes.services);
          }
          if (Array.isArray(servicesRes.packages)) {
            setStudioPackagesList(servicesRes.packages);
          }
        }
        return true;
      } catch (err) {
        console.error("[OmsPage] Failed to load orders:", err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [studioSlug, workspaceToken, getIdToken]
  );

  useEffect(() => {
    if (!authLoading) {
      void loadOrders(workspaceToken);
    }
  }, [studioSlug, authLoading, workspaceToken, loadOrders]);

  useEffect(() => {
    if (selectedId) {
      if (workspaceToken) {
        void getOrderTasksAction(selectedId, studioSlug, workspaceToken).then(
          setSelectedTasks
        );
      }
    } else {
      setSelectedTasks([]);
    }
  }, [selectedId, studioSlug, workspaceToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlSection = params.get("section") || params.get("tab");
    if (urlSection && urlSection.toLowerCase() === "leads") {
      setOmsSection("LEADS");
    }
    const urlOrderId = params.get("orderId");
    if (urlOrderId) {
      setOmsSection("ORDERS");
      setSelectedId(urlOrderId);
    }
    const action = params.get("action");
    const newOrder = params.get("newOrder");
    if (action === "new-order" || newOrder === "true" || newOrder === "1") {
      setOmsSection("ORDERS");
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
        ? newOrderForm.customEventType.trim() || "Special Occasion"
        : newOrderForm.eventType;

    const trimmedPhone = newOrderForm.customerPhone.trim();
    const resolvedPhone = trimmedPhone
      ? trimmedPhone.startsWith("+")
        ? trimmedPhone
        : `${newOrderForm.countryCode.trim() || "+91"} ${trimmedPhone}`
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
      notifyWhatsApp: Boolean(
        hasWhatsAppOperations && newOrderForm.notifyWhatsApp && resolvedPhone
      ),
      notifyEmail: Boolean(
        newOrderForm.notifyEmail && newOrderForm.customerEmail.trim()
      ),
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
      setOrdersRefreshError(null);
      setIsOrdersRefreshing(true);
      const refreshed = await loadOrders();
      setIsOrdersRefreshing(false);
      if (!refreshed) {
        setOrdersRefreshError("Order was registered, but the order list could not be refreshed. Please refresh the page to confirm it.");
      }
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
      setSelectedTasks((prev) =>
        prev.map((t) => (t.id === taskId ? res.task! : t))
      );
      await loadOrders();
    } else if (!res.success) {
      alert(res.error || "Failed to update task status");
    }
  };

  const handleSaveOrderSchedule = async (eventDate: string, eventLocation: string) => {
    if (!selected) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) throw new Error("Authentication error. Please sign in again.");
    const res = await updateOrderAction({
      orderId: selected.id,
      studioId: studioSlug,
      updates: { eventDate, eventLocation: eventLocation.trim() },
      idToken: token,
    });
    if (!res.success || !res.order) throw new Error(res.error || "Failed to save event schedule.");
    setOrders((previous) => previous.map((order) => order.id === res.order!.id ? res.order! : order));
  };

  const handleMarkTaskOfflineReviewReady = async (taskId: string) => {
    if (!selected) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) throw new Error("Authentication error. Please sign in again.");
    const res = await markTaskOfflineReviewReadyAction({ orderId: selected.id, taskId, studioId: studioSlug, idToken: token });
    if (!res.success || !res.task) throw new Error(res.error || "Failed to confirm offline handoff.");
    setSelectedTasks((previous) => previous.map((task) => task.id === res.task!.id ? res.task! : task));
    await loadOrders();
  };

  const handleUpdatePayment = async (
    newPaymentStatus?: PaymentStatus,
    advanceAmount?: number,
    finalConfirmedPrice?: number,
    installments?: OrderInstallment[],
    advanceDate?: string
  ): Promise<boolean> => {
    if (!selected || isUpdatingPayment) return false;
    setIsUpdatingPayment(true);

    const previousOrders = [...orders];
    const confirmedVal =
      finalConfirmedPrice !== undefined
        ? finalConfirmedPrice
        : selected.pricing.finalConfirmedPrice;
    const currentInstallments =
      installments !== undefined
        ? installments
        : selected.pricing.installments || [];
    const installmentsTotal = currentInstallments.reduce(
      (sum, inst) => sum + (inst.amount || 0),
      0
    );

    let nextInstallments = [...currentInstallments];
    const nextAdvance =
      advanceAmount !== undefined
        ? advanceAmount
        : selected.pricing.advanceAmount;

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
          recordedBy:
            workspaceUser?.displayName || studio?.ownerName || "Studio Owner",
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
      nextInstallments = nextInstallments.filter(
        (inst) => !inst.notes?.includes("Marked Paid")
      );
      const newInstTotal = nextInstallments.reduce(
        (sum, inst) => sum + (inst.amount || 0),
        0
      );
      const totalPaid = nextAdvance + newInstTotal;
      const calculatedStatus: PaymentStatus =
        totalPaid > 0 && totalPaid < confirmedVal
          ? nextInstallments.length > 0
            ? "PARTIAL"
            : "ADVANCE_RECEIVED"
          : totalPaid >= confirmedVal && confirmedVal > 0
          ? "PAID"
          : "PENDING";
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
      const advVal =
        advanceAmount !== undefined
          ? advanceAmount
          : selected.pricing.advanceAmount;
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
                    advVal < confirmedVal
                      ? advVal
                      : o.pricing.previousAdvanceAmount,
                },
              }
            : o
        )
      );
    }

    try {
      const token =
        (await getIdToken(true)) ?? (await getIdToken(false)) ?? workspaceToken;
      if (!token) {
        setIsUpdatingPayment(false);
        setOrders(previousOrders);
        return false;
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
        setOrders((prev) =>
          prev.map((o) => (o.id === res.order!.id ? res.order! : o))
        );
        await loadOrders();
        return true;
      } else {
        setOrders(previousOrders);
        alert(res.error || "Failed to update payment status");
        return false;
      }
    } catch (err: unknown) {
      setIsUpdatingPayment(false);
      setOrders(previousOrders);
      alert(
        err instanceof Error ? err.message : "Failed to update payment status"
      );
      return false;
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
      alert(
        err instanceof Error ? err.message : "Failed to send payment reminder."
      );
    }
  };

  const handleStartEditingPricing = () => {
    if (!selected) return;
    setEditConfirmedPrice(String(selected.pricing.finalConfirmedPrice));
    setEditAdvanceAmount(String(selected.pricing.advanceAmount));
    setEditAdvanceDate(
      selected.pricing.advanceDate ||
        (selected.createdAt
          ? selected.createdAt.split("T")[0]
          : new Date().toISOString().split("T")[0])
    );
    setEditInstallments(
      selected.pricing.installments ? [...selected.pricing.installments] : []
    );
    setShowAddInstallment(false);
    setNewInstallmentAmount("");
    setNewInstallmentDate(new Date().toISOString().split("T")[0]);
    setNewInstallmentNotes("");
    setNewInstallmentMethod("CASH");
    setNewInstallmentReference("");
    setPricingError(null);
    setInstallmentError(null);
    setIsEditingPricing(true);
  };

  const handleAddInstallment = async () => {
    const amt = Number(newInstallmentAmount);
    if (!amt || amt <= 0) {
      setInstallmentError(
        "Please enter a valid payment amount greater than ₹0."
      );
      return;
    }
    const confirmedNum = Math.max(0, Number(editConfirmedPrice) || 0);
    const advanceNum = Math.max(0, Number(editAdvanceAmount) || 0);
    const existingInstTotal = editInstallments.reduce(
      (sum, inst) => sum + (inst.amount || 0),
      0
    );
    const maxAllowed = Math.max(
      0,
      confirmedNum - (advanceNum + existingInstTotal)
    );

    if (amt > maxAllowed) {
      setInstallmentError(
        `Payment amount (₹${amt.toLocaleString()}) exceeds the remaining balance of ₹${maxAllowed.toLocaleString()}.`
      );
      return;
    }

    setInstallmentError(null);
    setPricingError(null);
    const paymentId = `inst_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let proofUrl: string | undefined;
    if (newInstallmentMethod === "UPI" && newInstallmentProofFile) {
      try {
        if (!selected) throw new Error("Select an order first.");
        proofUrl = await uploadPaymentProof({ studioId: studioSlug, orderId: selected.id, paymentId, file: newInstallmentProofFile });
      } catch (error) {
        setInstallmentError(error instanceof Error ? error.message : "Failed to upload payment proof.");
        return;
      }
    }
    const newInst: OrderInstallment = {
      id: paymentId,
      amount: amt,
      date: newInstallmentDate.trim() || new Date().toISOString().split("T")[0],
      notes: newInstallmentNotes.trim() || undefined,
      method: newInstallmentMethod,
      referenceNumber: newInstallmentMethod === "UPI" && newInstallmentReference.trim() ? newInstallmentReference.trim() : undefined,
      proofUrl,
      createdAt: new Date().toISOString(),
      recordedBy:
        workspaceUser?.displayName || studio?.ownerName || "Studio Owner",
      recordedByRole: "Owner",
    };
    setEditInstallments((prev) => [...prev, newInst]);
    setNewInstallmentAmount("");
    setNewInstallmentNotes("");
    setNewInstallmentReference("");
    setNewInstallmentProofFile(null);
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
    const installmentsTotal = editInstallments.reduce(
      (sum, inst) => sum + (inst.amount || 0),
      0
    );
    const totalPaid = advanceNum + installmentsTotal;

    if (totalPaid > confirmedNum) {
      setPricingError(
        `Total payments (Advance ₹${advanceNum.toLocaleString()} + Installments ₹${installmentsTotal.toLocaleString()}) cannot exceed confirmed price (₹${confirmedNum.toLocaleString()}).`
      );
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

    const saved = await handleUpdatePayment(
      calculatedStatus,
      advanceNum,
      confirmedNum,
      editInstallments,
      editAdvanceDate
    );
    if (saved) setIsEditingPricing(false);
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
      setOrders((prev) =>
        prev.map((o) => (o.id === res.order!.id ? res.order! : o))
      );
    } else {
      alert(res.error || "Failed to assign resource");
    }
  };

  const openErpWizardForService = (
    serviceName?: string,
    memberName?: string
  ) => {
    if (!hasErp) return;
    let initialSkills = ["PHOTOGRAPHY"];
    if (serviceName) {
      const s = serviceName.toLowerCase();
      if (s.includes("video") || s.includes("cinemat"))
        initialSkills = ["VIDEOGRAPHY"];
      else if (s.includes("album")) initialSkills = ["ALBUM_DESIGN"];
      else if (s.includes("photo")) initialSkills = ["PHOTOGRAPHY"];
    }
    setAddMemberInitialName(memberName || "");
    setAddMemberInitialSkills(initialSkills);
    setTargetAssignContext(serviceName ? { serviceName } : null);
    setShowAddMemberModal(true);
  };

  const handleCommitCrewAssignment = async (
    serviceName: string,
    enteredName: string
  ) => {
    if (!selected || !enteredName.trim()) return;
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) return;

    const trimmed = enteredName.trim();
    const matchedMember = allSelectableCrew.find(
      (m) =>
        (m.name || "").toLowerCase() === trimmed.toLowerCase() ||
        m.id === trimmed ||
        (m.role === "Owner" &&
          (m.name.toLowerCase().includes(trimmed.toLowerCase()) ||
            trimmed
              .toLowerCase()
              .includes(
                m.name
                  .replace(/\s*\(owner\)/i, "")
                  .trim()
                  .toLowerCase()
              )))
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
      setOrders((prev) =>
        prev.map((o) => (o.id === res.order!.id ? res.order! : o))
      );
      setCrewSearchQuery((prev) => ({ ...prev, [serviceName]: "" }));
      setEditingCrewService(null);
      setActiveCrewDropdown(null);
    } else {
      alert(res.error || "Failed to assign crew member");
    }
  };

  const handleSaveServiceCrewAssignments = async (serviceName: string, memberNames: string[]) => {
    if (!selected) throw new Error("Select an order first.");
    const token = (await getIdToken(false)) ?? workspaceToken;
    if (!token) throw new Error("Authentication error. Please sign in again.");
    const normalized = new Set<string>();
    const assignments = memberNames.map((name, index) => {
      const clean = name.trim();
      const key = clean.toLowerCase();
      if (!clean || normalized.has(key)) throw new Error("Each crew member can be assigned only once to this service.");
      normalized.add(key);
      const matched = allSelectableCrew.find((member) => member.name.toLowerCase() === key) || temporaryCrewList.find((member) => member.name.toLowerCase() === key);
      return { memberId: matched?.id || `temp_${Date.now()}_${index}`, memberName: matched?.name || clean };
    });
    const res = await saveServiceCrewAssignmentsAction({ orderId: selected.id, studioId: studioSlug, serviceName, assignments, idToken: token });
    if (!res.success || !res.order) throw new Error(res.error || "Failed to save crew assignments.");
    setOrders((previous) => previous.map((order) => order.id === res.order!.id ? res.order! : order));
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
      setOrders((prev) =>
        prev.map((o) => (o.id === res.order!.id ? res.order! : o))
      );
      setCrewSearchQuery((prev) => ({ ...prev, [serviceName]: "" }));
      setEditingCrewService(null);
      setActiveCrewDropdown(null);
    } else {
      alert(res.error || "Failed to unassign crew member");
    }
  };

  const handleAssignTaskCrew = async (
    taskId: string,
    memberIdentifier: string
  ) => {
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
        setSelectedTasks((prev) =>
          prev.map((t) => (t.id === taskId ? res.task! : t))
        );
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
              trimmed
                .toLowerCase()
                .includes(
                  m.name
                    .replace(/\s*\(owner\)/i, "")
                    .trim()
                    .toLowerCase()
                )))
      ) ||
      studioMembers.find(
        (m) =>
          (m.name || "").toLowerCase() === trimmed.toLowerCase() ||
          m.id === trimmed
      ) ||
      temporaryCrewList.find(
        (t) =>
          (t.name || "").toLowerCase() === trimmed.toLowerCase() ||
          t.id === trimmed
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
      setSelectedTasks((prev) =>
        prev.map((t) => (t.id === taskId ? res.task! : t))
      );
    } else {
      alert(res.error || "Failed to assign crew to task");
    }
  };

  const handleMemberCreated = async (newMember: {
    id: string;
    name: string;
  }) => {
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
        setOrders((prev) =>
          prev.map((o) => (o.id === res.order!.id ? res.order! : o))
        );
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
        setSelectedTasks((prev) =>
          prev.map((t) => (t.id === targetTaskId ? res.task! : t))
        );
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
      setOrders((prev) =>
        prev.map((o) => (o.id === res.order!.id ? res.order! : o))
      );
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
        (statusFilter === "ALL" ||
          (statusFilter === "MARKETPLACE"
            ? Boolean(order.bookingRequestId)
            : order.orderStatus === statusFilter)) &&
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

  const handleExportOmsExcel = useCallback(() => {
    exportOmsOrdersToExcel(studioSlug, filtered);
  }, [filtered, studioSlug]);

  const handleSaveDriveDeliverables = useCallback(
    async (updatedDeliverables: OrderDriveDeliverable[]) => {
      if (!selected) return { success: false, error: "No order selected." };
      const token = (await getIdToken(false)) ?? workspaceToken;
      if (!token) return { success: false, error: "Authentication required." };

      const res = await updateOrderDriveDeliverablesAction({
        orderId: selected.id,
        studioId: studioSlug,
        deliverables: updatedDeliverables,
        idToken: token,
      });

      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === selected.id
              ? {
                  ...o,
                  driveDeliverables: res.deliverables || updatedDeliverables,
                  ...(res.order?.auditLog ? { auditLog: res.order.auditLog } : {}),
                }
              : o
          )
        );
      }
      return { success: res.success, error: res.error };
    },
    [selected, getIdToken, workspaceToken, studioSlug]
  );

  const handleSaveStudioBillingProfile = useCallback(
    async (profile: StudioBillingProfile) => {
      const token = (await getIdToken(false)) ?? workspaceToken;
      if (!token) return;
      await updateStudioAction({
        studioSlug,
        updates: { billingProfile: profile },
        idToken: token,
      });
    },
    [getIdToken, workspaceToken, studioSlug]
  );

  return (
    <div className="flex h-full bg-surface-app">
      {omsSection === "LEADS" ? (
        <OmsLeadsPanel
          studioSlug={studioSlug}
          ordersCount={orders.length}
          leads={leads}
          webhookConfig={webhookConfig}
          onSwitchToOrders={(orderId) => {
            setOmsSection("ORDERS");
            if (orderId) {
              setSelectedId(orderId);
            }
          }}
          getIdToken={getIdToken}
          onRefreshAll={async () => {
            await loadOrders(workspaceToken);
          }}
        />
      ) : (
        <>
          <OmsOrdersListPanel
            studioSlug={studioSlug}
            orders={orders}
            filtered={filtered}
            selected={selected}
            selectedId={selectedId}
            onSelectOrder={setSelectedId}
            loading={loading}
            isRefreshing={isOrdersRefreshing}
            refreshError={ordersRefreshError}
            query={query}
            onChangeQuery={setQuery}
            statusFilter={statusFilter}
            onChangeStatusFilter={setStatusFilter}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            onExportExcel={handleExportOmsExcel}
            onOpenCreateModal={handleOpenCreateModal}
            leadsCount={leads.length}
            onSwitchToLeads={() => setOmsSection("LEADS")}
          />

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
                  <span className="font-mono text-xs font-bold text-brand-blue-primary block">
                    {selected.orderNumber}
                  </span>
                  {selected.bookingRequestId && (
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                      Marketplace Booking: {selected.bookingRequestId}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-extrabold text-text-primary truncate">
                  {selected.customer.name}
                </h2>
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
            onSaveServiceCrew={handleSaveServiceCrewAssignments}
            onOpenErpWizard={hasErp ? openErpWizardForService : undefined}
            onAssignTaskCrew={handleAssignTaskCrew}
            onMarkOfflineReviewReady={handleMarkTaskOfflineReviewReady}
            onSaveSchedule={handleSaveOrderSchedule}
            hasErp={hasErp}
          />

          {/* Production Aging and Turnaround SLA Banner */}
          <OmsTurnaroundSlaBanner order={selected} tasks={selectedTasks} />

          {/* 3. Payment and Pricing Summary */}
          <OmsPaymentSummarySection
            selected={selected}
            isEditingPricing={isEditingPricing}
            onCancelEditingPricing={() => {
              setIsEditingPricing(false);
              setPricingError(null);
              setInstallmentError(null);
            }}
            onStartEditingPricing={handleStartEditingPricing}
            isUpdatingPayment={isUpdatingPayment}
            isSendingReminder={isSendingReminder}
            onUpdatePayment={(...args) => void handleUpdatePayment(...args)}
            onSendPaymentReminder={() => void handleSendPaymentReminder()}
            onOpenBillingModal={(tab, receiptId) =>
              setBillingModalState({ isOpen: true, tab, receiptId })
            }
            editConfirmedPrice={editConfirmedPrice}
            onChangeEditConfirmedPrice={(val) => {
              setEditConfirmedPrice(val);
              setPricingError(null);
            }}
            editAdvanceAmount={editAdvanceAmount}
            onChangeEditAdvanceAmount={(val) => {
              setEditAdvanceAmount(val);
              setPricingError(null);
            }}
            editAdvanceDate={editAdvanceDate}
            onChangeEditAdvanceDate={setEditAdvanceDate}
            editInstallments={editInstallments}
            onRemoveInstallment={handleRemoveInstallment}
            showAddInstallment={showAddInstallment}
            onOpenAddInstallment={() => {
              setInstallmentError(null);
              setNewInstallmentAmount("");
              setNewInstallmentNotes("");
              setNewInstallmentMethod("CASH");
              setNewInstallmentReference("");
              setNewInstallmentProofFile(null);
              setNewInstallmentDate(new Date().toISOString().split("T")[0]);
              setShowAddInstallment(true);
            }}
            onCloseAddInstallment={() => {
              setShowAddInstallment(false);
              setInstallmentError(null);
            }}
            newInstallmentAmount={newInstallmentAmount}
            onChangeNewInstallmentAmount={(val) => {
              setNewInstallmentAmount(val);
              setInstallmentError(null);
            }}
            newInstallmentDate={newInstallmentDate}
            onChangeNewInstallmentDate={setNewInstallmentDate}
            newInstallmentNotes={newInstallmentNotes}
            onChangeNewInstallmentNotes={setNewInstallmentNotes}
            newInstallmentMethod={newInstallmentMethod}
            onChangeNewInstallmentMethod={setNewInstallmentMethod}
            newInstallmentReference={newInstallmentReference}
            onChangeNewInstallmentReference={setNewInstallmentReference}
            newInstallmentProofFile={newInstallmentProofFile}
            onChangeNewInstallmentProofFile={setNewInstallmentProofFile}
            installmentError={installmentError}
            pricingError={pricingError}
            onAddInstallment={handleAddInstallment}
            onSavePricing={() => void handleSavePricing()}
          />

          {/* 4. Pre-flight Operational Check Report */}
          <OmsPreflightCheckSection order={selected} />

          {/* 5. Automated Resource Suggestions (ERP only) */}
          {hasErp && (
            <OmsResourceSuggestionsSection
              order={selected}
              onConfirmSuggestion={handleConfirmSuggestion}
            />
          )}

          {/* 5B. Google Drive Deliverables & Client Preview (Drive Review only) */}
          {hasDriveReview && (
            <GoogleDriveDeliverablesSection
              orderId={selected.id}
              deliverables={selected.driveDeliverables || []}
              reviewTasks={selectedTasks.map((task) => ({ id: task.id, title: task.title }))}
              canManageLinks={true}
              canSubmitClientReview={false}
              onSaveDeliverables={handleSaveDriveDeliverables}
            />
          )}

          {/* 6. Customer Order Access and Tracking Link */}
          <OmsCustomerAccessCard
            order={selected}
            origin={origin}
            copiedField={copiedField}
            onCopyText={handleCopyText}
            onShareText={(url, title) => void handleShareText(url, title)}
          />

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
          {showAuditHistory && (
            <OmsAuditHistorySection
              order={selected}
              tasks={selectedTasks}
              studio={studio}
            />
          )}
        </aside>
      )}
        </>
      )}

      {/* New Order Modal */}
      <OmsCreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        newOrderForm={newOrderForm}
        setNewOrderForm={setNewOrderForm}
        formError={formError}
        isSubmitting={isSubmitting}
        onSubmit={handleCreateOrder}
        studioCustomers={studioCustomers}
        matchingCustomers={matchingCustomers}
        duplicateCustomerWarning={duplicateCustomerWarning}
        showCustomerDropdown={showCustomerDropdown}
        setShowCustomerDropdown={setShowCustomerDropdown}
        onSelectExistingCustomer={selectExistingCustomer}
        activeStudioPackages={activeStudioPackages}
        selectedPackageId={selectedPackageId}
        onSelectPackage={handleSelectPackage}
        availableServices={availableServices}
        studioServicesList={studioServicesList}
        showServicesDropdown={showServicesDropdown}
        setShowServicesDropdown={setShowServicesDropdown}
        onToggleService={toggleService}
        calculateOrderPrice={calculateOrderPrice}
        busyEventDates={orders
          .filter((order) => !order.isDeleted && order.orderStatus !== "CANCELLED")
          .map((order) => order.eventDate)
          .filter(Boolean)}
        hasCrm={hasCrm}
        hasWhatsAppOperations={hasWhatsAppOperations}
      />

      {/* In-App Cancellation & Soft-Delete Dialogs */}
      <OmsOrderActionDialogs
        cancelTargetOrder={cancelTargetOrder}
        onCloseCancelModal={() => setCancelTargetOrder(null)}
        cancelReason={cancelReason}
        onChangeCancelReason={setCancelReason}
        isCancelling={isCancelling}
        onConfirmCancelOrder={handleConfirmCancelOrder}
        deleteTargetOrder={deleteTargetOrder}
        onCloseDeleteModal={() => setDeleteTargetOrder(null)}
        isDeleting={isDeleting}
        onConfirmDeleteOrder={handleConfirmDeleteOrder}
      />

      {/* Studio ERP Member Wizard Dialog */}
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

      {selected && billingModalState.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Billing documents">
          <div className="mx-auto my-8 max-w-2xl rounded-xl border border-border-default bg-white p-6 text-text-primary shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Billing documents</h2><button type="button" className="rounded border border-border-divider px-3 py-1" onClick={() => setBillingModalState(prev => ({ ...prev, isOpen: false }))}>Close</button></div>
            <OrderBillingPanel studioId={studioSlug} orderId={selected.id} />
          </div>
        </div>
      )}
    </div>
  );
}
