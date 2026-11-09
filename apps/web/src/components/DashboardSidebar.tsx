"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FocomanLogo } from "@/components/FocomanLogo";
import { signOutUser, subscribeToAuthState } from "@/lib/firebaseAuth";
import { getUserWorkspacesAction } from "@/actions/studioActions";
import { getLocalDefaultWorkspace, subscribeToDefaultWorkspaceChanges } from "@/lib/workspaceDefaults";

export type Plan = "basic" | "professional" | "complete";

export interface WorkspaceItem {
  studioId: string;
  studioName: string;
  role: "STUDIO_OWNER" | "STUDIO_MEMBER";
  logoUrl?: string;
}

export interface DashboardSidebarProps {
  studioSlug: string;
  role: "STUDIO_OWNER" | "STUDIO_MEMBER";
  plan: Plan;
  studioName: string;
  studioLogoUrl?: string;
  ownerName?: string;
  features?: {
    oms: boolean;
    crm: boolean;
    erp: boolean;
    whatsapp: boolean;
    marketplace: boolean;
    reports?: boolean;
  };
  appEnv?: string;
  workspaces?: WorkspaceItem[];
}

const ACTIVE_NAV_CLASS = "bg-[#242932] text-slate-200 border border-slate-700/60 font-medium shadow-2xs";
const INACTIVE_NAV_CLASS = "text-slate-400 hover:text-slate-200 hover:bg-[#22262E] border border-transparent transition-colors";

