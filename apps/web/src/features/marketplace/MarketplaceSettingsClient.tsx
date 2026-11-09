"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchMarketplaceProfile,
  saveMarketplaceProfile,
  getStudioPackagesAction,
  createStudioPackageAction,
  updateStudioPackageAction,
  deleteStudioPackageAction,
  getStudioBookingRequestsAction,
  negotiateBookingRequestAction,
  getStudioPaymentsAction,
  verifyPaymentAction,
  confirmBookingAndConvertToOrderAction,
} from "@/actions/marketplaceActions";
import { MarketplaceProfile, StudioPackage, BookingRequest, PaymentRecord, PaymentMethod } from "@focoman/types";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";

export function MarketplaceSettingsClient({ studioId }: { studioId: string }) {
  const [activeTab, setActiveTab] = useState<"profile" | "packages" | "bookings">("profile");

  // Profile State
  const [profile, setProfile] = useState<Partial<MarketplaceProfile>>({});
  const [logoError, setLogoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Packages State
  const [packages, setPackages] = useState<StudioPackage[]>([]);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgPrice, setNewPkgPrice] = useState<number>(15000);
  const [newPkgDesc, setNewPkgDesc] = useState("");
  const [newPkgServices, setNewPkgServices] = useState("Photography, Album");
  const [newPkgNegotiable, setNewPkgNegotiable] = useState(true);
  const [newPkgPublished, setNewPkgPublished] = useState(true);
  const [pkgSaving, setPkgSaving] = useState(false);

  // Bookings & Payments State
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null);
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(0);
  const [advanceRequested, setAdvanceRequested] = useState<number>(0);
  const [confirmingBookingId, setConfirmingBookingId] = useState<string | null>(null);
  const [confirmAdvanceAmount, setConfirmAdvanceAmount] = useState<number>(0);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState<PaymentMethod>("UPI");
  const [confirmRefNumber, setConfirmRefNumber] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  const { getIdToken } = useStudioWorkspace();

  const loadData = useCallback(async () => {
    setLoading(true);
    const token = await getIdToken();
    if (!token) {
      setMessage({ type: "error", text: "Authentication required." });
      setLoading(false);
      return;
    }

    try {
      const [pRes, pkgRes, bRes, payRes] = await Promise.all([
        fetchMarketplaceProfile(studioId, token),
        getStudioPackagesAction(studioId, token),
        getStudioBookingRequestsAction(studioId, token),
        getStudioPaymentsAction(studioId, token),
      ]);

      if (pRes.success && pRes.profile) setProfile(pRes.profile);
      if (pkgRes.success && pkgRes.packages) setPackages(pkgRes.packages);
      if (bRes.success && bRes.bookingRequests) setBookings(bRes.bookingRequests);
      if (payRes.success && payRes.payments) setPayments(payRes.payments);
    } catch {
      setMessage({ type: "error", text: "Failed to load studio marketplace data." });
    } finally {
      setLoading(false);
    }
  }, [studioId, getIdToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Please select an image file (PNG, JPG, WebP, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo image size must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setProfile((prev) => ({ ...prev, logoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setProfile((prev) => ({ ...prev, logoUrl: "" }));
    setLogoError(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const token = await getIdToken();
    if (!token) {
      setMessage({ type: "error", text: "Authentication required." });
      setSaving(false);
      return;
    }

    const res = await saveMarketplaceProfile(
      studioId,
      {
        name: profile.name,
        city: profile.city,
        logoUrl: profile.logoUrl,
        description: profile.description,
        tags: profile.tags || [],
        isVisible: profile.isVisible || false,
      },
      token
    );

    if (res.success) {
      setMessage({ type: "success", text: "Marketplace profile updated successfully." });
      if (res.profile) setProfile(res.profile);
    } else {
      setMessage({ type: "error", text: res.error || "Failed to update profile." });
    }
    setSaving(false);
  };

  const openCreatePackageModal = () => {
    setEditingPkgId(null);
    setNewPkgName("");
    setNewPkgPrice(15000);
    setNewPkgDesc("");
    setNewPkgServices("Photography, Album");
    setNewPkgNegotiable(true);
    setNewPkgPublished(true);
    setShowPackageModal(true);
  };

  const openEditPackageModal = (pkg: StudioPackage) => {
    setEditingPkgId(pkg.id);
    setNewPkgName(pkg.name);
    setNewPkgPrice(pkg.price);
    setNewPkgDesc(pkg.description || "");
    setNewPkgServices((pkg.services || []).join(", "));
    setNewPkgNegotiable(pkg.isNegotiable);
    setNewPkgPublished(pkg.isPublished);
    setShowPackageModal(true);
  };

  const handleCreateOrUpdatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgName || newPkgPrice <= 0) return;

    setPkgSaving(true);
    const token = await getIdToken();
    if (!token) {
      setPkgSaving(false);
      return;
    }

    const services = newPkgServices.split(",").map((s) => s.trim()).filter(Boolean);

    if (editingPkgId) {
      const res = await updateStudioPackageAction(
        {
          packageId: editingPkgId,
          studioId,
          name: newPkgName,
          price: newPkgPrice,
          description: newPkgDesc,
          services,
          isNegotiable: newPkgNegotiable,
          isPublished: newPkgPublished,
        },
        token
      );
      if (res.success && res.package) {
        setPackages(packages.map((p) => (p.id === editingPkgId ? res.package! : p)));
        setShowPackageModal(false);
        setEditingPkgId(null);
        setMessage({ type: "success", text: `Updated package "${res.package.name}".` });
      } else {
        setMessage({ type: "error", text: res.error || "Failed to update package." });
      }
    } else {
      const res = await createStudioPackageAction(
        {
          studioId,
          name: newPkgName,
          price: newPkgPrice,
          description: newPkgDesc,
          services,
          isNegotiable: newPkgNegotiable,
          isPublished: newPkgPublished,
        },
        token
      );
      if (res.success && res.package) {
        setPackages([res.package, ...packages]);
        setShowPackageModal(false);
        setNewPkgName("");
        setNewPkgDesc("");
        setMessage({ type: "success", text: `Created package "${res.package.name}".` });
      } else {
        setMessage({ type: "error", text: res.error || "Failed to create package." });
      }
    }
    setPkgSaving(false);
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!confirm("Are you sure you want to remove this package?")) return;
    const token = await getIdToken();
    if (!token) return;

    const res = await deleteStudioPackageAction(pkgId, studioId, token);
    if (res.success) {
      setPackages(packages.filter((p) => p.id !== pkgId));
    } else {
      setMessage({ type: "error", text: res.error || "Failed to delete package" });
    }
  };

  const handleStartNegotiate = (req: BookingRequest) => {
    setNegotiatingId(req.id);
    setNegotiatedPrice(req.agreedPrice || req.originalPrice);
    setAdvanceRequested(req.advanceRequested || Math.round((req.agreedPrice || req.originalPrice) * 0.3));
  };

  const handleConfirmNegotiation = async (bookingRequestId: string) => {
    setActionLoading(true);
    const token = await getIdToken();
    if (!token) {
      setActionLoading(false);
      return;
    }

    const res = await negotiateBookingRequestAction(
      {
        bookingRequestId,
        studioId,
        agreedPrice: negotiatedPrice,
        advanceRequested,
      },
      token
    );

    if (res.success && res.bookingRequest) {
      setBookings(bookings.map((b) => (b.id === bookingRequestId ? res.bookingRequest! : b)));
      setNegotiatingId(null);
    } else {
      setMessage({ type: "error", text: res.error || "Failed to confirm negotiation" });
    }
    setActionLoading(false);
  };

  const handleStartConfirmBooking = (req: BookingRequest) => {
    setConfirmingBookingId(req.id);
    setConfirmAdvanceAmount(req.advanceRequested || Math.round((req.agreedPrice || req.originalPrice) * 0.3));
    setConfirmPaymentMethod("UPI");
    setConfirmRefNumber("");
  };

  const handleDirectConfirmAndConvert = async (bookingRequestId: string) => {
    setActionLoading(true);
    const token = await getIdToken();
    if (!token) {
      setActionLoading(false);
      return;
    }

    const res = await confirmBookingAndConvertToOrderAction(
      {
        bookingRequestId,
        studioId,
        advanceAmount: confirmAdvanceAmount,
        paymentMethod: confirmPaymentMethod,
        referenceNumber: confirmRefNumber.trim() || undefined,
      },
      token
    );

    if (res.success && res.order) {
      setConfirmingBookingId(null);
      setMessage({
        type: "success",
        text: `Booking confirmed! Created canonical OMS Order ${res.order.id} (Passkey PIN: ${res.order.passkeyPin}).`,
      });
      await loadData();
    } else {
      setMessage({ type: "error", text: res.error || "Failed to confirm booking." });
    }
    setActionLoading(false);
  };

  const handleVerifyPayment = async (paymentId: string) => {
    if (!confirm("Verify this payment? This will confirm the booking and create the Confirmed Order in OMS.")) {
      return;
    }
    setActionLoading(true);
    const token = await getIdToken();
    if (!token) {
      setActionLoading(false);
      return;
    }

    const res = await verifyPaymentAction(
      {
        paymentId,
        studioId,
        verified: true,
      },
      token
    );

    if (res.success) {
      setMessage({
        type: "success",
        text: "Payment verified successfully! The booking is now confirmed and OMS tasks are initialized.",
      });
      await loadData();
    } else {
      setMessage({ type: "error", text: res.error || "Failed to verify payment" });
    }
    setActionLoading(false);
  };

  if (loading) {
    return <div className="text-sm text-text-secondary py-8">Loading studio marketplace settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-border-divider gap-4">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === "profile"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Studio Profile
        </button>
        <button
          onClick={() => setActiveTab("packages")}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === "packages"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Studio Packages ({packages.length})
        </button>
        <button
          onClick={() => setActiveTab("bookings")}
          className={`pb-3 text-sm font-bold border-b-2 transition ${
            activeTab === "bookings"
              ? "border-text-primary text-text-primary"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Booking Requests ({bookings.length})
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl p-4 text-sm font-semibold ${
            message.type === "success" ? "bg-green-50 text-status-success" : "bg-red-50 text-status-error"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tab 1: Studio Profile */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6 rounded-2xl border border-border-default bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-text-primary">Public Visibility</h3>
            <p className="text-xs text-text-secondary mt-1">
              When enabled, your studio will be discoverable on the public marketplace.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={profile.isVisible || false}
                  onChange={(e) => setProfile({ ...profile, isVisible: e.target.checked })}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-blue-primary peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
              <span className="text-sm font-semibold text-text-primary">
                {profile.isVisible ? "Visible to Public" : "Hidden (Private)"}
              </span>
            </div>
          </div>

          {/* Studio Logo (Optional) */}
          <div className="border-t border-border-divider pt-6">
            <label className="block text-sm font-semibold text-text-primary mb-1">
              Studio Logo (Optional)
            </label>
            <p className="text-xs text-text-secondary mb-3">
              Displayed near your studio name on your public marketplace listing cards and studio profile page.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt="Marketplace logo preview"
                  className="w-14 h-14 rounded-2xl object-cover border border-border-default shadow-xs bg-white shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-brand-blue-background border border-dashed border-brand-blue-light flex items-center justify-center text-brand-blue-primary font-extrabold text-xl shrink-0">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : "S"}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-slate-50 transition shadow-2xs">
                    <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>{profile.logoUrl ? "Change Logo" : "Upload Logo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={saving}
                      className="hidden"
                    />
                  </label>

                  {profile.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={saving}
                      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
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

          <div>
            <label className="block text-sm font-semibold text-text-primary">Public Studio Name</label>
            <input
              type="text"
              value={profile.name || ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="mt-2 block w-full rounded-xl border border-border-input px-4 py-2 text-sm focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
              placeholder="e.g. Luminary Studios"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary">Service City</label>
            <input
              type="text"
              value={profile.city || ""}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              className="mt-2 block w-full rounded-xl border border-border-input px-4 py-2 text-sm focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
              placeholder="e.g. Bangalore"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary">Studio Description</label>
            <textarea
              value={profile.description || ""}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-border-input px-4 py-2 text-sm focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
              placeholder="Tell clients about your style, experience, and services..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary">Service Tags</label>
            <p className="text-xs text-text-secondary mb-2">Comma separated values (e.g. Wedding, Portrait, Corporate)</p>
            <input
              type="text"
              value={(profile.tags || []).join(", ")}
              onChange={(e) =>
                setProfile({ ...profile, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
              }
              className="block w-full rounded-xl border border-border-input px-4 py-2 text-sm focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
              placeholder="Wedding, Portrait, Corporate"
            />
          </div>

          <div className="pt-4 border-t border-border-divider flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-blue-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Studio Packages */}
      {activeTab === "packages" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-text-primary">Configured Studio Packages</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Packages belong exclusively to your studio. Customers can book directly or request negotiation.
              </p>
            </div>
            <button
              onClick={openCreatePackageModal}
              className="rounded-xl bg-text-primary px-4 py-2 text-xs font-bold text-white hover:bg-black transition"
            >
              + Create Package
            </button>
          </div>

          {packages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default p-8 text-center bg-white">
              <p className="text-sm font-semibold text-text-secondary">No packages created yet.</p>
              <p className="text-xs text-text-tertiary mt-1">Create packages to allow marketplace clients to book quickly.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-2xl border border-border-default bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-bold text-text-primary">{pkg.name}</h4>
                      <p className="text-xl font-extrabold text-text-primary mt-1">
                        ₹{pkg.price.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {pkg.isNegotiable ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                          Negotiable
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                          Fixed
                        </span>
                      )}
                      {pkg.isPublished ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-status-success border border-green-200">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>

                  {pkg.description && <p className="text-xs text-text-secondary">{pkg.description}</p>}

                  {pkg.services && pkg.services.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {pkg.services.map((s) => (
                        <span key={s} className="rounded bg-surface-app px-2 py-0.5 text-[10px] text-text-secondary border border-border-default">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-border-divider flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => openEditPackageModal(pkg)}
                      className="text-xs font-bold text-brand-blue-primary hover:underline"
                    >
                      Edit Package
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="text-xs font-semibold text-status-error hover:underline"
                    >
                      Delete Package
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create / Edit Package Modal */}
          {showPackageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-border-default space-y-4">
                <div className="flex justify-between items-center border-b border-border-divider pb-3">
                  <h4 className="text-base font-bold text-text-primary">
                    {editingPkgId ? "Edit Studio Package" : "Create Studio Package"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPackageModal(false);
                      setEditingPkgId(null);
                    }}
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateOrUpdatePackage} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">Package Name *</label>
                    <input
                      type="text"
                      required
                      value={newPkgName}
                      onChange={(e) => setNewPkgName(e.target.value)}
                      placeholder="e.g. Premium Wedding Photography"
                      className="w-full rounded-xl border border-border-input px-3 py-2 text-xs focus:ring-1 focus:ring-brand-blue-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">Base Price (₹) *</label>
                    <input
                      type="number"
                      required
                      value={newPkgPrice}
                      onChange={(e) => setNewPkgPrice(Number(e.target.value))}
                      className="w-full rounded-xl border border-border-input px-3 py-2 text-xs focus:ring-1 focus:ring-brand-blue-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={newPkgDesc}
                      onChange={(e) => setNewPkgDesc(e.target.value)}
                      placeholder="What is included in this package..."
                      className="w-full rounded-xl border border-border-input px-3 py-2 text-xs focus:ring-1 focus:ring-brand-blue-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">Included Services</label>
                    <input
                      type="text"
                      value={newPkgServices}
                      onChange={(e) => setNewPkgServices(e.target.value)}
                      placeholder="Photography, Videography, Album (comma separated)"
                      className="w-full rounded-xl border border-border-input px-3 py-2 text-xs focus:ring-1 focus:ring-brand-blue-primary"
                    />
                  </div>

                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPkgNegotiable}
                        onChange={(e) => setNewPkgNegotiable(e.target.checked)}
                        className="rounded border-gray-300 text-brand-blue-primary"
                      />
                      Allow Negotiation
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPkgPublished}
                        onChange={(e) => setNewPkgPublished(e.target.checked)}
                        className="rounded border-gray-300 text-brand-blue-primary"
                      />
                      Publish to Marketplace
                    </label>
                  </div>

                  <div className="pt-3 border-t border-border-divider flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPackageModal(false);
                        setEditingPkgId(null);
                      }}
                      className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pkgSaving}
                      className="rounded-xl bg-brand-blue-primary px-5 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-50"
                    >
                      {pkgSaving ? "Saving..." : editingPkgId ? "Update Package" : "Save Package"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Booking Requests & Payments */}
      {activeTab === "bookings" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-text-primary">Marketplace Inquiries &amp; Booking Requests</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Review customer booking requests, agree on negotiated rates, record advance payments, and convert confirmed bookings into OMS orders.
            </p>
          </div>

          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default p-8 text-center bg-white">
              <p className="text-sm font-semibold text-text-secondary">No booking requests received yet.</p>
              <p className="text-xs text-text-tertiary mt-1">Inquiries from the marketplace will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => {
                const bPayments = payments.filter((p) => p.bookingRequestId === b.id);
                const canDirectConfirm =
                  !b.orderId &&
                  (b.bookingStatus === "BOOKING_REQUEST" || b.bookingStatus === "AWAITING_PAYMENT");

                return (
                  <div key={b.id} className="rounded-2xl border border-border-default bg-white p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-divider pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-brand-blue-primary">{b.id}</span>
                          <span className="rounded-full bg-surface-app px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary border border-border-default">
                            {b.bookingStatus}
                          </span>
                          {b.orderId && (
                            <a
                              href={`/${studioId}/dashboard/oms?orderId=${b.orderId}`}
                              className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
                            >
                              <span>OMS Order: {b.orderId} →</span>
                            </a>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-text-primary mt-1">
                          {b.customerName} — {b.packageName || b.eventType}
                        </h4>
                        <p className="text-xs text-text-secondary">
                          {b.customerPhone} {b.customerEmail ? `• ${b.customerEmail}` : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-text-tertiary uppercase">Agreed / Quoted Price</span>
                        <p className="text-lg font-extrabold text-text-primary">
                          ₹{b.agreedPrice.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[10px] text-text-secondary">
                          Advance: ₹{b.advanceRequested.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-text-tertiary">Event Date:</span>{" "}
                        <span className="font-semibold text-text-primary">{b.eventDate}</span>
                      </div>
                      <div>
                        <span className="text-text-tertiary">Location:</span>{" "}
                        <span className="font-semibold text-text-primary">{b.location.address}</span>
                      </div>
                      {b.notes && (
                        <div className="col-span-full">
                          <span className="text-text-tertiary">Notes:</span>{" "}
                          <span className="text-text-secondary">{b.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Negotiation Form */}
                    {b.bookingStatus === "OPEN_FOR_NEGOTIATION" && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-blue-900">Negotiation Requested</span>
                          {negotiatingId !== b.id && (
                            <button
                              type="button"
                              onClick={() => handleStartNegotiate(b)}
                              className="rounded-lg bg-blue-700 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-800"
                            >
                              Enter Agreed Amount
                            </button>
                          )}
                        </div>

                        {negotiatingId === b.id && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-blue-200">
                            <div>
                              <label className="block text-[10px] font-semibold text-blue-900 mb-0.5">Agreed Price (₹)</label>
                              <input
                                type="number"
                                value={negotiatedPrice}
                                onChange={(e) => setNegotiatedPrice(Number(e.target.value))}
                                className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-blue-900 mb-0.5">Advance Requested (₹)</label>
                              <input
                                type="number"
                                value={advanceRequested}
                                onChange={(e) => setAdvanceRequested(Number(e.target.value))}
                                className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex items-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmNegotiation(b.id)}
                                disabled={actionLoading}
                                className="w-full rounded-lg bg-blue-700 py-1.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                              >
                                {actionLoading ? "Saving..." : "Confirm Rate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setNegotiatingId(null)}
                                className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-xs font-semibold text-blue-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Direct Studio Confirmation & Advance Payment Recording (MKT-001) */}
                    {canDirectConfirm && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                          <div>
                            <span className="text-xs font-bold text-emerald-900">
                              Ready for Studio Confirmation
                            </span>
                            <p className="text-[11px] text-emerald-800">
                              Record advance received and convert this inquiry into a confirmed OMS order with a 6-digit customer passkey.
                            </p>
                          </div>
                          {confirmingBookingId !== b.id && (
                            <button
                              type="button"
                              onClick={() => handleStartConfirmBooking(b)}
                              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 transition"
                            >
                              Confirm Advance &amp; Convert to Order
                            </button>
                          )}
                        </div>

                        {confirmingBookingId === b.id && (
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200">
                            <div>
                              <label className="block text-[10px] font-semibold text-emerald-900 mb-0.5">
                                Advance Received (₹)
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={b.agreedPrice}
                                value={confirmAdvanceAmount}
                                onChange={(e) => setConfirmAdvanceAmount(Number(e.target.value))}
                                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-emerald-900 mb-0.5">
                                Payment Method
                              </label>
                              <select
                                value={confirmPaymentMethod}
                                onChange={(e) => setConfirmPaymentMethod(e.target.value as PaymentMethod)}
                                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs"
                              >
                                <option value="UPI">UPI</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CASH">Cash</option>
                                <option value="ONLINE_GATEWAY">Online Gateway</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-emerald-900 mb-0.5">
                                UTR / Ref # (Optional)
                              </label>
                              <input
                                type="text"
                                value={confirmRefNumber}
                                onChange={(e) => setConfirmRefNumber(e.target.value)}
                                placeholder="e.g. UTR4029182"
                                className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex items-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDirectConfirmAndConvert(b.id)}
                                disabled={actionLoading}
                                className="w-full rounded-lg bg-emerald-700 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                {actionLoading ? "Creating Order..." : "Create OMS Order"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingBookingId(null)}
                                className="rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-xs font-semibold text-emerald-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Associated Payment Records & Verification */}
                    {bPayments.length > 0 && (
                      <div className="border-t border-border-divider pt-3 space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                          Recorded Payments
                        </span>
                        {bPayments.map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-surface-app p-3 text-xs border border-border-default"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-text-primary">₹{p.amount.toLocaleString("en-IN")}</span>
                                <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary border border-border-default">
                                  {p.method}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    p.verificationStatus === "VERIFIED"
                                      ? "bg-green-100 text-status-success"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {p.verificationStatus}
                                </span>
                              </div>
                              {p.proof?.referenceNumber && (
                                <p className="text-[11px] text-text-secondary mt-0.5">
                                  Ref/UTR: <span className="font-mono">{p.proof.referenceNumber}</span>
                                </p>
                              )}
                            </div>

                            {p.verificationStatus === "PENDING_VERIFICATION" && (
                              <button
                                type="button"
                                onClick={() => handleVerifyPayment(p.id)}
                                disabled={actionLoading}
                                className="rounded-xl bg-status-success px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
                              >
                                Verify Payment &amp; Confirm Booking
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
