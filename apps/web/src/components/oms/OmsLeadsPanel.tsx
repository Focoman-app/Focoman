"use client";

import { useState } from "react";
import {
  StudioLead,
  LeadChannel,
  LeadStage,
  StudioLeadWebhookConfig,
} from "@focoman/types";
import {
  createStudioLeadAction,
  updateStudioLeadAction,
  convertLeadToOrderAction,
  saveStudioLeadWebhookConfigAction,
} from "@/actions/leadActions";
import {
  Webhook,
  Copy,
  Check,
  Plus,
  ArrowRight,
  Sparkles,
  Globe,
  MessageCircle,
  ExternalLink,
  Phone,
  SlidersHorizontal,
} from "lucide-react";

const CHANNEL_BADGES: Record<LeadChannel, { label: string; badgeClass: string }> = {
  MARKETPLACE: { label: "Studio Marketplace", badgeClass: "badge-brand-orange" },
  INSTAGRAM: { label: "Instagram", badgeClass: "badge-brand-purple" },
  WHATSAPP: { label: "WhatsApp", badgeClass: "badge-status-success" },
  WEBSITE: { label: "Website", badgeClass: "badge-brand-blue" },
  DIRECT: { label: "Direct", badgeClass: "badge-status-neutral" },
};

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New Inquiry",
  CONTACTED: "Contacted",
  QUOTED: "Quotation Sent",
  CONVERTED: "Converted to Order",
  ARCHIVED: "Archived",
};

interface OmsLeadsPanelProps {
  studioSlug: string;
  ordersCount: number;
  leads: StudioLead[];
  webhookConfig: StudioLeadWebhookConfig | null;
  onSwitchToOrders: (selectOrderId?: string) => void;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  onRefreshAll: () => Promise<void>;
}

