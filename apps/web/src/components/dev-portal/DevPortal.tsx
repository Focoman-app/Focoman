"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Boxes, Cloud, GitBranch, LayoutDashboard, LogOut, Mail, MessageSquare, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
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
type MetricsResponse = { generatedAt: string; metrics: Metrics };
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

  return <div className={styles.loginShell}><div className={styles.loginCard}>
    <div className={styles.masthead}><FocomanLogo className={styles.loginLogo} showStudiosSuffix={false} /><span> INTERNAL PORTAL</span></div>
    <div className={styles.loginIcon}><ShieldCheck size={23} /></div>
    <p className={styles.eyebrow}>RESTRICTED ACCESS</p><h1>Dev Portal</h1>
    <p className={styles.description}>A private workspace for platform analytics and operations.</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="dev-password">Admin password</label>
      <input id="dev-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Unlock portal →"}</button>
    </form><p className={styles.loginFoot}>AUTHORISED PERSONNEL ONLY</p>
  </div></div>;
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
        {tab === "email" && <><Placeholder title="Resend" text="Delivery, bounce and quota data are not connected to this dashboard."/><Placeholder title="Brevo" text="Provider usage and limits are not connected to this dashboard."/></>}
        {tab === "whatsapp" && <Placeholder title="Meta WhatsApp" text="Message counts, delivery status and limits are not connected to this dashboard."/>}
        {tab === "deploy" && <Placeholder title="Repository & pipeline" text="Build, deployment and environment status are not connected to this dashboard."/>}
        {tab === "settings" && <><section className={styles.panel}><div className={styles.panelTitle}><span>Portal access</span><ShieldCheck size={16}/></div><p className={styles.empty}>This portal displays aggregate data only. Credentials and provider configuration are managed server-side and are not displayed here.</p></section><Placeholder title="Alerts & thresholds" text="Alert configuration is not connected. No settings can be changed from this portal."/></>}
      </div><div className={styles.footer}><span>FOCOMAN / DEV PORTAL</span><span>INTERNAL OPERATIONS</span></div>
    </main>
  </div>;
}
