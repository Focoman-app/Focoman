import "server-only";

import { getOrderById } from "@focoman/db";
import type { CloudUploadSession } from "@focoman/types";
import { requireStudioMember } from "@/lib/serverAuth";
import { requireAssignedOrderAccess } from "@/actions/orders/orderAccessHelpers";

/** Re-checks live tenancy and assignment; a persisted uploader UID is not authority. */
export async function authorizeCloudUploadSession(
  session: CloudUploadSession,
  actor: { uid: string; email?: string },
  allowOwnerCancellation = false,
): Promise<void> {
  const membership = await requireStudioMember(actor.uid, session.studioId);
  const order = await getOrderById(session.orderId);
  if (!order || order.studioId.toLowerCase() !== session.studioId.toLowerCase() || order.isDeleted) {
    throw new Error("Upload session is unavailable.");
  }
  await requireAssignedOrderAccess(membership, actor.email, session.studioId, order);
  if (session.actorUid !== actor.uid && !(allowOwnerCancellation && membership.role === "STUDIO_OWNER")) {
    throw new Error("Upload session belongs to another uploader.");
  }
}
