import type { Metadata } from "next";
import Link from "next/link";
import { getStudioBySlug } from "@focoman/db";
import { hasStudioCapability } from "@/lib/entitlementAuth";
import { DEFAULT_STUDIO_SERVICES } from "@/lib/studioServices";
import { Navbar } from "@/components/Navbar";
import { PublicEnquiryForm } from "@/components/public/PublicEnquiryForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ studioSlug: string }>;
}): Promise<Metadata> {
  const { studioSlug } = await params;
  const cleanSlug = studioSlug.toLowerCase().trim();
  const studio = await getStudioBySlug(cleanSlug);

  if (!studio || studio.isDeleted) {
    return {
      title: "Studio Enquiry | Focoman",
      description: "Send a photography or videography shoot enquiry directly to the studio.",
    };
  }

  return {
    title: `Enquire with ${studio.name} | Focoman`,
    description: `Book photography or videography with ${studio.name}${
      studio.city ? ` in ${studio.city}` : ""
    }. Submit your event details and receive a direct response.`,
  };
}

export default async function StudioEnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ studioSlug: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { studioSlug } = await params;
  const { source } = await searchParams;
  const cleanSlug = studioSlug.toLowerCase().trim();

  const studio = await getStudioBySlug(cleanSlug);
  const isActiveStudio = Boolean(studio) && !studio!.isDeleted;

  const canCapture = isActiveStudio
    ? (await hasStudioCapability(cleanSlug, "CUSTOMER_CRM")) &&
      studio!.leadWebhookConfig?.enabled !== false
    : false;

  const configuredServices =
    studio?.configuredServices && studio.configuredServices.length > 0
      ? studio.configuredServices
      : DEFAULT_STUDIO_SERVICES;

  const serviceNames = configuredServices
    .filter((s) => s.enabled)
    .map((s) => s.name);

  const resolvedServices =
    serviceNames.length > 0
      ? serviceNames
      : DEFAULT_STUDIO_SERVICES.filter((s) => s.enabled).map((s) => s.name);

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#1C1917] flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center px-3.5 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-2xl">
          {!isActiveStudio ? (
            <div className="rounded-xl border border-[#D8D2C4] bg-[#FFFFFF] p-8 shadow-[0_3px_0_#C4BCAB] text-center space-y-4">
              <h1 className="retro-serif-heading text-2xl font-black text-[#1C1917]">
                Studio Not Found
              </h1>
              <p className="text-xs sm:text-sm text-[#57534E]">
                No active photography studio workspace matches{" "}
                <span className="font-mono font-bold text-[#1C1917]">{cleanSlug}</span>.
              </p>
              <Link
                href="/"
                className="inline-flex rounded-lg bg-[#1C1917] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2C2825] transition"
              >
                Return to Focoman
              </Link>
            </div>
          ) : !canCapture ? (
            <div className="rounded-xl border border-[#D8D2C4] bg-[#FFFFFF] p-8 shadow-[0_3px_0_#C4BCAB] text-center space-y-4">
              <h1 className="retro-serif-heading text-2xl font-black text-[#1C1917]">
                {studio!.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#57534E]">
                Online enquiry capture is currently paused for this studio.
              </p>
              <Link
                href="/"
                className="inline-flex rounded-lg border border-[#D8D2C4] bg-[#FAF7F2] px-5 py-2.5 text-xs font-bold text-[#1C1917] hover:bg-[#ECE6DE] transition"
              >
                Back to Home
              </Link>
            </div>
          ) : (
            <PublicEnquiryForm
              studioSlug={cleanSlug}
              studioName={studio!.name}
              studioCity={studio!.city}
              services={resolvedServices}
              source={source}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-[#D8D2C4] bg-[#FAF7F2] py-6">
        <div className="mx-auto max-w-2xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#78716C]">
          <p>Direct Studio Enquiry · Powered by Focoman</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
