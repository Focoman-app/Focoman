import { redirect } from "next/navigation";
import { Suspense } from "react";
import { toMemberWorkView } from "@focoman/domain";
import { getMembersByStudio, getOrdersByStudio, getTasksByMember, getStudioBySlug, getDashboardOrderProjection } from "@focoman/db";
import { DashboardHomeView } from "@/features/dashboard/DashboardHomeView";
import { MemberWorkDashboardView } from "@/features/dashboard/MemberWorkDashboardView";
import { requireDashboardStudioAccess } from "@/lib/dashboardAccess";
import { getEffectiveStudioTier, getEffectiveStudioFeatures } from "@/lib/proEntitlements";

export default async function DashboardPage({ params }: { params: Promise<{ studioSlug: string }> }) {
  const { studioSlug } = await params;
  const access = await requireDashboardStudioAccess(studioSlug);
  if (access.membership.role === "STUDIO_MEMBER") {
    const normalizedEmail = access.decoded.email?.trim().toLowerCase();
    const members = await getMembersByStudio(studioSlug);
    const member = normalizedEmail
      ? members.find((candidate) => candidate.status === "ACTIVE" && candidate.email.trim().toLowerCase() === normalizedEmail)
      : undefined;

    if (!member) {
      return <MemberWorkDashboardView studioId={studioSlug} orders={[]} initialTasks={[]} hasCrewProfile={false} />;
    }

    const [memberTasks, studioOrders] = await Promise.all([
      getTasksByMember(studioSlug, member.id),
      getOrdersByStudio(studioSlug),
    ]);
    const memberWork = toMemberWorkView(studioSlug, member.id, studioOrders, memberTasks);

    return (
      <MemberWorkDashboardView
        studioId={studioSlug}
        hasCrewProfile
        orders={memberWork.orders}
        initialTasks={memberWork.tasks}
      />
    );
  }

  // Studio owner / admin — fetch orders and studio features
  const studio = await getStudioBySlug(studioSlug);

  const effectiveTier = getEffectiveStudioTier(studio?.ownerEmail || access.decoded.email, studio?.planInfo);
  const effectiveFeatures = getEffectiveStudioFeatures(studio?.ownerEmail || access.decoded.email, studio?.features, studio?.planInfo);

  // Free Plan (₹0) does NOT include the Business Dashboard — direct Free users to OMS
  if (effectiveTier === "FREE" || !effectiveFeatures.basicDashboard) {
    redirect(`/${studioSlug}/dashboard/oms`);
  }

  return (
    <Suspense fallback={<div role="status" className="p-6 text-sm">Loading dashboard summaries…</div>}>
      <OwnerDashboard studioSlug={studioSlug} planTier={effectiveTier} />
    </Suspense>
  );
}

async function OwnerDashboard({ studioSlug, planTier }: { studioSlug: string; planTier: 'FREE' | 'PROFESSIONAL' | 'COMPLETE' }) {
  const orders = await getDashboardOrderProjection(studioSlug);
  return <DashboardHomeView studioSlug={studioSlug} initialOrders={orders} planTier={planTier} />;
}
