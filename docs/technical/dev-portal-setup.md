# FocoMan internal developer portal

Status: local implementation; production DNS, hosting, credentials, and provider integrations require setup.

The portal is a separate internal application view. It returns aggregate counts only, never customer, order, or studio documents. The public hostname is intended to be `dev.4command.com`; the application rewrites its root to the internal portal. For local development use `http://localhost:3000/devportal`. Host routing is not an authorization boundary.

**Temporary development preview:** Only when `NODE_ENV=development` and `DEV_PORTAL_ALLOW_UNAUTHENTICATED=true` is explicitly set on the server process, the portal and its aggregate metrics endpoint do not require a password. Anyone who can reach that development server can view its metrics, including visitors on the local network and through public tunnels. Use only on trusted networks, do not expose the server through a public tunnel, and use isolated test data. Signing out does not lock the portal in this mode. Without the opt-in or in production, the independent portal session is required.

## Authentication setup

On a trusted interactive terminal, run `node scripts/generate-dev-portal-secrets.mjs`. Enter a strong unique password twice; it is not echoed. The command outputs a salted scrypt hash and a random session signing secret. Privately add `DEV_PORTAL_PASSWORD_HASH` and `DEV_PORTAL_SESSION_SECRET` to the server environment/secret manager; never commit or share them. Restart the server after configuration. No password is stored in code. Rotating both values invalidates existing sessions.

Login requires working Firestore server credentials: a shared account-level rate limit is stored in `_internal_security/dev_portal_login`. Login fails closed if configuration or Firestore is unavailable. Five attempts in 15 minutes lock the shared account temporarily; an attacker could deliberately cause lockout, so add edge/WAF rate limiting before public deployment. The portal uses a separate four-hour HttpOnly, SameSite=Strict session cookie and does not accept studio/dev-preview sessions. Production requires HTTPS and accepts login/logout only from `https://dev.4command.com`. Password-only access remains weaker than MFA; restrict access at the edge where possible.

## Data and limitations

The current portal reads Firestore aggregation counts for studios, CRM customer records, orders, orders created this UTC month, and verified/pending payment records. Totals include archived records; customer records are not unique people. Missing/failed metrics are unavailable, never zero. It does not expose individual records. Active studios, expenses, earnings, ratings, API usage, provider quotas, GCP cost/usage, email delivery, WhatsApp usage, and Git/deployment metrics are not yet connected; the UI says unavailable.

## Domain and deployment

Confirm control of `4command.com` and its DNS before adding `dev.4command.com` to the chosen hosting service and applying the host's DNS/TLS records. Confirm the separate owner/zone for `beta.focoman.com`; beta should use isolated project/data/secrets. Neither domain nor deployment is configured by this repository change. Do not expose the portal publicly until password/secret configuration, HTTPS, edge rate limiting, and a security review are complete. Firebase/Admin credentials and provider keys must remain server-only.
