"use client";

import { useState, use, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { getEffectiveStudioTier } from "@/lib/proEntitlements";
import { updateStudioWhatsappConfigAction } from "@/actions/studioActions";
import {
  simulateWhatsappBotQueryAction,
  getStudioWhatsappLogsAction,
} from "@/actions/whatsappActions";
import { WhatsAppTemplateId, WhatsAppDispatchLog } from "@/services/whatsappService";

/**
 * WhatsApp Premium Operational Layer & Interactive Bot Hub
 * Primary Source of Truth: Focoman Product Discovery Document & Pricing Specifications
 */

const NOTIFICATION_GROUPS = [
  {
    title: "Studio Owner Alerts (OMS)",
    description: "Lightweight operational notifications sent to Studio Owner for upcoming events and production milestones.",
    badgeClass: "badge-brand-blue",
    badgeLabel: "OMS · Owner Alerts",
    dotClass: "bg-brand-blue-primary",
    switchClass: "bg-brand-blue-primary",
    cardBorder: "border-border-default hover:border-brand-blue-light",
    items: [
      { id: "upcoming_3day", label: "Upcoming Order Reminder (3 days before event)", enabled: true },
      { id: "post_event_start", label: "Post-Event Workflow Started", enabled: true },
      { id: "raw_photos_sent", label: "RAW Photos Marked Sent", enabled: true },
      { id: "customer_selection_done", label: "Customer Selection Completed", enabled: true },
      { id: "album_review_done", label: "Album Review Completed", enabled: true },
      { id: "ready_for_delivery", label: "Ready for Delivery Notification", enabled: true },
    ],
  },
  {
    title: "Studio Member Operational Alerts (ERP)",
    description: "Notifications for planned crew assignments, call-time reminders, and downstream production task assignments.",
    badgeClass: "badge-brand-purple",
    badgeLabel: "ERP · Crew Operations",
    dotClass: "bg-brand-purple-primary",
    switchClass: "bg-brand-purple-primary",
    cardBorder: "border-border-default hover:border-brand-purple-light",
    items: [
      { id: "assignment_confirm", label: "Planned Order Assignment, Call Time & Availability Confirmation", enabled: true },
      { id: "task_assigned", label: "Downstream Production Task Assigned", enabled: true },
    ],
  },
  {
    title: "Customer Order Tracking Updates (CRM)",
    description: "Optional updates sent to customer WhatsApp number for milestone transparency and tracking.",
    badgeClass: "badge-brand-orange",
    badgeLabel: "CRM · Customer Relations",
    dotClass: "bg-brand-orange-primary",
    switchClass: "bg-brand-orange-primary",
    cardBorder: "border-border-default hover:border-brand-orange-light",
    items: [
      { id: "customer_post_event", label: "Post-Event Workflow Updates", enabled: true },
      { id: "customer_ready_delivery", label: "Order Ready for Delivery", enabled: true },
      { id: "customer_payment_remind", label: "Payment Status Updates", enabled: true },
    ],
  },
];

const TEMPLATES_LIST: { id: WhatsAppTemplateId; name: string; audience: string }[] = [
  { id: "booking_confirmation", name: "Booking Confirmation & 6-Digit Passkey", audience: "Client" },
  { id: "upcoming_3day_reminder", name: "Upcoming Shoot (3 Days Out)", audience: "Studio Owner" },
  { id: "raw_photos_ready", name: "RAW Proofing Gallery Ready", audience: "Client" },
  { id: "customer_selection_done", name: "Selection Finalized Alert", audience: "Studio Owner" },
  { id: "album_review_ready", name: "Photobook Draft Layout Ready", audience: "Client" },
  { id: "ready_for_delivery", name: "Ready for Delivery / Balance", audience: "Client" },
  { id: "crew_assignment_alert", name: "Crew Call-Time Reminder", audience: "Team Crew" },
  { id: "crew_task_assigned", name: "Production Task Assigned", audience: "Editor" },
];

export default function WhatsappPage({ params }: { params: Promise<{ studioSlug: string }> }) {
  const { studioSlug } = use(params);
  const { studio, idToken, authLoading, getIdToken } = useStudioWorkspace();

  const [activeTab, setActiveTab] = useState<"triggers" | "bot_simulator" | "templates" | "logs">("triggers");
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [dispatchLogs, setDispatchLogs] = useState<WhatsAppDispatchLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const effectiveTier = getEffectiveStudioTier(studio);

  // Bot Simulator State
  const [botQuery, setBotQuery] = useState("TODAY");
  const [botChatHistory, setBotChatHistory] = useState<Array<{ sender: "user" | "bot"; text: string; time: string }>>([
    {
      sender: "bot",
      text: `👋 Hello! I am your Focoman Operations Bot for *${studio?.name || "your studio"}*.\n\nType *TODAY*, *SHOOTS*, *ORDERS*, *CREW*, *STATUS <OrderID>*, *DONE <OrderID>*, or *CONFIRM <OrderID>* to query or update live studio operations.`,
      time: "Just now",
    },
  ]);
  const [isBotLoading, setIsBotLoading] = useState(false);

  // Template Preview State
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateId>("booking_confirmation");
  const [templatePreviewText, setTemplatePreviewText] = useState<string>("");
  const [templateClickUrl, setTemplateClickUrl] = useState<string>("");
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);

  useEffect(() => {
    if (studio?.whatsappConfig) {
      setConfig(studio.whatsappConfig);
      setMasterEnabled(studio.whatsappConfig.masterEnabled !== false);
    }
  }, [studio]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const token = idToken || (await getIdToken(false));
      if (!token) return;
      const logs = await getStudioWhatsappLogsAction(studioSlug, token);
      setDispatchLogs(logs);
    } finally {
      setLogsLoading(false);
    }
  }, [studioSlug, idToken, getIdToken]);

  useEffect(() => {
    if (activeTab === "logs") {
      void loadLogs();
    }
  }, [activeTab, loadLogs]);

  useEffect(() => {
    async function loadTemplate() {
      setIsTemplateLoading(true);
      try {
        // Templates containing customer/order fields must be generated from an
        // owner-authorized OMS order, never from sample data in this settings page.
        setTemplatePreviewText("Select an order from OMS to generate an authorized preview.");
        setTemplateClickUrl("");
      } catch (err) {
        console.error("Failed to load template preview:", err);
      } finally {
        setIsTemplateLoading(false);
      }
    }
    loadTemplate();
  }, [selectedTemplate]);

  const toggleItem = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const finalConfig = { ...config, masterEnabled };
      const token = idToken || (await getIdToken(true));
      if (!token) throw new Error("Authentication required");

      const res = await updateStudioWhatsappConfigAction(studioSlug, finalConfig, token);

      if (res.success) {
        setStatusMessage("WhatsApp notification configuration updated successfully.");
      } else {
        setStatusMessage("Failed to update: " + res.error);
      }
    } catch (err: any) {
      setStatusMessage("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunBotQuery = async (queryText?: string) => {
    const textToRun = (queryText || botQuery).trim();
    if (!textToRun) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setBotChatHistory((prev) => [...prev, { sender: "user", text: textToRun, time: timeStr }]);
    setBotQuery("");
    setIsBotLoading(true);

    try {
      const token = idToken || (await getIdToken(true));
      if (!token) throw new Error("Authentication required");

      const res = await simulateWhatsappBotQueryAction(studioSlug, textToRun, token);
      const replyText = res.success ? res.reply || "Done." : `⚠️ ${res.error || "Execution failed"}`;

      setBotChatHistory((prev) => [
        ...prev,
        {
          sender: "bot",
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: any) {
      setBotChatHistory((prev) => [
        ...prev,
        {
          sender: "bot",
          text: `⚠️ Error: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsBotLoading(false);
    }
  };

  if (authLoading) {
    return <div className="p-10 text-sm text-text-secondary">Loading workspace...</div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-app">
      {effectiveTier !== "COMPLETE" && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-brand-blue-primary text-white">
              ₹1,999/MO PLAN
            </span>
            <span className="text-xs text-text-secondary">
              WhatsApp Operations &amp; Interactive Bot is included in the ₹1,999/month Complete Studio Plan.
            </span>
          </div>
          <Link
            href={`/checkout?studio=${studioSlug}&plan=COMPLETE`}
            className="text-xs font-bold text-white bg-brand-blue-primary px-3 py-1 rounded-lg hover:bg-sky-600 transition shrink-0"
          >
            Upgrade to ₹1,999/mo →
          </Link>
        </div>
      )}

      <div className="p-6 lg:p-10 max-w-4xl space-y-8">
        {/* Header */}
        <header className="header-brand-blue">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="badge-brand-blue">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-blue-primary" />
                  WhatsApp Hub
                </span>
                <span className="badge-status-success">
                  Interactive Bot Enabled
                </span>
                <span className="badge-status-neutral">
                  Studio: <strong className="font-semibold text-text-primary">{studioSlug}</strong>
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-text-primary tracking-tight">
                WhatsApp Operations &amp; Bot Hub
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                Manage operational triggers, test the interactive Operations Bot, and preview one-click client &amp; crew templates.
              </p>
            </div>
            {activeTab === "triggers" && (
              <button onClick={handleSave} disabled={isSaving} className="btn-brand-blue">
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 mt-6 border-b border-border-default pb-2">
            <button
              onClick={() => setActiveTab("triggers")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "triggers"
                  ? "bg-brand-blue-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-white"
              }`}
            >
              Operational Triggers
            </button>
            <button
              onClick={() => setActiveTab("bot_simulator")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === "bot_simulator"
                  ? "bg-brand-blue-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-white"
              }`}
            >
              <span>Bot Simulator &amp; Workflow Actions</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-emerald-100 text-emerald-800 font-bold">Live</span>
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "templates"
                  ? "bg-brand-blue-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-white"
              }`}
            >
              Templates &amp; Click-to-Chat
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "logs"
                  ? "bg-brand-blue-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-white"
              }`}
            >
              Dispatch Logs
            </button>
          </div>
        </header>

        {/* TAB 1: OPERATIONAL TRIGGERS */}
        {activeTab === "triggers" && (
          <div className="space-y-6">
            {/* Master Switch */}
            <div
              className={`rounded-2xl border p-6 transition ${
                masterEnabled
                  ? "border-brand-blue-soft bg-brand-blue-background/40 shadow-xs"
                  : "border-border-default bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        masterEnabled ? "bg-brand-blue-primary animate-pulse" : "bg-text-tertiary"
                      }`}
                    />
                    <h2 className="text-sm font-extrabold text-text-primary">
                      Focoman WhatsApp Operational System
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {masterEnabled
                      ? "Operational alerts and milestone updates actively routed via central WhatsApp service."
                      : "WhatsApp notifications paused (Core OMS application remains fully operational)."}
                  </p>
                </div>
                <button
                  onClick={() => setMasterEnabled(!masterEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    masterEnabled ? "bg-brand-blue-primary" : "bg-border-default"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      masterEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Notification Groups */}
            {masterEnabled && (
              <div className="space-y-6">
                {NOTIFICATION_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className={`rounded-2xl border bg-white p-6 shadow-xs transition ${group.cardBorder}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <h3 className="text-base font-extrabold text-text-primary">{group.title}</h3>
                      <span className={group.badgeClass}>
                        <span className={`h-1.5 w-1.5 rounded-full ${group.dotClass}`} />
                        {group.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-4">{group.description}</p>

                    <div className="space-y-3 pt-3 border-t border-border-default">
                      {group.items.map((item) => {
                        const isActive = config[item.id] !== false;
                        return (
                          <div key={item.id} className="flex items-center justify-between py-1.5">
                            <span className="text-xs font-semibold text-text-primary">{item.label}</span>
                            <button
                              onClick={() => toggleItem(item.id)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                isActive ? group.switchClass : "bg-border-default"
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                                  isActive ? "translate-x-5" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Button & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <button onClick={handleSave} disabled={isSaving} className="btn-brand-blue">
                {isSaving ? "Saving..." : "Save Configuration"}
              </button>
              {statusMessage && (
                <span
                  className={
                    statusMessage.includes("Error") || statusMessage.includes("Failed")
                      ? "badge-status-error"
                      : "badge-status-success"
                  }
                >
                  {statusMessage}
                </span>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE BOT SIMULATOR */}
        {activeTab === "bot_simulator" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                    <span>WhatsApp Operations &amp; Workflow Bot</span>
                    <span className="badge-brand-blue text-[10px]">Owner &amp; Authorized Crew</span>
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Test live queries (`TODAY`, `SHOOTS`, `ORDERS`, `CREW`) and workflow actions (`DONE &lt;OrderID&gt;`, `PROGRESS &lt;OrderID&gt;`, `CONFIRM &lt;OrderID&gt;`).
                  </p>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Webhook Active
                </span>
              </div>

              {/* Quick Prompt Chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-[11px] font-bold text-text-secondary self-center mr-1">Quick Commands:</span>
                {["TODAY", "SHOOTS", "ORDERS", "CREW", "HELP"].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => handleRunBotQuery(cmd)}
                    disabled={isBotLoading}
                    className="rounded-lg bg-surface-app border border-border-default px-2.5 py-1 text-xs font-mono font-bold text-text-primary hover:border-brand-blue-primary hover:text-brand-blue-primary transition"
                  >
                    {cmd}
                  </button>
                ))}
              </div>

              {/* WhatsApp Simulated Phone Screen */}
              <div className="rounded-2xl border-2 border-slate-700 bg-[#EFEAE2] p-4 sm:p-6 max-w-xl mx-auto shadow-md">
                {/* Chat Top Bar */}
                <div className="flex items-center gap-3 pb-3 mb-4 border-b border-black/10">
                  <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    F
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">Focoman Operations Bot</div>
                    <div className="text-[10px] text-emerald-700 font-medium">Online · Automated Assistant</div>
                  </div>
                </div>

                {/* Messages Container */}
                <div className="space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto pr-1">
                  {botChatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs max-w-[85%] shadow-xs whitespace-pre-line leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-[#D9FDD3] text-slate-900 rounded-tr-none font-medium"
                            : "bg-white text-slate-800 rounded-tl-none border border-black/5"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9.5px] text-slate-500 mt-0.5 px-1">{msg.time}</span>
                    </div>
                  ))}
                  {isBotLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white/80 px-3 py-2 rounded-xl w-max">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce delay-150" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce delay-300" />
                      <span className="text-[11px] ml-1">Focoman Bot is typing...</span>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="mt-4 pt-3 border-t border-black/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={botQuery}
                    onChange={(e) => setBotQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRunBotQuery()}
                    placeholder="Type command (e.g. TODAY, SHOOTS, DONE ORD-...)..."
                    className="flex-1 rounded-xl bg-white border border-black/10 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={() => handleRunBotQuery()}
                    disabled={isBotLoading || !botQuery.trim()}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Production Webhook Integration Details */}
            <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary mb-2">
                Meta WhatsApp Business Cloud API Credentials &amp; Webhook
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                To connect this operations bot to a live WhatsApp Business number, configure your Meta developer webhook with the details below:
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-surface-app rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-text-secondary">Callback URL:</span>
                  <span className="font-bold text-text-primary select-all">https://focoman.web.app/api/webhooks/whatsapp</span>
                </div>
                <div className="p-3 bg-surface-app rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-text-secondary">Verify Token:</span>
                  <span className="font-bold text-text-primary select-all">focoman_whatsapp_verify_token_2026</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TEMPLATES & ONE-CLICK CLICK-TO-CHAT */}
        {activeTab === "templates" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary mb-1">
                Standard Studio WhatsApp Templates Library
              </h3>
              <p className="text-xs text-text-secondary mb-4">
                Pre-formatted customer and crew notifications with canonical Order IDs, 6-digit passkeys, and crew call times.
              </p>

              <div className="grid gap-6 md:grid-cols-12">
                {/* Left Selector List */}
                <div className="md:col-span-5 space-y-2">
                  {TEMPLATES_LIST.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                        selectedTemplate === tpl.id
                          ? "border-brand-blue-primary bg-brand-blue-background/60 shadow-xs"
                          : "border-border-default bg-surface-app hover:border-slate-300"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-text-primary">{tpl.name}</div>
                        <div className="text-[10px] text-text-secondary">Audience: {tpl.audience}</div>
                      </div>
                      <span className="text-xs font-bold text-brand-blue-primary">→</span>
                    </button>
                  ))}
                </div>

                {/* Right Preview Box */}
                <div className="md:col-span-7 flex flex-col justify-between rounded-2xl border border-border-default bg-[#FAF7F2] p-5">
                  <div>
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10">
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                        Template Preview
                      </span>
                      <span className="text-[10px] bg-white border border-border-default px-2 py-0.5 rounded-full font-medium">
                        Instant wa.me link
                      </span>
                    </div>

                    {isTemplateLoading ? (
                      <div className="py-12 text-center text-xs text-text-secondary">Loading template...</div>
                    ) : (
                      <div className="rounded-xl bg-white border border-border-default p-4 text-xs text-slate-800 font-mono whitespace-pre-line leading-relaxed shadow-xs">
                        {templatePreviewText}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-black/10 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(templatePreviewText);
                        setCopiedNotice(true);
                        setTimeout(() => setCopiedNotice(false), 2000);
                      }}
                      className="btn-brand-outline"
                    >
                      {copiedNotice ? "✓ Copied Text" : "Copy Text"}
                    </button>

                    {templateClickUrl && (
                      <a
                        href={templateClickUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-brand-blue bg-emerald-600 hover:bg-emerald-700 border-none shadow-xs"
                      >
                        <span>Open WhatsApp Web (wa.me)</span>
                        <span>→</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DISPATCH LOGS (WA-001) */}
        {activeTab === "logs" && (
          <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">
                  Automated WhatsApp Notification &amp; Bot Dispatch Logs
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Recent stage updates, crew call-time alerts, and interactive bot responses recorded for {studioSlug}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadLogs()}
                className="btn-brand-outline py-1.5 px-3 text-xs"
              >
                Refresh
              </button>
            </div>

            {logsLoading ? (
              <div className="py-12 text-center text-xs text-text-tertiary">Loading dispatch logs...</div>
            ) : dispatchLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-default p-8 text-center text-xs text-text-secondary">
                No WhatsApp dispatch logs recorded yet. Stage updates and bot commands will appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-default bg-surface-app text-[10px] font-bold uppercase text-text-secondary">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Template / Event</th>
                      <th className="py-2.5 px-3">Audience</th>
                      <th className="py-2.5 px-3">Order</th>
                      <th className="py-2.5 px-3">Recipient</th>
                      <th className="py-2.5 px-3">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {dispatchLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-app/50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-text-primary">
                          {log.templateId}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {log.audience}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-brand-blue-primary font-bold">
                          {log.orderNumber || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-text-secondary">
                          {log.recipientPhone}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {log.mode}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
