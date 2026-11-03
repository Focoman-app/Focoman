# Email, Domain & WhatsApp Integration Action Items

**Status:** Planned — implementation not yet approved  
**Scope:** Track the three integration workstreams discussed for Focoman. Review each item before implementation.  
**Domain assumption:** `focoman.com`; confirm the actual registered domain before changing DNS.

## 1. Email providers — Brevo and Resend

- [x] Create/configure Brevo account and verify the account sender. *(Completed: Account created under `webmaster@focoman.com`, key generated & connected in Dev Portal)*
- [x] Configure Resend account under `webmaster@focoman.com` with sender `noreply@focoman.com` and `replyTo: support@focoman.com`. *(Completed: Transferred to `webmaster@focoman.com`, Dev Portal integration active)*
- [ ] Decide provider responsibilities (recommended starting point: keep existing Resend transactional flow; use Brevo for opted-in marketing/campaign mail, unless a reviewed requirement calls for routing selected transactional messages through Brevo).
- [ ] Add server-only Brevo credentials through local/deployment secret stores; never commit API keys or share them in chat.
- [ ] Implement provider-specific server-side sending with explicit message routing, truthful delivery/error results, and no automatic cross-provider retry that could duplicate a message.
- [ ] Test a permitted recipient and inspect provider delivery logs before enabling production sends.

## 2. Sender domain and inbound mailbox routing

- [x] Configure custom domain routing on Vercel: `focoman.com` and `www.focoman.com` routed with A record (`76.76.21.21`) and CNAME record (`cname.vercel-dns.com`). Live and operational. *(Completed)*
- [x] Hostinger Registrar Account Security: Maintained Hostinger account on independent external email (`sivakrishna.era@gmail.com`) to prevent circular-dependency lockout (Hostinger prohibits setting primary account email to a domain managed by that same account). *(Completed)*
- [x] Migrate GitHub repository from personal account (`Sivakrishna30`) to professional organization / `Focoman-app/Focoman`. *(Completed: Transferred to org `Focoman-app`, local remote updated)*
- [ ] Migrate Vercel project ownership / account to professional organization / `webmaster@focoman.com`. *(Planned)*
- [x] Record root domain `focoman.com` expiration date (`2029-11-02` — 3-year registration) and configure expiration alert schedule (`60, 30, 15, 7, 3, 1` days to `webmaster@focoman.com`, `founder@focoman.com`, and personal recovery email) in Dev Portal. *(Completed)*
- [ ] Add the domain to Brevo and Resend; apply their provider-specific DKIM/domain-verification records and maintain one valid SPF record (merge mechanisms rather than adding conflicting SPF records).
- [ ] Preserve existing website records and any chosen mailbox MX records. Do not enable Cloudflare Email Routing until its effect on the domain's MX records is reviewed.
- [x] Create the approved first four Zoho mailboxes from a laptop after domain ownership and DNS readiness are confirmed: `founder@focoman.com` (company ownership and recovery), `webmaster@focoman.com` (website, DNS, hosting, and technical administration), `support@focoman.com` (all customer, app, and finance support), and `noreply@focoman.com` (automated outbound messages only). *(Completed in Zoho Mail)*
- [ ] Reserve Zoho's fifth mailbox for a future named employee; do not allocate it to a shared account.
- [x] Configure automated messages sent from `noreply@focoman.com` to state that replies are not monitored and direct recipients to `support@focoman.com` for help. Configure `Reply-To: support@focoman.com` on all automated emails. Do not use `noreply@focoman.com` as an owner, recovery, or support-login identity. *(Configured in `apps/web/src/services/emailService.ts`)*
- [ ] Verify SPF/DKIM/DMARC and test inbox placement and replies before customer rollout.

## 3. WhatsApp Business Cloud API — notifications and owner bot

- [ ] Create/prepare Meta Business Portfolio, Meta Developer app, WhatsApp Business Account, and initially test with a Meta test number.
- [ ] Decide whether production will use a new dedicated number or an existing WhatsApp Business number before registration/migration.
- [ ] Configure a server-only system-user access token, App Secret, Phone Number ID, WABA ID, and a unique webhook verification token in secret storage.
- [ ] Secure the webhook: remove the repository's hard-coded verification-token fallback, validate Meta `X-Hub-Signature-256` on raw request bodies, validate payloads, and deduplicate webhook message IDs.
- [ ] Confirm approved templates, recipient opt-in, allowed messaging windows, delivery/status events, and failure handling before enabling automated customer notifications.
- [ ] Test inbound owner-bot commands and outbound notifications against the test number; only then configure production credentials and number.

