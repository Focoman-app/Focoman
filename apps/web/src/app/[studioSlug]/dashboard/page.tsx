import { redirect } from "next/navigation";
import { Order } from "@focoman/types";
import { toMemberWorkView } from "@focoman/domain";
import { getMembersByStudio, getOrdersByStudio, getTasksByMember, getStudioBySlug } from "@focoman/db";
import { DashboardHomeView } from "@/features/dashboard/DashboardHomeView";
import { MemberWorkDashboardView } from "@/features/dashboard/MemberWorkDashboardView";
import { requireDashboardStudioAccess } from "@/lib/dashboardAccess";
import { getEffectiveStudioTier } from "@/lib/proEntitlements";

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
  const [orders, studio] = await Promise.all([
    getOrdersByStudio(studioSlug) as Promise<Order[]>,
    getStudioBySlug(studioSlug),
  ]);

  const effectiveTier = getEffectiveStudioTier(studio?.ownerEmail || access.decoded.email, studio?.planInfo);

  // Free Plan (₹0) does NOT include the Business Dashboard — direct Free users to OMS
  if (effectiveTier === "FREE") {
    redirect(`/${studioSlug}/dashboard/oms`);
  }

  const hasMarketplace = true;

  return (
    <DashboardHomeView
      studioSlug={studioSlug}
      initialOrders={orders}
      hasMarketplace={hasMarketplace}
      planTier={effectiveTier}
    />
  );
}
