import { redirect } from "next/navigation";
import { Order, Task, StudioMember } from "@focoman/types";
import { getOrdersByStudio, getTasksByStudio, getMembersByStudio, getStudioBySlug } from "@focoman/db";
import { BusinessReportsView } from "@/features/dashboard/BusinessReportsView";
import { requireDashboardStudioAccess } from "@/lib/dashboardAccess";
import { getEffectiveStudioTier, getEffectiveStudioFeatures } from "@/lib/proEntitlements";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ studioSlug: string }>;
}) {
  const { studioSlug } = await params;
  await requireDashboardStudioAccess(studioSlug, "STUDIO_OWNER");

  const studio = await getStudioBySlug(studioSlug);
  const studioTier = getEffectiveStudioTier(studio);
  const effectiveFeatures = getEffectiveStudioFeatures(studio?.ownerEmail, studio?.features, studio?.planInfo);

  if (!effectiveFeatures.reports) {
    redirect(`/${studioSlug}/dashboard/oms`);
  }

  const [orders, tasks, members] = await Promise.all([
    getOrdersByStudio(studioSlug) as Promise<Order[]>,
    getTasksByStudio(studioSlug).catch(() => [] as Task[]),
    getMembersByStudio(studioSlug).catch(() => [] as StudioMember[]),
  ]);

  return (
    <BusinessReportsView
      studioSlug={studioSlug}
      initialOrders={orders}
      initialTasks={tasks}
      initialMembers={members}
      studioTier={studioTier}
    />
  );
}