## Related design decision — support conversations

Cloudflare Email Routing is forwarding, not a mailbox or a ticket/thread store. A support conversation UI would be a separate feature. Evaluate a database-backed in-app ticket with message history first; later, Brevo Inbound Parsing on a dedicated reply subdomain can ingest customer email replies through a webhook and append them to the matching ticket. Do not route support replies into a conversation automatically until ticket identity, sender verification, spam handling, attachments, and retention are designed.

## 4. Payment economics — subscription vs. studio booking

- [ ] Keep FocoMan subscription billing separate from customer-to-studio booking payments; define the merchant of record and exact fund flow for each.
- [ ] Enforce the product rule server-side: one active subscription covers one studio; confirm how multi-studio owners buy/manage separate subscriptions.
- [ ] Decide who bears booking payment processing costs: studio, customer via a clearly disclosed fee (subject to provider/legal approval), or FocoMan from its revenue. If the customer pays exactly ₹1,00,000 and the studio must receive ₹1,00,000, someone must cover the gateway charges and applicable tax; do not assume a permanently free gateway.
- [ ] Compare written provider quotes for normal domestic UPI/cards, refunds/chargebacks, settlement, split settlement, recurring subscription methods, taxes, and any introductory offers. Treat offers as temporary and eligibility-bound.
- [ ] If online booking collection is introduced, evaluate the provider's approved marketplace/split-settlement offering and obtain provider, Indian tax/accounting, and legal confirmation of the fund flow before FocoMan collects or settles studio money.
- [ ] Retain direct-to-studio UPI/manual owner verification as a potential low-fee option only if the product accepts that payment confirmation is not automated. For gateway payments, verify status server-side via signed webhooks/provider APIs; never trust a redirect or screenshot alone.
- [ ] Before enabling subscription charges, replace the current checkout's success-without-charge behavior with a verified provider-backed payment lifecycle and accurate invoice/tax treatment.

## 5. GCP cost model and environment setup

- [ ] Decide hosting model after a small representative load test: Google Cloud Run (managed autoscaling, usage-based compute) vs. a fixed monthly VPS (predictable compute bill, but self-managed capacity/operations). Compare the complete monthly bill, not only the web-server price: the current app still uses Firebase Auth/Firestore, and photo/object storage, backups, egress, monitoring, and domain/TLS may be separate.
- [ ] If revisiting cloud vendor choice, compare AWS, GCP, and Azure with the same measured workload and complete service bundle (Next.js hosting/compute, Firebase/Auth/Firestore dependency or migration, object storage/egress, build/deploy, logs, backups, and staging). Similar serverless free request/compute allowances do not imply equal total cost or a free app.
- [ ] If considering a ₹500–₹800/month VPS, verify its exact RAM/CPU/disk/transfer, region, backups, provider support/SLA, overage policy, and taxes. Treat it as a fixed-size server, not “unlimited”; define monitoring, OS patching, restart/process management, security hardening, backups/restore tests, and capacity alerts.
- [ ] For real VPS autoscaling, separately design multiple app instances plus load balancing, health checks, image/deployment consistency, and database/session/storage behavior. Do not assume a single VPS automatically adds capacity under load.
- [ ] Confirm production architecture and reconcile target Cloud Run docs with the current Firebase Hosting deployment script before choosing a migration path.
- [ ] Estimate a monthly 1 / 10 / 100-studio workload using measured assumptions: app requests and execution time, Firestore reads/writes/storage/egress, photo/file GB stored and delivered, logs, build minutes, and region. Studio count alone is not enough to predict cost.
- [ ] Model staging as a separate GCP/Firebase project with isolated Auth, Firestore, secrets, and test data; do not let beta write to production data.
- [ ] Set Cloud Run `min=0`, an intentionally conservative service-level `max` after load testing, logging retention, usage monitoring, and budget alerts. Investigate Cloud Run spend caps as an optional reliability trade-off; alerts alone are not a hard cap and spend-cap enforcement is not instant.
- [ ] Choose beta hostname: if `focoman.com` is already owned, `beta.focoman.com` is a DNS subdomain and does not require buying another domain. Confirm DNS provider and production-safe custom-domain front end (Firebase Hosting or an external load balancer; Cloud Run direct domain mapping is currently preview and not recommended for production).
- [ ] Record the monthly provider free quotas and reset period in the cost model; re-check official pricing and offer terms before launch because rates/eligibility can change.

