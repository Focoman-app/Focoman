"use client";

import { useState } from "react";
import { submitPublicStudioEnquiryAction } from "@/actions/leadActions";

interface PublicEnquiryFormProps {
  studioSlug: string;
  studioName: string;
  studioCity?: string;
  services: string[];
  source?: string;
}

export function PublicEnquiryForm({
  studioSlug,
  studioName,
  studioCity,
  services,
  source,
}: PublicEnquiryFormProps) {
  const defaultService = services[0] || "Wedding Photography";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState(defaultService);
  const [customEventType, setCustomEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);

  const normalizedSource = (source || "").toLowerCase().trim();
  const sourceCaption =
    normalizedSource === "google-maps" ||
    normalizedSource === "google_maps" ||
    normalizedSource === "gmb"
      ? "Google Maps & Search Enquiry"
      : normalizedSource === "instagram" || normalizedSource === "ig"
      ? "Instagram Bio Enquiry"
      : "Direct Studio Enquiry";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError("Please enter your name and phone number so the studio can contact you.");
      return;
    }

    const resolvedEventType =
      eventType === "__CUSTOM__"
        ? customEventType.trim() || "Custom Photography Package"
        : eventType;

    setIsSubmitting(true);
    try {
      const res = await submitPublicStudioEnquiryAction({
        studioSlug,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        eventType: resolvedEventType,
        eventDate: eventDate.trim() || undefined,
        location: location.trim() || undefined,
        message: message.trim() || undefined,
        source,
      });

      if (!res.success || !res.leadId) {
        setError(res.error || "Unable to submit your enquiry. Please try again.");
        return;
      }

      setSubmittedLeadId(res.leadId);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setEventType(defaultService);
    setCustomEventType("");
    setEventDate("");
    setLocation("");
    setMessage("");
    setError(null);
    setSubmittedLeadId(null);
  };

  if (submittedLeadId) {
    return (
      <div className="rounded-xl border border-[#86EFAC] bg-[#FFFFFF] p-6 sm:p-8 shadow-[0_3px_0_#C4BCAB] text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-[#86EFAC] bg-[#F0FDF4] text-xl font-black text-[#16A34A]">
          ✓
        </div>
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#16A34A]">
            Enquiry Received
          </p>
          <h2 className="retro-serif-heading text-2xl font-black text-[#1C1917]">
            Thank you, {name.trim()}
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed max-w-md mx-auto">
            Your shoot enquiry has been sent directly to <strong className="text-[#1C1917]">{studioName}</strong>. They will reach out to you on <strong className="text-[#1C1917] tabular-nums">{phone.trim()}</strong> shortly.
          </p>
        </div>

        <div className="mx-auto max-w-sm rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-4 py-3 text-left text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8C857B]">Reference ID</span>
            <span className="font-mono font-bold text-[#1C1917] tabular-nums">{submittedLeadId}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8C857B]">Service</span>
            <span className="font-semibold text-[#1C1917] truncate">
              {eventType === "__CUSTOM__" ? customEventType || "Custom Shoot" : eventType}
            </span>
          </div>
          {eventDate && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8C857B]">Preferred Date</span>
              <span className="font-semibold text-[#1C1917] tabular-nums">{eventDate}</span>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-4 py-2 text-xs font-bold text-[#1C1917] hover:bg-[#ECE6DE] transition"
          >
            Submit Another Enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#D8D2C4] bg-[#FFFFFF] p-5 sm:p-8 shadow-[0_3px_0_#C4BCAB] space-y-5"
    >
      <div className="border-b border-[#E6E0D4] pb-4 space-y-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#E85D04]">
          {sourceCaption} · {studioCity || "Photography & Videography"}
        </p>
        <h1 className="retro-serif-heading text-2xl sm:text-3xl font-black text-[#1C1917]">
          Enquire with {studioName}
        </h1>
        <p className="text-xs sm:text-sm text-[#57534E]">
          Share your event date and requirements. Your enquiry goes directly into the studio&apos;s order desk.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="enquiry-name" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Your Name <span className="text-red-600">*</span>
          </label>
          <input
            id="enquiry-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Karthik & Divya"
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#8C857B] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="enquiry-phone" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Phone / WhatsApp Number <span className="text-red-600">*</span>
          </label>
          <input
            id="enquiry-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#8C857B] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="enquiry-service" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Event / Service Needed
          </label>
          <select
            id="enquiry-service"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          >
            {services.map((svc) => (
              <option key={svc} value={svc}>
                {svc}
              </option>
            ))}
            <option value="__CUSTOM__">Other / Custom Package</option>
          </select>
        </div>

        <div>
          <label htmlFor="enquiry-date" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Preferred Event Date
          </label>
          <input
            id="enquiry-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>
      </div>

      {eventType === "__CUSTOM__" && (
        <div>
          <label htmlFor="enquiry-custom-service" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Specify Event / Shoot Type
          </label>
          <input
            id="enquiry-custom-service"
            type="text"
            value={customEventType}
            onChange={(e) => setCustomEventType(e.target.value)}
            placeholder="e.g. Engagement, Baby Shower, Corporate Event"
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#8C857B] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="enquiry-location" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Event City / Venue
          </label>
          <input
            id="enquiry-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={studioCity ? `e.g. ${studioCity}` : "Venue or City"}
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#8C857B] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="enquiry-email" className="block text-xs font-bold text-[#1C1917] mb-1.5">
            Email (Optional)
          </label>
          <input
            id="enquiry-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#8C857B] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="enquiry-message" className="block text-xs font-bold text-[#1C1917] mb-1.5">
          Shoot Requirements / Notes (Optional)
        </label>
        <textarea
          id="enquiry-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about timings, number of days, album preference, or any questions..."
          className="w-full rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#8C857B] focus:bg-[#FFFFFF] focus:border-[#0EA5E9] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-[#E85D04] px-6 py-3.5 text-sm font-bold text-white shadow-[0_3px_0_#9A3412] active:translate-y-[2px] active:shadow-none transition hover:bg-[#EA580C] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Sending Enquiry..." : "Send Shoot Enquiry →"}
      </button>
    </form>
  );
}
