import "server-only";
import { getMembersByStudio, getTasksByMember } from "@focoman/db";
import type { Order, StudioMember } from "@focoman/types";
import type { requireStudioMember } from "@/lib/serverAuth";

export async function findActiveMemberRecord(
  studioId: string,
  email?: string
): Promise<StudioMember | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const members = await getMembersByStudio(studioId);
  return (
    members.find(
      (member) =>
        member.status === "ACTIVE" &&
        member.email.trim().toLowerCase() === normalizedEmail
    ) || null
  );
}

export async function requireAssignedOrderAccess(
  membership: Awaited<ReturnType<typeof requireStudioMember>>,
  email: string | undefined,
  studioId: string,
  order: Order
): Promise<StudioMember | null> {
  if (membership.role === "STUDIO_OWNER") {
    return null;
  }
  const member = await findActiveMemberRecord(studioId, email);
  if (!member) {
    throw new Error("No active crew profile is linked to this account.");
  }

  const tasks = await getTasksByMember(studioId, member.id);
  const isAssigned =
    order.assignedResources?.some((resource) => resource.memberId === member.id) ||
    tasks.some((task) => task.orderId === order.id);
  if (!isAssigned) {
    throw new Error("Access denied: This order is not assigned to your crew profile.");
  }
  return member;
}