## 6. CI/CD: beta → production

- [ ] First do a scoped code/deployment cleanup: reconcile documented Cloud Run/GitHub Actions target with actual Firebase Hosting deploy path; remove false-positive checkout success; make lint/build/tests run explicitly (Next build currently ignores lint during builds); avoid a broad refactor before a reliable baseline exists.
- [ ] Add PR checks for lint, typecheck, tests, and production build; block deployment if any required check fails.
- [ ] Deploy each approved commit as an immutable artifact to isolated beta (Cloud Run if that is the approved target) using beta-only credentials and data; expose `beta.focoman.com` only after DNS/TLS plan is confirmed.
- [ ] Require manual user UAT/approval in the deployment workflow before production promotion.
- [ ] Promote the exact beta-tested image digest/commit to production, not a separately rebuilt untested artifact; retain the prior revision and document rollback and post-deploy smoke checks.
- [ ] Choose GCP pipeline service: simplest path is Cloud Build GitHub trigger(s) that build/push to Artifact Registry and deploy Cloud Run; use Cloud Deploy if a first-class staged rollout/release approval pipeline is desired. GCP console offers repository connection for Cloud Build or Developer Connect; select branch/event and build config, then inspect trigger/build logs in Cloud Build.
- [ ] Map branch policy deliberately: pull requests run checks only; push/merge to `develop` (or an agreed beta branch) deploys beta; production deploy is gated by a manual approval (Cloud Deploy approval or protected GitHub Environment) and promotes the already-tested immutable image digest.
- [ ] Authenticate CI using Workload Identity Federation/OIDC with narrowly scoped IAM rather than storing a long-lived service-account JSON key in GitHub secrets. Use separate least-privilege deploy identities and secrets per environment.
- [ ] Confirm whether beta and production are separate GCP/Firebase projects (recommended for Auth/Firestore isolation) or services within one project; document project IDs, service names, regions, environment variables, secret bindings, DNS, rollback owner, and alert recipients before creating triggers.
- [ ] Approve a technical blueprint and rollout plan before implementing payment, GCP migration, DNS, or CI/CD changes.

## 7. Security review — server actions, Firebase, and abuse protection

- [ ] Audit every exported Server Action, Route Handler, and API endpoint. Build an access matrix for public/guest, signed-in customer, studio member, and owner actions; verify identity cryptographically and check resource ownership, active studio membership, and required role server-side on every protected operation. Validate inputs and avoid trusting client-supplied UID, role, studioId, price, or payment state.
- [ ] Verify all Firestore access paths. Browser rules currently deny direct client access; Admin SDK bypasses Firestore rules, so authorization must be enforced by the server action before each Admin read/write. Confirm production service identity/IAM is least-privilege and no Admin private key or credential file is exposed to browser bundles, logs, or Git.
- [ ] Security-blocker review: `requireVerifiedSession()` currently accepts `dev_session:` cookies without an explicit production guard; inspect related dev/owner UID shortcuts and remove/strictly isolate them before public production. Add tests proving forged dev cookies cannot authenticate or gain studio access in production.
- [ ] Security-blocker review: `/api/session` same-origin guard currently returns `true` unconditionally. Implement and test appropriate origin/CSRF protections for session-cookie creation/deletion while retaining legitimate proxy/custom-domain support.
- [ ] Configure Firebase API key restrictions/quotas. Treat Firebase web config API key as public project identifier, not as an authorization secret; keep service-account/Admin credentials private and server-only.
- [ ] Evaluate Firebase App Check for web clients (reCAPTCHA Enterprise or supported provider), first monitor metrics then enforce only after legitimate beta traffic is verified. If protecting custom Next.js APIs/server actions, send App Check token and verify it server-side; do not assume Firebase service enforcement automatically covers custom endpoints. Check Identity Platform requirement before enforcing App Check on Firebase Authentication.
- [ ] Add abuse controls independent of CAPTCHA/App Check: per-user/IP rate limits for public booking/search/session endpoints, request/schema/size limits, idempotency for mutations, abuse/error monitoring and alerts, and quotas/cost safeguards. App Check helps attest the app but is not a replacement for authentication, authorization, or rate limiting.
- [ ] Add automated security tests for unauthenticated calls, cross-studio access, member-vs-owner permissions, expired/revoked tokens, guest passkey boundaries, session CSRF/origin behavior, rate limits, and App Check enforcement before rollout. Do not perform destructive production testing; use isolated beta data.
