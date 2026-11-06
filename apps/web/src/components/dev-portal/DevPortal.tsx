"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Boxes, Cloud, GitBranch, LayoutDashboard, LogOut, Mail, MessageSquare, RefreshCw, ShieldCheck, SlidersHorizontal, CheckCircle2, AlertCircle, Send, Key, Clock } from "lucide-react";
import { FocomanLogo } from "@/components/FocomanLogo";
import styles from "./DevPortal.module.css";

type Metrics = {
  studioRecords: number | null;
  customerRecords: number | null;
  orderRecords: number | null;
  ordersThisMonth: number | null;
  verifiedPaymentRecords: number | null;
  pendingPaymentRecords: number | null;
};
type BrevoAccount = {
  configured: boolean;
  connected: boolean;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  dailyCredits?: number;
  planType?: string;
  keyCreatedDate: string;
  keyExpiryDate: string;
  inactivityLimitDays: number;
  lastUsedAt: string | null;
  daysRemainingUntilInactivity: number;
  error?: string;
};

type BrevoStats = {
  requests: number;
  delivered: number;
  hardBounces: number;
  softBounces: number;
  clicks: number;
  opens: number;
  spamReports: number;
  blocked: number;
};

type ResendDomainInfo = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  region: string;
};

type ResendAccountStatus = {
  configured: boolean;
  connected: boolean;
  accountEmail: string;
  domains: ResendDomainInfo[];
  dailyLimit: number;
  monthlyLimit: number;
  lastUsedAt: string | null;
  error?: string;
};

type ResendStatus = {
  configured: boolean;
  fromEmail: string;
  replyToEmail: string;
  account?: ResendAccountStatus | null;
};

type DomainExpirationInfo = {
  domain: string;
  registrar: string;
  expiryDate: string;
  daysRemaining: number;
  alertThresholdsDays: number[];
  alertRecipients: string[];
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
};

type EmailProviders = {
  brevo: {
    account: BrevoAccount | null;
    stats: BrevoStats | null;
  };
  resend: ResendStatus | null;
};

type MetricsResponse = {
  generatedAt: string;
  metrics: Metrics;
  emailProviders?: EmailProviders;
  domainExpiration?: DomainExpirationInfo;
};
type Tab = "overview" | "studios" | "usage" | "cloud" | "email" | "whatsapp" | "deploy" | "settings";

const tabs: { id: Tab; name: string; icon: typeof Activity }[] = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "studios", name: "Studios & orders", icon: Boxes },
  { id: "usage", name: "Product usage", icon: BarChart3 },
  { id: "cloud", name: "Infrastructure", icon: Cloud },
  { id: "email", name: "Email", icon: Mail },
  { id: "whatsapp", name: "WhatsApp", icon: MessageSquare },
  { id: "deploy", name: "Git & deployments", icon: GitBranch },
  { id: "settings", name: "Settings", icon: SlidersHorizontal },
];

function SignIn() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/dev-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      setPassword("");
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Unable to sign in.");
      } else router.refresh();
    } catch { setError("Unable to reach the server. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-surface-app text-text-primary selection:bg-brand-blue-soft flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition"
          >
            ← Back to Home
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Internal Ops
          </span>
        </div>

        <div className="w-full rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-10">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <FocomanLogo className="h-8 w-auto" showStudiosSuffix={false} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
              Restricted Environment
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Dev Portal Access
            </h1>
            <p className="mx-auto mt-2 text-sm text-text-secondary">
              A private workspace for platform analytics, telemetry, and infrastructure operations.
            </p>
          </div>

          <div className="mx-auto mt-8">
            <div className="rounded-2xl border border-border-default bg-gray-50/50 p-6 sm:p-7">
              <div className="mb-5 pb-4 border-b border-border-default">
                <h2 className="text-sm font-bold text-text-primary">Admin Authentication</h2>
                <p className="text-[11px] text-text-secondary mt-0.5">Enter your platform security credentials</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="dev-password" className="block text-xs font-bold text-text-primary mb-1.5">
                    Admin Password
                  </label>
                  <input
                    id="dev-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter security key or password"
                    required
                    className="w-full rounded-xl border border-border-default bg-white px-4 py-3 text-sm text-text-primary shadow-xs placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-2 focus:ring-brand-blue-primary/20 transition"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-text-primary text-white font-bold py-3.5 px-4 text-xs shadow-sm hover:bg-black active:translate-y-[1px] transition text-center cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <span>Unlock Dev Portal →</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-[11px] text-text-tertiary text-center mt-6">
            Authorised FocoMan administrators only. Session valid for 4 hours.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: number | null | undefined; note: string }) {
  return <article className={styles.metric}><p>{label}</p><strong>{value == null ? "Unavailable" : value.toLocaleString("en-IN")}</strong><small>{note}</small></article>;
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return <section className={styles.panel}><div className={styles.panelTitle}><span>{title}</span><span className={styles.badge}>UNAVAILABLE</span></div><p className={styles.empty}>{text}</p></section>;
}

