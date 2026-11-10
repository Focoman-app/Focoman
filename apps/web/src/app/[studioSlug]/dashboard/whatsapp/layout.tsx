import { redirect } from "next/navigation";
import { requireDashboardOwnerAccess } from "@/lib/dashboardAccess";
import { getStudioBySlug } from "@focoman/db";
import { getEffectiveStudioFeatures } from "@/lib/proEntitlements";

export default async function OwnerWhatsappLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ studioSlug: string }>;
}) {
  const { studioSlug } = await params;
  await requireDashboardOwnerAccess(studioSlug);

  const studio = await getStudioBySlug(studioSlug);
  const features = getEffectiveStudioFeatures(studio?.ownerEmail, studio?.features, studio?.planInfo);

  if (!features.whatsapp) {
    redirect(`/${studioSlug}/dashboard/oms`);
  }

  return children;
}
