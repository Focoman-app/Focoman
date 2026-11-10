"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { updateProfile } from "firebase/auth";
import { signOutUser } from "@/lib/firebaseAuth";
import {
  updateStudioAction,
  deleteStudioAction,
  leaveStudioAction,
  getUserWorkspacesAction,
  deleteUserAccountAction,
} from "@/actions/studioActions";
import { StudioMembership } from "@focoman/types";
import {
  setDefaultWorkspace,
  clearDefaultWorkspace,
  getLocalDefaultWorkspace,
  subscribeToDefaultWorkspaceChanges,
  resolveAndSyncDefaultWorkspace,
} from "@/lib/workspaceDefaults";

function SettingsPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studioSlug = (params.studioSlug as string) || "";
  const { studio, user, getIdToken } = useStudioWorkspace();

  const isOwner = studio.ownerId === user?.uid || studio.ownerEmail?.toLowerCase() === user?.email?.toLowerCase();

  // Tab State
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"studio" | "account">(
    tabParam === "account" ? "account" : "studio"
  );

  useEffect(() => {
    if (tabParam === "account") {
      setActiveTab("account");
    } else if (tabParam === "studio") {
      setActiveTab("studio");
    }
  }, [tabParam]);

  const handleTabSwitch = (tab: "studio" | "account") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "account") {
        url.searchParams.set("tab", "account");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // -------------------------------------------------------------
  // STUDIO SETTINGS STATE
  // -------------------------------------------------------------
  const [isDefaultStudio, setIsDefaultStudio] = useState(false);
  const [defaultToast, setDefaultToast] = useState<string | null>(null);

  const [name, setName] = useState(studio.name || "");
  const [city, setCity] = useState(studio.city || "");
  const [logoUrl, setLogoUrl] = useState(studio.logoUrl || "");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [website, setWebsite] = useState((studio.website || "").replace(/^https?:\/\//i, ""));
  const [instagram, setInstagram] = useState(studio.instagram || "");
  const [features, setFeatures] = useState(studio.features || {
    oms: true,
    crm: true,
    erp: true,
    whatsapp: true,
    marketplace: false,
    reports: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete / Leave Studio Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load default studio preference for current studio
  useEffect(() => {
    if (user && studioSlug) {
      const { studioId } = getLocalDefaultWorkspace(user.uid);
      setIsDefaultStudio(!!studioId && studioId.toLowerCase() === studioSlug.toLowerCase());

      const unsub = subscribeToDefaultWorkspaceChanges(user.uid, (newDefault) => {
        setIsDefaultStudio(!!newDefault && newDefault.toLowerCase() === studioSlug.toLowerCase());
      });
      return () => unsub();
    }
  }, [user, studioSlug]);

  const handleSetDefaultStudio = async () => {
    if (!user || !studioSlug) return;
    setIsDefaultStudio(true);
    const token = await getIdToken();
    await setDefaultWorkspace(user.uid, studioSlug, token || undefined);
    setDefaultToast(`"/${studioSlug}" is now set as your default studio workspace.`);
    setTimeout(() => setDefaultToast(null), 4000);
  };

  const handleClearDefaultStudio = async () => {
    if (!user) return;
    setIsDefaultStudio(false);
    const token = await getIdToken();
    await clearDefaultWorkspace(user.uid, token || undefined);
    setDefaultToast("Default workspace setting cleared.");
    setTimeout(() => setDefaultToast(null), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Please select a valid image file (PNG, JPG, WebP, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo image size must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setLogoUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    setLogoError(null);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication token unavailable.");

      const cleanWebsite = website.trim().replace(/^https?:\/\//i, "");
      const formattedWebsite = cleanWebsite ? `https://${cleanWebsite}` : "";

      const res = await updateStudioAction({
        studioSlug,
        updates: {
          name,
          city,
          logoUrl,
          website: formattedWebsite,
          instagram,
          features,
        },
        idToken: token,
      });

      if (res.success) {
        setSaveSuccess(true);
        router.refresh();
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(res.error || "Failed to update studio settings.");
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "An error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteOrLeave = async () => {
    if (!user || !studioSlug) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication token unavailable.");

      let res;
      if (isOwner) {
        res = await deleteStudioAction(studioSlug, token);
      } else {
        res = await leaveStudioAction(studioSlug, token);
      }

      if (!res.success) {
        setDeleteError(res.error || "Failed to process request.");
        setIsDeleting(false);
        return;
      }

      const { studioId } = getLocalDefaultWorkspace(user.uid);
      if (studioId?.toLowerCase() === studioSlug.toLowerCase()) {
        await clearDefaultWorkspace(user.uid, token || undefined);
      }

      router.push("/workspaces");
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred during deletion.");
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------
  // ACCOUNT SETTINGS STATE
  // -------------------------------------------------------------
  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameSaveLoading, setNameSaveLoading] = useState(false);
  const [nameSaveSuccess, setNameSaveSuccess] = useState(false);

  const [workspaces, setWorkspaces] = useState<StudioMembership[]>([]);
  const [defaultStudioId, setDefaultStudioId] = useState<string | null>(null);
  const [selectedDefaultStudio, setSelectedDefaultStudio] = useState<string>(studioSlug);
  const [defaultSaveLoading, setDefaultSaveLoading] = useState(false);
  const [defaultSaveSuccess, setDefaultSaveSuccess] = useState(false);

  // Delete Account State
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountInput, setDeleteAccountInput] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayNameInput(user.displayName || "");
    let mounted = true;
    getIdToken().then(async (token) => {
      if (!token || !mounted) return;
      try {
        const list = await getUserWorkspacesAction(token);
        if (mounted && list) {
          setWorkspaces(list);
          const initialDefault = await resolveAndSyncDefaultWorkspace(user.uid, list, token);
          setDefaultStudioId(initialDefault);
          if (initialDefault) {
            setSelectedDefaultStudio(initialDefault);
          } else if (list.length > 0) {
            setSelectedDefaultStudio(list[0].studioId);
          }
        }
      } catch (e) {
        console.warn("Failed to load user workspaces:", e);
      }
    });
    return () => {
      mounted = false;
    };
  }, [user, getIdToken]);

  const handleSaveName = async () => {
    if (!user || !displayNameInput.trim()) return;
    setNameSaveLoading(true);
    setNameSaveSuccess(false);
    try {
      await updateProfile(user, { displayName: displayNameInput.trim() });
      setNameSaveSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile name:", err);
    } finally {
      setNameSaveLoading(false);
    }
  };

  const handleSaveDefaultWorkspace = async () => {
    if (!user || !selectedDefaultStudio) return;
    setDefaultSaveLoading(true);
    setDefaultSaveSuccess(false);
    try {
      const token = await getIdToken();
      await setDefaultWorkspace(user.uid, selectedDefaultStudio, token || undefined);
      setDefaultStudioId(selectedDefaultStudio);
      setDefaultSaveSuccess(true);
      setTimeout(() => setDefaultSaveSuccess(false), 2500);
    } finally {
      setDefaultSaveLoading(false);
    }
  };

  const handleClearDefaultWorkspace = async () => {
    if (!user) return;
    setDefaultSaveLoading(true);
    try {
      const token = await getIdToken();
      await clearDefaultWorkspace(user.uid, token || undefined);
      setDefaultStudioId(null);
    } finally {
      setDefaultSaveLoading(false);
    }
  };

  const handleSignOutUser = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error("[Settings] Sign out error:", err);
    }
    router.push("/");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteAccountInput.trim().toLowerCase() !== "delete") return;
    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication token unavailable.");
      const res = await deleteUserAccountAction(token);
      if (res.success) {
        if (typeof window !== "undefined") {
          try {
            Object.keys(localStorage).forEach((key) => {
              if (key.startsWith("focoman_")) {
                localStorage.removeItem(key);
              }
            });
          } catch (e) {
            console.warn("[handleDeleteAccount] Failed to clear local storage:", e);
          }
        }
        await signOutUser();
        router.replace("/sign-in?deleted=true");
      } else {
        setDeleteAccountError(res.error || "Failed to delete account. Please try again.");
        setIsDeletingAccount(false);
      }
    } catch (err: unknown) {
      setDeleteAccountError(err instanceof Error ? err.message : "Failed to delete account. Please try again.");
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-divider pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-blue-primary">
              Settings &amp; Preferences
            </span>
            <span className="font-mono text-xs text-text-tertiary bg-slate-100 px-2 py-0.5 rounded-md">
              /{studioSlug}
            </span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-text-primary">
            Settings
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            Configure studio preferences, services catalog, operational capabilities, and account settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workspaces"
            className="rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-app transition"
          >
            ← All Workspaces
          </Link>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border-default gap-3">
        <button
          type="button"
          onClick={() => handleTabSwitch("studio")}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "studio"
              ? "border-brand-blue-primary text-brand-blue-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span>Studio Settings</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("account")}
          className={`pb-3 px-3 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === "account"
              ? "border-brand-blue-primary text-brand-blue-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>Account Settings</span>
        </button>
      </div>

      {defaultToast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-900 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-600">✓</span>
            <span>{defaultToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setDefaultToast(null)}
            className="text-emerald-800 font-bold hover:text-emerald-950 px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: STUDIO SETTINGS                                    */}
      {/* ========================================================= */}
      {activeTab === "studio" && (
        <div className="space-y-8">
          {/* 1. Default Studio Workspace Preference */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary">Default Workspace Routing</h2>
                  {isDefaultStudio && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                      Default Active
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-secondary max-w-xl leading-relaxed">
                  When set as default, entering <strong className="text-text-primary">/dashboard</strong> directly or opening Focoman will launch this studio automatically.
                </p>
              </div>

              <div>
                {isDefaultStudio ? (
                  <button
                    type="button"
                    onClick={handleClearDefaultStudio}
                    className="rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition cursor-pointer"
                  >
                    Clear Default
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSetDefaultStudio}
                    className="rounded-xl bg-brand-blue-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition shadow-xs cursor-pointer"
                  >
                    Set as Default Studio
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Services & Packages Catalog Section (OMS & Marketplace badge removed) */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary">Services &amp; Packages Catalog</h2>
                </div>
                <p className="mt-1 text-xs text-text-secondary max-w-xl leading-relaxed">
                  Configure the photography &amp; videography services your studio provides, set base prices for automatic calculations, and create package combos for orders.
                </p>
              </div>

              <div>
                <Link
                  href={`/${studioSlug}/dashboard/services`}
                  className="rounded-xl bg-brand-blue-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-xs inline-flex items-center gap-1.5"
                >
                  Configure Services &amp; Packages →
                </Link>
              </div>
            </div>
          </div>

          {/* 3. Studio Profile & Identity (Owner Only) */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-text-primary">Studio Profile &amp; Identity</h2>
              <p className="mt-1 text-xs text-text-secondary">
                Basic information displayed on invoices, client contracts, and WhatsApp templates.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Studio Logo Upload */}
              <div className="rounded-2xl border border-border-default bg-surface-app/40 p-4 sm:p-5">
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Studio Logo (Optional)
                </label>
                <p className="text-[11px] text-text-secondary mb-3">
                  Displayed near your studio name in the dashboard panel and public marketplace listings.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  {logoUrl ? (
                    <div className="relative group">
                      <img
                        src={logoUrl}
                        alt="Studio Logo Preview"
                        className="w-16 h-16 rounded-2xl object-cover border border-border-default shadow-xs bg-white"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-brand-blue-background border border-dashed border-brand-blue-light flex items-center justify-center text-brand-blue-primary font-extrabold text-xl">
                      {name ? name.charAt(0).toUpperCase() : "S"}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-slate-50 transition shadow-2xs">
                        <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>{logoUrl ? "Change Logo" : "Upload Logo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={!isOwner || isSaving}
                          className="hidden"
                        />
                      </label>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          disabled={!isOwner || isSaving}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-text-tertiary">
                      PNG, JPG, WebP, or SVG up to 2MB. Square ratio recommended.
                    </p>
                    {logoError && (
                      <p className="text-[11px] font-semibold text-red-600 mt-1">{logoError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-text-primary">Studio Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isOwner || isSaving}
                    className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary disabled:bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary">Operating City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={!isOwner || isSaving}
                    className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary disabled:bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary">Website (Optional)</label>
                  <div className="mt-1 flex rounded-xl border border-border-default bg-white overflow-hidden focus-within:border-brand-blue-primary focus-within:ring-1 focus-within:ring-brand-blue-primary">
                    <span className="inline-flex items-center px-3 bg-slate-50 text-text-muted text-xs font-medium border-r border-border-default select-none">
                      https://
                    </span>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value.replace(/^https?:\/\//i, ""))}
                      disabled={!isOwner || isSaving}
                      placeholder="yourstudio.com"
                      className="w-full px-3.5 py-2.5 text-xs text-text-primary outline-none bg-transparent disabled:bg-slate-50 placeholder:text-text-muted"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary">Instagram Handle (Optional)</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    disabled={!isOwner || isSaving}
                    placeholder="@yourstudio"
                    className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary disabled:bg-slate-50"
                  />
                </div>
              </div>

              {/* Operational Modules & Capabilities (Including Studio Marketplace) */}
              <div className="pt-4 border-t border-border-divider space-y-3">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Operational Modules &amp; Capabilities
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { key: "oms", label: "OMS (Order Management)", desc: "Pipelines, deliverables, drive sync" },
                    { key: "crm", label: "CRM (Customer Relations)", desc: "Clients, inquiries, contracts" },
                    { key: "erp", label: "ERP (Crew Operations)", desc: "Crew scheduling, equipment, tasks" },
                    { key: "whatsapp", label: "WhatsApp Alerts", desc: "Automated event alerts & updates" },
                    { key: "reports", label: "Business Reports", desc: "Financial analytics and trends" },
                    { key: "marketplace", label: "Studio Marketplace", desc: "Public profile, portfolio packages & inquiries" },
                  ].map((mod) => (
                    <label
                      key={mod.key}
                      className={`flex flex-col justify-between p-3.5 rounded-2xl border transition cursor-pointer ${
                        features[mod.key as keyof typeof features]
                          ? "border-brand-blue-primary/40 bg-sky-50/50"
                          : "border-border-default bg-surface-app"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-text-primary">{mod.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(features[mod.key as keyof typeof features])}
                          onChange={(e) =>
                            setFeatures({
                              ...features,
                              [mod.key]: e.target.checked,
                            })
                          }
                          disabled={!isOwner || isSaving}
                          className="mt-0.5 rounded text-brand-blue-primary focus:ring-brand-blue-primary"
                        />
                      </div>
                      <span className="text-[11px] text-text-secondary mt-1">{mod.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {saveSuccess && (
                <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  ✓ Studio settings updated successfully.
                </p>
              )}

              {saveError && (
                <p className="text-xs font-semibold text-status-error bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {saveError}
                </p>
              )}

              {isOwner && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-brand-blue-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? "Saving Settings..." : "Save Studio Settings"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* 4. Danger Zone: Delete Studio (Owner) or Leave Studio (Member) */}
          <div className="rounded-3xl border border-red-200 bg-red-50/40 p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-red-950">
                  {isOwner ? "Delete Studio Workspace" : "Leave Studio Workspace"}
                </h2>
                <p className="mt-1 text-xs text-red-900/80 max-w-xl leading-relaxed">
                  {isOwner
                    ? "Permanently delete this studio workspace, associated tasks, order registries, and team memberships."
                    : "Remove your access to this studio workspace. You will need a new invite code to rejoin."}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setDeleteError(null);
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs cursor-pointer"
                >
                  {isOwner ? "Delete Studio..." : "Leave Studio..."}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ACCOUNT SETTINGS                                   */}
      {/* ========================================================= */}
      {activeTab === "account" && (
        <div className="space-y-8">
          {/* 1. Personal Profile */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-divider pb-6">
              <div>
                <h2 className="text-base font-bold text-text-primary">Personal Profile</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  Your identity across all studio workspaces in Focoman.
                </p>
              </div>
              <div className="h-12 w-12 flex-shrink-0 rounded-2xl bg-brand-blue-primary text-white flex items-center justify-center text-lg font-bold shadow-xs">
                {user?.displayName
                  ? user.displayName.charAt(0).toUpperCase()
                  : user?.email
                  ? user.email.charAt(0).toUpperCase()
                  : "U"}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Full Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-primary">Display Name</label>
                  {!isEditingName ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="text-[11px] font-bold text-brand-blue-primary hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingName(false);
                        setDisplayNameInput(user?.displayName || "");
                      }}
                      className="text-[11px] font-semibold text-text-tertiary hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      className="w-full rounded-xl border border-brand-blue-primary px-3.5 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
                      placeholder="Your full name"
                    />
                    <button
                      type="button"
                      disabled={nameSaveLoading}
                      onClick={handleSaveName}
                      className="rounded-xl bg-brand-blue-primary px-4 py-2 text-xs font-bold text-white hover:bg-brand-blue-hover transition shrink-0 cursor-pointer"
                    >
                      {nameSaveLoading ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <div className="w-full rounded-xl border border-border-default bg-surface-app px-4 py-2 text-xs font-medium text-text-primary flex items-center justify-between">
                    <span>{user?.displayName || "Not provided"}</span>
                    {nameSaveSuccess && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Updated
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-primary">Email Address</label>
                  {user?.emailVerified && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Verified
                    </span>
                  )}
                </div>
                <div className="w-full rounded-xl border border-border-default bg-surface-app px-4 py-2 text-xs font-medium text-text-primary">
                  {user?.email || "—"}
                </div>
              </div>

              {/* User UID */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-text-secondary">Account Identifier (UID)</label>
                <div className="mt-1 font-mono text-[11px] text-text-tertiary bg-surface-app p-2.5 rounded-xl border border-border-default select-all truncate">
                  {user?.uid || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Global Default Workspace Selector */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">Primary Default Workspace</h2>
                {defaultStudioId && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800">
                    Active Default: /{defaultStudioId}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Choose which studio workspace opens automatically when you navigate to /dashboard or launch Focoman.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-text-primary">Active Selection</span>
                <span className="text-text-secondary text-[11px] block mt-0.5">
                  {defaultStudioId
                    ? `Currently configured to open "/${defaultStudioId}".`
                    : "No workspace currently designated as your default."}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {workspaces.length > 0 ? (
                  <>
                    <select
                      value={selectedDefaultStudio || (defaultStudioId || workspaces[0]?.studioId || "")}
                      onChange={(e) => setSelectedDefaultStudio(e.target.value)}
                      className="rounded-xl border border-brand-blue-primary/40 bg-white px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand-blue-primary shrink-0 cursor-pointer"
                    >
                      {workspaces.map((w) => (
                        <option key={w.studioId} value={w.studioId}>
                          {w.studioName || w.studioId} (/{w.studioId})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleSaveDefaultWorkspace}
                      disabled={
                        defaultSaveLoading ||
                        !selectedDefaultStudio ||
                        selectedDefaultStudio === defaultStudioId
                      }
                      className="rounded-xl bg-brand-blue-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-blue-hover transition cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {defaultSaveLoading ? "Saving..." : defaultSaveSuccess ? "Saved ✓" : "Set Default"}
                    </button>

                    {defaultStudioId && (
                      <button
                        type="button"
                        onClick={handleClearDefaultWorkspace}
                        disabled={defaultSaveLoading}
                        className="rounded-xl border border-border-default bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-secondary hover:text-red-600 hover:border-red-200 transition cursor-pointer shadow-2xs"
                      >
                        Clear
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-text-tertiary text-[11px]">No workspaces found</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Session & Sign Out */}
          <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-text-primary">Sign Out Session</h2>
                <p className="mt-1 text-xs text-text-secondary max-w-xl leading-relaxed">
                  Sign out of your active Focoman account session on this device.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleSignOutUser}
                  className="rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* 4. Danger Zone: Close Account */}
          <div className="rounded-3xl border border-red-200 bg-red-50/40 p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-red-950">Close Account</h2>
                <p className="mt-1 text-xs text-red-900/80 max-w-xl leading-relaxed">
                  Close this account. Sole-owner workspaces remain recoverable for 30 days under the Privacy Policy.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAccountModal(true);
                    setDeleteAccountError(null);
                    setDeleteAccountInput("");
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs cursor-pointer"
                >
                  Close Account...
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete / Leave Studio */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-text-primary">
              {isOwner ? "Confirm Studio Deletion" : "Confirm Leave Workspace"}
            </h3>

            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              {isOwner ? (
                <>
                  Are you sure you want to close <span className="font-bold text-text-primary">{name || studioSlug}</span> (<span className="font-mono">/{studioSlug}</span>)? It removes access for members and remains recoverable for 30 days.
                </>
              ) : (
                <>
                  Are you sure you want to leave <span className="font-bold text-text-primary">{name || studioSlug}</span>? You will lose access immediately.
                </>
              )}
            </p>

            {isOwner && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 leading-tight">This workspace remains recoverable for 30 days. Its identifier cannot be reused during that period.</div>}

            {deleteError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="w-full sm:w-auto rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrLeave}
                disabled={isDeleting}
                className="w-full sm:w-auto rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </>
                ) : isOwner ? (
                  "Yes, Delete Studio"
                ) : (
                  "Yes, Leave Studio"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Close Account */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default animate-in fade-in duration-150">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-text-primary">
              Close Account
            </h3>

            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              This action signs you out and starts the 30-day recovery period for sole-owner workspaces. Contact support through the Privacy Policy if restoration is needed during that period.
            </p>

            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-3.5 space-y-2">
              <label className="block text-[11px] font-bold text-red-950">
                To confirm, type <span className="font-mono text-red-600 font-extrabold">&quot;delete&quot;</span>:
              </label>
              <input
                type="text"
                value={deleteAccountInput}
                onChange={(e) => setDeleteAccountInput(e.target.value)}
                placeholder='Type "delete" to confirm'
                disabled={isDeletingAccount}
                className="w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-red-500"
              />
            </div>

            {deleteAccountError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {deleteAccountError}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteAccountError(null);
                }}
                disabled={isDeletingAccount}
                className="w-full sm:w-auto rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteAccountInput.trim().toLowerCase() !== "delete" || isDeletingAccount}
                className="w-full sm:w-auto rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingAccount ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting Account...
                  </>
                ) : (
                  "Close Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudioSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 max-w-4xl">
          <div className="h-6 w-32 bg-slate-200 animate-pulse rounded-md mb-4" />
          <div className="h-10 w-48 bg-slate-200 animate-pulse rounded-md" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
