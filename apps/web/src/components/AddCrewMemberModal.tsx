"use client";

import { useState, useEffect } from "react";
import { createMemberAction } from "@/actions/memberActions";
import { useStudioWorkspace } from "@/components/StudioWorkspaceProvider";

const SKILL_LABELS: Record<string, string> = {
  PHOTOGRAPHY: "Photographer",
  VIDEOGRAPHY: "Videographer",
  PHOTO_EDITING: "Photo Editor",
  ALBUM_DESIGN: "Album Designer",
};

const ALL_SKILLS = ["PHOTOGRAPHY", "VIDEOGRAPHY", "PHOTO_EDITING", "ALBUM_DESIGN"];

export interface AddCrewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  studioSlug: string;
  initialName?: string;
  initialSkills?: string[];
  onSuccess?: (member: {
    id: string;
    name: string;
    skills: string[];
    invitationCode?: string;
    claimCode?: string;
    email?: string;
    linkToken?: string;
  }) => void;
}

export function AddCrewMemberModal({
  isOpen,
  onClose,
  studioSlug,
  initialName,
  initialSkills = ["PHOTOGRAPHY"],
  onSuccess,
}: AddCrewMemberModalProps) {
  const { idToken: workspaceToken, getIdToken } = useStudioWorkspace();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initialName || "",
    email: "",
    phone: "",
    claimCode: "",
    skills: initialSkills,
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialName || "",
        email: "",
        phone: "",
        claimCode: Math.floor(100000 + Math.random() * 900000).toString(),
        skills: initialSkills.length > 0 ? initialSkills : ["PHOTOGRAPHY"],
      });
      setModalError(null);
    }
  }, [isOpen, initialName, initialSkills]);

  if (!isOpen) return null;

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Full name is required.");
      return;
    }
    if (form.skills.length === 0) {
      setModalError("At least one certified skill must be selected.");
      return;
    }
    if (!form.email.trim() && !/^\d{6}$/.test(form.claimCode)) {
      setModalError("A 6-digit access PIN is required when no email is provided.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const token = (await getIdToken(true)) ?? workspaceToken;
      if (!token) {
        setModalError("Authentication error. Please sign in again.");
        setIsSubmitting(false);
        return;
      }

      const res = await createMemberAction({
        idToken: token,
        studioId: studioSlug,
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        claimCode: form.email.trim() ? undefined : form.claimCode.trim(),
        skills: form.skills,
      });

      setIsSubmitting(false);

      if (res.success && res.invitation) {
        onSuccess?.({
          id: res.invitation.id,
          name: form.name.trim(),
          skills: form.skills,
          invitationCode: res.invitationCode || res.invitation.id,
          claimCode: form.claimCode,
          email: form.email.trim() || undefined,
          linkToken: res.invitationLinkToken,
        });
        onClose();
      } else {
        setModalError(res.error || "Failed to create crew member.");
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setModalError(err instanceof Error ? err.message : "Failed to create crew member.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-border-default animate-in fade-in duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border-default">
          <div>
            <div className="badge-brand-purple mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-purple-primary" />
              Crew Member
            </div>
            <h3 className="text-base font-bold text-text-primary">Add Crew Member</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {modalError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
            {modalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-text-primary">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
            />
          </div>

          <div>
            <label className="block font-bold text-text-primary">Email</label>
            <input
              type="email"
              placeholder="crew@studio.com"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                  claimCode: e.target.value
                    ? ""
                    : form.claimCode || Math.floor(100000 + Math.random() * 900000).toString(),
                })
              }
              className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">
              Provide email for Google sign-in auth, or leave blank to use the auto-generated 6-digit access PIN below.
            </p>
          </div>

          {!form.email.trim() && (
            <div className="rounded-xl border border-brand-purple-soft/60 bg-brand-purple-background/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-brand-purple-primary block">
                  6-Digit Guest Access PIN *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      claimCode: Math.floor(100000 + Math.random() * 900000).toString(),
                    }))
                  }
                  className="text-[10px] font-bold text-brand-purple-primary hover:underline cursor-pointer"
                >
                  Regenerate PIN
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={6}
                placeholder="e.g. 492015"
                value={form.claimCode}
                onChange={(e) =>
                  setForm({ ...form, claimCode: e.target.value.replace(/\D/g, "").slice(0, 6) })
                }
                className={`w-full rounded-xl bg-white px-3.5 py-2 font-mono text-sm font-extrabold tracking-widest text-text-primary outline-none transition ${
                  form.claimCode.length !== 6
                    ? "border border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "border border-border-default focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
                }`}
              />
              {form.claimCode.length !== 6 && (
                <p className="mt-1 text-[11px] font-medium text-rose-600">PIN must be 6 digits.</p>
              )}
              <p className="text-[11px] text-text-secondary">
                Share this 6-digit PIN alongside the invitation link with your crew member to join the studio without a Google email account.
              </p>
            </div>
          )}

          <div>
            <label className="block font-bold text-text-primary">Phone</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-purple-primary focus:ring-1 focus:ring-brand-purple-primary"
            />
          </div>

          <div>
            <label className="block font-bold text-text-primary mb-1.5">Certified Skills *</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SKILLS.map((skill) => (
                <label
                  key={skill}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-[11px] font-semibold transition ${
                    form.skills.includes(skill)
                      ? "border-brand-purple-primary bg-brand-purple-background/40 text-brand-purple-primary"
                      : "border-border-default text-text-secondary hover:bg-surface-app"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.skills.includes(skill)}
                    onChange={() => toggleSkill(skill)}
                    className="rounded text-brand-purple-primary"
                  />
                  <span>{SKILL_LABELS[skill] || skill}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-brand-outline cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.name.trim()}
              className="btn-brand-purple disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