export function DevPortal({ authenticated, preview }: { authenticated: boolean; preview: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendPinging, setResendPinging] = useState(false);
  const [resendPingResult, setResendPingResult] = useState<{ success: boolean; message: string } | null>(null);

  async function triggerResendPing() {
    setResendPinging(true);
    setResendPingResult(null);
    try {
      const res = await fetch("/api/dev/resend-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: "webmaster@focoman.com" }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setResendPingResult({
          success: true,
          message: `Test email successfully sent via Resend! (ID: ${resData.messageId || "delivered"})`,
        });
        void load();
      } else {
        setResendPingResult({
          success: false,
          message: resData.error || "Resend test email failed.",
        });
      }
    } catch {
      setResendPingResult({ success: false, message: "Network error triggering Resend test." });
    } finally {
      setResendPinging(false);
    }
  }
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; message: string } | null>(null);

  async function triggerKeepAlive() {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch("/api/dev/brevo-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: "webmaster@focoman.com" }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setPingResult({
          success: true,
          message: resData.testEmailSent
            ? "Keep-alive ping sent successfully! Test email delivered to webmaster@focoman.com."
            : "Keep-alive ping sent to Brevo API successfully! 90-day inactivity timer refreshed.",
        });
        void load();
      } else {
        setPingResult({
          success: false,
          message: resData.error || "Keep-alive ping failed.",
        });
      }
    } catch {
      setPingResult({ success: false, message: "Network error triggering ping." });
    } finally {
      setPinging(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/dev/metrics", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { setData(null); router.refresh(); return; }
      if (!response.ok) throw new Error("Metrics could not be loaded.");
      setData(await response.json() as MetricsResponse);
    } catch { setData(null); setError("Metrics are unavailable. Check the connection and try again."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { if (authenticated) void load(); }, [authenticated, load]);

  async function signOut() {
    try {
      const response = await fetch("/api/dev-auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign out failed");
      setData(null); router.refresh();
    } catch { setError("Unable to sign out. Please try again."); }
  }
  if (!authenticated) return <SignIn />;

  const m = data?.metrics;
  const title = tabs.find(item => item.id === tab)?.name ?? "Overview";
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><div><FocomanLogo className={styles.brandLogo} showStudiosSuffix={false} variant="dark" /><small>DEV PORTAL / INTERNAL</small></div></div>
      <div className={styles.sideLabel}>WORKSPACE <span>01</span></div>
      <nav aria-label="Developer portal sections" className={styles.nav}>{tabs.map(item => <button key={item.id} className={tab === item.id ? styles.selected : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><item.icon size={17}/><span>{item.name}</span><span className={styles.arrow}>›</span></button>)}</nav>
      <div className={styles.sideBottom}><ShieldCheck size={16}/><div><b>{preview ? "Development preview" : "Private workspace"}</b><small>{preview ? "Password disabled" : "Aggregate data only"}</small></div></div>
      {!preview && <button className={styles.signOut} onClick={signOut}><LogOut size={15}/> Sign out</button>}
    </aside>
    <main className={styles.main}>
      <div className={styles.topbar}><div><span>FOCOMAN</span> / DEV PORTAL / {title.toUpperCase()}</div><button onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? styles.spin : ""}/> {loading ? "Refreshing" : "Refresh data"}</button></div>
      <div className={styles.content}>
        <div className={styles.heading}><div><p className={styles.eyebrow}>PLATFORM OPERATIONS / {String(tabs.findIndex(item => item.id === tab) + 1).padStart(2, "0")}</p><h1>{title}</h1><p>{tab === "overview" ? "A clear view of your Focoman workspace." : "Platform-wide visibility, without personal data."}</p></div><span className={styles.internal}>◈ &nbsp; INTERNAL ONLY</span></div>
        {preview && <div className={styles.callout} role="status">Development preview — password protection is disabled on this server.</div>}
        {error && <div className={styles.errorBanner} role="alert">{error}</div>}
        {(tab === "overview" || tab === "studios") && <>
          <div className={styles.sectionLabel}><span>PLATFORM SNAPSHOT</span><span>{data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleString("en-IN")}` : "No update available"}</span></div>
          <div className={styles.grid}>
            <MetricCard label="Studio records" value={m?.studioRecords} note="All stored records, including archived" />
            <MetricCard label="Customer records" value={m?.customerRecords} note="Studio CRM records; not unique people" />
            <MetricCard label="Order records" value={m?.orderRecords} note="All stored records, including archived" />
            <MetricCard label="New orders this month" value={m?.ordersThisMonth} note="Order creation date · UTC month" />
          </div>
          <div className={styles.sectionLabel}><span>PAYMENT RECORDS</span><span>COUNTS ONLY</span></div>
          <div className={styles.grid}><MetricCard label="Verified payments" value={m?.verifiedPaymentRecords} note="Recorded verification status" /><MetricCard label="Pending verification" value={m?.pendingPaymentRecords} note="Recorded verification status" /></div>
          <div className={styles.callout}><Activity size={18}/><div><b><span aria-hidden="true">🔒 </span>Thoughtful by design.</b><p>These are record counts, not active users or studio earnings. No customer identities are shown.</p></div></div>
        </>}
        {tab === "usage" && <><Placeholder title="Requests & activity" text="Usage metrics are not connected. Request volume, active studios, memory and per-studio usage need a reliable monitoring source."/><Placeholder title="Storage" text="Storage usage and limits are unavailable until a verified source is connected."/></>}
        {tab === "cloud" && <><Placeholder title="Google Cloud" text="Cloud usage, billing, budgets and limits are not connected. Configure a read-only monitoring and billing integration to view actual values."/><Placeholder title="AWS" text="No AWS cost integration is connected."/></>}
        {tab === "email" && <>
          {/* Brevo Provider Section */}
          <div className={styles.sectionLabel}>
            <span>BREVO EMAIL API (CAMPAIGNS & NOTIFICATIONS)</span>
            <span>{data?.emailProviders?.brevo?.account?.connected ? "CONNECTED (LIVE API)" : "UNAVAILABLE"}</span>
          </div>

          <div className={styles.grid}>
            <MetricCard
              label="Brevo Daily Limit"
              value={data?.emailProviders?.brevo?.account?.dailyCredits ?? 300}
              note="Daily outbound credits limit"
            />
            <MetricCard
              label="Sent Today"
              value={data?.emailProviders?.brevo?.stats?.requests ?? 0}
              note="Outbound requests today"
            />
            <MetricCard
              label="Delivered Today"
              value={data?.emailProviders?.brevo?.stats?.delivered ?? 0}
              note="Successfully delivered messages"
            />
            <MetricCard
              label="Inactivity Safety Window"
              value={data?.emailProviders?.brevo?.account?.daysRemainingUntilInactivity ?? 90}
              note="Days remaining until 90-day inactivity"
            />
          </div>

          <section className={styles.panel} style={{ marginTop: "16px" }}>
            <div className={styles.panelTitle}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Key size={16} /> Brevo API Key Metadata & Safety Controls
              </span>
              <span className={styles.badge}>
                {data?.emailProviders?.brevo?.account?.connected ? "ACTIVE KEY" : "DISCONNECTED"}
              </span>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", borderBottom: "1px solid #e6e0d4" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>ACCOUNT IDENTITY</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>
                  {data?.emailProviders?.brevo?.account?.email || "webmaster@focoman.com"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#a8a29e" }}>
                  {data?.emailProviders?.brevo?.account?.companyName || "Vealth Enterprises"}
                </p>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>KEY CREATION / EXPIRY</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>
                  Expires: {data?.emailProviders?.brevo?.account?.keyExpiryDate || "Nov 3, 2027"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#a8a29e" }}>
                  Created: {data?.emailProviders?.brevo?.account?.keyCreatedDate || "Nov 3, 2026"}
                </p>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>LAST API ACTIVITY</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>
                  {data?.emailProviders?.brevo?.account?.lastUsedAt
                    ? new Date(data.emailProviders.brevo.account.lastUsedAt).toLocaleString("en-IN")
                    : "No recorded ping"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a" }}>
                  {data?.emailProviders?.brevo?.account?.daysRemainingUntilInactivity ?? 90} days until inactivity limit
                </p>
              </div>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", background: "#faf7f2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <strong style={{ fontSize: "13px", color: "#1c1917", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={15} /> 90-Day Deactivation Safeguard
                  </strong>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#78716c" }}>
                    Brevo deactivates API keys if unused for 90 days. Triggering a keep-alive ping refreshes activity on Brevo&apos;s servers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerKeepAlive}
                  disabled={pinging || !data?.emailProviders?.brevo?.account?.configured}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#1c1917",
                    color: "white",
                    padding: "9px 16px",
                    borderRadius: "6px",
                    border: "1px solid #1c1917",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: pinging ? "not-allowed" : "pointer",
                    opacity: pinging ? 0.7 : 1,
                  }}
                >
                  <Send size={13} className={pinging ? styles.spin : ""} />
                  {pinging ? "Sending Ping…" : "Send Keep-Alive Ping"}
                </button>
              </div>

              {pingResult && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: pingResult.success ? "#f0fdf4" : "#fef2f2",
                    border: pingResult.success ? "1px solid #bbf7d0" : "1px solid #fecaca",
                    color: pingResult.success ? "#166534" : "#991b1b",
                  }}
                >
                  {pingResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{pingResult.message}</span>
                </div>
              )}
            </div>
          </section>

          {/* Resend Provider Section */}
          <div className={styles.sectionLabel} style={{ marginTop: "28px" }}>
            <span>RESEND EMAIL SERVICE (TRANSACTIONAL SENDS)</span>
            <span>{data?.emailProviders?.resend?.configured ? "ACTIVE (CONNECTED)" : "PENDING RESEND_API_KEY"}</span>
          </div>

          <div className={styles.grid}>
            <MetricCard
              label="Resend Daily Limit"
              value={data?.emailProviders?.resend?.account?.dailyLimit ?? 100}
              note="Transactional daily quota"
            />
            <MetricCard
              label="Monthly Allowance"
              value={data?.emailProviders?.resend?.account?.monthlyLimit ?? 3000}
              note="Monthly included emails"
            />
            <MetricCard
              label="Verified Domains"
              value={data?.emailProviders?.resend?.account?.domains?.length ?? 0}
              note="Domains configured on Resend"
            />
            <MetricCard
              label="Account Identity"
              value={1}
              note={data?.emailProviders?.resend?.account?.accountEmail || "webmaster@focoman.com"}
            />
          </div>

          <section className={styles.panel} style={{ marginTop: "16px" }}>
            <div className={styles.panelTitle}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Key size={16} /> Resend Transactional Configuration & Live Ping
              </span>
              <span className={styles.badge}>
                {data?.emailProviders?.resend?.configured ? "READY FOR SENDING" : "WAITING FOR KEY"}
              </span>
            </div>

            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", borderBottom: "1px solid #e6e0d4" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>OUTBOUND SENDER (FROM)</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>
                  {data?.emailProviders?.resend?.fromEmail || "Focoman <noreply@focoman.com>"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#a8a29e" }}>Automated system notifications</p>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>SUPPORT INBOX (REPLY-TO)</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>
                  {data?.emailProviders?.resend?.replyToEmail || "support@focoman.com"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a" }}>Routes directly to Zoho Mail Support</p>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>DOMAIN VERIFICATION</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>
                  {data?.emailProviders?.resend?.account?.domains?.[0]?.name || "focoman.com"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: data?.emailProviders?.resend?.account?.domains?.[0]?.status === "verified" ? "#16a34a" : "#d97706" }}>
                  Status: {data?.emailProviders?.resend?.account?.domains?.[0]?.status || "pending DNS setup"}
                </p>
              </div>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", background: "#faf7f2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <strong style={{ fontSize: "13px", color: "#1c1917", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Send size={15} /> Resend Transactional Diagnostics
                  </strong>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#78716c" }}>
                    Sends a live diagnostic test email to webmaster@focoman.com via Resend.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerResendPing}
                  disabled={resendPinging || !data?.emailProviders?.resend?.configured}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#1c1917",
                    color: "white",
                    padding: "9px 16px",
                    borderRadius: "6px",
                    border: "1px solid #1c1917",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: resendPinging ? "not-allowed" : "pointer",
                    opacity: resendPinging || !data?.emailProviders?.resend?.configured ? 0.6 : 1,
                  }}
                >
                  <Send size={13} className={resendPinging ? styles.spin : ""} />
                  {resendPinging ? "Sending Test…" : "Send Resend Test Email"}
                </button>
              </div>

              {resendPingResult && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: resendPingResult.success ? "#f0fdf4" : "#fef2f2",
                    border: resendPingResult.success ? "1px solid #bbf7d0" : "1px solid #fecaca",
                    color: resendPingResult.success ? "#166534" : "#991b1b",
                  }}
                >
                  {resendPingResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{resendPingResult.message}</span>
                </div>
              )}
            </div>
          </section>

          {/* Hostinger Domain Validity Section */}
          <div className={styles.sectionLabel} style={{ marginTop: "28px" }}>
            <span>HOSTINGER ROOT DOMAIN VALIDITY & EXPIRY SAFEGUARD</span>
            <span>{data?.domainExpiration?.status === "HEALTHY" ? "HEALTHY (3 YEARS REMAINING)" : "ATTENTION"}</span>
          </div>

          <div className={styles.grid}>
            <MetricCard
              label="Registered Domain"
              value={1}
              note={data?.domainExpiration?.domain || "focoman.com"}
            />
            <MetricCard
              label="Registrar"
              value={1}
              note={data?.domainExpiration?.registrar || "Hostinger"}
            />
            <MetricCard
              label="Days Remaining"
              value={data?.domainExpiration?.daysRemaining ?? 1094}
              note={`Expires: ${data?.domainExpiration?.expiryDate || "2029-11-02"}`}
            />
            <MetricCard
              label="Alert Schedule"
              value={6}
              note="Alerts at 60, 30, 15, 7, 3, 1 days"
            />
          </div>

          <section className={styles.panel} style={{ marginTop: "16px" }}>
            <div className={styles.panelTitle}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={16} /> Domain Expiration Alert Recipients & Protection Policy
              </span>
              <span className={styles.badge} style={{ color: "#16a34a", borderColor: "#bbf7d0", background: "#f0fdf4" }}>
                PROTECTED UNTIL 2029
              </span>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>ROOT OWNER (HOSTINGER ACCOUNT)</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>founder@focoman.com</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#a8a29e" }}>Company legal ownership</p>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>BACKUP RECOVERY EMAIL (ESSENTIAL)</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>sivakrishna.era@gmail.com</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#16a34a" }}>Emergency recovery if domain ever lapses</p>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#78716c", fontWeight: 700 }}>EXPIRATION WARNING THRESHOLDS</p>
                <strong style={{ fontSize: "13px", color: "#1c1917" }}>60, 30, 15, 7, 3, 1 Days</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#78716c" }}>Automated notification sent to all recipients</p>
              </div>
            </div>
          </section>
        </>}
        {tab === "whatsapp" && <Placeholder title="Meta WhatsApp" text="Message counts, delivery status and limits are not connected to this dashboard."/>}
        {tab === "deploy" && <Placeholder title="Repository & pipeline" text="Build, deployment and environment status are not connected to this dashboard."/>}
        {tab === "settings" && <><section className={styles.panel}><div className={styles.panelTitle}><span>Portal access</span><ShieldCheck size={16}/></div><p className={styles.empty}>This portal displays aggregate data only. Credentials and provider configuration are managed server-side and are not displayed here.</p></section><Placeholder title="Alerts & thresholds" text="Alert configuration is not connected. No settings can be changed from this portal."/></>}
      </div><div className={styles.footer}><span>FOCOMAN / DEV PORTAL</span><span>INTERNAL OPERATIONS</span></div>
    </main>
  </div>;
}
