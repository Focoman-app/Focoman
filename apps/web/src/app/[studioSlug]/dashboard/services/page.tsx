"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";
import { FocomanSpinner } from "@/components/FocomanSpinner";
import { StudioServiceConfig, StudioPackage } from "@focoman/types";
import {
  updateStudioServicesAction,
  getStudioServicesAction,
  saveStudioPackagesAction,
  createStudioPackageAction,
  deleteStudioPackageAction,
} from "@/actions/studioActions";
import { DEFAULT_STUDIO_SERVICES, getDefaultStudioPackages } from "@/lib/studioServices";

function ServicesContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studioSlug = (params.studioSlug as string) || "";
  const isOnboarding = searchParams.get("onboarding") === "true";

  const { studio, user, getIdToken } = useStudioWorkspace();
  const isOwner = studio.ownerId === user?.uid || studio.ownerEmail?.toLowerCase() === user?.email?.toLowerCase();

  // Services State
  const [services, setServices] = useState<StudioServiceConfig[]>(
    studio.configuredServices && studio.configuredServices.length > 0
      ? studio.configuredServices
      : DEFAULT_STUDIO_SERVICES
  );
  const [packages, setPackages] = useState<StudioPackage[]>(() =>
    getDefaultStudioPackages(studioSlug)
  );
  const [loading, setLoading] = useState(true);
  const [savingServices, setSavingServices] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<string>(() =>
    JSON.stringify({
      services: studio.configuredServices && studio.configuredServices.length > 0
        ? studio.configuredServices
        : DEFAULT_STUDIO_SERVICES,
      packages: getDefaultStudioPackages(studioSlug),
    })
  );
  const hasLoadedServerRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    type: "service" | "package";
    id: string;
    name: string;
  } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Add Custom Service Modal
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServiceCategory, setCustomServiceCategory] = useState("Photography");
  const [customServicePrice, setCustomServicePrice] = useState<number | "">(15000);
  const [customServiceDeliverable, setCustomServiceDeliverable] = useState(false);

  // Create Package Modal
  const [showCreatePackageModal, setShowCreatePackageModal] = useState(false);
  const [packageName, setPackageName] = useState("");
  const [packageDesc, setPackageDesc] = useState("");
  const [packagePrice, setPackagePrice] = useState<number | "">(50000);
  const [packageServices, setPackageServices] = useState<string[]>([]);
  const [creatingPackage, setCreatingPackage] = useState(false);

  // Load initial services & packages from server
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const token = await getIdToken();
        if (!token) return;

        const res = await getStudioServicesAction(studioSlug, token);
        if (res.success && !hasLoadedServerRef.current) {
          hasLoadedServerRef.current = true;
          const loadedServices = Array.isArray(res.services) && res.services.length > 0
            ? res.services
            : (studio.configuredServices && studio.configuredServices.length > 0 ? studio.configuredServices : DEFAULT_STUDIO_SERVICES);
          const loadedPackages = Array.isArray(res.packages) && res.packages.length > 0
            ? res.packages
            : getDefaultStudioPackages(studioSlug);

          setServices(loadedServices);
          setPackages(loadedPackages);
          setInitialSnapshot(JSON.stringify({ services: loadedServices, packages: loadedPackages }));
        }
      } catch (err) {
        console.error("Failed to load studio services & packages:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [studioSlug, getIdToken]);

  const hasChanges = useMemo(() => {
    if (isOnboarding) return true;
    if (isDirty) return true;
    return initialSnapshot !== JSON.stringify({ services, packages });
  }, [isOnboarding, isDirty, initialSnapshot, services, packages]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle service enabled / disabled
  const handleToggleService = (id: string) => {
    setIsDirty(true);
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Update base price for a service
  const handlePriceChange = (id: string, price: number) => {
    setIsDirty(true);
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, defaultPrice: Math.max(0, price) } : s))
    );
  };

  // Toggle package enabled / disabled.
  const handleTogglePackage = (pkgId: string) => {
    setIsDirty(true);
    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? { ...p, isEnabled: !p.isEnabled } : p))
    );
  };

  // Update package price in local state
  const handlePackagePriceChange = (pkgId: string, newPrice: number) => {
    setIsDirty(true);
    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? { ...p, price: Math.max(0, newPrice) } : p))
    );
  };

  // Remove a custom service
  const handleRemoveService = (id: string) => {
    setIsDirty(true);
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Save custom service
  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customServiceName.trim()) return;

    const newService: StudioServiceConfig = {
      id: `svc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: customServiceName.trim(),
      category: customServiceCategory,
      defaultPrice: typeof customServicePrice === "number" ? customServicePrice : 0,
      isDeliverable: customServiceDeliverable,
      enabled: true,
    };

    setServices((prev) => [...prev, newService]);
    setIsDirty(true);
    setCustomServiceName("");
    setCustomServicePrice(15000);
    setCustomServiceDeliverable(false);
    setShowAddServiceModal(false);
    showToast(`Added "${newService.name}" to catalog.`);
  };

  // Save all services and packages to database
  const handleSaveServices = async (forceDashboard = false) => {
    setSavingServices(true);
    setErrorMessage(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication token not available.");

      const [servicesRes, packagesRes] = await Promise.all([
        updateStudioServicesAction(studioSlug, services, token),
        saveStudioPackagesAction(studioSlug, packages, token),
      ]);

      if (!servicesRes.success) {
        throw new Error(servicesRes.error || "Failed to save services catalog.");
      }
      if (!packagesRes.success) {
        throw new Error(packagesRes.error || "Failed to save packages.");
      }

      showToast("Services & packages saved successfully!");
      setInitialSnapshot(JSON.stringify({ services, packages }));
      setIsDirty(false);
      setTimeout(() => {
        if (forceDashboard) {
          router.push(`/${studioSlug}/dashboard`);
        } else if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(`/${studioSlug}/dashboard`);
        }
      }, 500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save services & packages.");
    } finally {
      setSavingServices(false);
    }
  };

  // Create custom package
  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName.trim() || packageServices.length === 0) return;

    setCreatingPackage(true);
    setErrorMessage(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication token unavailable.");

      const res = await createStudioPackageAction(
        {
          studioId: studioSlug,
          name: packageName.trim(),
          description: packageDesc.trim() || undefined,
          services: packageServices,
          price: typeof packagePrice === "number" ? packagePrice : 0,
          isEnabled: true,
        },
        token
      );

      if (!res.success || !res.package) {
        throw new Error(res.error || "Failed to create package.");
      }

      setPackages((prev) => [...prev, res.package]);
      setIsDirty(true);
      setShowCreatePackageModal(false);
      setPackageName("");
      setPackageDesc("");
      setPackagePrice(50000);
      setPackageServices([]);
      showToast(`Created combo package "${res.package.name}"!`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create package.");
    } finally {
      setCreatingPackage(false);
    }
  };

  // Delete package or service confirmation handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setDeletingItem(true);
    try {
      if (deleteConfirmItem.type === "service") {
        setServices((prev) => prev.filter((s) => s.id !== deleteConfirmItem.id));
        setIsDirty(true);
        showToast(`Removed "${deleteConfirmItem.name}" from catalog.`);
        setDeleteConfirmItem(null);
      } else {
        const pkgId = deleteConfirmItem.id;
        const pkgName = deleteConfirmItem.name;
        setPackages((prev) => prev.filter((p) => p.id !== pkgId));
        setIsDirty(true);
        setDeleteConfirmItem(null);
        try {
          const token = await getIdToken();
          if (token) {
            await deleteStudioPackageAction(pkgId, studioSlug, token);
          }
        } catch (err) {
          console.error("Failed to delete package from backend:", err);
        }
        showToast(`Package "${pkgName}" deleted successfully.`);
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
      setErrorMessage("Failed to delete item.");
    } finally {
      setDeletingItem(false);
    }
  };

  const enabledServices = services.filter((s) => s.enabled);
  const enabledPackages = packages.filter((p) => p.isEnabled && !p.isDeleted);
  const categories = Array.from(new Set(services.map((s) => s.category)));

  const isDeletingItemEnabled = deleteConfirmItem
    ? deleteConfirmItem.type === "service"
      ? services.find((s) => s.id === deleteConfirmItem.id)?.enabled !== false
      : packages.find((p) => p.id === deleteConfirmItem.id)?.isEnabled !== false
    : false;

  return (
    <div className="flex flex-col min-h-screen sm:h-full sm:min-h-0 sm:overflow-hidden bg-surface-app">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 right-6 z-50 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <span className="text-emerald-400">✓</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header Panel (Scrolls away on mobile to maximize visible catalog space; fixed on desktop) */}
      <header className="relative sm:shrink-0 border-b border-border-default bg-white px-3.5 py-3 sm:px-8 sm:py-5 shadow-2xs z-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div>
            <div className="flex items-center justify-between sm:justify-start gap-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full bg-brand-blue-50 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-bold text-brand-blue-primary uppercase tracking-wider border border-brand-blue-soft">
                  {isOnboarding ? "Step 2 · Quick Setup" : "Studio Catalog"}
                </span>
                <span className="text-[11px] sm:text-xs text-text-tertiary">
                  {enabledServices.length} Active Services · {enabledPackages.length} Active Packages
                </span>
              </div>
              {/* Skip for now on mobile top row */}
              {isOnboarding && (
                <div className="sm:hidden shrink-0">
                  <Link
                    href={`/${studioSlug}/dashboard`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-text-secondary hover:text-text-primary underline whitespace-nowrap shrink-0"
                  >
                    <span>Skip</span>
                    <span className="inline-block">→</span>
                  </Link>
                </div>
              )}
            </div>
            <h1 className="mt-1 sm:mt-2 text-base sm:text-2xl font-extrabold tracking-tight text-text-primary">
              {isOnboarding ? "Configure Services & Starter Packages" : "Studio Services & Package Combos"}
            </h1>
            <p className="mt-1 text-xs text-text-secondary max-w-2xl leading-relaxed hidden sm:block">
              Define the specific services your studio provides and set default rates. When you register confirmed orders, only your active services will appear with instant price auto-calculations.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 shrink-0">
            {isOnboarding && (
              <Link
                href={`/${studioSlug}/dashboard`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-default px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-app transition whitespace-nowrap shrink-0"
              >
                <span>Skip for now</span>
                <span className="inline-block">→</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Catalog Body (Natural document scroll on mobile, contained scroll on desktop) */}
      <div className="flex-1 px-3 py-3 sm:overflow-y-auto sm:min-h-0 sm:px-6 lg:px-8 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-6">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-4 sm:pb-6">
          {/* Error Alert */}
          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-700 ml-4 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Section 1: Studio Services & Deliverables */}
          <div className="rounded-2xl sm:rounded-3xl border border-border-default bg-white p-3.5 sm:p-8 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 border-b border-border-divider pb-3 sm:pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-primary">
                  1. Services &amp; Deliverables Catalog
                </h2>
                <p className="text-xs text-text-secondary mt-0.5 hidden sm:block">
                  Toggle the services your studio offers. Set base prices for automatic calculations in confirmed orders.
                </p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(true)}
                  className="rounded-xl border border-brand-blue-soft bg-brand-blue-50/60 px-3.5 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-brand-blue-50 transition shrink-0 self-start sm:self-auto"
                >
                  + Add Custom Service
                </button>
              )}
            </div>

            {/* Services List Grouped by Category */}
            <div className="space-y-4 sm:space-y-6">
              {categories.map((cat) => {
                const catServices = services.filter((s) => s.category === cat);
                return (
                  <div key={cat} className="space-y-2.5 sm:space-y-3">
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      {cat}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                      {catServices.map((svc) => (
                        <div
                          key={svc.id}
                          className={`rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 transition flex items-center justify-between gap-2 sm:gap-3 ${
                            svc.enabled
                              ? "border-border-default bg-white shadow-2xs hover:border-brand-blue-primary/40"
                              : "border-border-divider bg-slate-50/70 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            {/* Toggle switch with tactile shadows and mild gray state */}
                            <button
                              type="button"
                              onClick={() => handleToggleService(svc.id)}
                              disabled={!isOwner}
                              className={`relative inline-flex h-5 w-10 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed ${
                                svc.enabled
                                  ? "bg-brand-blue-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] focus:ring-brand-blue-primary"
                                  : "bg-slate-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] border border-slate-300/80 focus:ring-slate-400"
                              }`}
                              aria-label={`Toggle ${svc.name}`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full transition duration-200 ease-in-out shadow-[0_2px_4px_rgba(0,0,0,0.18)] ${
                                  svc.enabled
                                    ? "translate-x-5 bg-white border border-brand-blue-soft"
                                    : "translate-x-0 bg-slate-100 border border-slate-300/80"
                                }`}
                              />
                            </button>

                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-text-primary truncate">
                                {svc.name}
                              </span>
                              {svc.isDeliverable && (
                                <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold text-amber-700">
                                  Deliverable
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Price Input */}
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <div className="relative w-24 sm:w-28 shrink-0">
                              <span className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="500"
                                disabled={!svc.enabled || !isOwner}
                                value={svc.defaultPrice === 0 ? "" : svc.defaultPrice}
                                onChange={(e) => handlePriceChange(svc.id, Number(e.target.value))}
                                className="w-full rounded-xl border border-border-default bg-white py-1.5 pl-6 sm:pl-7 pr-2.5 sm:pr-3 text-right text-xs font-bold text-text-primary outline-none transition focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary disabled:bg-slate-100/60 disabled:text-text-disabled disabled:border-border-divider"
                                placeholder="0"
                              />
                            </div>

                            {/* Delete service */}
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmItem({
                                    type: "service",
                                    id: svc.id,
                                    name: svc.name,
                                  })
                                }
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-text-tertiary hover:bg-red-50 hover:text-red-600 transition text-sm font-bold"
                                title={`Delete ${svc.name}`}
                                aria-label={`Delete ${svc.name}`}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Studio Packages & Combos */}
          <div className="rounded-2xl sm:rounded-3xl border border-border-default bg-white p-3.5 sm:p-8 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 border-b border-border-divider pb-3 sm:pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-primary">
                  2. Packages &amp; Combos
                </h2>
                <p className="text-xs text-text-secondary mt-0.5 hidden sm:block">
                  Bundle services together into wedding packages and combos. Edit prices directly below or create custom combos.
                </p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setPackageServices(enabledServices.slice(0, 3).map((s) => s.name));
                    setShowCreatePackageModal(true);
                  }}
                  className="rounded-xl bg-brand-blue-primary px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-xs shrink-0 self-start sm:self-auto"
                >
                  + Create Package Combo
                </button>
              )}
            </div>

            {/* Packages & Combos List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-xl sm:rounded-2xl border p-3.5 sm:p-5 transition flex flex-col justify-between space-y-2.5 sm:space-y-3 ${
                    pkg.isEnabled
                      ? "border-border-default bg-white shadow-2xs hover:border-brand-blue-primary/40"
                      : "border-border-divider bg-slate-50/70 opacity-60"
                  }`}
                >
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {/* Toggle switch with tactile shadows and mild gray state */}
                        <button
                          type="button"
                          onClick={() => handleTogglePackage(pkg.id)}
                          disabled={!isOwner}
                          className={`relative inline-flex h-5 w-10 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed ${
                          pkg.isEnabled
                              ? "bg-brand-blue-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] focus:ring-brand-blue-primary"
                              : "bg-slate-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] border border-slate-300/80 focus:ring-slate-400"
                          }`}
                          aria-label={`Toggle ${pkg.name}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full transition duration-200 ease-in-out shadow-[0_2px_4px_rgba(0,0,0,0.18)] ${
                              pkg.isEnabled
                                ? "translate-x-5 bg-white border border-brand-blue-soft"
                                : "translate-x-0 bg-slate-100 border border-slate-300/80"
                            }`}
                          />
                        </button>

                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-text-primary truncate">
                            {pkg.name}
                          </h3>
                        </div>
                      </div>

                      {/* Direct Editable Combo Price Input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative w-24 sm:w-28 shrink-0">
                          <span className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            disabled={!pkg.isEnabled || !isOwner}
                            value={pkg.price === 0 ? "" : pkg.price}
                            onChange={(e) => handlePackagePriceChange(pkg.id, Number(e.target.value))}
                            placeholder="0"
                            className="w-full rounded-xl border border-border-default bg-white py-1.5 pl-6 sm:pl-7 pr-2.5 sm:pr-3 text-right text-xs font-bold text-text-primary outline-none transition focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary disabled:bg-slate-100/60 disabled:text-text-disabled disabled:border-border-divider"
                          />
                        </div>

                        {/* Delete package */}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirmItem({
                                type: "package",
                                id: pkg.id,
                                name: pkg.name,
                              })
                            }
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-text-tertiary hover:bg-red-50 hover:text-red-600 transition text-sm font-bold"
                            title={`Delete ${pkg.name}`}
                            aria-label={`Delete ${pkg.name}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                        {pkg.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pkg.services.map((svc) => (
                        <span
                          key={svc}
                          className="rounded-lg bg-surface-app border border-border-default px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                        >
                          {svc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar (Sleek sticky bar on mobile; fixed bar on desktop) */}
      <footer className="sticky bottom-0 sm:shrink-0 border-t border-border-default bg-white/95 backdrop-blur-md px-3.5 py-2.5 sm:px-8 sm:py-3.5 shadow-lg z-20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="text-xs text-text-secondary hidden sm:block">
            {isOnboarding
              ? "Save your studio catalog to launch your workspace with instant pre-calculated rates."
              : hasChanges
              ? "You have unsaved changes in your catalog."
              : "Ready to book? Your active services immediately power the Confirmed Order form."}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            {isOnboarding ? (
              <button
                type="button"
                onClick={() => handleSaveServices(true)}
                disabled={savingServices || !isOwner}
                className="w-full sm:w-auto rounded-xl bg-brand-blue-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingServices ? (
                  <>
                    <FocomanSpinner size="xs" />
                    Saving &amp; Launching...
                  </>
                ) : (
                  "Save & Launch Dashboard →"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveServices(false)}
                disabled={savingServices || !hasChanges}
                className={`w-full sm:w-auto rounded-xl px-6 py-2.5 text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 ${
                  hasChanges
                    ? "bg-brand-blue-primary text-white hover:bg-brand-blue-hover cursor-pointer"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                }`}
                title={!hasChanges ? "No changes to save" : undefined}
              >
                {savingServices ? (
                  <>
                    <FocomanSpinner size="xs" />
                    Saving...
                  </>
                ) : (
                  "Save All Changes"
                )}
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modal: Focoman Theme Delete Confirmation */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-border-default space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 border border-red-100 text-red-600">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-text-primary">
                  Delete {deleteConfirmItem.type === "service" ? "Service" : "Package"}?
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Confirm removal from studio catalog
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="text-text-tertiary hover:text-text-primary text-base font-bold -mt-1"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-surface-app p-3.5 border border-border-default text-xs text-text-secondary leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-bold text-text-primary">&ldquo;{deleteConfirmItem.name}&rdquo;</span>?{" "}
              {deleteConfirmItem.type === "service"
                ? isDeletingItemEnabled
                  ? "This service will be permanently removed from your catalog and active order booking forms."
                  : "This service is currently disabled and will be permanently removed from your catalog."
                : isDeletingItemEnabled
                  ? "This package combo will be permanently removed from your catalog and active order forms."
                  : "This package combo is currently disabled and will be permanently removed from your catalog."}
            </div>

            <div className="pt-2 border-t border-border-divider flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deletingItem}
                className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-app transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingItem}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {deletingItem ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Service */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-border-divider pb-3">
              <h3 className="font-bold text-sm text-text-primary">Add Custom Studio Service</h3>
              <button
                type="button"
                onClick={() => setShowAddServiceModal(false)}
                className="text-text-tertiary hover:text-text-primary text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Service / Deliverable Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Film Coverage, 360 Video Booth"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  className="w-full rounded-xl border border-border-default px-3.5 py-2 text-xs font-medium text-text-primary outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Category
                  </label>
                  <select
                    value={customServiceCategory}
                    onChange={(e) => setCustomServiceCategory(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-white px-3 py-2 text-xs font-medium text-text-primary outline-none focus:border-brand-blue-primary"
                  >
                    <option value="Photography">Photography</option>
                    <option value="Videography">Videography</option>
                    <option value="Aerial & Drone">Aerial & Drone</option>
                    <option value="Albums & Deliverables">Albums & Deliverables</option>
                    <option value="Shoots & Sessions">Shoots & Sessions</option>
                    <option value="Equipment & Live">Equipment & Live</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    Default Base Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={customServicePrice}
                    onChange={(e) => setCustomServicePrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-default px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-blue-primary"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={customServiceDeliverable}
                  onChange={(e) => setCustomServiceDeliverable(e.target.checked)}
                  className="h-4 w-4 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary"
                />
                <span className="text-xs text-text-primary">
                  This is a physical or digital <strong>deliverable</strong> (e.g. Album, USB Drive)
                </span>
              </label>

              <div className="pt-3 border-t border-border-divider flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-blue-primary px-5 py-2 text-xs font-bold text-white hover:bg-brand-blue-hover"
                >
                  Add to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Package Combo */}
      {showCreatePackageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-border-default space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-border-divider pb-3">
              <h3 className="font-bold text-sm text-text-primary">Create Package / Combo</h3>
              <button
                type="button"
                onClick={() => setShowCreatePackageModal(false)}
                className="text-text-tertiary hover:text-text-primary text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Wedding Combo, Pre-Wedding Special"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  className="w-full rounded-xl border border-border-default px-3.5 py-2 text-xs font-medium text-text-primary outline-none focus:border-brand-blue-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Select Included Services ({packageServices.length} selected) *
                </label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border-default p-2.5 space-y-1.5 bg-surface-app/30">
                  {enabledServices.map((svc) => {
                    const isSelected = packageServices.includes(svc.name);
                    return (
                      <label
                        key={svc.id}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none ${
                          isSelected ? "bg-brand-blue-50 text-brand-blue-primary font-bold" : "text-text-primary hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setPackageServices((prev) => prev.filter((s) => s !== svc.name));
                              } else {
                                setPackageServices((prev) => [...prev, svc.name]);
                              }
                            }}
                            className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary"
                          />
                          <span>{svc.name}</span>
                        </div>
                        <span className="text-[10px] text-text-tertiary">
                          ₹{svc.defaultPrice.toLocaleString("en-IN")}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Package Combo Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-default px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-blue-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Description / Features (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Includes 2 photographers, 1 cinematographer, raw drive, and custom album."
                  value={packageDesc}
                  onChange={(e) => setPackageDesc(e.target.value)}
                  className="w-full rounded-xl border border-border-default px-3.5 py-2 text-xs font-medium text-text-primary outline-none focus:border-brand-blue-primary resize-none"
                />
              </div>

              <div className="pt-3 border-t border-border-divider flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePackageModal(false)}
                  className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPackage || packageServices.length === 0}
                  className="rounded-xl bg-brand-blue-primary px-5 py-2 text-xs font-bold text-white hover:bg-brand-blue-hover disabled:opacity-50"
                >
                  {creatingPackage ? "Creating..." : "Save Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-text-tertiary">Loading studio catalog...</div>}>
      <ServicesContent />
    </Suspense>
  );
}
