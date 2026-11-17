"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import type { CustomerTrackingView } from "@focoman/types";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageSquare,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { subscribeToAuthState } from "@/lib/firebaseAuth";
import { checkIsStudioStaffAction } from "@/actions/orderActions";
import {
  getOrderCloudPhotosByPasskeyAction,
  submitCloudGalleryReviewAction,
  updateCloudPhotoSelectionAction,
  type HydratedCloudPhoto,
} from "@/actions/storageActions";
import { formatStorageBytes } from "@/lib/storageQuota";

interface CloudPhotoGalleryClientProps {
  view: CustomerTrackingView;
  rawIdentifier: string;
}

type GalleryFilter = "ALL" | "SELECTED" | "UNSELECTED" | "COMMENTS";

export function CloudPhotoGalleryClient({
  view,
  rawIdentifier,
}: CloudPhotoGalleryClientProps) {
  const { order } = view;
  const hasCustomerEmail = Boolean(
    order.customerEmail && order.customerEmail.trim().length > 0
  );

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [enteredPasskey, setEnteredPasskey] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<HydratedCloudPhoto[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filter, setFilter] = useState<GalleryFilter>("ALL");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);

  const [showSubmitBar, setShowSubmitBar] = useState(false);
  const [finalNotes, setFinalNotes] = useState(order.cloudReviewNotes || "");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<string | null>(null);

  const validatePasskey = useCallback(
    (input: string): boolean => {
      const cleanInput = input.trim().toUpperCase();
      if (!cleanInput) return false;
      const numericPinMatch =
        order.trackingPasskey?.match(/\d{6}/g) ||
        order.orderNumber.match(/\d{6}/g) ||
        [];
      if (order.passkeyPin && cleanInput === order.passkeyPin.toUpperCase())
        return true;
      if (
        order.trackingPasskey &&
        cleanInput === order.trackingPasskey.toUpperCase()
      )
        return true;
      if (cleanInput === order.orderNumber.toUpperCase()) return true;
      if (cleanInput === order.id.toUpperCase()) return true;
      if (numericPinMatch.some((pin) => cleanInput === pin)) return true;
      return false;
    },
    [order.passkeyPin, order.trackingPasskey, order.orderNumber, order.id]
  );

  useEffect(() => {
    if (!hasCustomerEmail && typeof window !== "undefined") {
      const sessionKey = `focoman_unlocked_order_${order.id}`;
      if (sessionStorage.getItem(sessionKey) === "true") {
        setIsUnlocked(true);
      }
    }

    const unsubscribe = subscribeToAuthState((user) => {
      setCurrentUser(user);
      setAuthChecked(true);
      if (user) {
        const userEmail = user.email?.toLowerCase();
        const customerEmail = order.customerEmail?.toLowerCase();
        const isOwnerMatch = Boolean(
          (userEmail &&
            order.studioOwnerEmail &&
            userEmail === order.studioOwnerEmail.toLowerCase()) ||
            (order.studioOwnerId && order.studioOwnerId === user.uid)
        );
        const isStaffMatch = Boolean(
          isOwnerMatch ||
            (userEmail && order.staffEmails?.includes(userEmail)) ||
            (order.staffUids && order.staffUids.includes(user.uid))
        );
        const isCustomerMatch = Boolean(
          !isStaffMatch &&
            ((userEmail && customerEmail && userEmail === customerEmail) ||
              (order.customerUid && order.customerUid === user.uid))
        );
        const isCollabMatch = Boolean(
          userEmail &&
            (order.collaborators || []).some(
              (c) => c.email.toLowerCase() === userEmail
            )
        );
        if (isCustomerMatch || isStaffMatch || isCollabMatch) {
          setIsUnlocked(true);
        }

        if (order.studioId) {
          user.getIdToken().then(async (token) => {
            try {
              const res = await checkIsStudioStaffAction({
                studioId: order.studioId || "",
                idToken: token,
              });
              if (res.isStaff) {
                setIsStaffUser(true);
                setIsUnlocked(true);
              }
            } catch {
              // ignore
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [hasCustomerEmail, order]);

  const loadGalleryPhotos = useCallback(async () => {
    if (!isUnlocked) return;
    setLoadingPhotos(true);
    setErrorMsg(null);
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : undefined;
      const res = await getOrderCloudPhotosByPasskeyAction({
        passkey: order.trackingPasskey || rawIdentifier,
        idToken,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Unable to load gallery photos.");
        return;
      }
      setPhotos(res.photos);
      setCanEdit(res.canEdit);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load gallery.");
    } finally {
      setLoadingPhotos(false);
    }
  }, [isUnlocked, currentUser, order.trackingPasskey, rawIdentifier]);

  useEffect(() => {
    if (isUnlocked && authChecked) {
      void loadGalleryPhotos();
    }
  }, [isUnlocked, authChecked, loadGalleryPhotos]);

  const handleVerifyPasskey = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePasskey(enteredPasskey)) {
      setIsUnlocked(true);
      setPasskeyError(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`focoman_unlocked_order_${order.id}`, "true");
      }
    } else {
      setPasskeyError("Invalid 6-digit access PIN. Please check and try again.");
    }
  };

  const selectedCount = useMemo(
    () => photos.filter((p) => Boolean(p.selected)).length,
    [photos]
  );
  const commentedCount = useMemo(
    () => photos.filter((p) => Boolean(p.comment && p.comment.trim())).length,
    [photos]
  );

  const filteredPhotos = useMemo(() => {
    if (filter === "SELECTED") return photos.filter((p) => p.selected);
    if (filter === "UNSELECTED") return photos.filter((p) => !p.selected);
    if (filter === "COMMENTS")
      return photos.filter((p) => Boolean(p.comment && p.comment.trim()));
    return photos;
  }, [photos, filter]);

  const activeLightboxPhoto =
    lightboxIndex !== null && filteredPhotos[lightboxIndex]
      ? filteredPhotos[lightboxIndex]
      : null;

  useEffect(() => {
    if (activeLightboxPhoto) {
      setCommentDraft(activeLightboxPhoto.comment || "");
    }
  }, [activeLightboxPhoto]);

  const togglePhotoSelect = useCallback(
    async (photo: HydratedCloudPhoto) => {
      if (!canEdit && !isStaffUser) return;
      const nextSelected = !photo.selected;
      // Optimistic update
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, selected: nextSelected } : p
        )
      );
      setSavingPhotoId(photo.id);
      try {
        const idToken = currentUser ? await currentUser.getIdToken() : undefined;
        const res = await updateCloudPhotoSelectionAction({
          orderId: order.id,
          photoId: photo.id,
          selected: nextSelected,
          passkey: order.trackingPasskey || rawIdentifier,
          idToken,
        });
        if (!res.success) {
          // rollback
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === photo.id ? { ...p, selected: photo.selected } : p
            )
          );
          setErrorMsg(res.error || "Could not save selection.");
        }
      } finally {
        setSavingPhotoId(null);
      }
    },
    [canEdit, isStaffUser, currentUser, order.id, order.trackingPasskey, rawIdentifier]
  );

  const savePhotoComment = async (photo: HydratedCloudPhoto) => {
    if (!canEdit && !isStaffUser) return;
    setSavingPhotoId(photo.id);
    setErrorMsg(null);
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : undefined;
      const res = await updateCloudPhotoSelectionAction({
        orderId: order.id,
        photoId: photo.id,
        comment: commentDraft,
        passkey: order.trackingPasskey || rawIdentifier,
        idToken,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Could not save comment.");
        return;
      }
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, comment: commentDraft.trim() } : p
        )
      );
    } finally {
      setSavingPhotoId(null);
    }
  };

  // Keyboard navigation inside lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % filteredPhotos.length
        );
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + filteredPhotos.length) % filteredPhotos.length
        );
      } else if (e.key.toLowerCase() === "s" && activeLightboxPhoto) {
        void togglePhotoSelect(activeLightboxPhoto);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, filteredPhotos.length, activeLightboxPhoto, togglePhotoSelect]);

  const handleSubmitFinalSelection = async (approved: boolean) => {
    setSubmittingReview(true);
    setErrorMsg(null);
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : undefined;
      const res = await submitCloudGalleryReviewAction({
        orderId: order.id,
        approved,
        notes: finalNotes,
        passkey: order.trackingPasskey || rawIdentifier,
        idToken,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to submit final selection.");
        return;
      }
      setSubmittedNotice(
        approved
          ? `Selection submitted! ${res.selectedCount ?? selectedCount} photo(s) sent to ${order.studioName}.`
          : `Revision request sent to ${order.studioName}.`
      );
      setShowSubmitBar(false);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#FAF7F2]">
        <Navbar />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center text-sm text-[#57534E]">
          Loading Photo Selection Gallery...
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917]">
        <Navbar />
        <main className="mx-auto max-w-md px-4 py-16">
          <div className="rounded-3xl border border-[#D8D2C4] bg-white p-7 shadow-sm text-center space-y-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange-background text-brand-orange-primary border border-brand-orange-soft">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-brand-blue-primary">
                {order.studioName}
              </span>
              <h1 className="mt-1 text-xl font-extrabold">{order.eventType}</h1>
              <p className="mt-1.5 text-xs text-[#57534E]">
                {hasCustomerEmail
                  ? `This gallery is private. Please sign in with ${order.customerEmail} or enter an authorized editor account to view and select photos.`
                  : "Enter the 6-digit access PIN shared by your studio to unlock this photo selection gallery."}
              </p>
            </div>

            {hasCustomerEmail ? (
              <Link
                href={`/sign-in?redirect=${encodeURIComponent(
                  `/track/${rawIdentifier}/gallery`
                )}`}
                className="w-full inline-flex items-center justify-center rounded-xl bg-brand-blue-primary px-5 py-3 text-xs font-bold text-white hover:bg-sky-600 transition"
              >
                Sign In to Open Gallery →
              </Link>
            ) : (
              <form onSubmit={handleVerifyPasskey} className="space-y-3 text-left">
                <input
                  type="text"
                  value={enteredPasskey}
                  onChange={(e) => setEnteredPasskey(e.target.value)}
                  placeholder="Enter 6-digit access PIN"
                  className="w-full rounded-xl border border-[#D8D2C4] px-4 py-3 text-center font-mono text-sm font-bold tracking-widest outline-none focus:border-brand-orange-primary"
                  required
                />
                {passkeyError && (
                  <p className="text-xs font-semibold text-red-600 text-center">
                    {passkeyError}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-orange-primary px-5 py-3 text-xs font-bold text-white hover:bg-orange-600 transition cursor-pointer"
                >
                  Unlock Photo Gallery →
                </button>
              </form>
            )}

            <Link
              href={`/track/${encodeURIComponent(rawIdentifier)}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57534E] hover:text-[#1C1917]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Order Tracker</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917]">
      {/* Sticky Gallery Header */}
      <header className="sticky top-0 z-30 border-b border-[#D8D2C4] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/track/${encodeURIComponent(rawIdentifier)}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D2C4] bg-[#FAF7F2] px-3 py-1.5 text-xs font-bold text-[#1C1917] hover:bg-white transition shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Order</span>
            </Link>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-blue-primary truncate">
                {order.studioName} · {order.orderNumber}
              </p>
              <h1 className="text-sm sm:text-base font-extrabold truncate">
                {order.eventType} — Photo Selection Gallery
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {selectedCount} Selected
            </span>
            {(canEdit || isStaffUser) && photos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSubmitBar((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-600 transition cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Submit Final Selection</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: `All (${photos.length})` },
                { id: "SELECTED", label: `Selected (${selectedCount})` },
                {
                  id: "UNSELECTED",
                  label: `Unselected (${Math.max(0, photos.length - selectedCount)})`,
                },
                { id: "COMMENTS", label: `Comments (${commentedCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  filter === tab.id
                    ? "bg-[#1C1917] text-white"
                    : "border border-[#D8D2C4] bg-white text-[#57534E] hover:bg-[#FAF7F2]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {!canEdit && !isStaffUser && (
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
              View-only access
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {submittedNotice && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 flex items-center justify-between gap-3">
            <span>✓ {submittedNotice}</span>
            <Link
              href={`/track/${encodeURIComponent(rawIdentifier)}`}
              className="underline font-extrabold shrink-0"
            >
              Return to Order Tracker →
            </Link>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {showSubmitBar && (canEdit || isStaffUser) && (
          <div className="rounded-2xl border border-brand-orange-soft bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-extrabold">
              Confirm &amp; Send {selectedCount} Selected Photo(s) to {order.studioName}
            </h2>
            <p className="text-xs text-[#57534E]">
              Your photographer receives the exact camera filenames for every selected photo and any notes you added.
            </p>
            <textarea
              rows={2}
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
              placeholder="Optional note for album design or retouching (e.g. 'Please soften background on candid shots')..."
              className="w-full rounded-xl border border-[#D8D2C4] px-3.5 py-2 text-xs outline-none focus:border-brand-orange-primary"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitBar(false)}
                className="rounded-xl border border-[#D8D2C4] px-4 py-2 text-xs font-semibold text-[#57534E] hover:bg-[#FAF7F2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReview}
                onClick={() => void handleSubmitFinalSelection(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Request Rework / More Photos</span>
              </button>
              <button
                type="button"
                disabled={submittingReview}
                onClick={() => void handleSubmitFinalSelection(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {submittingReview
                    ? "Submitting..."
                    : `Confirm Selection (${selectedCount})`}
                </span>
              </button>
            </div>
          </div>
        )}

        {loadingPhotos ? (
          <div className="rounded-3xl border border-[#D8D2C4] bg-white p-14 text-center text-sm text-[#57534E]">
            Loading gallery previews...
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#D8D2C4] bg-white p-14 text-center text-sm text-[#57534E]">
            {photos.length === 0
              ? "No proofing photos have been uploaded to this gallery yet."
              : "No photos match this filter."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredPhotos.map((photo, idx) => (
              <div
                key={photo.id}
                className={`group relative rounded-2xl border overflow-hidden bg-white shadow-2xs transition ${
                  photo.selected
                    ? "border-emerald-500 ring-2 ring-emerald-500/25"
                    : "border-[#D8D2C4] hover:border-[#A8A29E]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className="block w-full aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer"
                >
                  {photo.previewUrl ? (
                    <img
                      src={photo.previewUrl}
                      alt={photo.fileName}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[#78716C]">
                      Preview unavailable
                    </div>
                  )}
                </button>

                {(canEdit || isStaffUser) && (
                  <button
                    type="button"
                    disabled={savingPhotoId === photo.id}
                    onClick={() => void togglePhotoSelect(photo)}
                    aria-label={
                      photo.selected
                        ? `Deselect ${photo.fileName}`
                        : `Select ${photo.fileName}`
                    }
                    className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition cursor-pointer ${
                      photo.selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-white/80 bg-black/50 text-white hover:bg-emerald-600"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}

                <div className="p-2.5 flex items-center justify-between gap-2">
                  <span
                    title={photo.fileName}
                    className="truncate font-mono text-[11px] font-bold text-[#1C1917]"
                  >
                    {photo.displayName || photo.fileName}
                  </span>
                  {photo.comment && photo.comment.trim() && (
                    <span
                      title={photo.comment}
                      className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-blue-primary shrink-0"
                    >
                      <MessageSquare className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Fullscreen Lightbox Modal */}
      {activeLightboxPhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Lightbox Bar */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs sm:text-sm font-bold truncate">
                {activeLightboxPhoto.fileName}
              </span>
              <span className="text-[11px] text-white/60 shrink-0">
                {lightboxIndex + 1} / {filteredPhotos.length} ·{" "}
                {formatStorageBytes(activeLightboxPhoto.sizeBytes)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(canEdit || isStaffUser) && (
                <button
                  type="button"
                  onClick={() => void togglePhotoSelect(activeLightboxPhoto)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeLightboxPhoto.selected
                      ? "bg-emerald-600 text-white"
                      : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {activeLightboxPhoto.selected ? "Selected" : "Select Photo"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Close lightbox"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Image Stage */}
          <div
            className="relative flex-1 flex items-center justify-center p-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex(
                    (lightboxIndex - 1 + filteredPhotos.length) %
                      filteredPhotos.length
                  )
                }
                aria-label="Previous photo"
                className="absolute left-3 z-10 rounded-full bg-black/60 p-3 text-white hover:bg-black/90 border border-white/20 cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {activeLightboxPhoto.previewUrl && (
              <img
                src={activeLightboxPhoto.previewUrl}
                alt={activeLightboxPhoto.fileName}
                className="max-h-[72vh] max-w-full object-contain rounded-lg"
              />
            )}

            {filteredPhotos.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length)
                }
                aria-label="Next photo"
                className="absolute right-3 z-10 rounded-full bg-black/60 p-3 text-white hover:bg-black/90 border border-white/20 cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Bottom Comment Bar */}
          <div
            className="border-t border-white/10 bg-[#1C1917] px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                disabled={!canEdit && !isStaffUser}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder={
                  canEdit || isStaffUser
                    ? "Add a retouching note or album comment for this photo..."
                    : "View-only mode"
                }
                className="flex-1 rounded-xl border border-white/20 bg-black/40 px-3.5 py-2 text-xs text-white placeholder:text-white/50 outline-none focus:border-brand-orange-primary"
              />
              {(canEdit || isStaffUser) && (
                <button
                  type="button"
                  disabled={savingPhotoId === activeLightboxPhoto.id}
                  onClick={() => void savePhotoComment(activeLightboxPhoto)}
                  className="rounded-xl bg-brand-blue-primary px-4 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  {savingPhotoId === activeLightboxPhoto.id
                    ? "Saving..."
                    : "Save Note"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
