import { notFound, redirect } from 'next/navigation';
import {
  requireStudioSessionMember,
  StudioMembershipRequiredError,
  UnauthenticatedSessionError,
} from '@/lib/serverAuth';
import { evaluateDashboardStudioAccess } from '@/lib/sessionSecurity';
import type { StudioMembership } from '@focoman/types';

export async function requireDashboardStudioAccess(
  studioSlug: string,
  requiredRole?: StudioMembership['role']
): Promise<Awaited<ReturnType<typeof requireStudioSessionMember>>> {
  const decision = await evaluateDashboardStudioAccess(
    studioSlug,
    requiredRole,
    requireStudioSessionMember
  );

  if (decision.status === 'REDIRECT_SIGN_IN') {
    redirect(decision.redirectTo);
  }

  if (decision.status !== 'ALLOWED') {
    notFound();
  }

  return decision.access;
}

export async function requireDashboardOwnerAccess(studioSlug: string): Promise<void> {
  await requireDashboardStudioAccess(studioSlug, 'STUDIO_OWNER');
}
export { StudioMembershipRequiredError, UnauthenticatedSessionError };