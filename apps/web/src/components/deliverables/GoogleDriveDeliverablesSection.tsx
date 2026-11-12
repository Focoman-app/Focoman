"use client";

import React, { useState } from "react";
import {
  FolderOpen,
  Image as ImageIcon,
  Film,
  FileText,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Info,
  Link2,
} from "lucide-react";
import type { OrderDriveDeliverable } from "@focoman/types";
import { parseGoogleDriveUrl } from "@/utils/googleDriveUtils";

export interface GoogleDriveDeliverablesSectionProps {
  orderId: string;
  deliverables: OrderDriveDeliverable[];
  reviewTasks?: Array<{ id: string; title: string }>;
  /** True for Studio Owner/Staff in OMS so they can add/remove Drive deliverable links */
  canManageLinks?: boolean;
  /** True for Primary Customer or Editor collaborator on /track/[passkey] to approve or request changes */
  canSubmitClientReview?: boolean;
  onSaveDeliverables?: (
    updated: OrderDriveDeliverable[]
  ) => Promise<{ success: boolean; error?: string }>;
  onSubmitClientReview?: (input: {
    deliverableId: string;
    approved: boolean;
    feedback?: string;
    selectedPhotos?: string[];
  }) => Promise<{ success: boolean; error?: string }>;
}

const CATEGORY_LABELS: Record<OrderDriveDeliverable["category"], string> = {
  FOLDER: "Google Drive Folder",
  IMAGE: "Photo / Image Set",
  VIDEO: "Video / Film",
  PDF: "Album Proof / PDF",
  OTHER: "Deliverable Link",
};

function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: OrderDriveDeliverable["category"];
  className?: string;
}) {
  switch (category) {
    case "FOLDER":
      return <FolderOpen className={className} />;
    case "IMAGE":
      return <ImageIcon className={className} />;
    case "VIDEO":
      return <Film className={className} />;
    case "PDF":
      return <FileText className={className} />;
    default:
      return <Link2 className={className} />;
  }
}

