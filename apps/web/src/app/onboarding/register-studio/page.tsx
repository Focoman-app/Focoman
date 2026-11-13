"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import { FocomanSpinner } from "@/components/FocomanSpinner";
import { subscribeToAuthState, getCurrentUserIdToken, syncServerSession } from "@/lib/firebaseAuth";
import { registerStudioAction, checkStudioSlugAvailabilityAction, getUserWorkspacesAction } from "@/actions/studioActions";
import { setDefaultWorkspace } from "@/lib/workspaceDefaults";
import { User } from "firebase/auth";

export default function RegisterStudioPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [form, setForm] = useState({
    name: "",
    city: "",
    logoUrl: "",
    website: "",
    instagram: "",
  });
  const [logoError, setLogoError] = useState<string | null>(null);

  const [slugPreview, setSlugPreview] = useState("");
  const [availability, setAvailability] = useState<{ checked: boolean; available: boolean; message?: string }>({
    checked: false,
    available: true,
  });

  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingWorkspacesCount, setExistingWorkspacesCount] = useState<number | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(true);

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
      setForm((prev) => ({ ...prev, logoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    setLogoError(null);
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (user) => {
      setCurrentUser(user);
      setLoadingUser(false);
      if (user) {
        try {
          const token = await user.getIdToken();
          const workspaces = await getUserWorkspacesAction(token);
          const count = workspaces.length;
          setExistingWorkspacesCount(count);
          // If user already has existing workspaces, leave unchecked by default to preserve their primary workspace
          if (count > 0) {
            setSetAsDefault(false);
          } else {
            setSetAsDefault(true);
          }
        } catch {
          setExistingWorkspacesCount(0);
          setSetAsDefault(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isCurrent = true;

    if (!slugPreview) {
      setIsChecking(false);
      setAvailability({ checked: false, available: true });
      return;
    }

    const letterCount = (slugPreview.match(/[a-z]/g) || []).length;
    if (letterCount < 3) {
      setIsChecking(false);
      setAvailability({ checked: true, available: false, message: "Name must have at least 3 letters." });
      return;
    }

    setAvailability({ checked: false, available: true });
    setIsChecking(true);
    const timeout = window.setTimeout(async () => {
      try {
        const result = await checkStudioSlugAvailabilityAction(slugPreview);
        if (isCurrent) {
          setAvailability({ checked: true, available: result.available, message: result.message });
        }
      } catch {
        if (isCurrent) {
          setAvailability({ checked: false, available: true, message: "Could not verify availability. You can still submit; registration will recheck the name." });
        }
      } finally {
        if (isCurrent) setIsChecking(false);
      }
    }, 450);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [slugPreview]);

  const handleNameChange = (name: string) => {
    setForm((prev) => ({ ...prev, name }));
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSlugPreview(slug);
    setAvailability({ checked: false, available: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMessage("Please sign in with Google first before registering a studio.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    // CHG-010: Get a fresh ID token — UID and profile are verified server-side from the token.
    const idToken = await getCurrentUserIdToken(true);
    if (!idToken) {
      setErrorMessage("Authentication error. Please sign in again.");
      setIsSubmitting(false);
      return;
    }

    const cleanWebsite = form.website.trim().replace(/^https?:\/\//i, "");
    const formattedWebsite = cleanWebsite ? `https://${cleanWebsite}` : undefined;

    const res = await registerStudioAction({
      name: form.name,
      city: form.city,
      logoUrl: form.logoUrl || undefined,
      website: formattedWebsite,
      instagram: form.instagram || undefined,
      idToken,
    });

    setIsSubmitting(false);

    if (res.success && res.studio) {
      if (setAsDefault) {
        await setDefaultWorkspace(currentUser.uid, res.studio.id, idToken);
      }
      await syncServerSession();
      router.push(`/${res.studio.id}/dashboard/services?onboarding=true`);
    } else {
      setErrorMessage(res.error || "Failed to register studio. Please choose another name.");
    }
  };

  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton fallbackHref="/workspaces" />
        </div>
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-10">
          <div className="border-b border-border-divider pb-6">
            <span className="inline-block rounded-full bg-brand-orange-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-orange-primary">
              Studio Owner Setup
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Register Your Studio
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Set up your photography business workspace. Your Google account will become the authenticated Studio Owner.
            </p>
          </div>

          {!loadingUser && !currentUser && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">
              Note: You are not currently signed in with Google. You can fill in the details below, but will need to sign in with Google to complete registration.
            </div>
          )}

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-600">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" suppressHydrationWarning>
            <div>
              <label htmlFor="studio-name" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                Studio Name *
              </label>
              <input
                id="studio-name"
                type="text"
                required
                placeholder="e.g. Luminary Wedding Films"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border-default px-4 py-2.5 text-sm outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
              />
              {slugPreview && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
                  <span className="text-text-tertiary">
                    Studio Identifier: <code className="font-mono text-brand-orange-primary font-semibold">/{slugPreview}</code>
                  </span>
                  <span className="font-semibold text-text-secondary">
                    {isChecking ? (
                      <span className="inline-flex items-center gap-1.5">
                        <FocomanSpinner size="xs" />
                        Checking availability...
                      </span>
                    ) : availability.checked && availability.available ? (
                      "Identifier is available."
                    ) : (
                      ""
                    )}
                  </span>
                </div>
              )}
              {(availability.checked && !availability.available || availability.message && !isChecking) && (
                <p className={`mt-1 text-xs font-semibold ${!availability.checked ? "text-amber-600" : availability.available ? "text-emerald-600" : "text-red-600"}`}>
                  {availability.available ? availability.message : availability.message || "Identifier already in use."}
                </p>
              )}
            </div>

            {/* Studio Logo (Optional) */}
            <div className="rounded-2xl border border-border-default bg-surface-app/40 p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                Studio Logo (Optional)
              </label>
              <p className="text-xs text-text-muted mb-3">
                Appears next to your studio name across your workspace.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="w-14 h-14 rounded-2xl object-cover border border-border-default shadow-xs bg-white shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-brand-orange-background border border-dashed border-brand-orange-light flex items-center justify-center text-brand-orange-primary font-extrabold text-xl shrink-0">
                    {form.name ? form.name.charAt(0).toUpperCase() : "S"}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-slate-50 transition shadow-2xs">
                      <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{form.logoUrl ? "Change Logo" : "Upload Logo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isSubmitting}
                        className="hidden"
                      />
                    </label>

                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={isSubmitting}
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
              <label htmlFor="studio-city" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                City / Primary Location *
              </label>
              <input
                id="studio-city"
                type="text"
                required
                placeholder="e.g. Chennai, Tamil Nadu"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border-default px-4 py-2.5 text-sm outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
              />
            </div>

            <div>
              <label htmlFor="studio-website" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                Website (Optional)
              </label>
              <div className="mt-1.5 flex rounded-xl border border-border-default bg-white overflow-hidden focus-within:border-brand-orange-primary focus-within:ring-1 focus-within:ring-brand-orange-primary">
                <span className="inline-flex items-center px-3.5 bg-slate-50 text-text-muted text-xs font-medium border-r border-border-default select-none">
                  https://
                </span>
                <input
                  id="studio-website"
                  type="text"
                  placeholder="luminaryweddings.com"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value.replace(/^https?:\/\//i, '') })}
                  className="w-full px-3.5 py-2.5 text-sm outline-none bg-transparent text-text-primary placeholder:text-text-muted"
                />
              </div>
            </div>

            <div>
              <label htmlFor="studio-instagram" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                Instagram / Social Handle (Optional)
              </label>
              <input
                id="studio-instagram"
                type="text"
                placeholder="@luminaryweddings"
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-border-default px-4 py-2.5 text-sm outline-none focus:border-brand-orange-primary focus:ring-1 focus:ring-brand-orange-primary"
              />
            </div>

            <div className="rounded-2xl border border-border-default/80 bg-surface-subtle/50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border-default text-brand-orange-primary focus:ring-brand-orange-primary"
                />
                <div className="text-xs">
                  <span className="font-semibold text-text-primary">
                    Set as default workspace
                  </span>
                  <p className="text-text-secondary text-[11px] mt-0.5 leading-relaxed">
                    {existingWorkspacesCount && existingWorkspacesCount > 0
                      ? "Make this new studio your default workspace on sign-in, or leave unchecked to keep your current default studio."
                      : "Automatically opens this studio workspace whenever you sign in."}
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-border-divider">
              <Link href="/workspaces" className="text-xs font-semibold text-text-secondary hover:text-text-primary">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || isChecking || (availability.checked && !availability.available)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-orange-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <FocomanSpinner size="xs" />
                    <span>Creating Workspace...</span>
                  </>
                ) : (
                  "Complete Registration"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
