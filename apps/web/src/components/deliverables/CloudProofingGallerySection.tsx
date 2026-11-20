"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Ban,
  Check,
  CheckCircle2,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  MessageSquare,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { Order } from "@focoman/types";
import {
  deleteOrderCloudPhotosAction,
  getOrderCloudPhotosAction,
  getStudioStorageStatusAction,
  getOrderCloudStorageSettingsAction,
  updateOrderCloudStorageSettingsAction,
  getOriginalPhotoDownloadUrlAction,
  updateCloudPhotoSelectionAction,
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

type GalleryFilter = "ALL" | "SELECTED" | "REJECTED" | "COMMENTS";

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
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSessionIdsRef = useRef<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<{
    phase: "COMPRESSING" | "UPLOADING" | "FINALIZING";
    done: number;
    total: number;
    bytesTransferred?: number;
    totalBytes?: number;
    speedBytesPerSec?: number;
    etaSeconds?: number | null;
    completedCount?: number;
    failedCount?: number;
  } | null>(null);

  const [filter, setFilter] = useState<GalleryFilter>("ALL");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [clearingAll, setClearingAll] = useState(false);
  const [copiedLightroom, setCopiedLightroom] = useState(false);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  const [settings, setSettings] = useState<{ compressionEnabled: boolean; proofingEnabled: boolean }>({
    compressionEnabled: order.cloudStorageSettings?.compressionEnabled ?? true,
    proofingEnabled: order.cloudStorageSettings?.proofingEnabled ?? false,
  });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getIdToken(false);
      if (!token) return;
      const [statusRes, photosRes, settingsRes] = await Promise.all([
        getStudioStorageStatusAction({ studioId, idToken: token }),
        getOrderCloudPhotosAction({ orderId: order.id, idToken: token }),
        getOrderCloudStorageSettingsAction({ studioId, orderId: order.id, idToken: token }),
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
      if (settingsRes.success && settingsRes.settings) {
        setSettings({
          compressionEnabled: settingsRes.settings.compressionEnabled,
          proofingEnabled: settingsRes.settings.proofingEnabled,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load Cloud Proofing Gallery.");
    } finally {
      setLoading(false);
    }
  }, [studioId, order.id, getIdToken]);

  const handleToggleSetting = async (key: "compressionEnabled" | "proofingEnabled", value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setUpdatingSettings(true);
    try {
      const token = await getIdToken(false);
      if (!token) return;
      const res = await updateOrderCloudStorageSettingsAction({
        studioId,
        orderId: order.id,
        settings: next,
        idToken: token,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to update gallery settings.");
        setSettings(settings);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update settings.");
      setSettings(settings);
    } finally {
      setUpdatingSettings(false);
    }
  };

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const selectedPhotos = useMemo(
    () => photos.filter((p) => p.selectionStatus === "SELECTED" || Boolean(p.selected)),
    [photos]
  );

  const rejectedPhotos = useMemo(
    () => photos.filter((p) => p.selectionStatus === "REJECTED"),
    [photos]
  );

  const commentedPhotos = useMemo(
    () => photos.filter((p) => Boolean(p.comment && p.comment.trim())),
    [photos]
  );

  const visiblePhotos = useMemo(() => {
    if (filter === "SELECTED") return selectedPhotos;
    if (filter === "REJECTED") return rejectedPhotos;
    if (filter === "COMMENTS") return commentedPhotos;
    return photos;
  }, [filter, photos, selectedPhotos, rejectedPhotos, commentedPhotos]);

  const totalOrderBytes = useMemo(
    () => photos.reduce((sum, p) => sum + Math.max(0, p.sizeBytes || 0), 0),
    [photos]
  );

  const handleCancelUpload = async () => {
    if (!isUploading) return;
    abortControllerRef.current?.abort();
    const token = await getIdToken(false).catch(() => null);
    const sessionIdsToClean = Array.from(activeSessionIdsRef.current);
    if (token && sessionIdsToClean.length > 0) {
      await Promise.allSettled(
        sessionIdsToClean.map((sessionId) =>
          fetch("/api/storage/cancel-upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId }),
          })
        )
      );
    }
    activeSessionIdsRef.current.clear();
    setIsUploading(false);
    setUploadProgress(null);
    setStatusMsg("Upload cancelled. In-flight storage reservations released.");
  };

  const handleUpdatePhotoStatus = async (
    photoId: string,
    status: "NOT_REVIEWED" | "SELECTED" | "REJECTED"
  ) => {
    const token = await getIdToken(false);
    if (!token) return;
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? {
              ...p,
              selectionStatus: status,
              selected: status === "SELECTED",
            }
          : p
      )
    );
    try {
      const res = await updateCloudPhotoSelectionAction({
        orderId: order.id,
        photoId,
        selectionStatus: status,
        idToken: token,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to update selection.");
        void loadGallery();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update selection.");
      void loadGallery();
    }
  };

  const executeUpload = async (batchFiles: File[]) => {
    if (batchFiles.length === 0) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setIsUploading(true);
    abortControllerRef.current = new AbortController();
    activeSessionIdsRef.current = new Set();
    const signal = abortControllerRef.current.signal;

    try {
      const token = await getIdToken(true);
      if (!token) throw new Error("Authentication expired. Please sign in again.");

      // 1. Prepare files: compress if compression is enabled, or send original file bytes
      const filePayloads: Array<{
        blob: Blob | File;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        originalFile: File;
      }> = [];

      for (let i = 0; i < batchFiles.length; i++) {
        if (signal.aborted) throw new Error("Upload cancelled.");
        setUploadProgress({
          phase: "COMPRESSING",
          done: i,
          total: batchFiles.length,
          completedCount: 0,
          failedCount: 0,
        });
        const source = batchFiles[i];
        if (settings.compressionEnabled) {
          // RAW stays byte-identical even when compression is enabled.
          if (/\.(cr2|cr3|nef|arw|dng)$/i.test(source.name)) {
            filePayloads.push({
              blob: source,
              fileName: source.name,
              mimeType: source.type || "application/octet-stream",
              sizeBytes: source.size,
              originalFile: source,
            });
          } else {
            const result = await compressProofingPhoto(source);
            filePayloads.push({
              blob: result.blob,
              fileName: result.fileName,
              mimeType: result.mimeType,
              sizeBytes: result.sizeBytes,
              originalFile: source,
            });
          }
        } else {
          filePayloads.push({
            blob: source,
            fileName: source.name,
            mimeType: source.type || "application/octet-stream",
            sizeBytes: source.size,
            originalFile: source,
          });
        }
      }
      setUploadProgress({
        phase: "COMPRESSING",
        done: batchFiles.length,
        total: batchFiles.length,
        completedCount: 0,
        failedCount: 0,
      });

      if (signal.aborted) throw new Error("Upload cancelled.");

      const sha256 = async (blob: Blob) =>
        Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      // 2. Presign upload sessions
      const admissionFiles = await Promise.all(
        filePayloads.map(async (c) => ({
          fileName: c.fileName,
          sourceSizeBytes: c.originalFile.size,
          sourceMimeType: c.originalFile.type || "application/octet-stream",
          mimeType: c.mimeType,
          sizeBytes: c.sizeBytes,
          sha256: await sha256(c.blob),
          lastModified: c.originalFile.lastModified,
          idempotencyKey: crypto.randomUUID().replace(/-/g, ""),
        }))
      );

      const presignRes = await fetch("/api/storage/presign-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studioId,
          orderId: order.id,
          files: admissionFiles,
        }),
        signal,
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        if (presignData.quota) setQuota(presignData.quota);
        throw new Error(presignData.error || "Unable to authorize photo upload.");
      }

      const rawUploads: Array<{
        photoId: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        sessionId: string;
        partCount: number;
        partSizeBytes: number;
      }> = presignData.uploads || [];

      const uploads = rawUploads.map((u, idx) => ({ ...u, index: idx }));
      uploads.forEach((u) => activeSessionIdsRef.current.add(u.sessionId));

      // 3. Upload parts with 4 concurrency, byte tracking, smoothed speed, and transient retries
      const totalUploadBytes = uploads.reduce((sum, u) => sum + u.sizeBytes, 0);
      let bytesTransferred = 0;
      let completedUploads = 0;
      let failedUploadsCount = 0;
      const succeeded: typeof uploads = [];
      const failedFileItems: File[] = [];
      const uploadStartTime = Date.now();

      setUploadProgress({
        phase: "UPLOADING",
        done: 0,
        total: uploads.length,
        bytesTransferred: 0,
        totalBytes: totalUploadBytes,
        speedBytesPerSec: 0,
        etaSeconds: null,
        completedCount: 0,
        failedCount: 0,
      });

      const concurrency = 4;
      let cursor = 0;

      const worker = async () => {
        while (cursor < uploads.length) {
          if (signal.aborted) break;
          const targetIndex = cursor++;
          const target = uploads[targetIndex];
          const payload = filePayloads[target.index];
          const blob = payload.blob;
          let fileFailed = false;

          try {
            for (let first = 1; first <= target.partCount; first += 8) {
              if (signal.aborted) throw new Error("Upload cancelled.");
              const partNumbers = Array.from(
                { length: Math.min(8, target.partCount - first + 1) },
                (_, i) => first + i
              );

              // Transient retry for preparing upload parts (max 3 attempts)
              let partsData: { parts?: Array<{ partNumber: number; sizeBytes: number; url: string }>; error?: string } = {};
              for (let attempt = 0; attempt < 3; attempt++) {
                if (signal.aborted) throw new Error("Upload cancelled.");
                try {
                  const partsRes = await fetch("/api/storage/upload-parts", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ sessionId: target.sessionId, partNumbers }),
                    signal,
                  });
                  partsData = await partsRes.json();
                  if (partsRes.ok && partsData.parts) break;
                  if (partsRes.status >= 400 && partsRes.status < 500 && partsRes.status !== 408 && partsRes.status !== 429) {
                    throw new Error(partsData.error || `Could not prepare ${target.fileName}.`);
                  }
                } catch (e) {
                  if (signal.aborted) throw e;
                  if (attempt === 2) throw e;
                }
                const backoffMs = Math.min(2500, 400 * Math.pow(2, attempt)) + Math.random() * 200;
                await new Promise((r) => setTimeout(r, backoffMs));
              }

              if (!partsData.parts) {
                throw new Error(partsData.error || `Could not prepare ${target.fileName}.`);
              }

              for (const part of partsData.parts) {
                if (signal.aborted) throw new Error("Upload cancelled.");
                const start = (part.partNumber - 1) * target.partSizeBytes;
                const partBlob = blob.slice(start, start + part.sizeBytes);

                // Transient retry for PUT part bytes (max 3 attempts)
                let putSuccess = false;
                let lastStatus = 0;
                for (let attempt = 0; attempt < 3; attempt++) {
                  if (signal.aborted) throw new Error("Upload cancelled.");
                  try {
                    const putRes = await fetch(part.url, { method: "PUT", body: partBlob, signal });
                    if (putRes.ok) {
                      putSuccess = true;
                      break;
                    }
                    lastStatus = putRes.status;
                    if (lastStatus >= 400 && lastStatus < 500 && lastStatus !== 408 && lastStatus !== 429) {
                      break;
                    }
                  } catch (e) {
                    if (signal.aborted) throw e;
                    if (attempt === 2) throw e;
                  }
                  const backoffMs = Math.min(2500, 400 * Math.pow(2, attempt)) + Math.random() * 200;
                  await new Promise((r) => setTimeout(r, backoffMs));
                }

                if (!putSuccess) {
                  throw new Error(`Upload failed for "${target.fileName}" (HTTP ${lastStatus}).`);
                }

                bytesTransferred += part.sizeBytes;
                const elapsedSec = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
                const currentSpeed = Math.round(bytesTransferred / elapsedSec);
                const remainingBytes = Math.max(0, totalUploadBytes - bytesTransferred);
                const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : null;

                setUploadProgress({
                  phase: "UPLOADING",
                  done: completedUploads,
                  total: uploads.length,
                  bytesTransferred,
                  totalBytes: totalUploadBytes,
                  speedBytesPerSec: currentSpeed,
                  etaSeconds,
                  completedCount: completedUploads,
                  failedCount: failedUploadsCount,
                });
              }
            }
          } catch (err) {
            fileFailed = true;
            failedUploadsCount++;
            failedFileItems.push(payload.originalFile);
            if (signal.aborted) throw err;
          }

          if (!fileFailed && !signal.aborted) {
            succeeded.push(target);
            completedUploads++;
            const elapsedSec = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
            const currentSpeed = Math.round(bytesTransferred / elapsedSec);
            const remainingBytes = Math.max(0, totalUploadBytes - bytesTransferred);
            const etaSeconds = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : null;

            setUploadProgress({
              phase: "UPLOADING",
              done: completedUploads,
              total: uploads.length,
              bytesTransferred,
              totalBytes: totalUploadBytes,
              speedBytesPerSec: currentSpeed,
              etaSeconds,
              completedCount: completedUploads,
              failedCount: failedUploadsCount,
            });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, uploads.length) }, () => worker())
      );

      if (signal.aborted) throw new Error("Upload cancelled.");

      // 4. Finalize uploaded sessions in bounded batches of max 20
      if (succeeded.length > 0) {
        setUploadProgress({
          phase: "FINALIZING",
          done: succeeded.length,
          total: uploads.length,
          bytesTransferred,
          totalBytes: totalUploadBytes,
          completedCount: succeeded.length,
          failedCount: failedUploadsCount,
        });

        const COMPLETION_CHUNK_SIZE = 20;
        let finalizedCount = 0;

        for (let i = 0; i < succeeded.length; i += COMPLETION_CHUNK_SIZE) {
          if (signal.aborted) break;
          const chunk = succeeded.slice(i, i + COMPLETION_CHUNK_SIZE);
          try {
            const completeRes = await fetch("/api/storage/complete-upload", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ sessionIds: chunk.map((s) => s.sessionId) }),
              signal,
            });

            const completeData = await completeRes.json();
            if (!completeRes.ok) {
              chunk.forEach((c) => {
                failedFileItems.push(filePayloads[c.index].originalFile);
              });
            } else {
              const results: Array<{ sessionId: string; state: string; error?: string }> =
                completeData.results || [];
              for (const c of chunk) {
                const resItem = results.find((r) => r.sessionId === c.sessionId);
                if (resItem && resItem.state === "FAILED") {
                  failedFileItems.push(filePayloads[c.index].originalFile);
                } else {
                  finalizedCount++;
                  activeSessionIdsRef.current.delete(c.sessionId);
                }
              }
            }
          } catch {
            chunk.forEach((c) => {
              failedFileItems.push(filePayloads[c.index].originalFile);
            });
          }
        }

        if (finalizedCount > 0) {
          setStatusMsg(
            `Uploaded and finalized ${finalizedCount} photo${finalizedCount === 1 ? "" : "s"}. ${
              failedFileItems.length > 0
                ? `${failedFileItems.length} photo(s) failed and can be retried.`
                : ""
            }`
          );
        }
      }

      setFailedFiles(failedFileItems);
      if (failedFileItems.length > 0 && succeeded.length === 0) {
        setErrorMsg(`Failed to upload ${failedFileItems.length} photo(s). Click "Retry Failed Files" to try again.`);
      }

      await loadGallery();
    } catch (err: unknown) {
      if (signal.aborted) {
        setStatusMsg("Upload cancelled by user.");
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Failed to upload proofing photos.");
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const acceptedExtensions = /\.(jpe?g|png|webp|cr2|cr3|nef|arw|dng)$/i;
    const imageFiles = rawFiles.filter((f) => f.type.startsWith("image/") || acceptedExtensions.test(f.name));
    if (imageFiles.length === 0) {
      setErrorMsg("Please select JPEG, PNG, WebP, CR2, CR3, NEF, ARW, or DNG files.");
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

    void executeUpload(batchFiles);
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
      ["Filename", "LightroomSearchName", "Selected", "SelectionStatus", "Tags", "Comment", "SelectedBy"].join(","),
      ...targetList.map((p) =>
        [
          escapeCsv(p.fileName),
          escapeCsv(p.displayName),
          p.selected ? "YES" : "NO",
          escapeCsv(p.selectionStatus || (p.selected ? "SELECTED" : "NOT_REVIEWED")),
          escapeCsv((p.tags || []).join("; ")),
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
              {isUploading ? (
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition shadow-2xs cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel Upload</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={quota.isAtCap}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition shadow-2xs cursor-pointer"
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  <span>Upload Photos</span>
                </button>
              )}
              {failedFiles.length > 0 && !isUploading && (
                <button
                  type="button"
                  onClick={() => void executeUpload(failedFiles)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry {failedFiles.length} Failed Photo(s)</span>
                </button>
              )}
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

      {/* Cloud Storage & Proofing Settings Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-default bg-white p-3.5 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.compressionEnabled}
              disabled={updatingSettings}
              onChange={(e) => handleToggleSetting("compressionEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-brand-orange-primary focus:ring-brand-orange-primary cursor-pointer"
            />
            <div>
              <span className="font-bold text-text-primary">Image Compression</span>
              <span className="block text-[11px] text-text-tertiary">
                {settings.compressionEnabled
                  ? "ON · Compress uploads to ~2048px WebP to conserve plan quota"
                  : "OFF · Store exact original file bytes without raster compression"}
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.proofingEnabled}
              disabled={updatingSettings}
              onChange={(e) => handleToggleSetting("proofingEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-border-default text-brand-orange-primary focus:ring-brand-orange-primary cursor-pointer"
            />
            <div>
              <span className="font-bold text-text-primary">Photo Selection Access</span>
              <span className="block text-[11px] text-text-tertiary">
                {settings.proofingEnabled
                  ? "ENABLED · Customers can open the gallery and submit photo selections"
                  : "DISABLED · Gallery hidden from customer tracking view"}
              </span>
            </div>
          </label>
        </div>

        {updatingSettings && (
          <span className="text-[11px] text-text-tertiary animate-pulse font-medium">
            Saving settings...
          </span>
        )}
      </div>

      {!settings.compressionEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs text-amber-900 space-y-0.5">
          <span className="font-bold">Notice: Image compression is OFF.</span>
          <p className="text-[11px] text-amber-800">
            Original uncompressed files (especially RAW or high-resolution photos) consume your studio storage quota faster. Photo selection previews for customer viewing will require derivative generation.
          </p>
        </div>
      )}

      {!settings.proofingEnabled && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs text-slate-700">
          <span className="font-semibold">Photo Selection Access is DISABLED.</span> Photos uploaded here are stored in cloud storage but remain hidden from the customer on their tracking page.
        </div>
      )}

      {!r2Configured && quota?.isCloudStorageEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          Cloud storage uploads are paused until Cloudflare R2 credentials (<code className="font-mono">R2_ACCOUNT_ID</code>, <code className="font-mono">R2_ACCESS_KEY_ID</code>, <code className="font-mono">R2_SECRET_ACCESS_KEY</code>, <code className="font-mono">R2_BUCKET_NAME</code>) are configured on the server.
        </div>
      )}

      {uploadProgress && (
        <div className="rounded-xl border border-brand-blue-soft bg-brand-blue-background/40 px-3.5 py-3 text-xs font-semibold text-brand-blue-primary space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span>
              {uploadProgress.phase === "COMPRESSING"
                ? `Compressing photos in browser (${uploadProgress.done}/${uploadProgress.total})...`
                : uploadProgress.phase === "UPLOADING"
                ? `Uploading (${uploadProgress.completedCount || 0}/${uploadProgress.total} completed${
                    uploadProgress.failedCount ? `, ${uploadProgress.failedCount} failed` : ""
                  })...`
                : `Finalizing ${uploadProgress.done}/${uploadProgress.total} photo metadata in Cloud Storage...`}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px]">
                {uploadProgress.phase === "UPLOADING" && uploadProgress.totalBytes
                  ? `${Math.round(((uploadProgress.bytesTransferred || 0) / Math.max(1, uploadProgress.totalBytes)) * 100)}%`
                  : `${Math.round((uploadProgress.done / Math.max(1, uploadProgress.total)) * 100)}%`}
              </span>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="rounded-lg border border-red-300 bg-white px-2 py-0.5 text-[10px] font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                Cancel Upload
              </button>
            </div>
          </div>

          {uploadProgress.phase === "UPLOADING" && uploadProgress.totalBytes ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-brand-blue-primary transition-all duration-200"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((uploadProgress.bytesTransferred || 0) / Math.max(1, uploadProgress.totalBytes)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-text-secondary pt-0.5">
                <span>
                  {formatStorageBytes(uploadProgress.bytesTransferred || 0)} of {formatStorageBytes(uploadProgress.totalBytes)}
                </span>
                <span className="flex items-center gap-2">
                  {uploadProgress.speedBytesPerSec ? (
                    <span>{formatStorageBytes(uploadProgress.speedBytesPerSec)}/s</span>
                  ) : null}
                  {uploadProgress.etaSeconds !== null && uploadProgress.etaSeconds !== undefined ? (
                    <span>ETA: {uploadProgress.etaSeconds}s</span>
                  ) : null}
                </span>
              </div>
            </div>
          ) : null}
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
                  { id: "REJECTED", label: `Rejected (${rejectedPhotos.length})` },
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

              {photo.selectionStatus === "SELECTED" || photo.selected ? (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  ✓ Selected
                </span>
              ) : photo.selectionStatus === "REJECTED" ? (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  ✕ Rejected
                </span>
              ) : null}

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
                {photo.tags && photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {photo.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-mono text-slate-600">
                        #{tag}
                      </span>
                    ))}
                    {photo.tags.length > 2 && (
                      <span className="text-[9px] text-slate-400">+{photo.tags.length - 2}</span>
                    )}
                  </div>
                )}
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold">{lightboxPhoto.fileName}</span>
                <span className="text-[11px] text-white/60">
                  {formatStorageBytes(lightboxPhoto.sizeBytes)}
                </span>
                {(lightboxPhoto.selectionStatus === "SELECTED" || lightboxPhoto.selected) && (
                  <span className="rounded-full bg-emerald-600/80 px-2 py-0.5 text-[10px] font-bold text-white">
                    Selected
                  </span>
                )}
                {lightboxPhoto.selectionStatus === "REJECTED" && (
                  <span className="rounded-full bg-rose-600/80 px-2 py-0.5 text-[10px] font-bold text-white">
                    Rejected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdatePhotoStatus(
                      lightboxPhoto.id,
                      lightboxPhoto.selectionStatus === "SELECTED" || lightboxPhoto.selected
                        ? "NOT_REVIEWED"
                        : "SELECTED"
                    )
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    lightboxPhoto.selectionStatus === "SELECTED" || lightboxPhoto.selected
                      ? "bg-emerald-600 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  ✓ Select
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdatePhotoStatus(
                      lightboxPhoto.id,
                      lightboxPhoto.selectionStatus === "REJECTED" ? "NOT_REVIEWED" : "REJECTED"
                    )
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    lightboxPhoto.selectionStatus === "REJECTED"
                      ? "bg-rose-600 text-white"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  ✕ Reject
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxPhotoId(null)}
                  className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center bg-black max-h-[75vh]">
              {lightboxPhoto.previewUrl ? (
                <img
                  src={lightboxPhoto.previewUrl}
                  alt={lightboxPhoto.fileName}
                  className="max-h-[75vh] w-auto object-contain"
                />
              ) : (
                <div className="py-20 text-center text-xs text-white/40">
                  Preview unavailable or processing.
                </div>
              )}
            </div>
            {lightboxPhoto.tags && lightboxPhoto.tags.length > 0 && (
              <div className="px-4 py-2 border-t border-white/10 flex flex-wrap gap-1.5 items-center text-xs text-white/70">
                <span className="font-semibold text-white/50 text-[11px]">Tags:</span>
                {lightboxPhoto.tags.map((t) => (
                  <span key={t} className="rounded bg-white/15 px-2 py-0.5 font-mono text-[11px] text-white/90">
                    #{t}
                  </span>
                ))}
              </div>
            )}
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
