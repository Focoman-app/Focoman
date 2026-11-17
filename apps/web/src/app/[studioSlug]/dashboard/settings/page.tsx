"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import {
  updateStudioAction,
  deleteStudioAction,
  leaveStudioAction,
} from "@/actions/studioActions";
import { StudioMember } from "@focoman/types";
import { getStudioMembersAction } from "@/actions/memberActions";
import { DEFAULT_STUDIO_SERVICES } from "@/lib/studioServices";
import { getSkillLabel, isSkillRelatedToService } from "@/lib/crewSkills";
import { buildAutoAssignRoster } from "@/lib/autoAssignCrew";
import {
  setDefaultWorkspace,
  clearDefaultWorkspace,
  getLocalDefaultWorkspace,
  subscribeToDefaultWorkspaceChanges,
} from "@/lib/workspaceDefaults";
import { getEffectiveStudioFeatures, getEffectiveStudioTier } from "@/lib/proEntitlements";

function SettingsPageContent() {
  const params = useParams();
  const router = useRouter();
  const studioSlug = (params.studioSlug as string) || "";
  const { studio, user, getIdToken } = useStudioWorkspace();

  const isOwner = studio.ownerId === user?.uid || studio.ownerEmail?.toLowerCase() === user?.email?.toLowerCase();
  const effectiveTier = getEffectiveStudioTier(studio);
  const effectiveFeatures = getEffectiveStudioFeatures(studio.ownerEmail, studio.features, studio.planInfo);

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState<boolean>(
    studio.features?.autoAssignCrew !== false
  );
  const [togglingAutoAssign, setTogglingAutoAssign] = useState(false);
  const [autoAssignNotice, setAutoAssignNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [crewMembers, setCrewMembers] = useState<StudioMember[]>([]);
  const [loadingCrewRoster, setLoadingCrewRoster] = useState(false);
  const [serviceCrewMapping, setServiceCrewMapping] = useState<Record<string, string[]>>(
    studio.serviceCrewMapping || {}
  );
  const [savingCrewMapping, setSavingCrewMapping] = useState(false);
  const [crewMappingNotice, setCrewMappingNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete / Leave Studio Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [instantDelete, setInstantDelete] = useState(false);
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

  useEffect(() => {
    if (studio?.features?.autoAssignCrew !== undefined) {
      setAutoAssignEnabled(Boolean(studio.features.autoAssignCrew));
    }
  }, [studio?.features?.autoAssignCrew]);

  useEffect(() => {
    setServiceCrewMapping(studio?.serviceCrewMapping || {});
  }, [studio?.serviceCrewMapping]);

  useEffect(() => {
    let active = true;
    if (!isOwner || !studioSlug || studio.features?.erp === false) return;
    setLoadingCrewRoster(true);
    void (async () => {
      try {
        const token = await getIdToken(false);
        if (!token || !active) return;
        const members = await getStudioMembersAction(studioSlug, token);
        if (active) {
          setCrewMembers(members || []);
        }
      } catch (err) {
        console.error("[SettingsPage] Failed to load crew roster:", err);
      } finally {
        if (active) setLoadingCrewRoster(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOwner, studioSlug, studio.features?.erp, getIdToken]);

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
    if (!isOwner) return;
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
      if (!result) return;
      if (file.type === "image/svg+xml" || result.length <= 250_000) {
        setLogoUrl(result);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim));
        const width = Math.max(1, Math.round((img.width || maxDim) * scale));
        const height = Math.max(1, Math.round((img.height || maxDim) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setLogoUrl(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        setLogoUrl(canvas.toDataURL("image/webp", 0.85));
      };
      img.onerror = () => {
        setLogoError("Could not process the selected image file.");
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (!isOwner) return;
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

  const handleToggleAutoAssignCrew = async () => {
    if (!isOwner) return;
    setTogglingAutoAssign(true);
    setAutoAssignNotice(null);
    try {
      const token = await getIdToken(true);
      if (!token) throw new Error("Authentication token unavailable.");
      const nextVal = !autoAssignEnabled;
      const res = await updateStudioAction({
        studioSlug,
        updates: {
          features: {
            ...(studio.features || { oms: true, crm: true, erp: true, whatsapp: true }),
            autoAssignCrew: nextVal,
            autoAssignCrewConfigured: true,
          },
        },
        idToken: token,
      });
      if (res.success) {
        setAutoAssignEnabled(nextVal);
        setAutoAssignNotice({
          type: "success",
          text: nextVal
            ? "Auto-Assign Crew enabled: New orders will automatically assign available skill-matched crew."
            : "Auto-Assign Crew disabled: Crew assignments will remain manual.",
        });
        router.refresh();
        setTimeout(() => setAutoAssignNotice(null), 4000);
      } else {
        setAutoAssignNotice({
          type: "error",
          text: res.error || "Failed to update crew assignment setting.",
        });
      }
    } catch (err: unknown) {
      setAutoAssignNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update crew assignment setting.",
      });
    } finally {
      setTogglingAutoAssign(false);
    }
  };

  const toggleServiceCrewMember = (serviceName: string, memberId: string) => {
    setServiceCrewMapping((prev) => {
      const current = Array.isArray(prev[serviceName]) ? prev[serviceName] : [];
      const next = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [serviceName]: next };
    });
  };

  const handleSaveServiceCrewMapping = async () => {
    if (!isOwner) return;
    setSavingCrewMapping(true);
    setCrewMappingNotice(null);
    try {
      const token = await getIdToken(true);
      if (!token) throw new Error("Authentication token unavailable.");
      const res = await updateStudioAction({
        studioSlug,
        updates: { serviceCrewMapping },
        idToken: token,
      });
      if (res.success) {
        setCrewMappingNotice({
          type: "success",
          text: "Service-to-crew auto-assignment mapping saved.",
        });
        router.refresh();
        setTimeout(() => setCrewMappingNotice(null), 4000);
      } else {
        setCrewMappingNotice({
          type: "error",
          text: res.error || "Failed to save crew mapping.",
        });
      }
    } catch (err: unknown) {
      setCrewMappingNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save crew mapping.",
      });
    } finally {
      setSavingCrewMapping(false);
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
        res = await deleteStudioAction(studioSlug, token, { permanent: instantDelete });
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

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col items-center gap-4 border-b border-border-divider pb-6 text-center">
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
            Studio Settings
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            Configure studio preferences, services catalog, and plan information.
          </p>
        </div>

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

      <div className="flex flex-col gap-8">
          {/* 1. Default Studio Workspace Preference */}
          <div className="order-3 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary">Default Workspace Information</h2>
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

          {/* 2. Services & Packages Catalog Section */}
          <div className="order-2 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
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

          {/* 2b. Workflow Automation (Owner Only, when ERP enabled) */}
          {isOwner && studio.features?.erp !== false && (
            <div className="order-3 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-text-primary">Workflow Automation</h2>
                  <p className="mt-1 text-xs text-text-secondary max-w-xl leading-relaxed">
                    Automatically assign available skill-matched crew members when confirming new orders (falls back to manual assignment if busy).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={togglingAutoAssign}
                  onClick={() => void handleToggleAutoAssignCrew()}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-2xs shrink-0 cursor-pointer disabled:opacity-50 ${
                    autoAssignEnabled
                      ? "bg-brand-purple-primary text-white hover:opacity-90"
                      : "border border-border-default bg-white text-text-secondary hover:text-text-primary hover:bg-surface-app"
                  }`}
                >
                  {togglingAutoAssign
                    ? "Updating..."
                    : autoAssignEnabled
                    ? "Auto-Assign Crew: ON"
                    : "Auto-Assign Crew: OFF"}
                </button>
              </div>
              {autoAssignNotice && (
                <p
                  className={`text-xs font-semibold p-2.5 rounded-xl border ${
                    autoAssignNotice.type === "success"
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-status-error bg-red-50 border-red-200"
                  }`}
                >
                  {autoAssignNotice.text}
                </p>
              )}

              {/* Service-to-Crew Auto-Assign Mapping (Unified Panel with Bottom Save) */}
              <div className="pt-4 border-t border-border-divider space-y-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                    Service-to-Crew Mapping
                  </h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Map one or multiple crew members to each catalog service. Select your crew across the services below and save your mapping at the bottom.
                  </p>
                </div>

                {loadingCrewRoster ? (
                  <p className="text-xs text-text-tertiary py-2">Loading crew roster...</p>
                ) : (
                  <div className="rounded-2xl border border-border-default bg-surface-app/40 overflow-hidden">
                    <div className="divide-y divide-border-divider">
                      {(studio.configuredServices && studio.configuredServices.length > 0
                        ? studio.configuredServices
                        : DEFAULT_STUDIO_SERVICES
                      )
                        .filter((svc) => svc.enabled !== false)
                        .map((svc) => {
                          const roster = buildAutoAssignRoster(studio, studioSlug, crewMembers);
                          const selectedIds = serviceCrewMapping[svc.name] || [];
                          return (
                            <div key={svc.id} className="p-4 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-bold text-text-primary">{svc.name}</p>
                                  <p className="text-[11px] text-text-tertiary">{svc.category}</p>
                                </div>
                                <span className="text-[10px] font-bold text-brand-purple-primary bg-brand-purple-background/60 px-2 py-0.5 rounded-full">
                                  {selectedIds.length} mapped
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {roster.map((member) => {
                                  const isChecked = selectedIds.includes(member.id);
                                  const skillMatches =
                                    member.isOwner ||
                                    isSkillRelatedToService(member.skills, svc.name, svc.category);
                                  return (
                                    <label
                                      key={member.id}
                                      className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer transition ${
                                        isChecked
                                          ? "border-brand-purple-primary bg-white text-brand-purple-primary shadow-2xs"
                                          : skillMatches
                                          ? "border-purple-200 bg-purple-50/40 text-text-primary hover:border-brand-purple-primary"
                                          : "border-border-default bg-white text-text-secondary hover:bg-surface-app"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() =>
                                          toggleServiceCrewMember(svc.name, member.id)
                                        }
                                        className="rounded text-brand-purple-primary"
                                      />
                                      <span>
                                        {member.name}
                                        {member.isOwner ? " (Owner)" : ""}
                                      </span>
                                      {!member.isOwner && member.skills.length > 0 && (
                                        <span className="text-[10px] font-normal text-text-tertiary">
                                          · {member.skills.map(getSkillLabel).join(", ")}
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <div className="border-t border-border-divider bg-white px-4 py-3.5 space-y-2.5">
                      {crewMappingNotice && (
                        <p
                          className={`text-xs font-semibold p-2.5 rounded-xl border ${
                            crewMappingNotice.type === "success"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : "text-status-error bg-red-50 border-red-200"
                          }`}
                        >
                          {crewMappingNotice.text}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-[11px] text-text-secondary">
                          Unmapped services automatically fall back to skill-matched available crew.
                        </p>
                        <button
                          type="button"
                          disabled={savingCrewMapping || loadingCrewRoster}
                          onClick={() => void handleSaveServiceCrewMapping()}
                          className="rounded-xl bg-brand-purple-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {savingCrewMapping ? "Saving Mapping..." : "Save Crew Mapping"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Studio Profile & Identity (Owner Editable / Member Read-Only Panel) */}
          <div className="order-1 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-6">
            <div>
              <h2 className="text-base font-bold text-text-primary">Studio Profile &amp; Identity</h2>
              <p className="mt-1 text-xs text-text-secondary">
                {isOwner
                  ? "Basic information displayed on invoices, client contracts, and WhatsApp templates."
                  : "Studio profile details displayed on invoices, client portals, and templates (managed by the studio owner)."}
              </p>
            </div>

            {isOwner ? (
              <form onSubmit={handleSaveSettings} className="space-y-5">
                {/* Studio Logo Upload (Owner Only) */}
                <div className="rounded-2xl border border-border-default bg-surface-app/40 p-4 sm:p-5">
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Studio Logo (Optional)
                  </label>
                  <p className="text-[11px] text-text-secondary mb-3">
                    Displayed near your studio name in the dashboard.
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
                            disabled={isSaving}
                            className="hidden"
                          />
                        </label>

                        {logoUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            disabled={isSaving}
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
                      disabled={isSaving}
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
                      disabled={isSaving}
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
                        disabled={isSaving}
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
                      disabled={isSaving}
                      placeholder="@yourstudio"
                      className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-brand-blue-primary disabled:bg-slate-50"
                    />
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

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-brand-blue-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? "Saving Settings..." : "Save Studio Settings"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-divider pb-5">
                  <div className="flex items-center gap-4">
                    {studio.logoUrl ? (
                      <img
                        src={studio.logoUrl}
                        alt={`${studio.name || studioSlug} Logo`}
                        className="w-14 h-14 rounded-2xl object-cover border border-border-default shadow-xs bg-white shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-brand-blue-background border border-brand-blue-light flex items-center justify-center text-brand-blue-primary font-extrabold text-xl shrink-0">
                        {(studio.name || studioSlug).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-blue-primary">
                        Studio Identity
                      </span>
                      <h3 className="mt-0.5 text-xl font-extrabold tracking-tight text-text-primary">
                        {studio.name || studioSlug}
                      </h3>
                      <p className="text-xs text-text-secondary font-mono">/{studioSlug}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Studio Name
                    </span>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {studio.name || studioSlug}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Operating City
                    </span>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {studio.city || "—"}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Website
                    </span>
                    {(() => {
                      const displayWebsite = (studio.website || "").trim().replace(/^https?:\/\//i, "");
                      return (
                        <p className="mt-1 text-sm font-semibold text-text-primary break-all">
                          {displayWebsite ? (
                            <a
                              href={`https://${displayWebsite}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-blue-primary hover:underline"
                            >
                              https://{displayWebsite}
                            </a>
                          ) : (
                            "—"
                          )}
                        </p>
                      );
                    })()}
                  </div>

                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Instagram
                    </span>
                    <p className="mt-1 text-sm font-semibold text-text-primary break-words">
                      {studio.instagram || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Plan Information */}
          <div className="order-4 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-text-primary">Plan Information</h2>
                <p className="mt-1 text-xs text-text-secondary max-w-xl leading-relaxed">
                  Your current subscription tier and included modules are outlined below. Plan changes are managed from checkout.
                </p>
              </div>
              {isOwner && (
                <Link
                  href={`/checkout?studio=${studioSlug}`}
                  className="inline-flex items-center justify-center rounded-xl bg-brand-blue-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-xs shrink-0"
                >
                  {effectiveTier === "COMPLETE" ? "Manage Plan →" : "Upgrade Plan →"}
                </Link>
              )}
            </div>

            {(() => {
              const isActiveTrial = Boolean(
                studio.planInfo?.isTrial &&
                  studio.planInfo?.trialExpiresAt &&
                  new Date() <= new Date(studio.planInfo.trialExpiresAt)
              );
              const planTitle =
                effectiveTier === "COMPLETE"
                  ? isActiveTrial
                    ? "30-Day Free Trial (Professional Features + 10 GB Storage)"
                    : "Professional Plan (₹1,999/month)"
                  : effectiveTier === "PROFESSIONAL"
                  ? "Starter Plan (₹999/month)"
                  : "Free Plan (₹0/forever)";

              const planItems: Array<{ title: string; description: string }> = [
                {
                  title: "OMS Basic: Order Management & Lifecycle Pipeline",
                  description:
                    "Create and track confirmed orders end-to-end with a visual order lifecycle pipeline from booking to final delivery.",
                },
              ];

              if (effectiveTier === "COMPLETE" || effectiveTier === "PROFESSIONAL") {
                const storageTitle =
                  effectiveTier === "COMPLETE"
                    ? isActiveTrial
                      ? "10 GB Cloud Proofing Storage (30-Day Trial)"
                      : "50 GB Cloud Proofing Storage"
                    : "20 GB Cloud Proofing Storage";
                const storageDesc =
                  effectiveTier === "COMPLETE"
                    ? isActiveTrial
                      ? "Built-in Cloud Proofing Storage (10 GB) included during your 30-day free trial for compressed client selection galleries and review comments."
                      : "Built-in Cloud Proofing Storage (50 GB) for compressed client photo selection galleries, shareable links, and review comments."
                    : "Built-in Cloud Proofing Storage (20 GB) for compressed client photo selection galleries, shareable links, and review comments.";

                planItems.push({
                  title: storageTitle,
                  description: storageDesc,
                });
              }

              if (effectiveFeatures.driveReview) {
                planItems.push({
                  title: "Photos & Deliverable Links Review",
                  description:
                    "Share links from Google Drive, Dropbox, OneDrive, or any client gallery with photo shortlist numbers and proofing comments.",
                });
              }

              if (effectiveFeatures.crm) {
                planItems.push({
                  title: "Customer Data & Relations (CRM)",
                  description:
                    "Store verified/unverified customer profiles, order history, payment balances, and capture Instagram & Website / Google Maps leads.",
                });
              }

              if (effectiveFeatures.erp) {
                planItems.push({
                  title: "Studio Operations (ERP)",
                  description:
                    "Manage studio crew members, skills, availability checks, task assignments, and auto-assign workflow rules.",
                });
              }

              if (effectiveFeatures.basicDashboard) {
                planItems.push({
                  title: "Basic Business Dashboard",
                  description:
                    "Track active order counts, total studio revenue overview, and pending customer payment balances.",
                });
              }

              if (effectiveFeatures.whatsapp || effectiveTier === "COMPLETE") {
                planItems.push({
                  title: "WhatsApp Operations, Alerts & Lead Capture",
                  description:
                    "Send automated milestone notifications, capture WhatsApp Business enquiries, and query studio status via the interactive bot.",
                });
                planItems.push({
                  title: "Pre-Anniversary & Event Reminders",
                  description:
                    "Send pre-anniversary and main-event reminders to share photography memory moments and create repeat lead opportunities.",
                });
              }

              if (effectiveFeatures.reports) {
                planItems.push({
                  title: "Business Reports, Invoices & Excel Exports",
                  description:
                    "Access monthly/yearly analytics, issue official invoices and receipts, and download Excel exports across orders and CRM.",
                });
              }

              return (
                <div className="rounded-2xl border border-border-default bg-surface-app/40 overflow-hidden">
                  <div className="border-b border-border-divider bg-white px-4 py-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-text-primary">{planTitle}</span>
                    <span className="text-[11px] font-semibold text-text-secondary">
                      {planItems.length} {planItems.length === 1 ? "module" : "modules"} included
                    </span>
                  </div>
                  <div className="divide-y divide-border-divider">
                    {planItems.map((item) => (
                      <div key={item.title} className="px-4 py-3 space-y-0.5">
                        <p className="text-xs font-bold text-text-primary">{item.title}</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 5. Danger Zone: Delete Studio (Owner) or Leave Studio (Member) */}
          <div className="order-5 rounded-3xl border border-red-200 bg-red-50/40 p-6 shadow-sm sm:p-8 space-y-4">
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
                    setInstantDelete(false);
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
                  Are you sure you want to delete <span className="font-bold text-text-primary">{name || studioSlug}</span> (<span className="font-mono">/{studioSlug}</span>)?
                </>
              ) : (
                <>
                  Are you sure you want to leave <span className="font-bold text-text-primary">{name || studioSlug}</span>? You will lose access immediately.
                </>
              )}
            </p>

            {isOwner && (
              <>
                <div
                  className={`mt-4 rounded-xl border p-3.5 text-xs leading-tight ${
                    instantDelete
                      ? "border-red-200 bg-red-50/70 text-red-950"
                      : "border-amber-200 bg-amber-50/70 text-amber-950"
                  }`}
                >
                  {instantDelete
                    ? "All studio data will be permanently removed immediately with no recovery window."
                    : "Recoverable for 30 days in Account Settings before permanent deletion."}
                </div>

                <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/40 p-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={instantDelete}
                    onChange={(e) => setInstantDelete(e.target.checked)}
                    disabled={isDeleting}
                    className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-xs text-red-950 leading-snug">
                    <span className="font-bold block">Full instant delete</span>
                    <span className="text-[11px] text-red-800">
                      Immediately remove all associated studio data without timeline.
                    </span>
                  </span>
                </label>
              </>
            )}

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
                  setInstantDelete(false);
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
                  instantDelete ? "Delete Immediately" : "Yes, Delete Studio"
                ) : (
                  "Yes, Leave Studio"
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
