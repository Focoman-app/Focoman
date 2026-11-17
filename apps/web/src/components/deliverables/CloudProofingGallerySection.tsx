"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import type { Order } from "@focoman/types";
import {
  deleteOrderCloudPhotosAction,
  getOrderCloudPhotosAction,
  getStudioStorageStatusAction,
  type HydratedCloudPhoto,
} from "@/actions/storageActions";
import {
  MAX_PHOTOS_PER_BATCH,
  buildLightroomFilterString,
  formatStorageBytes,
  type StudioStorageQuota,
} from "@/lib/storageQuota";
import { compressProofingPhoto } from "@/utils/imageCompression";

interface CloudProofingGallerySectionProps {
  studioId: string;
  order: Order;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  onPhotosChanged?: (summary: { cloudPhotoCount: number; cloudStorageBytes: number }) => void;
}

type GalleryFilter = "ALL" | "SELECTED" | "COMMENTS";

export function CloudProofingGallerySection({
  studioId,
  order,
  getIdToken,
  onPhotosChanged,
}: CloudProofingGallerySectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [r2Configured, setR2Configured] = useState(true);
  const [quota, setQuota] = useState<StudioStorageQuota | null>(null);
  const [photos, setPhotos] = useState<HydratedCloudPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    phase: "COMPRESSING" | "UPLOADING" | "FINALIZING";
    done: number;
    total: number;
  } | null>(null);

  const [filter, setFilter] = useState<GalleryFilter>("ALL");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [clearingAll, setClearingAll] = useState(false);
  const [copiedLightroom, setCopiedLightroom] = useState(false);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getIdToken(false);
      if (!token) return;
      const [statusRes, photosRes] = await Promise.all([
        getStudioStorageStatusAction({ studioId, idToken: token }),
        getOrderCloudPhotosAction({ orderId: order.id, idToken: token }),
      ]);
      if (statusRes.success && statusRes.quota) {
        setQuota(statusRes.quota);
      }
      setR2Configured(statusRes.r2Configured);
      if (photosRes.success) {
        setPhotos(photosRes.photos);
      } else if (photosRes.error) {
        setErrorMsg(photosRes.error);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load Cloud Proofing Gallery.");
    } finally {
      setLoading(false);
    }
  }, [studioId, order.id, getIdToken]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const selectedPhotos = useMemo(
    () => photos.filter((p) => Boolean(p.selected)),
    [photos]
  );

  const commentedPhotos = useMemo(
    () => photos.filter((p) => Boolean(p.comment && p.comment.trim())),
    [photos]
  );

  const visiblePhotos = useMemo(() => {
    if (filter === "SELECTED") return selectedPhotos;
    if (filter === "COMMENTS") return commentedPhotos;
    return photos;
  }, [filter, photos, selectedPhotos, commentedPhotos]);

  const totalOrderBytes = useMemo(
    () => photos.reduce((sum, p) => sum + Math.max(0, p.sizeBytes || 0), 0),
    [photos]
  );

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (rawFiles.length === 0) return;

    if (!r2Configured) {
      setErrorMsg(
        "Cloud Proofing Storage is pending R2 environment credentials on this server. You can still attach external links below."
      );
      return;
    }

    if (quota && !quota.isCloudStorageEnabled) {
      setErrorMsg(
        "Built-in Cloud Proofing Storage requires the Starter (20 GB) or Professional (50 GB) plan."
      );
      return;
    }

    const imageFiles = rawFiles.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setErrorMsg("Please select valid image files (JPEG, PNG, or WebP).");
      return;
    }

    const batchFiles = imageFiles.slice(0, MAX_PHOTOS_PER_BATCH);
    if (imageFiles.length > MAX_PHOTOS_PER_BATCH) {
      setStatusMsg(
        `Processing first ${MAX_PHOTOS_PER_BATCH} photos in this batch (you can upload additional batches right after).`
      );
    } else {
      setStatusMsg(null);
    }

    setErrorMsg(null);
    setIsUploading(true);

    try {
      const token = await getIdToken(true);
      if (!token) throw new Error("Authentication expired. Please sign in again.");

      // 1. Compress in browser (~2048px WebP/JPEG preserving original filename)
      const compressed: Awaited<ReturnType<typeof compressProofingPhoto>>[] = [];
      for (let i = 0; i < batchFiles.length; i++) {
        setUploadProgress({ phase: "COMPRESSING", done: i, total: batchFiles.length });
        const result = await compressProofingPhoto(batchFiles[i]);
        compressed.push(result);
      }
      setUploadProgress({ phase: "COMPRESSING", done: batchFiles.length, total: batchFiles.length });

      // 2. Request presigned upload URLs (strict quota check on server)
      const presignRes = await fetch("/api/storage/presign-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studioId,
          orderId: order.id,
          files: compressed.map((c) => ({
            fileName: c.fileName,
            mimeType: c.mimeType,
            sizeBytes: c.sizeBytes,
            width: c.width,
            height: c.height,
          })),
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        if (presignData.quota) setQuota(presignData.quota);
        throw new Error(presignData.error || "Unable to authorize photo upload.");
      }

      const uploads: Array<{
        photoId: string;
        fileName: string;
        objectKey: string;
        mimeType: string;
        sizeBytes: number;
        width?: number;
        height?: number;
        uploadUrl: string;
      }> = presignData.uploads || [];

      // 3. Parallel queued PUT directly to R2 (concurrency 4)
      let completedUploads = 0;
      setUploadProgress({ phase: "UPLOADING", done: 0, total: uploads.length });
      const succeeded: typeof uploads = [];
      const concurrency = 4;
      let cursor = 0;

      const worker = async () => {
        while (cursor < uploads.length) {
          const idx = cursor++;
          const target = uploads[idx];
          const blob = compressed[idx].blob;
          const putRes = await fetch(target.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": target.mimeType,
            },
            body: blob,
          });
          if (!putRes.ok) {
            throw new Error(`Upload failed for "${target.fileName}" (HTTP ${putRes.status}). Check R2 CORS policy.`);
          }
          succeeded.push(target);
          completedUploads++;
          setUploadProgress({
            phase: "UPLOADING",
            done: completedUploads,
            total: uploads.length,
          });
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, uploads.length) }, () => worker())
      );

      // 4. Finalize metadata & increment storage ledger
      setUploadProgress({ phase: "FINALIZING", done: succeeded.length, total: uploads.length });
      const completeRes = await fetch("/api/storage/complete-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studioId,
          orderId: order.id,
          photos: succeeded.map((s) => ({
            id: s.photoId,
            fileName: s.fileName,
            objectKey: s.objectKey,
            mimeType: s.mimeType,
            sizeBytes: s.sizeBytes,
            width: s.width,
            height: s.height,
          })),
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error || "Failed to save uploaded photo metadata.");
      }

      if (completeData.quota) setQuota(completeData.quota);
      if (completeData.orderSummary && onPhotosChanged) {
        onPhotosChanged(completeData.orderSummary);
      }

      setStatusMsg(
        `Uploaded ${succeeded.length} proofing photo${succeeded.length === 1 ? "" : "s"} successfully.`
      );
      await loadGallery();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload proofing photos.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDeletePhotos = async (photoIds: string[]) => {
    if (photoIds.length === 0) return;
    setErrorMsg(null);
    if (photoIds.length === photos.length) setClearingAll(true);
    setDeletingIds(new Set(photoIds));
    try {
      const token = await getIdToken(false);
      if (!token) throw new Error("Authentication required.");
      const res = await deleteOrderCloudPhotosAction({
        studioId,
        orderId: order.id,
        photoIds,
        idToken: token,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to remove photos.");
        return;
      }
      const nextPhotos = photos.filter((p) => !photoIds.includes(p.id));
      setPhotos(nextPhotos);
      if (res.quota) setQuota(res.quota);
      if (onPhotosChanged) {
        onPhotosChanged({
          cloudPhotoCount: nextPhotos.length,
          cloudStorageBytes: nextPhotos.reduce((s, p) => s + (p.sizeBytes || 0), 0),
        });
      }
      setStatusMsg(
        `Removed ${res.deletedCount || photoIds.length} photo(s) and freed ${formatStorageBytes(
          res.freedBytes || 0
        )}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete photos.");
    } finally {
      setDeletingIds(new Set());
      setClearingAll(false);
    }
  };

  const handleCopyForLightroom = async () => {
    const names = selectedPhotos.map((p) => p.fileName);
    const filterStr = buildLightroomFilterString(names);
    if (!filterStr) return;
    try {
      await navigator.clipboard.writeText(filterStr);
      setCopiedLightroom(true);
      setTimeout(() => setCopiedLightroom(false), 3000);
    } catch {
      setErrorMsg("Clipboard access denied. Use Download CSV instead.");
    }
  };

  const handleDownloadCsv = () => {
    const targetList = selectedPhotos.length > 0 ? selectedPhotos : photos;
    if (targetList.length === 0) return;
    const escapeCsv = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;
    const rows = [
      ["Filename", "LightroomSearchName", "Selected", "Comment", "SelectedBy"].join(","),
      ...targetList.map((p) =>
        [
          escapeCsv(p.fileName),
          escapeCsv(p.displayName),
          p.selected ? "YES" : "NO",
          escapeCsv(p.comment || ""),
          escapeCsv(p.selectedBy || ""),
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.orderNumber || order.id}-photo-selection.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lightboxPhoto = useMemo(
    () => photos.find((p) => p.id === lightboxPhotoId) || null,
    [photos, lightboxPhotoId]
  );

  return (
    <div className="rounded-2xl border border-border-default bg-white p-5 space-y-4 shadow-2xs">
      {/* Header + Upload CTA */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
              Cloud Proofing Storage &amp; Photo Selection
            </h4>
            {quota && (
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  quota.isCloudStorageEnabled
                    ? quota.isAtCap
                      ? "border-red-200 bg-red-50 text-red-700"
                      : quota.isNearCap
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <HardDrive className="h-3 w-3" />
                {quota.isCloudStorageEnabled
                  ? `${formatStorageBytes(quota.usedBytes)} / ${quota.limitGb} GB (${quota.planLabel})`
                  : "No Cloud Quota (Free Plan)"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Upload compressed proofing previews for client heart/checkmark selection, comments, and 1-click Lightroom filename export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {photos.length > 0 && order.trackingPasskey && (
            <Link
              href={`/track/${encodeURIComponent(order.trackingPasskey)}/gallery`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-bold text-text-primary hover:bg-surface-app transition shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Gallery</span>
            </Link>
          )}

          {quota?.isCloudStorageEnabled ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploading || quota.isAtCap}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition shadow-2xs cursor-pointer"
              >
                <CloudUpload className="h-3.5 w-3.5" />
                <span>{isUploading ? "Uploading..." : "Upload Proofing Photos"}</span>
              </button>
            </>
          ) : (
            <Link
              href={`/checkout?studio=${encodeURIComponent(studioId)}&plan=starter`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition shadow-2xs"
            >
              <span>Unlock 20 GB Cloud Storage</span>
            </Link>
          )}
        </div>
      </div>

      {/* Studio Storage Quota Bar */}
      {quota?.isCloudStorageEnabled && (
        <div className="rounded-xl border border-border-default bg-surface-app/50 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary">
            <span>Studio Cloud Storage Usage</span>
            <span className="font-mono text-text-primary">
              {formatStorageBytes(quota.usedBytes)} of {quota.limitGb} GB ({quota.usedPercent}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                quota.isAtCap
                  ? "bg-red-500"
                  : quota.isNearCap
                  ? "bg-amber-500"
                  : "bg-brand-blue-primary"
              }`}
              style={{ width: `${Math.min(100, quota.usedPercent)}%` }}
            />
          </div>
        </div>
      )}

      {!r2Configured && quota?.isCloudStorageEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          Cloud storage uploads are paused until Cloudflare R2 credentials (<code className="font-mono">R2_ACCOUNT_ID</code>, <code className="font-mono">R2_ACCESS_KEY_ID</code>, <code className="font-mono">R2_SECRET_ACCESS_KEY</code>, <code className="font-mono">R2_BUCKET_NAME</code>) are configured on the server.
        </div>
      )}

      {uploadProgress && (
        <div className="rounded-xl border border-brand-blue-soft bg-brand-blue-background/40 px-3.5 py-2.5 text-xs font-semibold text-brand-blue-primary flex items-center justify-between gap-2">
          <span>
            {uploadProgress.phase === "COMPRESSING"
              ? `Compressing previews in browser (${uploadProgress.done}/${uploadProgress.total})...`
              : uploadProgress.phase === "UPLOADING"
              ? `Uploading to Cloud Storage (${uploadProgress.done}/${uploadProgress.total})...`
              : "Finalizing gallery & updating storage quota..."}
          </span>
          <span className="font-mono text-[11px]">
            {Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)}%
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-status-error">
          {errorMsg}
        </div>
      )}

      {statusMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          {statusMsg}
        </div>
      )}

      {/* Client Selection & Lightroom Export Bar */}
      {photos.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-app/40 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: `All (${photos.length})` },
                  { id: "SELECTED", label: `Selected (${selectedPhotos.length})` },
                  { id: "COMMENTS", label: `Comments (${commentedPhotos.length})` },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                    filter === chip.id
                      ? "bg-text-primary text-white"
                      : "border border-border-default bg-white text-text-secondary hover:bg-surface-app"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
              <span className="ml-1 text-[11px] font-mono text-text-tertiary">
                {formatStorageBytes(totalOrderBytes)} in this order
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCopyForLightroom()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue-primary bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-brand-blue-primary hover:bg-blue-100 transition cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  <span>
                    {copiedLightroom
                      ? "Copied for Lightroom!"
                      : `Copy ${selectedPhotos.length} for Lightroom`}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-white px-2.5 py-1 text-[11px] font-bold text-text-primary hover:bg-surface-app transition cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => void handleDeletePhotos(photos.map((p) => p.id))}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>{clearingAll ? "Clearing..." : "Clear Gallery"}</span>
              </button>
            </div>
          </div>

          {order.cloudReviewSubmittedAt && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Client submitted {selectedPhotos.length} selected photo(s) on{" "}
                {new Date(order.cloudReviewSubmittedAt).toLocaleDateString("en-IN")}
                {order.cloudReviewNotes ? `: "${order.cloudReviewNotes}"` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Thumbnails Grid */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-app/40 px-4 py-6 text-center text-xs text-text-tertiary">
          Loading proofing photos...
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-app/50 px-4 py-6 text-center text-xs text-text-tertiary">
          <ImageIcon className="mx-auto h-5 w-5 text-text-tertiary mb-1.5" />
          No proofing photos uploaded yet. Upload compressed previews for client selection inside this order.
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-app/50 px-4 py-6 text-center text-xs text-text-tertiary">
          No photos match this filter yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {visiblePhotos.map((photo) => (
            <div
              key={photo.id}
              className={`group relative rounded-xl border overflow-hidden bg-surface-app transition ${
                photo.selected
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : "border-border-default"
              }`}
            >
              <button
                type="button"
                onClick={() => setLightboxPhotoId(photo.id)}
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
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-text-tertiary">
                    Preview pending
                  </div>
                )}
              </button>

              {photo.selected && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  ✓ Selected
                </span>
              )}

              <button
                type="button"
                disabled={deletingIds.has(photo.id)}
                onClick={() => void handleDeletePhotos([photo.id])}
                aria-label={`Delete ${photo.fileName}`}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 rounded-full bg-black/70 p-1 text-white hover:bg-red-600 transition cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>

              <div className="p-2 bg-white space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    title={photo.fileName}
                    className="truncate font-mono text-[10px] font-bold text-text-primary"
                  >
                    {photo.displayName || photo.fileName}
                  </span>
                  {photo.comment && (
                    <span title={photo.comment} className="text-brand-blue-primary shrink-0">
                      <MessageSquare className="h-3 w-3" />
                    </span>
                  )}
                </div>
                {photo.comment && (
                  <p className="truncate text-[10px] text-text-secondary" title={photo.comment}>
                    {photo.comment}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Lightbox in OMS */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxPhotoId(null)}
        >
          <div
            className="relative max-w-4xl w-full rounded-2xl bg-[#1C1917] text-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <span className="font-mono text-xs font-bold">{lightboxPhoto.fileName}</span>
                <span className="ml-2 text-[11px] text-white/60">
                  {formatStorageBytes(lightboxPhoto.sizeBytes)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhotoId(null)}
                className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-black max-h-[75vh]">
              {lightboxPhoto.previewUrl && (
                <img
                  src={lightboxPhoto.previewUrl}
                  alt={lightboxPhoto.fileName}
                  className="max-h-[75vh] w-auto object-contain"
                />
              )}
            </div>
            {lightboxPhoto.comment && (
              <div className="px-4 py-3 border-t border-white/10 text-xs text-white/90">
                Client comment: &ldquo;{lightboxPhoto.comment}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
