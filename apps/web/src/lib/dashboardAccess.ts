import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { measurePerformance } from '@/lib/performance';
import {
  requireStudioSessionMember,
  StudioMembershipRequiredError,
  UnauthenticatedSessionError,
} from '@/lib/serverAuth';
import { evaluateDashboardStudioAccess } from '@/lib/sessionSecurity';
import type { StudioMembership } from '@focoman/types';

// React's server-render cache is scoped to this request. Layout/page/role gates
// share one verification; mutation authorization in serverAuth remains uncached.
const getDashboardMembership = cache((studioSlug: string) =>
  measurePerformance('dashboard.access', () => requireStudioSessionMember(studioSlug))
);

export async function requireDashboardStudioAccess(
  studioSlug: string,
  requiredRole?: StudioMembership['role']
): Promise<Awaited<ReturnType<typeof requireStudioSessionMember>>> {
  const decision = await evaluateDashboardStudioAccess(
    studioSlug,
    requiredRole,
    getDashboardMembership
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
