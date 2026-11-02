import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicMarketplaceProfile } from "@/actions/marketplaceActions";
import { getPublishedStudioPackages } from "@focoman/db";
import { Navbar } from "@/components/Navbar";
import { PublicStudioPackagesClient } from "@/features/marketplace/PublicStudioPackagesClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const res = await getPublicMarketplaceProfile(params.slug);
  if (!res.success || !res.profile) {
    return { title: "Studio Not Found | Focoman" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://focoman.web.app";
  const profile = res.profile;
  const title = `${profile.name} — Photography Studio in ${profile.city} | Focoman`;
  const description = profile.description
    ? profile.description.slice(0, 160)
    : `Explore services, verified track records, and packages for ${profile.name} in ${profile.city} on Focoman.`;
  const canonicalUrl = `${baseUrl}/studios/${params.slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, type: "profile", url: canonicalUrl },
  };
}

export default async function StudioPublicProfilePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const res = await getPublicMarketplaceProfile(params.slug);

  if (res.isStudioDeleted) {
    return (
      <div className="min-h-screen bg-surface-app flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-16 flex flex-col items-center justify-center text-center">
          <div className="bg-white rounded-3xl border border-border-default p-8 sm:p-12 shadow-sm w-full">
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight sm:text-3xl">
              Studio Account Closed
            </h1>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              The studio <span className="font-semibold text-text-primary">"{res.studioName || params.slug}"</span> has been closed or deleted by the owner.
            </p>
            <div className="mt-6 p-4 rounded-2xl bg-gray-50 border border-border-default text-xs text-text-secondary text-left space-y-1.5">
              <p className="font-bold text-text-primary">Looking for your order or deliverables?</p>
              <p>Existing orders and proofing galleries associated with this studio remain fully accessible via your tracking PIN or direct order link.</p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/studios"
                className="w-full sm:w-auto rounded-xl bg-text-primary px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-black transition text-center"
              >
                Browse Marketplace
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!res.success || !res.profile) notFound();

  const profile = res.profile;
  const packages = await getPublishedStudioPackages(profile.studioId);

  return (
    <div className="min-h-screen bg-surface-app flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12">
        <Link
          href="/studios"
          className="inline-flex items-center gap-2 text-xs font-semibold text-text-tertiary hover:text-text-primary transition mb-8"
        >
          <span>←</span> Back to Studio Marketplace
        </Link>

        <div className="bg-white rounded-3xl border border-border-default shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-blue-background via-white to-brand-purple-background p-8 sm:p-12 border-b border-border-divider">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt={`${profile.name} logo`}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-border-default shadow-sm bg-white shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-blue-background border border-brand-blue-light/50 text-brand-blue-primary font-bold text-2xl sm:text-3xl flex items-center justify-center shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <span className="inline-block rounded-full bg-brand-blue-background border border-brand-blue-light/50 px-3 py-1 text-[10px] font-bold text-brand-blue-primary uppercase tracking-widest mb-2">
                  Verified Studio Profile
                </span>
                <h1 className="text-3xl font-extrabold text-text-primary tracking-tight sm:text-4xl truncate">
                  {profile.name}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary font-medium">
                  <svg className="h-4 w-4 text-brand-blue-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {profile.city}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-12 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              {profile.description && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">About the Studio</h2>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{profile.description}</p>
                </div>
              )}
              {profile.tags?.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">Specialized Services</h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.tags.map((tag) => (
                      <span key={tag} className="bg-surface-app text-text-primary text-xs font-semibold px-3 py-1.5 rounded-lg border border-border-default">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="rounded-2xl border border-border-default bg-surface-app p-6">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-4">Verified Focoman Metrics</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold text-text-secondary uppercase">On-Time Delivery</p>
                    <p className="text-2xl font-extrabold text-status-success mt-1">{profile.verifiedMetrics?.onTimeDeliveryPercentage || 0}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-text-secondary uppercase">Completed Orders</p>
                    <p className="text-2xl font-extrabold text-text-primary mt-1">{profile.verifiedMetrics?.completedOrdersCount || 0}</p>
                  </div>
                  <p className="text-[9px] text-text-tertiary pt-4 border-t border-border-divider">
                    These metrics are calculated automatically from actual order completion timestamps. Studio owners cannot edit these numbers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border-divider bg-white p-8 sm:p-12">
            <h2 className="text-lg font-bold text-text-primary mb-2">Available Packages &amp; Pricing</h2>
            <p className="text-xs text-text-secondary mb-6">
              Review packages offered by {profile.name}. Select a package to submit a booking inquiry.
            </p>
            <PublicStudioPackagesClient studioId={profile.studioId} packages={packages} />
          </div>
        </div>
      </main>
    </div>
  );
}