export function OmsLeadsPanel({
  studioSlug,
  ordersCount,
  leads,
  webhookConfig,
  onSwitchToOrders,
  getIdToken,
  onRefreshAll,
}: OmsLeadsPanelProps) {
  const [channelFilter, setChannelFilter] = useState<"ALL" | LeadChannel>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<StudioLead | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isMultiChannelEnabled = webhookConfig?.enabled !== false;

  const [configDraft, setConfigDraft] = useState({
    enabled: webhookConfig?.enabled !== false,
    instagramHandle: webhookConfig?.instagramHandle || `@${studioSlug}`,
    instagramBusinessId: webhookConfig?.instagramBusinessId || "",
    whatsappBusinessPhone: webhookConfig?.whatsappBusinessPhone || "",
    websiteDomain: webhookConfig?.websiteDomain || "",
    autoCaptureWhatsAppUnknownSenders:
      webhookConfig?.autoCaptureWhatsAppUnknownSenders !== false,
    autoReplyEnabled: webhookConfig?.autoReplyEnabled !== false,
  });

  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    phone: "",
    email: "",
    instagramHandle: "",
    channel: "MARKETPLACE" as LeadChannel,
    eventType: "Wedding Photography",
    eventDate: "",
    location: "Coimbatore",
    estimatedBudget: 45000,
    message: "",
  });

  const [convertForm, setConvertForm] = useState({
    eventType: "Wedding Photography",
    eventDate: new Date().toISOString().slice(0, 10),
    eventLocation: "Coimbatore",
    confirmedPrice: 45000,
    advanceAmount: 15000,
  });

  const showNotice = (type: "success" | "error", text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 4500);
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://focoman.web.app";
  const webhookKey = webhookConfig?.webhookKey || `fcm_wh_${studioSlug}`;
  const webhookUrl = `${origin}/api/webhooks/leads?studio=${studioSlug}&key=${webhookKey}`;

  const websiteSnippet = `<script>
async function submitFocomanLead(formEl) {
  const fd = new FormData(formEl);
  await fetch("${webhookUrl}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "WEBSITE",
      name: fd.get("name"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      eventType: fd.get("eventType"),
      eventDate: fd.get("eventDate"),
      location: fd.get("location"),
      message: fd.get("message")
    })
  });
}
</script>`;

  const copyText = async (key: string, value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (channelFilter !== "ALL" && l.channel !== channelFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.phone && l.phone.toLowerCase().includes(q)) ||
      (l.instagramHandle && l.instagramHandle.toLowerCase().includes(q)) ||
      (l.eventType && l.eventType.toLowerCase().includes(q)) ||
      (l.message && l.message.toLowerCase().includes(q))
    );
  });

  const handleToggleMultiChannel = async () => {
    setBusy(true);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const nextEnabled = !isMultiChannelEnabled;
      const res = await saveStudioLeadWebhookConfigAction({
        studioId: studioSlug,
        config: {
          ...configDraft,
          enabled: nextEnabled,
        },
        idToken: token,
      });
      if (res.success) {
        setConfigDraft((prev) => ({ ...prev, enabled: nextEnabled }));
        showNotice(
          "success",
          nextEnabled
            ? "Multi-Channel Lead Capture enabled! Instagram, WhatsApp, and Website leads will flow into OMS."
            : "External webhook lead capture paused. Studio Marketplace leads remain active."
        );
        await onRefreshAll();
      } else {
        showNotice("error", res.error || "Failed to update channel state.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWebhookSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await saveStudioLeadWebhookConfigAction({
        studioId: studioSlug,
        config: configDraft,
        idToken: token,
      });
      if (res.success) {
        showNotice(
          "success",
          "Channel configuration saved! Marketplace, Instagram, WhatsApp & Website leads are unified here."
        );
        setShowSetupModal(false);
        await onRefreshAll();
      } else {
        showNotice("error", res.error || "Failed to save channel configuration.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateWebhookLead = async (simChannel: "INSTAGRAM" | "WHATSAPP" | "WEBSITE") => {
    setBusy(true);
    try {
      const samplePayloads = {
        INSTAGRAM: {
          object: "instagram",
          entry: [
            {
              id: configDraft.instagramBusinessId || studioSlug,
              messaging: [
                {
                  sender: {
                    id: "ig_90218",
                    username: "karthik_weds_divya",
                    name: "Karthik & Divya",
                  },
                  message: {
                    text: "Hi! Saw your Coimbatore wedding reels on Instagram. Need candid photo + video package for Dec 14. My number is 9842211223.",
                  },
                },
              ],
            },
          ],
        },
        WHATSAPP: {
          object: "whatsapp_business_account",
          entry: [
            {
              changes: [
                {
                  value: {
                    contacts: [{ profile: { name: "Prakash Rajendran" }, wa_id: "919789012345" }],
                    messages: [
                      {
                        from: "919789012345",
                        type: "text",
                        text: {
                          body: "Vanakkam, engagement shoot inquiry for next month in RS Puram, Coimbatore. Please share package details.",
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        WEBSITE: {
          channel: "WEBSITE",
          name: "Meenakshi Sundaram",
          phone: "+91 94433 55667",
          email: "meenakshi.s@example.com",
          eventType: "Traditional Wedding & Album",
          eventDate: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
          location: "Codissia Hall, Coimbatore",
          estimatedBudget: 85000,
          message: "Submitted via Studio Website portfolio contact form.",
        },
      };

      const res = await fetch(`/api/webhooks/leads?studio=${studioSlug}&key=${webhookKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(samplePayloads[simChannel]),
      });

      const data = await res.json();
      if (res.ok && data.leadId) {
        showNotice(
          "success",
          `Live ${simChannel} Lead (#${data.leadId}) captured into OMS Leads!`
        );
        await onRefreshAll();
      } else {
        showNotice("error", data.error || "Webhook test failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateLeadManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await createStudioLeadAction({
        studioId: studioSlug,
        ...newLeadForm,
        idToken: token,
      });
      if (res.success && res.lead) {
        setShowAddLeadModal(false);
        setSelectedLead(res.lead);
        showNotice("success", `Lead "${res.lead.name}" added to OMS Leads.`);
        await onRefreshAll();
      } else {
        showNotice("error", res.error || "Failed to create lead.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStageChange = async (lead: StudioLead, nextStage: LeadStage) => {
    setBusy(true);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await updateStudioLeadAction({
        leadId: lead.id,
        studioId: studioSlug,
        updates: { stage: nextStage },
        idToken: token,
      });
      if (res.success && res.lead) {
        setSelectedLead(res.lead);
        showNotice("success", `Lead status updated to ${STAGE_LABELS[nextStage]}.`);
        await onRefreshAll();
      } else {
        showNotice("error", res.error || "Failed to update stage.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOpenConvertModal = (lead: StudioLead) => {
    setSelectedLead(lead);
    setConvertForm({
      eventType: lead.eventType || "Wedding Photography",
      eventDate: lead.eventDate || new Date().toISOString().slice(0, 10),
      eventLocation: lead.location || "Coimbatore",
      confirmedPrice: lead.estimatedBudget || 45000,
      advanceAmount: Math.round((lead.estimatedBudget || 45000) * 0.3),
    });
    setShowConvertModal(true);
  };

  const handleConvertLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setBusy(true);
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await convertLeadToOrderAction({
        leadId: selectedLead.id,
        studioId: studioSlug,
        eventType: convertForm.eventType,
        eventDate: convertForm.eventDate,
        eventLocation: convertForm.eventLocation,
        confirmedPrice: convertForm.confirmedPrice,
        advanceAmount: convertForm.advanceAmount,
        idToken: token,
      });
      if (res.success && res.order) {
        setShowConvertModal(false);
        await onRefreshAll();
        onSwitchToOrders(res.order.id);
      } else {
        showNotice("error", res.error || "Failed to convert lead to order.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 h-full w-full">
      {/* Left Panel: OMS Header + Unified Leads List */}
      <div
        className={`flex h-full flex-col ${
          selectedLead ? "hidden lg:flex lg:w-1/2 border-r border-border-default" : "w-full"
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
                Studio Marketplace inquiries &amp; multi-channel leads (Instagram, WhatsApp, Website) · {leads.length} Total Leads
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSetupModal(true)}
                className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-bold text-text-primary hover:bg-surface-app hover:border-brand-blue-primary transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-brand-blue-primary" />
                <span>Enable &amp; Configure Channels</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    isMultiChannelEnabled ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(true)}
                className="btn-brand-blue inline-flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Log Lead</span>
              </button>
            </div>
          </div>

          {/* 2-Section Switcher: Orders (Confirmed Orders) vs Leads */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-default/70 pt-3.5">
            <div className="inline-flex rounded-xl bg-surface-app p-1 border border-border-default">
              <button
                type="button"
                onClick={() => onSwitchToOrders()}
                className="rounded-lg px-3.5 py-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition"
              >
                Orders (Confirmed Orders) ({ordersCount})
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-blue-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition"
              >
                Leads ({leads.length})
              </button>
            </div>

            {/* Quick Enable/Disable Toggle for Multi-Channel Webhooks */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-text-secondary">
                Instagram / WhatsApp / Website Capture:
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleToggleMultiChannel()}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider transition border ${
                  isMultiChannelEnabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-gray-100 text-text-tertiary border-border-default"
                }`}
              >
                {isMultiChannelEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          {/* Search & Channel Filters */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2.5">
            <input
              suppressHydrationWarning
              autoComplete="off"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by client name, phone, Instagram handle, event..."
              className="flex-1 rounded-xl border border-border-default bg-surface-app px-3.5 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:bg-white focus:outline-none focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-soft"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(["ALL", "MARKETPLACE", "INSTAGRAM", "WHATSAPP", "WEBSITE"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  channelFilter === ch
                    ? "bg-text-primary text-white"
                    : "border border-border-default bg-white text-text-secondary hover:text-text-primary"
                }`}
              >
                {ch === "ALL"
                  ? `All Leads (${leads.length})`
                  : `${CHANNEL_BADGES[ch].label} (${leads.filter((l) => l.channel === ch).length})`}
              </button>
            ))}
          </div>
        </header>

        {banner && (
          <div
            className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              banner.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            <span>{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)} className="text-[11px] underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Unified Leads Stream */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {filteredLeads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default bg-white p-10 text-center space-y-3">
              <p className="text-sm font-bold text-text-secondary">
                No {channelFilter === "ALL" ? "" : CHANNEL_BADGES[channelFilter].label} leads found
              </p>
              <p className="text-xs text-text-tertiary max-w-md mx-auto">
                All Studio Marketplace inquiries and leads from Instagram, WhatsApp, and your Studio Website appear here before being confirmed as orders.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(true)}
                  className="rounded-xl border border-brand-blue-light bg-brand-blue-background px-3.5 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-sky-100 transition inline-flex items-center gap-1.5"
                >
                  <Webhook className="h-3.5 w-3.5" />
                  <span>Configure Channels &amp; Webhook</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSimulateWebhookLead("INSTAGRAM")}
                  className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-purple-primary transition inline-flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand-purple-primary" />
                  <span>Test Instagram Lead</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSimulateWebhookLead("WHATSAPP")}
                  className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 text-xs font-bold text-text-primary hover:border-emerald-500 transition inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Test WhatsApp Lead</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSimulateWebhookLead("WEBSITE")}
                  className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 text-xs font-bold text-text-primary hover:border-brand-blue-primary transition inline-flex items-center gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5 text-brand-blue-primary" />
                  <span>Test Website Lead</span>
                </button>
              </div>
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const chInfo = CHANNEL_BADGES[lead.channel] || CHANNEL_BADGES.DIRECT;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLead(lead.id === selectedLead?.id ? null : lead)}
                  className={`w-full rounded-2xl border p-5 text-left transition ${
                    selectedLead?.id === lead.id
                      ? "card-brand-blue"
                      : "border-border-default bg-white hover:border-brand-blue-light hover:shadow-xs"
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-text-primary">
                          {lead.name}
                        </span>
                        <span className={chInfo.badgeClass}>{chInfo.label}</span>
                        {lead.instagramHandle && (
                          <span className="text-[11px] font-mono text-brand-purple-primary">
                            {lead.instagramHandle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {lead.eventType || "Event Inquiry"}
                        {lead.eventDate ? ` · Event Date: ${lead.eventDate}` : ""}
                        {lead.location ? ` · ${lead.location}` : ""}
                      </p>
                      {lead.message && (
                        <p className="mt-1.5 text-xs text-text-tertiary line-clamp-1">
                          {lead.message}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={
                          lead.stage === "CONVERTED"
                            ? "badge-status-success"
                            : lead.stage === "NEW"
                            ? "badge-brand-orange"
                            : "badge-brand-blue"
                        }
                      >
                        {STAGE_LABELS[lead.stage]}
                      </span>
                      {lead.estimatedBudget ? (
                        <p className="mt-2 text-sm font-extrabold text-text-primary">
                          ₹{lead.estimatedBudget.toLocaleString("en-IN")}
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] text-text-tertiary">
                          {new Date(lead.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Selected Lead Detail & Conversion to Confirmed Order */}
      {selectedLead && (
        <aside className="h-full w-full lg:w-1/2 overflow-y-auto bg-white p-6 border-l border-border-default space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-border-default">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={CHANNEL_BADGES[selectedLead.channel]?.badgeClass || "badge-brand-blue"}>
                  {CHANNEL_BADGES[selectedLead.channel]?.label || selectedLead.channel}
                </span>
                <span className="text-xs font-mono text-text-tertiary">{selectedLead.id}</span>
              </div>
              <h2 className="text-lg font-extrabold text-text-primary">{selectedLead.name}</h2>
            </div>

            <div className="flex items-center gap-2">
              {selectedLead.stage !== "CONVERTED" ? (
                <button
                  type="button"
                  onClick={() => handleOpenConvertModal(selectedLead)}
                  className="btn-brand-blue inline-flex items-center gap-1"
                >
                  <span>Confirm &amp; Convert to Order</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                selectedLead.convertedOrderId && (
                  <button
                    type="button"
                    onClick={() => onSwitchToOrders(selectedLead.convertedOrderId)}
                    className="badge-status-success py-1.5 px-3 text-xs font-bold cursor-pointer"
                  >
                    View Order #{selectedLead.convertedOrderId} →
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="btn-brand-outline py-1.5 px-3 text-xs"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Lead Stage Progression */}
          <div className="rounded-2xl border border-border-default bg-surface-app/60 p-4 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Lead Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["NEW", "CONTACTED", "QUOTED", "CONVERTED", "ARCHIVED"] as LeadStage[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={busy || st === "CONVERTED"}
                  onClick={() => void handleStageChange(selectedLead, st)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    selectedLead.stage === st
                      ? "bg-brand-blue-primary text-white"
                      : "border border-border-default bg-white text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {STAGE_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          {/* Inquiry Message */}
          <div className="rounded-2xl border border-border-default bg-white p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Inquiry Message / Requirements
            </p>
            <p className="text-xs text-text-primary leading-relaxed bg-surface-app p-3.5 rounded-xl border border-border-default">
              {selectedLead.message || "No additional message text provided."}
            </p>
          </div>

          {/* Lead Metadata Grid */}
          <div className="rounded-2xl border border-border-default bg-surface-app/40 p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-text-tertiary">Phone / WhatsApp</p>
              <p className="font-bold text-text-primary mt-0.5">{selectedLead.phone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Email</p>
              <p className="font-bold text-text-primary mt-0.5">{selectedLead.email || "—"}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Instagram Handle</p>
              <p className="font-bold text-brand-purple-primary mt-0.5">
                {selectedLead.instagramHandle || "—"}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary">Source Channel</p>
              <p className="font-bold text-text-primary mt-0.5">
                {CHANNEL_BADGES[selectedLead.channel]?.label || selectedLead.channel}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary">Event Type / Package</p>
              <p className="font-bold text-text-primary mt-0.5">{selectedLead.eventType || "TBD"}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Preferred Event Date</p>
              <p className="font-bold text-text-primary mt-0.5">{selectedLead.eventDate || "Flexible"}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Location / Venue</p>
              <p className="font-bold text-text-primary mt-0.5">{selectedLead.location || "—"}</p>
            </div>
            <div>
              <p className="text-text-tertiary">Estimated / Quoted Budget</p>
              <p className="font-bold text-text-primary mt-0.5">
                {selectedLead.estimatedBudget
                  ? `₹${selectedLead.estimatedBudget.toLocaleString("en-IN")}`
                  : "Not quoted yet"}
              </p>
            </div>
          </div>

          {/* Quick Follow-Up Actions */}
          <div className="flex flex-wrap gap-2.5">
            {selectedLead.phone && (
              <a
                href={`https://wa.me/${
                  selectedLead.phone.replace(/\D/g, "").length === 10
                    ? `91${selectedLead.phone.replace(/\D/g, "")}`
                    : selectedLead.phone.replace(/\D/g, "")
                }?text=${encodeURIComponent(
                  `Hello ${selectedLead.name}! Thank you for reaching out to ${studioSlug} regarding ${
                    selectedLead.eventType || "your upcoming shoot"
                  }. Here are our package details and availability.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition inline-flex items-center gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Reply on WhatsApp</span>
              </a>
            )}
            {selectedLead.instagramHandle && (
              <a
                href={`https://instagram.com/${selectedLead.instagramHandle.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-brand-purple-light bg-brand-purple-background px-4 py-2 text-xs font-bold text-brand-purple-primary hover:bg-purple-100 transition inline-flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Instagram ({selectedLead.instagramHandle})</span>
              </a>
            )}
          </div>
        </aside>
      )}

      {/* Enable & Configure Lead Channels Modal (1-Time Setup) */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default space-y-5 text-xs">
            <div className="flex items-start justify-between border-b border-border-default pb-4">
              <div>
                <span className="badge-brand-blue mb-1.5 inline-flex items-center gap-1">
                  <Webhook className="h-3 w-3" />
                  OMS Lead Channels · 1-Time Setup
                </span>
                <h3 className="text-lg font-extrabold text-text-primary">
                  Enable &amp; Configure Multi-Channel Leads
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Unify Studio Marketplace inquiries with leads from Instagram Business, WhatsApp Business, and your Studio Website inside OMS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="text-text-tertiary hover:text-text-primary font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWebhookSetup} className="space-y-4">
              {/* Master Enable Switch */}
              <div className="rounded-2xl border border-border-default bg-surface-app p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-text-primary text-sm">
                    Enable Multi-Channel Lead Capture (Instagram, WhatsApp &amp; Website)
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    When enabled, inquiries sent to your connected channels automatically appear in the OMS Leads tab alongside Studio Marketplace inquiries.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={configDraft.enabled}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, enabled: e.target.checked })
                    }
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-blue-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              {/* Meta Webhook One-Time Credentials */}
              <div className="rounded-2xl border border-brand-blue-light bg-brand-blue-background/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-blue-primary uppercase tracking-wider text-[10px]">
                    1-Time Meta Webhook Setup (Instagram &amp; WhatsApp Business)
                  </span>
                  <span className="badge-status-success">
                    {configDraft.enabled ? "Active Endpoint" : "Paused"}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-text-primary mb-1">
                    Webhook Callback URL (Paste once in Meta Developer / Business Suite)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="w-full rounded-xl border border-border-default bg-white px-3 py-2 font-mono text-[11px] text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void copyText("url", webhookUrl)}
                      className="rounded-xl bg-text-primary px-3 py-2 text-white font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedField === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedField === "url" ? "Copied" : "Copy URL"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-text-primary mb-1">
                    Verify Token (hub.verify_token)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookKey}
                      className="w-full rounded-xl border border-border-default bg-white px-3 py-2 font-mono text-[11px] text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void copyText("token", webhookKey)}
                      className="rounded-xl border border-border-default bg-white px-3 py-2 text-text-primary font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedField === "token" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedField === "token" ? "Copied" : "Copy Token"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Channel Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text-primary mb-1">
                    Instagram Business Handle
                  </label>
                  <input
                    type="text"
                    value={configDraft.instagramHandle}
                    onChange={(e) => setConfigDraft({ ...configDraft, instagramHandle: e.target.value })}
                    placeholder="@yourstudiocbe"
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-primary mb-1">
                    WhatsApp Business Number
                  </label>
                  <input
                    type="text"
                    value={configDraft.whatsappBusinessPhone}
                    onChange={(e) => setConfigDraft({ ...configDraft, whatsappBusinessPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-text-primary mb-1">
                    External Studio Website Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={configDraft.websiteDomain}
                    onChange={(e) => setConfigDraft({ ...configDraft, websiteDomain: e.target.value })}
                    placeholder="https://yourstudiophotography.com"
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={configDraft.autoCaptureWhatsAppUnknownSenders}
                  onChange={(e) =>
                    setConfigDraft({
                      ...configDraft,
                      autoCaptureWhatsAppUnknownSenders: e.target.checked,
                    })
                  }
                  className="rounded border-border-default"
                />
                <span className="font-semibold text-text-primary">
                  Auto-capture inbound WhatsApp messages from new customer phone numbers into OMS Leads
                </span>
              </label>

              {/* Website Snippet */}
              <div className="rounded-2xl border border-border-default bg-surface-app p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">
                    External Studio Website Form Snippet
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyText("snippet", websiteSnippet)}
                    className="text-[11px] font-bold text-brand-blue-primary hover:underline"
                  >
                    {copiedField === "snippet" ? "Copied Snippet!" : "Copy Website Snippet"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-white p-2.5 text-[10px] font-mono text-text-secondary border border-border-default">
                  {websiteSnippet}
                </pre>
              </div>

              {/* Test Webhook Buttons */}
              <div className="rounded-2xl border border-border-default bg-white p-3.5 space-y-2">
                <p className="font-bold text-text-primary">
                  Test Channel Capture (Send Sample Lead into OMS)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSimulateWebhookLead("INSTAGRAM")}
                    className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 font-bold text-text-primary hover:border-brand-purple-primary transition"
                  >
                    + Simulate Instagram Lead
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSimulateWebhookLead("WHATSAPP")}
                    className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 font-bold text-text-primary hover:border-emerald-500 transition"
                  >
                    + Simulate WhatsApp Lead
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSimulateWebhookLead("WEBSITE")}
                    className="rounded-xl border border-border-default bg-surface-app px-3 py-1.5 font-bold text-text-primary hover:border-brand-blue-primary transition"
                  >
                    + Simulate Website Lead
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="btn-brand-outline"
                >
                  Close
                </button>
                <button type="submit" disabled={busy} className="btn-brand-blue">
                  {busy ? "Saving..." : "Save Channel Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Log Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h3 className="text-base font-bold text-text-primary">Log New Lead in OMS</h3>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="text-text-tertiary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLeadManual} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-text-primary mb-1">Channel *</label>
                  <select
                    value={newLeadForm.channel}
                    onChange={(e) =>
                      setNewLeadForm({ ...newLeadForm, channel: e.target.value as LeadChannel })
                    }
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  >
                    <option value="MARKETPLACE">Studio Marketplace</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="WEBSITE">Studio Website</option>
                    <option value="DIRECT">Direct Call / Walk-in</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-text-primary mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    placeholder="e.g. Vignesh Kumar"
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-text-primary mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-primary mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={newLeadForm.instagramHandle}
                    onChange={(e) =>
                      setNewLeadForm({ ...newLeadForm, instagramHandle: e.target.value })
                    }
                    placeholder="@vignesh_cbe"
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-text-primary mb-1">Event Type</label>
                  <input
                    type="text"
                    value={newLeadForm.eventType}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, eventType: e.target.value })}
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-primary mb-1">Event Date</label>
                  <input
                    type="date"
                    value={newLeadForm.eventDate}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, eventDate: e.target.value })}
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-text-primary mb-1">Inquiry Notes / Message</label>
                <textarea
                  rows={2}
                  value={newLeadForm.message}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, message: e.target.value })}
                  placeholder="Requirements, venue, package interest..."
                  className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="btn-brand-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn-brand-blue">
                  {busy ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm & Convert Lead to OMS Order Modal */}
      {showConvertModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <div>
                <span className="badge-brand-blue mb-1">Convert Lead to Confirmed Order</span>
                <h3 className="text-base font-bold text-text-primary">
                  Confirm Order for {selectedLead.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="text-text-tertiary hover:text-text-primary font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConvertLeadSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-text-primary mb-1">Event Type *</label>
                <input
                  type="text"
                  required
                  value={convertForm.eventType}
                  onChange={(e) => setConvertForm({ ...convertForm, eventType: e.target.value })}
                  className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-text-primary mb-1">Event Date *</label>
                  <input
                    type="date"
                    required
                    value={convertForm.eventDate}
                    onChange={(e) => setConvertForm({ ...convertForm, eventDate: e.target.value })}
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-primary mb-1">Venue / City *</label>
                  <input
                    type="text"
                    required
                    value={convertForm.eventLocation}
                    onChange={(e) =>
                      setConvertForm({ ...convertForm, eventLocation: e.target.value })
                    }
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-text-primary mb-1">
                    Confirmed Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={convertForm.confirmedPrice}
                    onChange={(e) =>
                      setConvertForm({ ...convertForm, confirmedPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-primary mb-1">
                    Advance Received (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={convertForm.advanceAmount}
                    onChange={(e) =>
                      setConvertForm({ ...convertForm, advanceAmount: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="btn-brand-outline"
                >
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn-brand-blue">
                  {busy ? "Creating Order..." : "Confirm & Move to Confirmed Orders"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
