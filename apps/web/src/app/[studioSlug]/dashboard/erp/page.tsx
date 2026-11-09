"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { StudioMember, Order, StudioInvitationSummary } from "@focoman/types";
import {
  getStudioMembersAction,
  getDeletedStudioMembersAction,
  getStudioInvitationsAction,
  createMemberAction,
  updateMemberAction,
  deleteMemberAction,
  restoreMemberAction,
  revokeInvitationAction,
} from "@/actions/memberActions";
import {
  getStudioOrdersAction,
  confirmResourceAvailabilityAction,
  updateAssignmentCallTimeAction,
} from "@/actions/orderActions";
import { updateStudioAction } from "@/actions/studioActions";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { getEffectiveStudioTier, isLifetimeProEmail } from "@/lib/proEntitlements";
import { FileSpreadsheet, Pencil, Trash2, RotateCcw, Clock, Send } from "lucide-react";
import { exportWorkbookToExcel } from "@/utils/excelExport";

const SKILL_LABELS: Record<string, string> = {
  PHOTOGRAPHY: "Photographer",
  VIDEOGRAPHY: "Videographer",
  PHOTO_EDITING: "Photo Editor",
  ALBUM_DESIGN: "Album Designer",
};

const SKILL_COLORS: Record<string, string> = {
  PHOTOGRAPHY: "badge-brand-blue",
  VIDEOGRAPHY: "badge-brand-orange",
  PHOTO_EDITING: "badge-brand-purple",
  ALBUM_DESIGN: "badge-brand-blue",
};

const ALL_SKILLS = ["PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_EDITING", "ALBUM_DESIGN"];

