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
import {
  setDefaultWorkspace,
  clearDefaultWorkspace,
  getLocalDefaultWorkspace,
  subscribeToDefaultWorkspaceChanges,
} from "@/lib/workspaceDefaults";

function SettingsPageContent() {
  const params = useParams();
  const router = useRouter();
  const studioSlug = (params.studioSlug as string) || "";
  const { studio, user, getIdToken } = useStudioWorkspace();

  const isOwner = studio.ownerId === user?.uid || studio.ownerEmail?.toLowerCase() === user?.email?.toLowerCase();

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

          {/* 3. Studio Profile & Identity (Owner Only) */}
          <div className="order-1 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-6">
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

          {/* 4. Plan Information */}
          <div className="order-4 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-8 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-text-primary">Plan Information</h2>
                <p className="mt-1 text-xs text-text-secondary max-w-xl leading-relaxed">
                  Your current plan and included features are shown here. Plan changes are managed from checkout.
                </p>
              </div>
              <Link
                href={`/checkout?studio=${studioSlug}`}
                className="inline-flex items-center justify-center rounded-xl bg-brand-blue-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-xs"
              >
                Upgrade Plan →
              </Link>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-app p-4 text-xs">
              <p className="font-bold text-text-primary">{studio.planInfo?.plan || "FREE"} Plan</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(studio.planInfo?.selectedCapabilities || ["OMS_CORE"]).map((capability) => (
                  <span key={capability} className="rounded-md border border-brand-blue-light bg-brand-blue-background px-2 py-1 text-[10px] font-bold text-brand-blue-primary">
                    {capability.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
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
