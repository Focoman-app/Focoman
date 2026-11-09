export class UnauthenticatedSessionError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthenticatedSessionError';
  }
}

export class StudioMembershipRequiredError extends Error {
  constructor(message = 'Studio membership required.') {
    super(message);
    this.name = 'StudioMembershipRequiredError';
  }
}

export function isRejectedDevSessionCookie(cookieValue: string | undefined | null): boolean {
  if (!cookieValue || !cookieValue.trim()) {
    return true;
  }
  const trimmed = cookieValue.trim();
  return (
    trimmed.startsWith('dev_session:') ||
    trimmed.startsWith('focoman_dev_session') ||
    trimmed === 'preview-user'
  );
}

export function isSyntheticBypassUid(uid: string | undefined | null): boolean {
  if (!uid || !uid.trim()) {
    return true;
  }
  const clean = uid.trim();
  return (
    clean.startsWith('owner-') ||
    clean.startsWith('dev-') ||
    clean === 'preview-user' ||
    clean === 'dev-uid'
  );
}

export function canAutoHealStudioOwner(
  studio: {
    id: string;
    name: string;
    ownerId?: string;
    ownerEmail?: string;
    isDeleted?: boolean;
  } | null | undefined,
  uid: string | undefined | null,
  email?: string | null,
  allowVerifiedEmailMatch = false
): boolean {
  if (!studio || studio.isDeleted || !uid || isSyntheticBypassUid(uid)) {
    return false;
  }
  if (studio.ownerId && studio.ownerId === uid) {
    return true;
  }
  if (
    allowVerifiedEmailMatch &&
    studio.ownerEmail &&
    email &&
    studio.ownerEmail.trim().toLowerCase() === email.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function verifyActiveStudioMembership<
  T extends { status: string; role: string; isDeleted?: boolean }
>(
  membership: T | null | undefined,
  studioId: string,
  requiredRole?: string
): T {
  if (!membership || membership.isDeleted || membership.status !== 'ACTIVE') {
    throw new StudioMembershipRequiredError(
      `Authorization denied: You are not an active member of studio "${studioId}".`
    );
  }
  if (requiredRole && membership.role !== requiredRole) {
    throw new StudioMembershipRequiredError(
      `Authorization denied: This action requires the "${requiredRole}" role. ` +
        `Your current role in studio "${studioId}" is "${membership.role}".`
    );
  }
  return membership;
}

export async function evaluateDashboardStudioAccess<
  TAccess extends { membership: { role: string; status: string; isDeleted?: boolean } }
>(
  studioSlug: string,
  requiredRole: string | undefined,
  verifyMember: (slug: string) => Promise<TAccess>
): Promise<
  | { status: 'ALLOWED'; access: TAccess }
  | { status: 'REDIRECT_SIGN_IN'; redirectTo: string }
  | { status: 'FORBIDDEN' }
> {
  try {
    const access = await verifyMember(studioSlug);
    verifyActiveStudioMembership(access?.membership, studioSlug, requiredRole);
    return { status: 'ALLOWED', access };
  } catch (error: unknown) {
    if (error instanceof UnauthenticatedSessionError) {
      return {
        status: 'REDIRECT_SIGN_IN',
        redirectTo: `/sign-in?redirect=${encodeURIComponent(`/${studioSlug}/dashboard`)}`,
      };
    }
    return { status: 'FORBIDDEN' };
  }
}

const TRUSTED_PRODUCTION_HOSTS = new Set([
  'focoman.com',
  'www.focoman.com',
  'beta.focoman.com',
  'focoman.web.app',
  'focoman.firebaseapp.com',
  'focoman.vercel.app',
]);

function extractConfiguredHosts(siteUrl?: string, appUrl?: string): Set<string> {
  const hosts = new Set<string>(TRUSTED_PRODUCTION_HOSTS);
  for (const raw of [siteUrl, appUrl]) {
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.hostname) {
        hosts.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // Ignore malformed env URL
    }
  }
  return hosts;
}

function isLocalhostHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '[::1]';
}

function isAllowedCandidateUrl(
  candidateUrl: URL,
  request: Request,
  isProduction: boolean,
  configuredHosts: Set<string>
): boolean {
  const candidateHost = candidateUrl.host.toLowerCase();
  const candidateHostname = candidateUrl.hostname.toLowerCase();
  const candidateProtocol = candidateUrl.protocol;

  if (candidateProtocol !== 'https:' && candidateProtocol !== 'http:') {
    return false;
  }

  if (isProduction && candidateProtocol !== 'https:' && !isLocalhostHostname(candidateHostname)) {
    return false;
  }

  // 1. Match against request URL origin/host
  try {
    const reqUrl = new URL(request.url);
    if (
      candidateHost === reqUrl.host.toLowerCase() &&
      (!isProduction || candidateProtocol === 'https:' || isLocalhostHostname(candidateHostname))
    ) {
      return true;
    }
  } catch {
    // Ignore malformed request.url
  }

  // 2. Match against x-forwarded-host / host header
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  const directHost = request.headers.get('host')?.trim().toLowerCase();

  if (
    (forwardedHost && candidateHost === forwardedHost) ||
    (directHost && candidateHost === directHost)
  ) {
    return true;
  }

  // 3. Match against explicitly trusted FocoMan domains (HTTPS required)
  if (candidateProtocol === 'https:' && configuredHosts.has(candidateHostname)) {
    return true;
  }

  // 4. Non-production local development & Cloudflare quick tunnel support
  if (!isProduction) {
    if (isLocalhostHostname(candidateHostname)) {
      return true;
    }
    if (
      candidateProtocol === 'https:' &&
      candidateHostname.endsWith('.trycloudflare.com') &&
      candidateHostname.split('.').length === 3
    ) {
      return true;
    }
  }

  return false;
}

export function hasSameOrigin(
  request: Request,
  options?: {
    nodeEnv?: string;
    siteUrl?: string;
    appUrl?: string;
  }
): boolean {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const configuredHosts = extractConfiguredHosts(
    options?.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL,
    options?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL
  );

  const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    const originHeader = request.headers.get('origin')?.trim();
    if (!originHeader || originHeader === 'null') {
      return false;
    }
  }

  const origin = request.headers.get('origin')?.trim();
  if (origin) {
    if (origin === 'null') {
      return false;
    }
    try {
      const originUrl = new URL(origin);
      return isAllowedCandidateUrl(originUrl, request, isProduction, configuredHosts);
    } catch {
      return false;
    }
  }

  // Fallback to Referer when Origin header is omitted by same-origin user agents
  const referer = request.headers.get('referer')?.trim();
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return isAllowedCandidateUrl(refererUrl, request, isProduction, configuredHosts);
    } catch {
      return false;
    }
  }

  return false;
}

export function getSessionCookieOptions(
  request?: Request,
  nodeEnv = process.env.NODE_ENV
) {
  const isProduction = nodeEnv === 'production';
  const host = (
    request?.headers.get('x-forwarded-host') ||
    request?.headers.get('host') ||
    ''
  ).toLowerCase();
  const proto = (request?.headers.get('x-forwarded-proto') || '').toLowerCase();
  const secFetchDest = (request?.headers.get('sec-fetch-dest') || '').toLowerCase();

  const isHttps =
    isProduction ||
    proto.includes('https') ||
    Boolean(request?.url?.startsWith('https://')) ||
    host.endsWith('.run.app');

  const isEmbeddedPreview =
    isHttps && (host.endsWith('.run.app') || secFetchDest === 'iframe');

  if (isEmbeddedPreview) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/',
    };
  }

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
  };
}
