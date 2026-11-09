import { notFound } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StudioWorkspaceProvider } from "@/components/StudioWorkspaceProvider";
import { DashboardTopNav } from "@/components/DashboardTopNav";
import { getStudioBySlug, getMembershipsByUid } from "@focoman/db";
import { Studio } from "@focoman/types";
import { requireDashboardStudioAccess } from "@/lib/dashboardAccess";

import { getEffectiveStudioTier, getEffectiveStudioFeatures } from "@/lib/proEntitlements";

const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || "local";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ studioSlug: string }>;
}) {
  const { studioSlug } = await params;
  const access = await requireDashboardStudioAccess(studioSlug);
  const studio = await getStudioBySlug(studioSlug);

  if (!studio) {
    // Studio slug not found — surface truthful 404
    notFound();
  }

  const userMemberships = access?.membership?.uid
    ? await getMembershipsByUid(access.membership.uid, access.decoded?.email)
    : [];
  const workspacesList = userMemberships
    .filter((m) => !m.isDeleted)
    .map((m) => ({
      studioId: m.studioId,
      studioName: m.studioName,
      role: m.role,
    }));

  const effectiveTier = getEffectiveStudioTier(studio.ownerEmail, studio.planInfo);
  const effectiveFeatures = getEffectiveStudioFeatures(studio.ownerEmail, studio.features, studio.planInfo);
  const sidebarPlan =
    effectiveTier === "COMPLETE"
      ? "complete"
      : effectiveTier === "PROFESSIONAL"
      ? "professional"
      : "basic";

  const serializedStudio: Studio = {
    id: studio.id,
    name: studio.name,
    logoUrl: studio.logoUrl,
    city: studio.city || "",
    ownerId: studio.ownerId,
    ownerName: access?.membership.role === "STUDIO_OWNER" ? studio.ownerName : "Studio Owner",
    ownerEmail: access?.membership.role === "STUDIO_OWNER" ? studio.ownerEmail : "",
    features: effectiveFeatures,
    planInfo: studio.planInfo,
    configuredServices: studio.configuredServices || undefined,
    createdAt: studio.createdAt || new Date().toISOString(),
    updatedAt: studio.updatedAt || new Date().toISOString(),
  };

  return (
    <StudioWorkspaceProvider studio={serializedStudio}>
      <div className="flex h-screen overflow-hidden bg-surface-app flex-col md:flex-row">
        <DashboardSidebar
          studioSlug={studioSlug}
          role={access?.membership.role || "STUDIO_OWNER"}
          plan={sidebarPlan}
          studioName={serializedStudio.name}
          studioLogoUrl={serializedStudio.logoUrl}
          ownerName={serializedStudio.ownerName}
          features={serializedStudio.features}
          appEnv={APP_ENV}
          workspaces={workspacesList}
        />
        <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
          <DashboardTopNav role={access?.membership.role || "STUDIO_OWNER"} planInfo={studio.planInfo} />
          <div id="dashboard-main-content" className="flex-1 overflow-y-auto min-h-0">{children}</div>
        </main>
      </div>
    </StudioWorkspaceProvider>
  );
}