export function GoogleDriveDeliverablesSection({
  deliverables = [],
  reviewTasks = [],
  canManageLinks = false,
  canSubmitClientReview = false,
  onSaveDeliverables,
  onSubmitClientReview,
}: GoogleDriveDeliverablesSectionProps) {
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] =
    useState<OrderDriveDeliverable["category"]>("FOLDER");
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newLinkedTaskId, setNewLinkedTaskId] = useState("");
  const [newReviewPurpose, setNewReviewPurpose] = useState<"PHOTO_SELECTION" | "FINAL_PROOF">("PHOTO_SELECTION");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
    {}
  );
  const [selectedPhotosDrafts, setSelectedPhotosDrafts] = useState<
    Record<string, string>
  >({});

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveDeliverables) return;
    setErrorMsg(null);

    const cleanTitle = newTitle.trim();
    const cleanUrl = newUrl.trim();
    if (!cleanTitle || !cleanUrl) {
      setErrorMsg("Please provide both a Deliverable Title and a Google Drive link.");
      return;
    }

    const parsed = parseGoogleDriveUrl(cleanUrl);
    const detectedCategory: OrderDriveDeliverable["category"] =
      newCategory === "FOLDER" && parsed.kind === "FILE"
        ? "IMAGE"
        : parsed.kind === "FOLDER"
        ? "FOLDER"
        : newCategory;

    const item: OrderDriveDeliverable = {
      id: `drv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      category: detectedCategory,
      driveUrl: parsed.openUrl || cleanUrl,
      ...(parsed.id ? { driveId: parsed.id } : {}),
      ...(newNotes.trim() ? { notes: newNotes.trim() } : {}),
      ...(newLinkedTaskId ? { linkedTaskId: newLinkedTaskId, reviewPurpose: newReviewPurpose } : {}),
      addedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const res = await onSaveDeliverables([...deliverables, item]);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to add Google Drive link.");
      } else {
        setNewTitle("");
        setNewUrl("");
        setNewNotes("");
        setNewLinkedTaskId("");
        setShowAddForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeliverable = async (id: string) => {
    if (!onSaveDeliverables) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const next = deliverables.filter((d) => d.id !== id);
      const res = await onSaveDeliverables(next);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to remove link.");
      } else if (activePreviewId === id) {
        setActivePreviewId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAction = async (
    deliverable: OrderDriveDeliverable,
    approved: boolean
  ) => {
    if (!onSubmitClientReview) return;
    setReviewingId(deliverable.id);
    setErrorMsg(null);
    try {
      const note =
        feedbackDrafts[deliverable.id] !== undefined
          ? feedbackDrafts[deliverable.id]
          : deliverable.clientFeedback || "";
      const rawPhotosStr =
        selectedPhotosDrafts[deliverable.id] !== undefined
          ? selectedPhotosDrafts[deliverable.id]
          : (deliverable.selectedPhotos || []).join(", ");
      const parsedPhotos = rawPhotosStr
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await onSubmitClientReview({
        deliverableId: deliverable.id,
        approved,
        feedback: note,
        selectedPhotos: parsedPhotos,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to save review status.");
      }
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border-default bg-white p-5 space-y-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
            Google Drive Deliverables &amp; In-App Preview
          </h4>
          <p className="mt-0.5 text-xs text-text-secondary">
            Preview photos, videos, album PDFs, or folders directly via Google Drive viewer, shortlist photo filenames, and submit client review approvals.
          </p>
        </div>

        {canManageLinks && onSaveDeliverables && (
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showAddForm ? "Cancel" : "Add Drive Link"}</span>
          </button>
        )}
      </div>

      {/* Zero-Server-Bandwidth & Access Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border-default bg-surface-app/70 px-3.5 py-2.5 text-[11px] text-text-secondary">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue-primary" />
        <div>
          Media streams directly from Google Drive using your browser internet connection when you click{" "}
          <span className="font-semibold text-text-primary">Preview in App</span>. If a file or folder is private, sign into the authorized Google account or use{" "}
          <span className="font-semibold text-text-primary">Open in Google Drive</span>.
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-status-error font-medium">
          {errorMsg}
        </div>
      )}

      {/* Add Link Form (Studio Owner/Staff in OMS) */}
      {canManageLinks && showAddForm && (
        <form
          onSubmit={handleAddDeliverable}
          className="space-y-3 rounded-xl border border-border-default bg-surface-app/40 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                Deliverable Title *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Raw Photo Selection Folder, Wedding Highlight Film, Album Draft PDF"
                className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                Media Type
              </label>
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(
                    e.target.value as OrderDriveDeliverable["category"]
                  )
                }
                className="w-full rounded-xl border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
              >
                <option value="FOLDER">Google Drive Folder</option>
                <option value="IMAGE">Photo / Image File</option>
                <option value="VIDEO">Video / Film File</option>
                <option value="PDF">Album Proof / PDF</option>
                <option value="OTHER">Other Drive Link</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                Google Drive Share URL *
              </label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/... or /file/d/..."
                className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                Instructions / Notes for Client (Optional)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Please shortlist 250 photos for album design"
                className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
              />
            </div>
          </div>

          {reviewTasks.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-[11px] font-semibold text-text-secondary">Link to customer-review task <span className="font-normal">(Optional)</span>
                <select value={newLinkedTaskId} onChange={(event) => setNewLinkedTaskId(event.target.value)} className="mt-1 w-full rounded-xl border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-blue-primary focus:outline-none">
                  <option value="">Regular deliverable — does not change workflow</option>
                  {reviewTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </select>
              </label>
              {newLinkedTaskId && <label className="text-[11px] font-semibold text-text-secondary">Review purpose
                <select value={newReviewPurpose} onChange={(event) => setNewReviewPurpose(event.target.value as "PHOTO_SELECTION" | "FINAL_PROOF")} className="mt-1 w-full rounded-xl border border-border-default bg-white px-2.5 py-1.5 text-xs text-text-primary focus:border-brand-blue-primary focus:outline-none">
                  <option value="PHOTO_SELECTION">Photo selection</option>
                  <option value="FINAL_PROOF">Final proof approval</option>
                </select>
              </label>}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-border-default bg-white px-3.5 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-app transition shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-blue-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-hover disabled:opacity-50 transition shadow-2xs"
            >
              {saving ? "Saving..." : "Save Deliverable Link"}
            </button>
          </div>
        </form>
      )}

      {/* Deliverables List */}
      {deliverables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-app/60 px-4 py-8 text-center text-xs text-text-tertiary">
          {canManageLinks
            ? "No Google Drive deliverable links added yet. Click 'Add Drive Link' to share photos, videos, or album proofs with the client."
            : "The studio has not shared any Google Drive deliverables for preview yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {deliverables.map((item) => {
            const parsed = parseGoogleDriveUrl(item.driveUrl);
            const isPreviewOpen = activePreviewId === item.id;
            const feedbackVal =
              feedbackDrafts[item.id] !== undefined
                ? feedbackDrafts[item.id]
                : item.clientFeedback || "";
            const selectedPhotosVal =
              selectedPhotosDrafts[item.id] !== undefined
                ? selectedPhotosDrafts[item.id]
                : (item.selectedPhotos || []).join(", ");

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border-default bg-surface-app/30 p-4 space-y-3"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-default bg-white text-brand-blue-primary shadow-2xs">
                      <CategoryIcon category={item.category} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-text-primary">
                          {item.title}
                        </span>
                        <span className="rounded-md border border-border-default bg-surface-app px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        {item.clientApproved === true && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            Client Approved
                          </span>
                        )}
                        {item.clientApproved === false && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            <RotateCcw className="h-3 w-3" />
                            Revision Requested
                          </span>
                        )}
                        {item.selectedPhotos && item.selectedPhotos.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                            {item.selectedPhotos.length} Photo{item.selectedPhotos.length === 1 ? "" : "s"} Selected
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-xs text-text-secondary">
                          {item.notes}
                        </p>
                      )}
                      {item.linkedTaskId && <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-800">{item.reviewPurpose === "PHOTO_SELECTION" ? "Photo selection review" : "Final proof review"}</span>}
                      {item.selectedPhotos && item.selectedPhotos.length > 0 && !canSubmitClientReview && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                            Shortlisted Photos:
                          </span>
                          {item.selectedPhotos.map((photo, idx) => (
                            <span
                              key={`${photo}-${idx}`}
                              className="rounded bg-white border border-border-default px-2 py-0.5 font-mono text-[10px] text-text-primary shadow-2xs"
                            >
                              {photo}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.clientFeedback && !canSubmitClientReview && (
                        <p className="mt-1 text-xs text-brand-blue-primary font-medium">
                          Client Note: &ldquo;{item.clientFeedback}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {parsed.canEmbedPreview && parsed.previewEmbedUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setActivePreviewId(isPreviewOpen ? null : item.id)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition shadow-2xs ${
                          isPreviewOpen
                            ? "border-brand-blue-primary bg-brand-blue-soft text-brand-blue-primary font-bold"
                            : "border-border-default bg-white text-text-primary hover:bg-surface-app"
                        }`}
                      >
                        {isPreviewOpen ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Close Preview</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            <span>Preview in App</span>
                          </>
                        )}
                      </button>
                    )}

                    <a
                      href={parsed.openUrl || item.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-app transition shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Google Drive</span>
                    </a>

                    {canManageLinks && onSaveDeliverables && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDeliverable(item.id)}
                        disabled={saving}
                        aria-label={`Remove ${item.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border-default bg-white text-text-tertiary hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition shadow-2xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Lazy On-Demand Google Drive Native Embed Viewer */}
                {isPreviewOpen && parsed.previewEmbedUrl && (
                  <div className="space-y-2 pt-2">
                    <div className="overflow-hidden rounded-xl border border-border-default bg-surface-app shadow-inner">
                      <iframe
                        src={parsed.previewEmbedUrl}
                        title={`Google Drive Preview - ${item.title}`}
                        className="h-[420px] w-full border-0 bg-white"
                        loading="lazy"
                        allow="autoplay; fullscreen"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-tertiary">
                      <span>
                        If Google Drive prompts for access or blocks embedding for restricted files, click{" "}
                        <strong className="text-text-primary font-semibold">Open in Google Drive</strong>.
                      </span>
                      <a
                        href={parsed.openUrl || item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-brand-blue-primary hover:underline"
                      >
                        <span>Open in new tab</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Client Photo Selection, Approval & Feedback Controls (on /track/[passkey]) */}
                {canSubmitClientReview && onSubmitClientReview && (
                  <div className="border-t border-border-divider pt-3 space-y-2.5">
                    {(item.category === "FOLDER" || item.category === "IMAGE") && (
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                          Selected Photo Numbers / Filenames (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={selectedPhotosVal}
                          onChange={(e) =>
                            setSelectedPhotosDrafts((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          placeholder="e.g. IMG_0012, IMG_0045, IMG_0108, DSC_0291"
                          className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <input
                        type="text"
                        value={feedbackVal}
                        onChange={(e) =>
                          setFeedbackDrafts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Optional selection note or revision feedback for studio..."
                        className="w-full sm:max-w-md rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
                      />
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() => handleReviewAction(item, true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-2xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Save Selection &amp; Approve</span>
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() => handleReviewAction(item, false)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition shadow-2xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Request Changes</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
