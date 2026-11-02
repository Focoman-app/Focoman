import { isDevPortalAuthenticated } from "@/lib/devPortalAuth";
import { isDevPortalPasswordFreePreview } from "@/lib/devPortalCrypto";
import { DevPortal } from "@/components/dev-portal/DevPortal";

export const dynamic = "force-dynamic";

export default async function DevPortalPage() {
  return <DevPortal authenticated={await isDevPortalAuthenticated()} preview={isDevPortalPasswordFreePreview()} />;
}
