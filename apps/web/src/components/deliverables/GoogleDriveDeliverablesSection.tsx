"use client";

import React, { useState } from "react";
import {
  FolderOpen,
  Image as ImageIcon,
  Film,
  FileText,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Link2,
} from "lucide-react";
import type { OrderDriveDeliverable } from "@focoman/types";
import { parseDeliverableStorageUrl } from "@/utils/googleDriveUtils";

export interface GoogleDriveDeliverablesSectionProps {
  orderId: string;
  deliverables: OrderDriveDeliverable[];
  /** True for Studio Owner/Staff in OMS so they can add/remove storage deliverable links */
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
  FOLDER: "Photos Folder Link",
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
  canManageLinks = false,
  canSubmitClientReview = false,
  onSaveDeliverables,
  onSubmitClientReview,
}: GoogleDriveDeliverablesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");
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
      setErrorMsg("Please provide both a Deliverable Title and a Photos / Storage link.");
      return;
    }

    const parsed = parseDeliverableStorageUrl(cleanUrl);
    if (!parsed.isValidUrl) {
      setErrorMsg("Please enter a valid HTTPS link (e.g. Google Drive, Dropbox, OneDrive, etc.).");
      return;
    }

    const detectedCategory: OrderDriveDeliverable["category"] =
      parsed.kind === "FILE"
        ? "IMAGE"
        : parsed.kind === "FOLDER"
        ? "FOLDER"
        : "OTHER";

    const item: OrderDriveDeliverable = {
      id: `drv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      category: detectedCategory,
      driveUrl: parsed.openUrl || cleanUrl,
      ...(newNotes.trim() ? { notes: newNotes.trim() } : {}),
      addedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const res = await onSaveDeliverables([...deliverables, item]);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to add photos link.");
      } else {
        setNewTitle("");
        setNewUrl("");
        setNewNotes("");
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
            Photos &amp; Deliverables Links
          </h4>
          <p className="mt-0.5 text-xs text-text-secondary">
            Share links from Google Drive, Dropbox, OneDrive, or any cloud gallery, shortlist photo filenames, and submit client review approvals.
          </p>
        </div>

        {canManageLinks && onSaveDeliverables && (
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-hover transition shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showAddForm ? "Cancel" : "Add Photos Link"}</span>
          </button>
        )}
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
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                Deliverable Title *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Raw Photo Selection Folder, Wedding Highlight Film, Album Proof"
                className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                  Photos / Storage Link *
                </label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://dropbox.com/..."
                  className="w-full rounded-xl border border-border-default bg-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-brand-blue-primary focus:outline-none focus:ring-1 focus:ring-brand-blue-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-text-secondary">
                  Optional Notes
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
          </div>

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
              {saving ? "Saving..." : "Save Photos Link"}
            </button>
          </div>
        </form>
      )}

      {/* Deliverables List */}
      {deliverables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-app/60 px-4 py-8 text-center text-xs text-text-tertiary">
          {canManageLinks
            ? "No photos or deliverable links added yet. Click 'Add Photos Link' to share Google Drive, Dropbox, OneDrive, or gallery links with the client."
            : "The studio has not shared any photos or deliverable links yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {deliverables.map((item) => {
            const parsed = parseDeliverableStorageUrl(item.driveUrl);
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
                          {parsed.isValidUrl && parsed.providerLabel !== "Storage Link"
                            ? parsed.providerLabel
                            : CATEGORY_LABELS[item.category]}
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
                    <a
                      href={parsed.openUrl || item.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-blue-primary bg-blue-50/50 px-3 py-1.5 text-xs font-bold text-brand-blue-primary hover:bg-blue-100 transition shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open Photos Link</span>
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

                {/* Client Photo Selection, Approval & Feedback Controls (on /track/[passkey]) */}
                {canSubmitClientReview && onSubmitClientReview && (
                  <div className="border-t border-border-divider pt-3 space-y-2.5">
                    {(item.category === "FOLDER" || item.category === "IMAGE" || item.category === "OTHER") && (
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