export function DashboardSidebar({ studioSlug, role, plan, studioName, studioLogoUrl, ownerName, features, appEnv, workspaces }: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspacesList, setWorkspacesList] = useState<WorkspaceItem[]>(workspaces || []);
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [defaultStudioId, setDefaultStudioId] = useState<string | null>(null);
  const switchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubEvents: (() => void) | undefined;
    const unsub = subscribeToAuthState(async (user) => {
      if (unsubEvents) unsubEvents();
      if (user) {
        const { studioId } = getLocalDefaultWorkspace(user.uid);
        if (studioId) {
          setDefaultStudioId(studioId);
        } else if (workspacesList.length > 0) {
          setDefaultStudioId(workspacesList[0].studioId);
        } else {
          setDefaultStudioId(null);
        }

        unsubEvents = subscribeToDefaultWorkspaceChanges(user.uid, (newDefault) => {
          setDefaultStudioId(newDefault);
        });
      }
    });
    return () => {
      unsub();
      if (unsubEvents) unsubEvents();
    };
  }, [workspacesList]);

  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      setWorkspacesList(workspaces);
      return;
    }
    const unsub = subscribeToAuthState(async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          const data = await getUserWorkspacesAction(token);
          if (data && data.length > 0) {
            setWorkspacesList(
              data.map((w) => ({
                studioId: w.studioId,
                studioName: w.studioName,
                role: w.role,
              }))
            );
          }
        } catch {
          // ignore
        }
      }
    });
    return () => unsub();
  }, [workspaces]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) {
        setIsSwitchOpen(false);
      }
    }
    if (isSwitchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSwitchOpen]);

  const navItems = [
    {
      label: "Dashboard",
      sublabel: undefined,
      key: "dashboard",
      href: (slug: string) => `/${slug}/dashboard`,
      module: null as null,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: "Order Management",
      sublabel: "OMS",
      key: "oms",
      href: (slug: string) => `/${slug}/dashboard/oms`,
      module: "oms" as const,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: "Customer Relations",
      sublabel: "CRM",
      key: "crm",
      href: (slug: string) => `/${slug}/dashboard/crm`,
      module: "crm" as const,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Studio Operations",
      sublabel: "ERP",
      key: "erp",
      href: (slug: string) => `/${slug}/dashboard/erp`,
      module: "erp" as const,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: "WhatsApp",
      sublabel: "Notifications",
      key: "whatsapp",
      href: (slug: string) => `/${slug}/dashboard/whatsapp`,
      module: "whatsapp" as const,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      label: "Studio Marketplace",
      sublabel: "Public Profile",
      key: "marketplace",
      href: (slug: string) => `/${slug}/dashboard/marketplace`,
      module: "marketplace" as const,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: "Business Reports",
      sublabel: "Analytics",
      key: "reports",
      href: (slug: string) => `/${slug}/dashboard/reports`,
      module: "reports" as const,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: "Services & Packages",
      sublabel: "Catalog & Pricing",
      key: "services",
      href: (slug: string) => `/${slug}/dashboard/services`,
      module: null as null,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: "Studio Settings",
      sublabel: "Preferences & Workspace",
      key: "settings",
      href: (slug: string) => `/${slug}/dashboard/settings`,
      module: null as null,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const visibleNavItems = role === "STUDIO_MEMBER"
    ? [
        ...navItems
          .filter((item) => item.key === "dashboard")
          .map((item) => ({ ...item, label: "My Orders", sublabel: "Assigned Work" })),
        ...navItems.filter((item) => item.key === "settings"),
      ]
    : plan === "basic"
    ? navItems.filter((item) => item.key !== "dashboard")
    : navItems;

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error("[DashboardSidebar] Sign out error:", err);
    }
    router.push("/");
  };

  const navContent = (onLinkClick?: () => void) => (
    <div className="flex h-full flex-col bg-[#181B20] text-slate-300">
      {/* Logo Header (In sync with dark side nav) */}
      <div className="flex items-center justify-between border-b border-[#262A32] bg-[#181B20] px-5 py-3.5 shrink-0">
        <Link href="/" className="flex items-center shrink-0" title="Focoman Home">
          <FocomanLogo className="h-8 sm:h-9 w-auto" showStudiosSuffix={true} variant="dark" />
        </Link>
        {onLinkClick && (
          <button
            onClick={onLinkClick}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#22262E] hover:text-slate-200 md:hidden transition"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Studio Info & Quick Switcher */}
      <div className="relative border-b border-[#262A32] px-4 py-2.5 bg-[#1C1F26]/60" ref={switchRef}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {studioLogoUrl ? (
              <img
                src={studioLogoUrl}
                alt={`${studioName} logo`}
                className="w-7 h-7 rounded-lg object-cover border border-white/10 shrink-0 bg-black/40"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                {studioName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate" title={studioName}>
                {studioName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    role === "STUDIO_OWNER"
                      ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                      : "bg-blue-400/10 text-blue-400 border border-blue-400/20"
                  }`}
                >
                  {role === "STUDIO_OWNER" ? "Owner" : "Member"}
                </span>
              </div>
            </div>
          </div>
          <button
            id="tour-sidebar-switch"
            type="button"
            onClick={() => setIsSwitchOpen((prev) => !prev)}
            className="flex items-center gap-1 rounded-lg bg-[#222731] hover:bg-[#2A303D] px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700/60 shadow-2xs transition shrink-0"
            title="Switch Studio Workspace"
          >
            <span>Switch</span>
            <svg
              className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                isSwitchOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Quick Switch Dropdown */}
        {isSwitchOpen && (
          <div className="absolute left-2 right-2 top-full mt-1.5 z-50 rounded-xl bg-[#181B21] border border-[#2F3542] shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#262B35] pb-1.5">
              <span>Your Studios</span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-0.5 py-0.5">
              {workspacesList.length > 0 ? (
                workspacesList.map((w) => {
                  const isCurrent = w.studioId.toLowerCase() === studioSlug.toLowerCase();
                  const isDefault = Boolean(defaultStudioId && w.studioId.toLowerCase() === defaultStudioId.toLowerCase());
                  return (
                    <button
                      key={w.studioId}
                      type="button"
                      onClick={() => {
                        setIsSwitchOpen(false);
                        if (!isCurrent) {
                          if (onLinkClick) onLinkClick();
                          router.push(`/${w.studioId}/dashboard`);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition ${
                        isCurrent
                          ? "bg-[#252B36] text-white font-bold border border-slate-600/50"
                          : "text-slate-300 hover:bg-[#20252E] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isCurrent
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "bg-slate-700/40 text-slate-400"
                          }`}
                        >
                          {w.studioName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-xs">{w.studioName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDefault && (
                          <span className="text-[9px] text-amber-300 bg-amber-400/10 border border-amber-400/25 px-1 py-0.2 rounded font-semibold uppercase tracking-wider" title="Default Workspace">
                            Default
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">
                          {w.role === "STUDIO_OWNER" ? "Owner" : "Member"}
                        </span>
                        {isCurrent && (
                          <span className="text-emerald-400 text-xs font-bold" title="Current studio">
                            ✓
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-2 text-center text-xs text-slate-400">
                  No other studios found
                </div>
              )}
            </div>

            <div className="border-t border-[#262B35] pt-1 mt-1 space-y-0.5">
              <Link
                href="/workspaces"
                onClick={() => {
                  setIsSwitchOpen(false);
                  if (onLinkClick) onLinkClick();
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-[#20252E] transition"
              >
                <span>Manage All Workspaces</span>
                <span>→</span>
              </Link>
              <Link
                href="/onboarding/register-studio"
                onClick={() => {
                  setIsSwitchOpen(false);
                  if (onLinkClick) onLinkClick();
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-950/30 transition"
              >
                <span>+ Register New Studio</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Nav Items (All modules enabled for all accounts, no restrictions) */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {visibleNavItems.map((item) => {
          const href = item.href(studioSlug);
          const isActive = pathname === href;

          return (
            <Link
              key={item.key}
              id={item.module ? `tour-nav-${item.module}` : "tour-nav-dashboard"}
              href={href}
              prefetch={true}
              onClick={onLinkClick}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                isActive ? ACTIVE_NAV_CLASS : INACTIVE_NAV_CLASS
              }`}
            >
              <span className={isActive ? "text-slate-200" : "text-slate-400 group-hover:text-slate-200 transition-colors"}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.label}</p>
                {item.sublabel && (
                  <p className={`text-[10px] ${isActive ? "text-slate-400" : "text-slate-500 group-hover:text-slate-400"}`}>
                    {item.sublabel}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Sign Out */}
      <div className="border-t border-[#262A32] px-3 py-3 flex flex-col gap-2">
        <button
          onClick={() => {
            if (onLinkClick) onLinkClick();
            void handleSignOut();
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-[#22262E] hover:text-red-400 border border-transparent text-left"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header (In sync with dark side nav) */}
      <div className="flex items-center justify-between border-b border-[#262A32] bg-[#181B20] px-3 sm:px-4 py-2.5 md:hidden shrink-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-[#22262E] transition"
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/" className="flex items-center shrink-0" title="Focoman Home">
            <FocomanLogo className="h-6 sm:h-7 w-auto shrink-0" showStudiosSuffix={true} variant="dark" />
          </Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[11px] sm:text-xs font-medium text-slate-200 max-w-[70px] sm:max-w-[120px] truncate" title={studioName}>
            {studioName}
          </span>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md bg-[#22262E] px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:text-slate-100 hover:bg-[#282D36] transition flex items-center gap-1"
            title="Switch Workspace"
          >
            <span>Switch</span>
            <span className="text-[8px] text-slate-400">▾</span>
          </button>
        </div>
      </div>

      {/* Mobile Slide-Out Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-72 max-w-[80vw] flex-1 flex-col shadow-2xl bg-[#181B20]">
            {navContent(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[#262A32] bg-[#181B20] md:flex">
        {navContent()}
      </aside>
    </>
  );
}