export default function ErpPage({ params }: { params: Promise<{ studioSlug: string }> }) {
  const { studioSlug } = use(params);
  const { idToken: workspaceToken, authLoading, getIdToken, user: workspaceUser, studio } = useStudioWorkspace();
  const [crewList, setCrewList] = useState<StudioMember[]>([]);
  const [deletedCrewList, setDeletedCrewList] = useState<StudioMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<StudioInvitationSummary[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<StudioMember | null>(null);
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"ACTIVE" | "DELETED">("ACTIVE");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add / Edit Member Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StudioMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    claimCode: "",
    skills: ["PHOTOGRAPHY"],
  });

  // Temporary Crew Edit State
  const [editingTempCrew, setEditingTempCrew] = useState<{ id: string; name: string } | null>(null);
  const [tempCrewNameInput, setTempCrewNameInput] = useState("");

  // Call-Time & Venue Notes draft state per orderId
  const [callTimeDrafts, setCallTimeDrafts] = useState<Record<string, { callTime: string; venueNotes: string }>>({});
  const [savingCallTimeOrderId, setSavingCallTimeOrderId] = useState<string | null>(null);

  // Auto-Assign Crew workflow toggle state
  const [autoAssignEnabled, setAutoAssignEnabled] = useState<boolean>(false);
  const [togglingAutoAssign, setTogglingAutoAssign] = useState(false);

  const [createdInvite, setCreatedInvite] = useState<{ code: string; email?: string; name: string; claimCode?: string; linkToken?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const effectiveTier = getEffectiveStudioTier(studio);
  const canExportExcel = effectiveTier === "COMPLETE";

  const showBannerMsg = (type: "success" | "error", text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 4000);
  };

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (studio?.features?.autoAssignCrew !== undefined) {
      setAutoAssignEnabled(Boolean(studio.features.autoAssignCrew));
    }
  }, [studio?.features?.autoAssignCrew]);

  // Check URL query parameters (e.g. ?action=add-crew or ?addCrew=true)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const addCrew = params.get("addCrew");
    if (action === "add-crew" || addCrew === "true" || addCrew === "1") {
      setEditingMember(null);
      setShowModal(true);
      setModalError(null);
      setForm((prev) => ({
        ...prev,
        claimCode: prev.claimCode || Math.floor(100000 + Math.random() * 900000).toString(),
      }));
    }
  }, []);

  const handleShareLink = async (url: string, title?: string, text?: string) => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: title || "Focoman Studio Invitation",
          text: text,
          url,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const loadData = useCallback(async (tokenOverride?: string | null) => {
    try {
      setLoading(true);
      const token = tokenOverride ?? workspaceToken ?? (await getIdToken(false));
      if (!token) {
        setLoading(false);
        return;
      }
      const [membersData, deletedMembersData, ordersData, invitationData] = await Promise.all([
        getStudioMembersAction(studioSlug, token),
        getDeletedStudioMembersAction(studioSlug, token).catch(() => [] as StudioMember[]),
        getStudioOrdersAction(studioSlug, token),
        getStudioInvitationsAction(studioSlug, token),
      ]);
      setCrewList(membersData);
      setDeletedCrewList(deletedMembersData);
      setOrders(ordersData);
      setPendingInvitations(invitationData.filter((invitation) => invitation.status === "PENDING"));
    } catch (err) {
      console.error("[ErpPage] Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [studioSlug, workspaceToken, getIdToken]);

  useEffect(() => {
    if (!authLoading) {
      void loadData(workspaceToken);
    }
  }, [studioSlug, authLoading, workspaceToken, loadData]);

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleToggleAutoAssignCrew = async () => {
    setTogglingAutoAssign(true);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const nextVal = !autoAssignEnabled;
      const res = await updateStudioAction({
        studioSlug,
        updates: {
          features: {
            ...(studio?.features || { oms: true, crm: true, erp: true, whatsapp: true, marketplace: true }),
            autoAssignCrew: nextVal,
          },
        },
        idToken: token,
      });
      if (res.success) {
        setAutoAssignEnabled(nextVal);
        showBannerMsg(
          "success",
          nextVal
            ? "Auto-Assign Crew enabled: New orders will automatically assign available skill-matched crew."
            : "Auto-Assign Crew disabled: Crew assignments remain manual."
        );
      } else {
        showBannerMsg("error", res.error || "Failed to update workflow automation.");
      }
    } finally {
      setTogglingAutoAssign(false);
    }
  };

  const fieldHints = useMemo(() => {
    if (editingMember) {
      return { nameHint: null, emailHint: null, hasBlockingError: false };
    }
    const trimmedName = form.name.trim().toLowerCase();
    const trimmedEmail = form.email.trim().toLowerCase();
    const ownerEmail = (workspaceUser?.email ?? studio?.ownerEmail ?? "").trim().toLowerCase();
    const ownerName = studio?.ownerName?.trim().toLowerCase() ?? "";

    let nameHint: { type: "error" | "warn"; text: string } | null = null;
    let emailHint: { type: "error" | "warn" | "info"; text: string } | null = null;

    if (trimmedName.length > 0) {
      if (ownerName && trimmedName === ownerName) {
        nameHint = { type: "error", text: `"${studio?.ownerName}" is the studio owner and already active in the crew.` };
      } else {
        const nameExistsInMembers = crewList.some(
          (m) =>
            m.name.trim().toLowerCase() === trimmedName ||
            (m.ownerAssignedName && m.ownerAssignedName.trim().toLowerCase() === trimmedName)
        );
        const nameExistsInPending = pendingInvitations.some(
          (inv) => inv.status === "PENDING" && inv.name?.trim().toLowerCase() === trimmedName
        );
        if (nameExistsInMembers) {
          nameHint = { type: "error", text: `"${form.name.trim()}" is already an active crew member. Use a unique name.` };
        } else if (nameExistsInPending) {
          nameHint = { type: "warn", text: `A pending invite for "${form.name.trim()}" already exists.` };
        }
      }
    }

    if (trimmedEmail.length > 0) {
      const isSelf = ownerEmail && trimmedEmail === ownerEmail;

      if (isSelf) {
        emailHint = { type: "error", text: "Self-invites are not allowed. As studio owner, you are automatically the first crew member." };
      } else {
        const emailExistsInMembers = crewList.some(
          (m) => m.email?.trim().toLowerCase() === trimmedEmail
        );
        const emailExistsInPending = pendingInvitations.some(
          (inv) => inv.status === "PENDING" && inv.email?.trim().toLowerCase() === trimmedEmail
        );

        if (emailExistsInMembers) {
          emailHint = { type: "error", text: `This email is already linked to an active crew member.` };
        } else if (emailExistsInPending) {
          emailHint = { type: "warn", text: `A pending invite for this email already exists. Revoke it first or send the existing code.` };
        }
      }
    }

    const hasBlockingError =
      (nameHint?.type === "error") ||
      (emailHint?.type === "error") ||
      (emailHint?.type === "warn");

    return { nameHint, emailHint, hasBlockingError };
  }, [editingMember, form.name, form.email, crewList, pendingInvitations, workspaceUser, studio]);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    const token = await getIdToken(true);
    if (!token) {
      setModalError("Authentication error. Please sign in again.");
      setIsSubmitting(false);
      return;
    }

    if (editingMember) {
      const res = await updateMemberAction({
        memberId: editingMember.id,
        studioId: studioSlug,
        updates: {
          name: form.name,
          phone: form.phone,
          skills: form.skills,
        },
        idToken: token,
      });
      setIsSubmitting(false);
      if (res.success && res.member) {
        setShowModal(false);
        setEditingMember(null);
        await loadData(token);
        setSelected(res.member);
        showBannerMsg("success", "Crew member profile updated.");
      } else {
        setModalError(res.error || "Failed to update crew member");
      }
      return;
    }

    const res = await createMemberAction({
      idToken: token,
      studioId: studioSlug,
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      claimCode: form.email ? undefined : form.claimCode,
      skills: form.skills,
    });

    setIsSubmitting(false);

    if (res.success && res.invitation) {
      setShowModal(false);
      const memberName = form.name;
      const memberEmail = form.email;
      setForm({ name: "", email: "", phone: "", claimCode: "", skills: ["PHOTOGRAPHY"] });
      await loadData(token);
      if (res.invitationCode) {
        setCreatedInvite({
          code: res.invitationCode,
          name: memberName,
          ...(memberEmail ? { email: memberEmail } : {}),
          claimCode: res.claimCode,
          linkToken: res.invitationLinkToken,
        });
      }
    } else {
      setModalError(res.error || "Failed to add crew member");
    }
  };

  const handleDeleteMember = async (member: StudioMember) => {
    if (member.role === "STUDIO_OWNER") return;
    const token = await getIdToken(true);
    if (!token) return;
    const res = await deleteMemberAction({
      memberId: member.id,
      studioId: studioSlug,
      idToken: token,
    });
    if (res.success) {
      setSelected(null);
      await loadData(token);
      showBannerMsg("success", `Archived crew member "${member.name}".`);
    } else {
      showBannerMsg("error", res.error || "Failed to archive crew member.");
    }
  };

  const handleRestoreMember = async (member: StudioMember) => {
    const token = await getIdToken(true);
    if (!token) return;
    const res = await restoreMemberAction({
      memberId: member.id,
      studioId: studioSlug,
      idToken: token,
    });
    if (res.success) {
      await loadData(token);
      setViewMode("ACTIVE");
      showBannerMsg("success", `Restored crew member "${member.name}".`);
    } else {
      showBannerMsg("error", res.error || "Failed to restore crew member.");
    }
  };

  const handleUpdateTempCrew = async (tempId: string, oldName: string, newName: string) => {
    if (!newName.trim()) return;
    const token = await getIdToken(true);
    if (!token) return;
    const existingTemp = studio?.temporaryCrew || [];
    const updatedTemp = existingTemp.map((t) =>
      t.id === tempId || t.name.toLowerCase() === oldName.toLowerCase()
        ? { ...t, name: newName.trim() }
        : t
    );
    const res = await updateStudioAction({
      studioSlug,
      updates: { temporaryCrew: updatedTemp },
      idToken: token,
    });
    if (res.success) {
      setEditingTempCrew(null);
      await loadData(token);
      showBannerMsg("success", "Temporary crew name updated.");
    } else {
      showBannerMsg("error", res.error || "Failed to update temporary crew.");
    }
  };

  const handleDeleteTempCrew = async (tempId: string, tempName: string) => {
    const token = await getIdToken(true);
    if (!token) return;
    const existingTemp = studio?.temporaryCrew || [];
    const updatedTemp = existingTemp.filter(
      (t) => t.id !== tempId && t.name.toLowerCase() !== tempName.toLowerCase()
    );
    const res = await updateStudioAction({
      studioSlug,
      updates: { temporaryCrew: updatedTemp },
      idToken: token,
    });
    if (res.success) {
      await loadData(token);
      showBannerMsg("success", `Removed temporary crew "${tempName}" from studio roster.`);
    } else {
      showBannerMsg("error", res.error || "Failed to remove temporary crew.");
    }
  };

  const handleSaveCallTime = async (orderId: string, memberId: string) => {
    const draft = callTimeDrafts[orderId];
    if (!draft) return;
    setSavingCallTimeOrderId(orderId);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await updateAssignmentCallTimeAction({
        orderId,
        studioId: studioSlug,
        memberId,
        callTime: draft.callTime,
        venueNotes: draft.venueNotes,
        idToken: token,
      });
      if (res.success) {
        await loadData(token);
        showBannerMsg("success", "Call time and venue instructions saved.");
      } else {
        showBannerMsg("error", res.error || "Failed to save call time.");
      }
    } finally {
      setSavingCallTimeOrderId(null);
    }
  };

  const ownerMember: StudioMember | null = useMemo(() => {
    if (!studio) return null;
    return {
      id: `owner-${studio.id || studioSlug}`,
      studioId: studioSlug.toLowerCase(),
      name: studio.ownerName || "Studio Owner",
      email: studio.ownerEmail || "",
      phone: studio.ownerPhone || "",
      role: "STUDIO_OWNER",
      skills: [],
      status: "ACTIVE",
      createdAt: studio.createdAt || new Date().toISOString(),
      updatedAt: studio.updatedAt || new Date().toISOString(),
    };
  }, [studio, studioSlug]);

  const allCrew = useMemo(() => {
    return ownerMember ? [ownerMember, ...crewList] : crewList;
  }, [ownerMember, crewList]);

  const activeSourceList = viewMode === "ACTIVE" ? allCrew : deletedCrewList;

  const filtered = useMemo(() => {
    return activeSourceList.filter((m) => {
      const matchSkill = skillFilter === "ALL" || m.skills.includes(skillFilter);
      const matchSearch =
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.ownerAssignedName && m.ownerAssignedName.toLowerCase().includes(search.toLowerCase())) ||
        m.email.toLowerCase().includes(search.toLowerCase()) ||
        (m.phone && m.phone.includes(search));
      return matchSkill && matchSearch;
    });
  }, [activeSourceList, skillFilter, search]);

  const temporaryCrewList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; services: string[]; orderCount: number }>();
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
      const isRegistered = allCrew.some(
        (c) =>
          (c.name || "").toLowerCase() === t.name.toLowerCase() ||
          c.id === t.id ||
          `${c.name.toLowerCase()} (owner)` === t.name.toLowerCase()
      );
      if (!isRegistered && t.name && !t.name.toLowerCase().includes("unassigned")) {
        map.set(t.name.toLowerCase(), {
          id: t.id,
          name: t.name,
          services: t.lastUsedService ? [t.lastUsedService] : [],
          orderCount: 0,
        });
      }
    });

    orders.forEach((o) => {
      (o.assignedResources || []).forEach((r) => {
        if (isOwnerCrew(r.memberId, r.memberName)) return;
        const isRegistered = allCrew.some(
          (c) =>
            (c.name || "").toLowerCase() === (r.memberName || "").toLowerCase() ||
            c.id === r.memberId ||
            `${c.name.toLowerCase()} (owner)` === (r.memberName || "").toLowerCase()
        );
        if (!isRegistered && r.memberName && !r.memberName.toLowerCase().includes("unassigned")) {
          const key = r.memberName.toLowerCase();
          const existing = map.get(key);
          if (existing) {
            existing.orderCount += 1;
            if (r.skill && !existing.services.includes(r.skill)) {
              existing.services.push(r.skill);
            }
          } else {
            map.set(key, {
              id: r.memberId || `temp_${key}`,
              name: r.memberName,
              services: r.skill ? [r.skill] : [],
              orderCount: 1,
            });
          }
        }
      });
    });

    return Array.from(map.values());
  }, [studio, orders, allCrew, workspaceUser]);

  return (
    <div className="flex flex-col h-full bg-surface-app">
      {/* Free Plan Upgrade Banner */}
      {studio && !studio.features?.erp && studio.planInfo?.plan !== "PROFESSIONAL" && studio.planInfo?.plan !== "COMPLETE" && !isLifetimeProEmail(studio.ownerEmail) && (
        <div className="bg-purple-50 border-b border-purple-200 px-4 py-2.5 flex items-center justify-between shadow-2xs z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-brand-purple-primary text-white">
              ₹999/MO PLAN
            </span>
            <span className="text-xs text-text-secondary">
              Studio Operations (ERP) is included in the ₹999/month and ₹1,999/month plans. Upgrade to manage crew assignments, call times, and availability.
            </span>
          </div>
          <Link
            href={`/checkout?studio=${studioSlug}&upgrade=erp`}
            className="text-xs font-bold text-white bg-brand-purple-primary px-3 py-1 rounded-lg hover:bg-purple-700 transition shrink-0"
          >
            Upgrade &amp; Checkout →
          </Link>
        </div>
      )}

      {statusBanner && (
        <div className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
          statusBanner.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          <span>{statusBanner.text}</span>
          <button type="button" onClick={() => setStatusBanner(null)} className="text-[11px] underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
      {/* Crew Members List Panel */}
      <div className={`flex flex-col ${selected ? "hidden lg:flex lg:w-1/2 border-r border-border-default" : "w-full"} h-full`}>
        {/* Header */}
        <header className="header-brand-purple">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="badge-brand-purple">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-purple-primary" />
                  ERP · Studio Operations
                </span>
                <span className="badge-status-neutral">
                  Studio: <strong className="font-semibold text-text-primary">{studioSlug}</strong>
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
                Studio Enterprise Resource Planning
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Crew assignments, certified skills, and event availability tracking · {allCrew.length} Active Crew Members
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canExportExcel ? (
                <button
                  type="button"
                  disabled={filtered.length === 0 && temporaryCrewList.length === 0}
                  onClick={() =>
                    exportWorkbookToExcel(`${studioSlug}_Studio_ERP_Crew`, [
                      {
                        name: "Active Crew & Workload",
                        rows: filtered,
                        columns: [
                          { header: "Crew ID", key: "id", width: 22 },
                          { header: "Name", key: "name", width: 24 },
                          {
                            header: "Role",
                            key: "role",
                            width: 18,
                            getValue: (m: StudioMember) =>
                              m.role === "STUDIO_OWNER" ? "Studio Owner" : "Crew Member",
                          },
                          {
                            header: "Email",
                            key: "email",
                            width: 26,
                            getValue: (m: StudioMember) => m.email || "-",
                          },
                          {
                            header: "Phone",
                            key: "phone",
                            width: 16,
                            getValue: (m: StudioMember) => m.phone || "-",
                          },
                          {
                            header: "Certified Skills",
                            key: "skills",
                            width: 30,
                            getValue: (m: StudioMember) =>
                              m.skills && m.skills.length > 0
                                ? m.skills.map((s: string) => SKILL_LABELS[s] || s).join(", ")
                                : "All / General",
                          },
                          {
                            header: "Assigned Orders Count",
                            key: "assignedOrders",
                            type: "number",
                            width: 20,
                            sumInTotals: true,
                            getValue: (m: StudioMember) =>
                              orders.filter((o) =>
                                (o.assignedResources || []).some(
                                  (r) =>
                                    r.memberId === m.id ||
                                    (r.memberName || "").toLowerCase() ===
                                      (m.name || "").toLowerCase()
                                )
                              ).length,
                          },
                        ],
                      },
                      {
                        name: "Temporary Crew Workload",
                        rows: temporaryCrewList,
                        columns: [
                          { header: "Temp Crew ID", key: "id", width: 20 },
                          { header: "Name", key: "name", width: 24 },
                          {
                            header: "Assigned Services",
                            key: "services",
                            width: 30,
                            getValue: (t: { services: string[] }) =>
                              (t.services || []).join(", ") || "-",
                          },
                          {
                            header: "Assigned Orders Count",
                            key: "orderCount",
                            type: "number",
                            width: 20,
                            sumInTotals: true,
                          },
                        ],
                      },
                    ])
                  }
                  className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary hover:bg-surface-app hover:border-brand-purple-primary transition inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                  title="Export filtered Crew Members and Workload to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-brand-purple-primary" />
                  <span>Export Excel</span>
                </button>
              ) : (
                <Link
                  href={`/checkout?studio=${studioSlug}&plan=COMPLETE`}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-amber-700" />
                  <span>Export Excel (₹1,999 Plan)</span>
                </Link>
              )}
              <button
                onClick={() => {
                  setEditingMember(null);
                  setShowModal(true);
                  setModalError(null);
                  setForm({
                    name: "",
                    email: "",
                    phone: "",
                    claimCode: Math.floor(100000 + Math.random() * 900000).toString(),
                    skills: ["PHOTOGRAPHY"],
                  });
                }}
                className="btn-brand-purple"
              >
                + Add Crew Member
              </button>
            </div>
          </div>

          {/* Workflow Automation Bar (ERP-003) */}
          <div className="mt-3 rounded-xl border border-brand-purple-soft/80 bg-brand-purple-background/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-text-primary">
                Automated Crew Assignment on Order Confirmation
              </span>
              <p className="text-[11px] text-text-secondary">
                Automatically assign available skill-matched crew members on order creation (falls back to manual assignment if busy).
              </p>
            </div>
            <button
              type="button"
              disabled={togglingAutoAssign}
              onClick={handleToggleAutoAssignCrew}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition cursor-pointer ${
                autoAssignEnabled
                  ? "bg-brand-purple-primary text-white"
                  : "border border-border-default bg-white text-text-secondary hover:text-text-primary"
              }`}
            >
              {togglingAutoAssign ? "Updating..." : autoAssignEnabled ? "Auto-Assign: ON" : "Auto-Assign: OFF"}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              suppressHydrationWarning
              autoComplete="off"
              type="text"
              placeholder="Search by name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-app px-3.5 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:bg-white focus:outline-none focus:border-brand-purple-primary focus:ring-2 focus:ring-brand-purple-soft"
            />
          </div>

          {/* Active vs Archived Toggle + Skill Filter Buttons */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {["ALL", ...ALL_SKILLS].map((s) => (
                <button
                  key={s}
                  onClick={() => setSkillFilter(s)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    skillFilter === s
                      ? "bg-brand-purple-primary text-white shadow-2xs"
                      : "border border-border-default bg-white text-text-secondary hover:bg-surface-app hover:text-text-primary"
                  }`}
                >
                  {s === "ALL" ? "All Skills" : SKILL_LABELS[s] || s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setViewMode("ACTIVE");
                  setSelected(null);
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  viewMode === "ACTIVE"
                    ? "bg-slate-900 text-white"
                    : "border border-border-default bg-white text-text-secondary"
                }`}
              >
                Active ({allCrew.length})
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
                    : "border border-border-default bg-white text-text-secondary"
                }`}
              >
                Archived ({deletedCrewList.length})
              </button>
            </div>
          </div>
        </header>

        {/* Crew Member List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {viewMode === "ACTIVE" && pendingInvitations.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-amber-950">Pending Invitations</h2>
                  <p className="mt-1 text-xs text-amber-900">Members become active only after claiming an invitation.</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">
                  {pendingInvitations.length}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-amber-200">
                {pendingInvitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary">{invitation.name || "Crew invitation"}</p>
                        <span className="rounded-md border border-amber-300 bg-amber-100/70 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900">
                          {invitation.id}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {invitation.email || "No email bound; recipient signs in with their own Google account"}
                        {invitation.phone ? ` · ${invitation.phone}` : ""}
                      </p>
                      {invitation.claimLocked ? (
                        <p className="mt-1 text-[10px] font-semibold text-red-800">Passcode attempts exceeded. Revoke and create a replacement invitation.</p>
                      ) : invitation.requiresPasscode ? (
                        <div className="mt-2.5 max-w-md rounded-xl border border-amber-300/80 bg-white/90 p-2.5 space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                              6-Digit Guest Access PIN *
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-extrabold tracking-widest text-brand-purple-primary bg-brand-purple-background/70 border border-brand-purple-soft/60 px-2 py-0.5 rounded">
                                {invitation.claimCode || invitation.id.match(/\d{6}$/)?.[0] || "••••••"}
                              </span>
                              {(invitation.claimCode || invitation.id.match(/\d{6}$/)?.[0]) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pin = invitation.claimCode || invitation.id.match(/\d{6}$/)?.[0] || "";
                                    void navigator.clipboard.writeText(pin);
                                    setCopiedPinId(invitation.id);
                                    setTimeout(() => setCopiedPinId(null), 2000);
                                  }}
                                  className="rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                >
                                  {copiedPinId === invitation.id ? "Copied PIN!" : "Copy PIN"}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-amber-900/90 leading-snug">
                            Share this 6-digit PIN alongside the invitation link with your crew member to join the studio without a Google email account.
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/onboarding/join-studio?code=${encodeURIComponent(invitation.id)}`;
                          void navigator.clipboard.writeText(link);
                          setCopiedLinkId(invitation.id);
                          setTimeout(() => setCopiedLinkId(null), 2000);
                        }}
                        className="rounded-lg border border-border-default bg-white px-3 py-2 text-[11px] font-semibold text-text-primary hover:bg-surface-app"
                      >
                        {copiedLinkId === invitation.id ? "Copied link!" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/onboarding/join-studio?code=${encodeURIComponent(invitation.id)}`;
                          void handleShareLink(link, "Join Studio Invitation", `You have been invited to join ${studioSlug} on Focoman`);
                        }}
                        className="rounded-lg border border-border-default bg-white px-2.5 py-2 text-[11px] font-semibold text-text-primary hover:bg-surface-app flex items-center gap-1.5"
                        title="Share invitation"
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const token = await getIdToken(true);
                          if (token) {
                            await revokeInvitationAction({ inviteCode: invitation.id, studioId: studioSlug, idToken: token });
                            await loadData(token);
                            showBannerMsg("success", "Invitation revoked.");
                          }
                        }}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Temporary Crew Section (Assigned in OMS) — ERP-002 */}
          {viewMode === "ACTIVE" && temporaryCrewList.length > 0 && (
            <section className="mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                    Temporary Crew ({temporaryCrewList.length})
                  </h2>
                  <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200">
                    Assigned in OMS
                  </span>
                </div>
                <span className="text-[11px] text-text-tertiary">
                  Temporary crew members entered during shoot planning
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {temporaryCrewList.map((temp) => (
                  <div
                    key={temp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 hover:bg-amber-50/80 transition"
                  >
                    <div className="min-w-0 pr-3 flex-1">
                      {editingTempCrew?.id === temp.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tempCrewNameInput}
                            onChange={(e) => setTempCrewNameInput(e.target.value)}
                            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-text-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleUpdateTempCrew(temp.id, temp.name, tempCrewNameInput)}
                            className="rounded-lg bg-brand-purple-primary px-2.5 py-1 text-[11px] font-bold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTempCrew(null)}
                            className="rounded-lg border border-border-default bg-white px-2 py-1 text-[11px] font-semibold text-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-text-primary truncate">{temp.name}</span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Temporary
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                            {temp.services.length > 0 ? `Services: ${temp.services.join(", ")}` : "Assigned in shoot planning"}
                            {temp.orderCount > 0 ? ` · In ${temp.orderCount} order(s)` : ""}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTempCrew({ id: temp.id, name: temp.name });
                          setTempCrewNameInput(temp.name);
                        }}
                        className="rounded-xl border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 inline-flex items-center gap-1 transition"
                        title="Rename temporary crew"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTempCrew(temp.id, temp.name)}
                        className="rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50 inline-flex items-center gap-1 transition"
                        title="Remove from studio temporary crew list"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMember(null);
                          setForm({
                            name: temp.name,
                            email: "",
                            phone: "",
                            claimCode: Math.floor(100000 + Math.random() * 900000).toString(),
                            skills: temp.services.some((s) => s.toLowerCase().includes("video"))
                              ? ["VIDEOGRAPHY"]
                              : ["PHOTOGRAPHY"],
                          });
                          setModalError(null);
                          setShowModal(true);
                        }}
                        className="rounded-xl bg-brand-purple-primary text-white font-bold text-xs px-3 py-1.5 hover:bg-brand-purple-hover transition shrink-0 shadow-xs cursor-pointer"
                      >
                        Convert to ERP
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading && activeSourceList.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-tertiary">Loading crew members...</div>
          ) : (
            <>
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border-default bg-white p-8 text-center text-xs text-text-tertiary">
                  {search || skillFilter !== "ALL"
                    ? "No crew members match the selected filters."
                    : viewMode === "DELETED"
                    ? "No archived crew members."
                    : "No crew members added yet. Add photographers, videographers, and editors to assign them to orders."}
                </div>
              )}
              {filtered.map((emp) => {
                const isOwner = emp.role === "STUDIO_OWNER";
                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelected(emp)}
                    className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition ${
                      selected?.id === emp.id
                        ? "card-brand-purple"
                        : isOwner
                        ? "border-brand-purple-soft bg-brand-purple-background/30 hover:border-brand-purple-light hover:shadow-xs"
                        : "border-border-default bg-white hover:border-brand-purple-light hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-sm shadow-xs ${
                          isOwner
                            ? "bg-brand-purple-primary text-white"
                            : "bg-brand-purple-background text-brand-purple-primary border border-brand-purple-soft"
                        }`}
                      >
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-text-primary">
                            {emp.name}
                            {emp.ownerAssignedName && emp.ownerAssignedName.toLowerCase() !== emp.name.toLowerCase() && (
                              <span className="ml-1.5 font-normal text-text-secondary text-xs">
                                ({emp.ownerAssignedName})
                              </span>
                            )}
                          </h3>
                          {isOwner && (
                            <span className="rounded-full bg-brand-purple-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                              Owner
                            </span>
                          )}
                          {emp.isDeleted && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">
                          {emp.email} {emp.phone ? `· ${emp.phone}` : ""}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {emp.skills && emp.skills.length > 0 ? (
                            emp.skills.map((skill, idx) => (
                              <span
                                key={idx}
                                className={SKILL_COLORS[skill] || "badge-status-neutral"}
                              >
                                {SKILL_LABELS[skill] || skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-text-tertiary italic">No skills assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {emp.isDeleted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRestoreMember(emp);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200 transition"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Selected Crew Detail Drawer */}
      {selected && (
        <div className="w-full lg:w-1/2 flex flex-col h-full bg-white overflow-y-auto border-l border-border-default">
          <div className="sticky top-0 z-10 border-b border-border-default bg-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple-primary">Crew Profile</span>
              <h2 className="text-sm font-bold text-text-primary">Member Overview</h2>
            </div>
            <div className="flex items-center gap-2">
              {selected.role !== "STUDIO_OWNER" && !selected.isDeleted && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMember(selected);
                      setForm({
                        name: selected.name || "",
                        email: selected.email || "",
                        phone: selected.phone || "",
                        claimCode: "",
                        skills: selected.skills && selected.skills.length > 0 ? selected.skills : ["PHOTOGRAPHY"],
                      });
                      setModalError(null);
                      setShowModal(true);
                    }}
                    className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-purple-primary inline-flex items-center gap-1.5 transition"
                  >
                    <Pencil className="h-3.5 w-3.5 text-brand-purple-primary" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteMember(selected)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 inline-flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Archive</span>
                  </button>
                </>
              )}
              {selected.isDeleted && (
                <button
                  type="button"
                  onClick={() => void handleRestoreMember(selected)}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Member</span>
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

          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl font-extrabold text-xl shadow-2xs ${
                  selected.role === "STUDIO_OWNER"
                    ? "bg-brand-purple-primary text-white"
                    : "bg-brand-purple-background text-brand-purple-primary border border-brand-purple-soft"
                }`}
              >
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-text-primary">
                    {selected.name}
                    {selected.ownerAssignedName && selected.ownerAssignedName.toLowerCase() !== selected.name.toLowerCase() && (
                      <span className="ml-2 text-sm font-normal text-text-secondary">
                        ({selected.ownerAssignedName})
                      </span>
                    )}
                  </h2>
                  {selected.role === "STUDIO_OWNER" && (
                    <span className="rounded-full bg-brand-purple-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Owner
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary">{selected.email}</p>
              </div>
            </div>

            {selected.role === "STUDIO_OWNER" && (
              <div className="rounded-2xl border border-brand-purple-soft bg-brand-purple-background/30 p-4">
                <p className="text-xs font-semibold text-brand-purple-primary">Studio Administrator &amp; Owner</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  The studio owner is automatically the primary crew member with owner status.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border-default p-4 space-y-3 bg-surface-app/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Contact Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-text-tertiary">Phone</p><p className="font-semibold text-text-primary mt-0.5">{selected.phone || "-"}</p></div>
                <div><p className="text-text-tertiary">Email</p><p className="font-semibold text-text-primary mt-0.5">{selected.email || "-"}</p></div>
              </div>
            </div>

            <div className="rounded-2xl border border-border-default p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">Certified Skills</h3>
              <div className="flex flex-wrap gap-2">
                {selected.skills && selected.skills.length > 0 ? (
                  selected.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className={SKILL_COLORS[skill] || "badge-status-neutral"}
                    >
                      {SKILL_LABELS[skill] || skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-tertiary italic">No certified skills assigned yet</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border-default p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">
                Upcoming Assignments &amp; Call Times
              </h3>
              <div className="space-y-3">
                {orders.filter(o => 
                  o.assignedResources?.some(r => r.memberId === selected.id) && 
                  o.orderStatus !== "COMPLETED"
                ).length > 0 ? (
                  orders
                    .filter(o => o.assignedResources?.some(r => r.memberId === selected.id) && o.orderStatus !== "COMPLETED")
                    .map(order => {
                      const assignment = order.assignedResources.find(r => r.memberId === selected.id)!;
                      const draft = callTimeDrafts[order.id] ?? {
                        callTime: assignment.callTime || order.callTime || "08:30 AM",
                        venueNotes: assignment.venueNotes || order.eventLocation || "",
                      };
                      const cleanPhone = (selected.phone || "").replace(/\D/g, "");
                      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                      const reminderText =
                        `📋 *${studio?.name || studioSlug} — Crew Call-Time Reminder*\n\n` +
                        `Hi ${selected.name},\n` +
                        `You are scheduled for *${order.eventType}* (Order #${order.orderNumber}).\n` +
                        `📅 *Event Date:* ${order.eventDate}\n` +
                        `⏰ *Call Time:* ${draft.callTime || "TBD"}\n` +
                        `📍 *Venue / Notes:* ${draft.venueNotes || order.eventLocation || "Studio Venue"}\n` +
                        `📌 *Assigned Role:* ${SKILL_LABELS[assignment.skill] || assignment.skill}\n\n` +
                        `Please arrive on time and confirm equipment readiness.`;

                      return (
                        <div key={order.id} className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-border-default bg-surface-app/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-text-primary">{order.eventType}</p>
                              <p className="text-[11px] text-text-secondary mt-0.5 font-mono">
                                <span className="font-bold text-brand-blue-primary">{order.orderNumber}</span> · {new Date(order.eventDate).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={SKILL_COLORS[assignment.skill] || "badge-status-neutral"}>
                              {SKILL_LABELS[assignment.skill] || assignment.skill}
                            </span>
                          </div>

                          {/* Call Time & Venue Notes (WA-004) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border-default text-xs">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-text-tertiary flex items-center gap-1">
                                <Clock className="h-3 w-3 text-brand-purple-primary" />
                                Call Time
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 07:30 AM"
                                value={draft.callTime}
                                onChange={(e) =>
                                  setCallTimeDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: { ...draft, callTime: e.target.value },
                                  }))
                                }
                                className="mt-1 w-full rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-purple-primary"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-text-tertiary">
                                Venue / Shoot Notes
                              </label>
                              <input
                                type="text"
                                placeholder="Venue & gear instructions"
                                value={draft.venueNotes}
                                onChange={(e) =>
                                  setCallTimeDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: { ...draft, venueNotes: e.target.value },
                                  }))
                                }
                                className="mt-1 w-full rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-purple-primary"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              disabled={savingCallTimeOrderId === order.id}
                              onClick={() => void handleSaveCallTime(order.id, selected.id)}
                              className="rounded-lg border border-brand-purple-soft bg-white px-2.5 py-1 text-[11px] font-bold text-brand-purple-primary hover:bg-brand-purple-background transition disabled:opacity-50"
                            >
                              {savingCallTimeOrderId === order.id ? "Saving..." : "Save Call Time"}
                            </button>
                            {formattedPhone && (
                              <a
                                href={`https://wa.me/${formattedPhone}?text=${encodeURIComponent(reminderText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                              >
                                <Send className="h-3 w-3" />
                                Send Call-Time WhatsApp
                              </a>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-1 pt-2 border-t border-border-default">
                            <span className="text-[10px] font-bold uppercase text-text-tertiary">Availability:</span>
                            {assignment.availabilityConfirmed === true ? (
                              <span className="badge-status-success">Confirmed</span>
                            ) : assignment.availabilityConfirmed === false ? (
                              <span className="badge-status-error">Rejected</span>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    const token = await getIdToken(false);
                                    if (token) {
                                      await confirmResourceAvailabilityAction(order.id, selected.id, true, token);
                                      await loadData(token);
                                    }
                                  }}
                                  className="btn-brand-purple py-1 px-2.5 text-[10px]"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={async () => {
                                    const token = await getIdToken(false);
                                    if (token) {
                                      await confirmResourceAvailabilityAction(order.id, selected.id, false, token);
                                      await loadData(token);
                                    }
                                  }}
                                  className="btn-brand-outline py-1 px-2.5 text-[10px]"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-text-tertiary">No upcoming assignments found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Add / Edit Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <div>
                <div className="badge-brand-purple mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-purple-primary" />
                  Crew Member
                </div>
                <h3 className="text-base font-bold text-text-primary">
                  {editingMember ? "Edit Crew Member" : "Add Crew Member"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingMember(null);
                }}
                className="text-text-tertiary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>
            {modalError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">{modalError}</div>
            )}
            <form onSubmit={handleSaveMember} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-text-primary">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`mt-1 w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:ring-1 ${
                    fieldHints.nameHint?.type === "error"
                      ? "border-red-400 focus:border-red-500 focus:ring-red-300"
                      : fieldHints.nameHint?.type === "warn"
                      ? "border-amber-400 focus:border-amber-500 focus:ring-amber-300"
                      : "border-border-default focus:border-brand-purple-primary focus:ring-brand-purple-primary"
                  }`}
                />
                {fieldHints.nameHint && (
                  <p className={`mt-1.5 text-[11px] font-medium ${
                    fieldHints.nameHint.type === "error" ? "text-red-600" : "text-amber-700"
                  }`}>
                    {fieldHints.nameHint.type === "error" ? "⊘ " : "⚠ "}{fieldHints.nameHint.text}
                  </p>
                )}
              </div>
              {!editingMember && (
                <>
                  <div>
                    <label className="block font-bold text-text-primary">Email</label>
                    <input
                      type="email"
                      placeholder="crew@studio.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          email: e.target.value,
                          claimCode: e.target.value
                            ? ""
                            : form.claimCode || Math.floor(100000 + Math.random() * 900000).toString(),
                        })
                      }
                      className={`mt-1 w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:ring-1 ${
                        fieldHints.emailHint?.type === "error"
                          ? "border-red-400 focus:border-red-500 focus:ring-red-300"
                          : fieldHints.emailHint?.type === "warn"
                          ? "border-amber-400 focus:border-amber-500 focus:ring-amber-300"
                          : "border-border-default focus:border-brand-purple-primary focus:ring-brand-purple-primary"
                      }`}
                    />
                    {fieldHints.emailHint ? (
                      <p className={`mt-1.5 text-[11px] font-medium leading-relaxed ${
                        fieldHints.emailHint.type === "error" ? "text-red-600"
                        : fieldHints.emailHint.type === "warn" ? "text-amber-700"
                        : "text-brand-purple-primary"
                      }`}>
                        {fieldHints.emailHint.type === "error" ? "⊘ "
                          : fieldHints.emailHint.type === "warn" ? "⚠ "
                          : "ℹ "}{fieldHints.emailHint.text}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">
                        {form.email.trim()
                          ? "✓ Member will authenticate directly using this Google email address."
                          : "Provide email for Google sign-in auth, or leave blank to use the auto-generated 6-digit access PIN below."}
                      </p>
                    )}
                  </div>
                  {!form.email.trim() && (
                    <div className="rounded-xl border border-brand-purple-soft/60 bg-brand-purple-background/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-brand-purple-primary block">
                          6-Digit Guest Access PIN *
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              claimCode: Math.floor(100000 + Math.random() * 900000).toString(),
                            }))
                          }
                          className="text-[10px] font-bold text-brand-purple-primary hover:underline"
                        >
                          Regenerate PIN
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        required
                        maxLength={6}
                        placeholder="e.g. 492015"
                        value={form.claimCode}
                        onChange={(e) =>
                          setForm({ ...form, claimCode: e.target.value.replace(/\D/g, "").slice(0, 6) })
                        }
                        className={`w-full rounded-xl bg-white px-3.5 py-2 font-mono text-sm font-extrabold tracking-widest text-text-primary outline-none transition ${
                          form.claimCode.length !== 6
                            ? "border border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                            : "border border-border-default focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
                        }`}
                      />
                      {form.claimCode.length !== 6 && (
                        <p className="mt-1 text-[11px] font-medium text-rose-600">PIN must be 6 digits.</p>
                      )}
                      <p className="text-[11px] text-text-secondary">
                        Share this 6-digit PIN alongside the invitation link with your crew member to join the studio without a Google email account.
                      </p>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block font-bold text-text-primary">Phone</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
                />
              </div>
              <div>
                <label className="block font-bold text-text-primary mb-1.5">Certified Skills *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SKILLS.map((skill) => (
                    <label
                      key={skill}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-[11px] font-semibold transition ${
                        form.skills.includes(skill)
                          ? "border-brand-purple-primary bg-brand-purple-background/40 text-brand-purple-primary"
                          : "border-border-default text-text-secondary hover:bg-surface-app"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={form.skills.includes(skill)}
                        onChange={() => toggleSkill(skill)}
                        className="rounded text-brand-purple-primary"
                      />
                      {SKILL_LABELS[skill] || skill}
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingMember(null);
                  }}
                  className="btn-brand-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || fieldHints.hasBlockingError}
                  className="btn-brand-purple disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving..." : editingMember ? "Update Member" : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitation Code Dialog */}
      {createdInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-border-default animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-border-default pb-4">
              <div>
                <span className="badge-status-success">
                  Invitation Created
                </span>
                <h3 className="mt-1.5 text-base font-bold text-text-primary">
                  Crew Member Invitation Ready
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatedInvite(null)}
                className="text-text-tertiary hover:text-text-primary text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-text-secondary">
              Share this single-use invitation with <strong>{createdInvite.name}</strong>{createdInvite.email ? ` (${createdInvite.email})` : ""}. {createdInvite.email ? "They must sign in with this Google email." : "They can use their own Google account, but must enter the 6-digit passcode you set."}
            </p>

            <div className="mt-4 rounded-2xl border border-brand-purple-soft bg-brand-purple-background/40 p-4 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple-primary">
                Single-Use Invitation Code
              </span>
              <div className="mt-1 font-mono text-xl font-extrabold tracking-widest text-brand-purple-primary">
                {createdInvite.code}
              </div>
            </div>

            {createdInvite.claimCode && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Share this passcode separately</span>
                <div className="mt-1 font-mono text-xl font-extrabold tracking-widest text-amber-900">{createdInvite.claimCode}</div>
                <p className="mt-1 text-[10px] text-amber-900">This passcode is shown once and is not stored in readable form.</p>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                Direct Onboarding Link
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  type="text"
                  value={`${origin}/onboarding/join-studio?code=${createdInvite.code}${createdInvite.linkToken ? `&token=${createdInvite.linkToken}` : ''}`}
                  className="w-full rounded-xl border border-border-default bg-surface-app px-3 py-2 font-mono text-xs text-text-primary outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}/onboarding/join-studio?code=${createdInvite.code}${createdInvite.linkToken ? `&token=${createdInvite.linkToken}` : ''}`;
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="btn-brand-purple shrink-0 py-2 px-3 text-xs"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}/onboarding/join-studio?code=${createdInvite.code}${createdInvite.linkToken ? `&token=${createdInvite.linkToken}` : ''}`;
                    void handleShareLink(link, "Join Studio Invitation", `Join ${studioSlug} on Focoman`);
                  }}
                  className="rounded-xl border border-border-default bg-white px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-app flex items-center gap-1.5 shrink-0"
                  title="Share invitation link"
                >
                  Share
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedInvite(null)}
                className="btn-brand-purple"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}