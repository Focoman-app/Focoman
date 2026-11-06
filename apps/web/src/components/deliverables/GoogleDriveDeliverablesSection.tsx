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
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
    {}
  );

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
      const res = await onSubmitClientReview({
        deliverableId: deliverable.id,
        approved,
        feedback: note,
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to save review status.");
      }
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Google Drive Deliverables & In-App Preview
          </h4>
          <p className="mt-0.5 text-xs text-slate-400">
            Preview photos, videos, album PDFs, or folders directly via Google Drive viewer or open in Google Drive.
          </p>
        </div>

        {canManageLinks && onSaveDeliverables && (
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showAddForm ? "Cancel" : "Add Drive Link"}</span>
          </button>
        )}
      </div>

      {/* Zero-Server-Bandwidth & Access Notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3.5 py-2.5 text-[11px] text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
        <div>
          Media streams directly from Google Drive using your browser internet connection when you click{" "}
          <span className="font-medium text-slate-300">Preview in App</span>. If a file or folder is private, sign into the authorized Google account or use{" "}
          <span className="font-medium text-slate-300">Open in Google Drive</span>.
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Add Link Form (Studio Owner/Staff in OMS) */}
      {canManageLinks && showAddForm && (
        <form
          onSubmit={handleAddDeliverable}
          className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Deliverable Title *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Raw Photo Selection Folder, Wedding Highlight Film, Album Draft PDF"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Media Type
              </label>
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(
                    e.target.value as OrderDriveDeliverable["category"]
                  )
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
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
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Google Drive Share URL *
              </label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/... or /file/d/..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">
                Instructions / Notes for Client (Optional)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Please shortlist 250 photos for album design"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Deliverable Link"}
            </button>
          </div>
        </form>
      )}

      {/* Deliverables List */}
      {deliverables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-xs text-slate-500">
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

            return (
              <div
                key={item.id}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 space-y-3"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-indigo-400">
                      <CategoryIcon category={item.category} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {item.title}
                        </span>
                        <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        {item.clientApproved === true && (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Client Approved
                          </span>
                        )}
                        {item.clientApproved === false && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <RotateCcw className="h-3 w-3" />
                            Revision Requested
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="mt-1 text-xs text-slate-400">
                          {item.notes}
                        </p>
                      )}
                      {item.clientFeedback && !canSubmitClientReview && (
                        <p className="mt-1 text-xs text-indigo-300">
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
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isPreviewOpen
                            ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200"
                            : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors"
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Lazy On-Demand Google Drive Native Embed Viewer */}
                {isPreviewOpen && parsed.previewEmbedUrl && (
                  <div className="space-y-2 pt-2">
                    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                      <iframe
                        src={parsed.previewEmbedUrl}
                        title={`Google Drive Preview - ${item.title}`}
                        className="h-[420px] w-full border-0 bg-slate-950"
                        loading="lazy"
                        allow="autoplay; fullscreen"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        If Google Drive prompts for access or blocks embedding for restricted files, click{" "}
                        <strong className="text-slate-300">Open in Google Drive</strong>.
                      </span>
                      <a
                        href={parsed.openUrl || item.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        <span>Open in new tab</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Client Approval & Feedback Controls (on /track/[passkey]) */}
                {canSubmitClientReview && onSubmitClientReview && (
                  <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
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
                      className="w-full sm:max-w-md rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={reviewingId === item.id}
                        onClick={() => handleReviewAction(item, true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve Deliverable</span>
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === item.id}
                        onClick={() => handleReviewAction(item, false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Request Changes</span>
                      </button>
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
