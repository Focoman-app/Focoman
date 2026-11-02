/**
 * Whether Firebase's auth helper should be reached through this app's
 * same-origin /__/auth proxy instead of the canonical Firebase domain.
 */
export function shouldUseSameOriginAuthDomain(
  hostname: string | undefined,
  isDevelopment: boolean,
): boolean {
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".run.app") ||
    hostname.includes("aistudio")
  ) {
    return false;
  }

  if (
    hostname === "focoman.web.app" ||
    hostname === "focoman.vercel.app" ||
    hostname.endsWith(".vercel.app") ||
    hostname === "focoman.com" ||
    hostname === "www.focoman.com"
  ) {
    return true;
  }

  // Quick Tunnel hostnames are random and only used for local development.
  // Do not opt production deployments into auth proxying for arbitrary tunnels.
  return isDevelopment && hostname.endsWith(".trycloudflare.com");
}
