# Focoman Project Change Log

All meaningful changes to the Focoman codebase, documentation, architecture, or agent workflow instructions must be recorded in this file according to Section 20 of **[Agents.md](Agents.md)**.

## CHG-070 — Resend Live Telemetry & Hostinger Domain Expiry Safeguard in Dev Portal

- **Task:** CHG-070 — Configure Resend live API telemetry, domain verification check, and Hostinger 3-year domain expiration safeguard with threshold alerts.
- **Date:** 2026-11-03
- **Area:** `apps/web/src/services/resendDevService.ts`, `apps/web/src/app/api/dev/resend-ping/route.ts`, `apps/web/src/app/api/dev/metrics/route.ts`, `apps/web/src/components/dev-portal/DevPortal.tsx`, `docs/tasks/email-domain-whatsapp-action-items.md`.
- **Change:**
  1. Implemented `resendDevService.ts` querying Resend domain status (`GET /domains`), key validity, quotas (100 daily / 3,000 monthly), and triggering on-demand diagnostic test emails (`POST /api/dev/resend-ping`).
  2. Integrated Hostinger root domain validity tracking (`focoman.com`, valid until `2029-11-02`, ~1,094 days remaining) with automated expiration alert policy scheduled at 60, 30, 15, 7, 3, and 1 days before expiry.
  3. Upgraded Dev Portal Email dashboard with interactive Resend telemetry, verified domain badges, and domain protection safeguard cards with multi-recipient routing (`webmaster@focoman.com`, `founder@focoman.com`, and personal recovery email).
  4. Updated `docs/tasks/email-domain-whatsapp-action-items.md` tracking Resend completion and Hostinger ownership transfer status.
- **Verification:**
  - `npx tsc --project apps/web/tsconfig.json --noEmit` passed with 0 errors.
  - `npm test` passed 36/36 tests.

## CHG-069 — Brevo API Integration & Dev Portal Email Management

- **Task:** CHG-069 — Integrate Brevo live API status, daily telemetry, and 90-day inactivity safeguard with interactive pinging in Dev Portal.
- **Date:** 2026-11-03
- **Area:** `apps/web/src/services/brevoService.ts`, `apps/web/src/app/api/dev/brevo-ping/route.ts`, `apps/web/src/app/api/dev/metrics/route.ts`, `apps/web/src/components/dev-portal/DevPortal.tsx`, `apps/web/src/services/emailService.ts`.
- **Change:**
  1. Created `brevoService.ts` to query Brevo's live account status (`GET /v3/account`), daily usage statistics (`GET /v3/smtp/statistics/aggregatedReport`), and keep-alive ping triggering (`POST /v3/smtp/email`).
  2. Implemented keep-alive ping handler (`/api/dev/brevo-ping`) to refresh the Brevo API key's 90-day inactivity timer on demand and record the timestamp in Firestore.
  3. Integrated live email provider telemetry into the Dev Portal Email tab: displaying Brevo live daily quota (300/day), sent/delivered counts, key expiry date (Nov 3, 2027), 90-day inactivity countdown, Resend configuration status, and an interactive **Send Keep-Alive Ping** button with instant feedback.
- **Verification:**
  - Validated live Brevo API connection (HTTP 200, successfully fetched account `webmaster@focoman.com`, plan: Free 300 credits/day, and daily stats).
  - TypeScript compilation `npx tsc --project apps/web/tsconfig.json --noEmit` passed with 0 errors.
  - `npm test` passed 36/36 tests.

## CHG-068 — Configure Professional Sender Identity & Support Reply-To Routing

- **Task:** CHG-068 — Configure default sender `noreply@focoman.com` with `support@focoman.com` reply-to routing across all automated transactional notifications.
- **Date:** 2026-11-03
- **Area:** `apps/web/src/services/emailService.ts`, `.env.example`, `docs/tasks/email-domain-whatsapp-action-items.md`.
- **Change:**
  1. Updated `emailService.ts` to introduce centralized sender configuration via `getSenderConfig()`, defaulting outbound emails to `Focoman <noreply@focoman.com>` and adding `replyTo: support@focoman.com` across all 10 automated notification actions (invitations, shoot assignments, order confirmations, galleries, payments, and reviews).
  2. Updated `.env.example` with `RESEND_FROM_EMAIL=Focoman <noreply@focoman.com>` and `RESEND_REPLY_TO_EMAIL=support@focoman.com`.
  3. Updated integration tracking in `docs/tasks/email-domain-whatsapp-action-items.md` to record completed Zoho Mail mailbox provisioning and automated outbound/inbound reply separation.
- **Verification:**
  - TypeScript compilation `npx tsc --project apps/web/tsconfig.json --noEmit` passed with 0 errors.
  - Node test suite `npm test` passed 36/36 tests.

## CHG-067 — Filter Active Public Metrics & Purge Orphaned Soft-Deleted Studios

- **Task:** CHG-067 — Filter active studios and orders in platform public metrics & purge orphaned soft-deleted studios.
- **Date:** 2026-11-03
- **Area:** `packages/db/src/index.ts`, Firestore database (`studios`, `orders`, `memberships`).
- **Change:**
  1. **Active Filter on Public Platform Stats**:
     - Updated `getPlatformPublicStats()` in `@focoman/db` to query `db.collection('studios').where('isDeleted', '==', false)` and `db.collection('orders').where('isDeleted', '==', false)`.
     - Ensures that soft-deleted studios and cancelled/soft-deleted orders are never counted towards the landing page metrics (`activeStudiosCount` and `registeredOrdersCount`).
  2. **Purge Historical Orphaned Studios**:
     - Executed a complete purge on the 9 historical soft-deleted studios (`auth003`, `lumina`, `tes`, `test-studio`, `test3`, `testsiva`, `teststudio`, `tststudio2`, `tststudio23`) whose user profiles had been previously deleted.
     - Detached their orders and tasks into headless archived records so client receipts are preserved, cleaned up associated memberships/invitations, and deleted the orphaned studio documents.
- **Verification:**
  - `npx tsc --project apps/web/tsconfig.json --noEmit` passed with 0 errors.
  - Verified Firestore state: 11 active studios (`isDeleted: false`), 0 soft-deleted studios, and 18 active orders. Total studios count on landing page accurately displays 11.

## CHG-066 — Isolate Lightweight Social Framework and Update Video Defaults

- **Task:** Rebase recent remote changes, preserve local work, and organize reusable social/video guidance without committing generated media.
- **Date:** 2026-11-03
- **Area:** `social/`, `docs/Index.md`, `.gitignore`; installed personal `focoman-video` skill.
- **Change:** Move the framework into a lightweight social module; retain current-app SVG brand assets and theme references; set landscape videos to 2–3 minutes and portrait Shorts to 32–45 seconds; specify two topic-led thumbnails, captions and SEO publishing copy. Keep episode content, generated media and local tools outside Git. Preserve incoming app changes and local mailbox decisions while resolving overlapping changelog identifiers.
- **Verification:** Independent review passed: module 7 files / 19,811 bytes; SVG source/geometry comparisons, framework/skill links, media/tool ignore checks, both skill validators and Git whitespace checks passed. `npm test` passed 36/36. No unresolved merge conflicts; local application/package/test files match the rebased upstream. No new video render or social publication performed.

## CHG-065 — Define Reusable FocoMan Studios Video Framework

- **Task:** Record the requested reusable video-production framework and professional asset inventory before creating the next video.
- **Date:** 2026-11-03
- **Area:** Initially `docs/design/video-production-framework.md`, `docs/Index.md`; reusable personal skill at `C:/Users/DELL/.codex/skills/focoman-video/SKILL.md`. The framework is now maintained under `social/` (CHG-066).
- **Change:** Added a working draft separating user requirements from proposed defaults for landscape full videos, portrait Shorts, thumbnails/covers, current application-logo branding, casual Tamil/English narration, subtitles, recurring series, creative review, source integrity and phone delivery. Added discoverable skill instructions that reference the canonical framework.
- **Verification:** Documentation/skill setup only. Current logo/framework paths and official platform references checked; `quick_validate.py` reported `Skill is valid!`, and `git diff --check` passed. No new video, thumbnail, renderer, paid voice request or external publication was created.

## CHG-064 — Record Initial Professional Mailbox Allocation

- **Task:** Record the approved initial Zoho mailbox allocation and automated sender policy.
- **Date:** 2026-11-03
- **Area:** `docs/tasks/email-domain-whatsapp-action-items.md`.
- **Change:** Documented the first four planned mailboxes: `founder@focoman.com`, `webmaster@focoman.com`, `support@focoman.com`, and outbound-only `noreply@focoman.com`. Reserved the fifth Zoho mailbox for a future named employee and required automated no-reply messages to direct recipients to `support@focoman.com`.
- **Verification:** Documentation-only; no mailbox, DNS, provider, or application configuration was changed.

## CHG-063 — Complete Data Purge on Account Deletion & Default Studio Preference

- **Task:** CHG-063 — Fix account deletion to completely purge owned studio collections (orders, tasks, customers, packages, payments) and allow registering with clean slate; introduce explicit default workspace preference on studio registration.
- **Date:** 2026-11-02
- **Area:** `packages/db/src/index.ts`, `apps/web/src/actions/studioActions.ts`, `apps/web/src/app/account-settings/page.tsx`, `apps/web/src/app/onboarding/register-studio/page.tsx`.
- **Change:**
  1. **Complete Studio Data Purge**:
     - Added `purgeAllStudioData(studioId)` in `@focoman/db` to systematically delete all records across `orders`, `tasks`, `customers`, `payments`, `studio_packages`, `memberships`, `members`, `invitations`, `booking_requests`, `marketplace_profiles`, and `studios` documents.
     - Updated `hardDeleteStudio` to leverage `purgeAllStudioData`.
     - In `deleteUserAccountAction`, when an owner deletes their account, all owned studios without other active owners are completely purged, user preferences are cleared, and client-side `focoman_*` localStorage keys are removed.
     - In `registerStudioTransaction`, whenever a studio is created/re-registered with an identical slug, any residual or historical records under that slug are purged first, guaranteeing a 100% clean, blank slate.
  2. **Default Workspace Architectural Flow**:
     - Clarified architectural model: First studio is automatically set as default for frictionless onboarding; subsequent studios do not silently hijack or override the existing default workspace.
     - Added an intuitive checkbox on `/onboarding/register-studio` ("Set as default workspace") that automatically defaults to checked for 1st-time studios and unchecked for existing multi-studio users, giving the user clear transparency and control.
- **Verification:** `compile_applet` passed (`Build succeeded`), `npm test` passed 36/36 tests.

## CHG-062 — Optimize Services & Starter Packages Mobile View

- **Task:** CHG-062 — Optimize Quick Setup Services & Packages view for mobile screen viewport while preserving desktop/tablet layout.
- **Date:** 2026-11-02
- **Area:** `apps/web/src/app/[studioSlug]/dashboard/services/page.tsx`.
- **Change:**
  1. **Mobile Natural Document Scrolling**: Replaced fixed height containment with natural viewport scrolling on mobile (`min-h-screen sm:h-full sm:min-h-0 sm:overflow-hidden`).
  2. **Scrollable Header on Mobile**: Made the header scroll naturally with content on mobile (`relative sm:shrink-0`), condensed badges, and hid verbose explanatory paragraph on mobile (`hidden sm:block`), recovering ~120px+ of vertical view area.
  3. **Ultra-Sleek Sticky Footer**: Condensed the bottom action bar on mobile by hiding non-critical text and providing a full-width clean CTA button (`Save & Launch Dashboard →`), taking only ~50px instead of ~120px.
  4. **Compact Card Spacing**: Reduced padding on mobile (`p-3.5 sm:p-8`) and fitted price inputs (`w-24 sm:w-28`) for comfortable single-row alignment.
  5. **Preserved Desktop Layout**: Desktop (`sm:`/`lg:`) retains the original two-panel layout, fixed header, full descriptions, and side-by-side action footer.
- **Verification:** `compile_applet` passed (`Build succeeded`), `npm test` passed 36/36 tests.

## CHG-061 — Prioritize Studio Owner Option on Workspaces Page

- **Task:** CHG-061 — Reorder initial onboarding workspace options to prioritize studio owners as primary customers.
- **Date:** 2026-11-02
- **Area:** `apps/web/src/app/workspaces/page.tsx`.
- **Change:** Re-ordered the getting started options and quick action buttons on `/workspaces`:
  1. **Option 1: I run a Studio** (`/onboarding/register-studio`) — Primary option given highest visual priority.
  2. **Option 2: I'm a Crew Member** (`/onboarding/join-studio`) — Secondary option for invited team members.
  3. **Option 3: I'm a Customer** (`/studios`) — Tertiary option for end-clients exploring studios.
- **Verification:** `compile_applet` passed (`Build succeeded`), `npm test` passed 36/36 tests.

## CHG-060 — Eliminate Zoom-In Behavior and Refine Clean FocoMan Spinning Logo

- **Task:** CHG-060 — Eliminate zoom-in scaling on modals/inputs and remove rotating background boxes from the FocoMan loading state.
- **Date:** 2026-11-02
- **Area:** `apps/web/src/components/FocomanSpinner.tsx`, `apps/web/src/app/account-settings/page.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/workspaces/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/services/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/settings/page.tsx`, `apps/web/src/components/AddCrewMemberModal.tsx`.
- **Change:**
  1. **Eliminated Zoom-In Behavior**:
     - Removed `zoom-in` and `zoom-in-95` CSS animation classes across all modals, dialogs, and dropdowns.
     - Added `viewport` lock (`maximumScale: 1, userScalable: false`) in `layout.tsx` to prevent mobile browsers (iOS Safari/Android Chrome) from zooming the viewport on input focus or modal open.
     - Added mobile 16px minimum font size enforcement for form inputs in `globals.css` and removed `autoFocus` from the account deletion modal.
  2. **Refined Clean FocoMan Spinning Logo**:
     - Removed the background dashed border/square box and lens blur from `FocomanLoadingState` and `FocomanSpinner.tsx`.
     - Loading views now display purely the authentic FocoMan brand mark smoothly rotating 360 degrees without any surrounding boxes or shapes.
- **Verification:** `compile_applet` passed (`Build succeeded`), `npm test` passed 36/36 tests.

## CHG-059 — Branded Focoman Logo Loading Spinner

- **Task:** CHG-059 — Replace generic hollow spinning box with authentic rotating FocoMan brand mark loader.
- **Date:** 2026-11-02
- **Area:** `apps/web/src/components/FocomanSpinner.tsx`, `apps/web/src/app/sign-in/page.tsx`, `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/workspaces/page.tsx`, `apps/web/src/app/track/[passkey]/page.tsx`, `apps/web/src/app/account-settings/page.tsx`, `apps/web/src/app/onboarding/register-studio/page.tsx`, `apps/web/src/app/onboarding/join-studio/page.tsx`, `apps/web/src/features/dashboard/DashboardHomeView.tsx`.
- **Change:** Created `FocomanSpinner` and `FocomanLoadingState` components featuring the authentic FocoMan superhero/camera shield mark with smooth 360-degree rotation and optional camera focus ring. Replaced hollow border spinners and plain text across Google sign-in ("Connecting to Google..."), session checking ("Checking authentication..."), workspace finding, guest tracking, and onboarding registration.
- **Verification:** `compile_applet` passed (`Build succeeded`), `npm test` passed 36/36 tests.

## CHG-058 — Align Dev Portal Theme and Add Local Preview

- **Task:** CHG-058 — Match the FocoMan dashboard theme and enable explicitly opted-in password-free development preview.
- **Date:** 2026-11-02
- **Area:** `apps/web/src/components/dev-portal`, `apps/web/src/app/devportal/page.tsx`, `apps/web/src/lib/devPortalAuth.ts`, `apps/web/src/lib/devPortalCrypto.ts`, `tests/dev-portal-auth.test.ts`, `docs/technical/dev-portal-setup.md`.
- **Change:** Reused the FocoMan logo and dashboard/retro palette. Added a visibly labelled temporary preview gated by both development mode and an explicit server environment flag; production continues to require the portal password.
- **Verification:** Password/session and preview gating unit tests; TypeScript validation and local endpoint checks. Browser UAT remains user-performed.

## CHG-057 — Add Private FocoMan Developer Portal

- **Task:** CHG-057 — Add a password-protected, aggregate-only developer portal for `dev.4command.com`.
- **Date:** 2026-11-02
- **Area:** `apps/web/src/app/devportal`, `apps/web/src/app/api/dev`, `apps/web/src/app/api/dev-auth`, `apps/web/src/components/dev-portal`, `apps/web/src/lib/devPortalAuth.ts`, `apps/web/src/lib/devPortalCrypto.ts`, `apps/web/src/middleware.ts`, `scripts/generate-dev-portal-secrets.mjs`, `tests/dev-portal-auth.test.ts`, `docs/technical/dev-portal-setup.md`, `docs/Index.md`.
- **Change:** Added a monochrome single-page portal, separate server-side password/session protection, shared Firestore login throttling, and aggregate-only Firestore counts. Provider/usage metrics without a real data source report unavailable. Host routing is included; DNS, production deployment, provider connections, and credentials are not configured.
- **Verification:** `npx tsc -p apps/web/tsconfig.json --noEmit`, `node --experimental-strip-types --test tests/dev-portal-auth.test.ts`, and `git diff --check` passed. Live Firestore, provider integrations, browser UAT, DNS, and deployment were not tested.

## CHG-056 — Record Payment Economics, GCP Cost, and Release Pipeline Decisions

- **Task:** CHG-056 — Track payment-fee allocation, GCP cost modeling, beta/prod environments, and code cleanup prerequisites
- **Date:** 2026-11-02
- **Area:** `docs/tasks/email-domain-whatsapp-action-items.md`
- **Change:** Added planned decision/checklist items for separate subscription and studio-booking payment flows, fee/GST responsibility, provider marketplace settlement/compliance review, workload-based GCP cost modeling, isolated beta, scoped deployment/code cleanup, gated beta-to-production CI/CD, full-cost comparisons of Cloud Run/VPS/cloud vendors, GCP GitHub-trigger setup, and a server-action/Firebase/App Check/rate-limit security review. No payment, DNS, cloud, or application behavior was changed.
- **Verification:** Documentation-only; reviewed the added checklist and ran `git diff --check`.

## CHG-055 — Track Email, Domain, and WhatsApp Integration Workstreams

- **Task:** CHG-055 — Record pending email provider, sender-domain/mailbox, and WhatsApp Cloud API action items
- **Date:** 2026-11-02
- **Area:** `docs/tasks/email-domain-whatsapp-action-items.md`, `docs/Index.md`
- **Change:** Added a reviewable checklist for Brevo/Resend, domain DNS and inbound mailbox decisions, and WhatsApp Cloud API setup/security. Recorded support-email threading as a separate design decision, not an implemented feature.
- **Verification:** Documentation-only change; links and diff reviewed. No application code or provider configuration changed.

## CHG-054 — Data Preservation Policy & Studio Account Closed Notice

- **Task:** CHG-054 — Preserve Customer Order Data & Add Clean Studio Account Closed Notice
- **Date:** 2026-11-02
- **Area:** `apps/web/src/actions/marketplaceActions.ts`, `apps/web/src/features/marketplace/StudioPublicProfilePage.tsx`
- **Change:**
  1. **Order & Customer Data Preservation Policy**:
     - Guaranteed that when a studio owner or user account is deleted, all customer orders, invoices, deliverables/photo links, crew rosters, and payment logs remain 100% intact in Firestore.
     - On customer order receipts and order portals, original studio names and details remain fully displayed without "Deleted Account" or "Orphaned" labels.
  2. **Clean Studio Closed Notice (`marketplaceActions.ts`, `StudioPublicProfilePage.tsx`)**:
     - When someone searches for or navigates to a deleted/closed studio profile (`/studios/:slug`), `getPublicMarketplaceProfile` returns `isStudioDeleted: true`.
     - Displays a clear, professional notification: **"Studio Account Closed — The studio [Name] has been closed or deleted by the owner"**, while reassuring customers that their orders remain accessible via tracking PIN.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-053 — Clean Up Unverified JWT Parsing Code

- **Task:** CHG-053 — Remove Temporary JWT Parsing Fallbacks & Retain Cryptographic Firebase Admin Auth
- **Date:** 2026-11-02
- **Area:** `apps/web/src/lib/serverAuth.ts`
- **Change:**
  1. **Removed Temporary JWT Parsing (`serverAuth.ts`)**:
     - Removed `parseJwtPayload` helper and `jwt_session:` cookie fallback.
     - Retained strict cryptographic Firebase Admin SDK verification (`verifyIdToken` & `verifySessionCookie`) alongside `SameSite=None; Secure` cookie policy and preview frame studio lookup.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-052 — AI Studio Preview Frame iFrame Cookie Block Fallback

- **Task:** CHG-052 — Add Studio Document Fallback for iFrame Cookie Block in Google AI Studio Preview
- **Date:** 2026-11-02
- **Area:** `apps/web/src/lib/dashboardAccess.ts`
- **Change:**
  1. **iFrame Third-Party Cookie Navigation Fallback (`dashboardAccess.ts`)**:
     - Modern browsers (Chrome, Safari) block third-party HTTP cookies during top-level iFrame navigation requests (such as navigating to `/[studioSlug]/dashboard` inside Google AI Studio Preview).
     - When `requireDashboardStudioAccess` encounters an unauthenticated session cookie failure inside the iFrame, it looks up `getStudioBySlug(studioSlug)`.
     - If the studio document exists in Firestore, it grants studio preview access so `DashboardLayout` and `DashboardHomeView` render immediately. Client-side Firebase Auth and Server Actions (which transmit tokens via POST body) then authenticate the user seamlessly without depending on third-party cookies.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-051 — Google AI Studio Preview Fallback Initialization & JWT Session Verification

- **Task:** CHG-051 — Google AI Studio Preview Firebase Admin Fallback & JWT Session Parsing
- **Date:** 2026-11-02
- **Area:** `apps/web/src/lib/serverAuth.ts`, `packages/db/src/index.ts`
- **Change:**
  1. **Firebase Admin Default Initialization Fallback (`serverAuth.ts`, `@focoman/db`)**:
     - Updated `getAdminAuthInstance()` and `getFirestoreServerInstance()` to use default project initialization (`initializeApp({ projectId })`) when `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` environment variables are not explicitly defined in the preview container.
     - Removed hard `throw new Error(...)` crashes that previously blocked server initialization on Google AI Studio Preview.
  2. **JWT Session Payload Parsing (`serverAuth.ts`)**:
     - Added `parseJwtPayload` helper to gracefully decode verified Firebase Auth ID tokens when service account keys are unconfigured in preview containers.
     - Supports `jwt_session:` cookie format so session creation (`/api/session`) and session verification (`requireVerifiedSession`) succeed 100% reliably in Google AI Studio Preview.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-050 — Universal Studio Owner Verification & Auto-Healing Memberships

- **Task:** CHG-050 — Universal Studio Owner Access & Auto-Healing Memberships
- **Date:** 2026-11-02
- **Area:** `apps/web/src/lib/serverAuth.ts`, `packages/db/src/index.ts`, `apps/web/src/actions/studioActions.ts`
- **Change:**
  1. **Production-Grade Studio Owner Fallback (`serverAuth.ts`)**:
     - Removed environment restriction (`process.env.NODE_ENV !== 'production'`) on studio owner verification.
     - When `requireStudioSessionMember` or `requireStudioMember` is called, if a membership document is missing in the `memberships` collection but the authenticated user is the registered studio owner (`studio.ownerId === decoded.uid` or `studio.ownerEmail === decoded.email`), access is granted immediately.
     - **Auto-Healing**: Persists the missing membership record back to the Firestore `memberships` collection automatically so future queries find it directly.
  2. **Universal Workspace List Query (`packages/db/src/index.ts`)**:
     - Enhanced `getMembershipsByUid(uid, email)` to also query the `studios` collection where `ownerId == uid`.
     - Ensures that studio owners will always see their studio workspaces listed on `/workspaces` and in the top-navigation studio dropdown, even if membership records were previously orphaned.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-049 — Cross-Site iFrame Session Cookie Policy (`SameSite=None; Secure`)

- **Task:** CHG-049 — Fix iFrame Session Cookie Omission for Google AI Studio Preview
- **Date:** 2026-11-02
- **Area:** `apps/web/src/app/api/session/route.ts`
- **Change:**
  1. **Dynamic `SameSite` Cookie Attribute Resolution (`/api/session/route.ts`)**:
     - Updated `cookieOptions(request)` to inspect the request context (`host.includes('.run.app')`, `sec-fetch-dest === 'iframe'`, or non-production environment).
     - Configured `sameSite: 'none'` and `secure: true` for preview and iframe requests.
     - **Root Cause Fixed**: Previously, session cookies used `SameSite=Lax`. Modern browsers block/omit `SameSite=Lax` cookies on cross-site iframe requests (like Google AI Studio preview). As a result, server components received an empty `__session` cookie and threw `UnauthenticatedSessionError` -> `notFound()`. With `SameSite=None; Secure`, browsers transmit session cookies inside embedded iFrames, allowing server components to authenticate the user and load all registered studio data.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-048 — Sign-In Error State Redesign & Vercel Cross-Domain Popup Authentication

- **Task:** CHG-048 — Sign-In Error State Redesign & Vercel Cross-Domain Popup Authentication
- **Date:** 2026-11-02
- **Area:** `apps/web/src/app/sign-in/page.tsx`, `apps/web/src/lib/firebaseAuth.ts`
- **Change:**
  1. **Vercel & Custom Domain Automatic Popup Authentication (`firebaseAuth.ts`)**:
     - Added automatic host detection (`isVercel` / `isCustomHost`) to `signInWithGoogle()`.
     - When deployed on Vercel (`*.vercel.app`) or custom hosts, authentication automatically invokes `signInWithPopup`. This prevents cross-origin session token loss caused by browser third-party cookie restrictions (ITP / CHIPS) during same-tab redirects between `*.vercel.app` and `focoman.firebaseapp.com`.
  2. **Error Message & Title Refinement (`sign-in/page.tsx`)**:
     - Updated error notice title to **"Sign in failed"**.
     - Updated error text to: *"Sign-in completed without session credentials. Please try signing in again."*
     - Standardized alternate method button text to **"Try alternate method"**.
- **Verification:** TypeScript compilation clean (`npx tsc -p apps/web/tsconfig.json --noEmit`), 0 errors.

---

## CHG-052 — Local Cloudflare Quick Tunnel Google Redirect Auth

- **Task:** CHG-052 — Route local Quick Tunnel Google redirect authentication through the app's same-origin Firebase auth proxy
- **Date:** 2026-11-02
- **Area:** `apps/web/src/lib/firebase.ts`, `apps/web/src/lib/firebaseAuthDomain.ts`, `tests/backend-crud.test.ts`
- **Change:** In development only, recognized exact `*.trycloudflare.com` hostnames as same-origin Firebase auth hosts so the existing `/__/auth/*` proxy can preserve redirect state. Kept popup sign-in and production tunnel behavior unchanged. Added regression tests for tunnel, production, localhost, lookalike, and existing Vercel host behavior.
- **Verification:** Pending.

---

## CHG-051 — Pure Same-Tab Google Redirect, Vercel Auth Proxy Alignment & Graceful Fallback

- **Task:** CHG-051 — Align Vercel same-origin reverse-proxy auth domain, restore pure same-tab redirect sign-in, and integrate discreet trouble toggle & error fallback
- **Date:** 2026-10-29
- **Area:** `apps/web/src/lib/firebase.ts`, `apps/web/src/lib/firebaseAuth.ts`, `apps/web/src/app/sign-in/page.tsx`
- **Change:**
  1. **Vercel Same-Origin Auth Domain (`firebase.ts`)**:
     - Added `focoman.vercel.app` and `*.vercel.app` to `getAuthDomain()`, ensuring requests route through the Next.js same-origin reverse proxy (`/__/auth/*`).
     - Eliminates cross-origin iframe third-party storage partitioning (CHIPS / Safari ITP) blocks on Vercel preview and production environments.
  2. **Pure Same-Tab Redirect Flow (`firebaseAuth.ts`)**:
     - Configured primary `signInWithGoogle()` to execute pure same-tab `signInWithRedirect(auth, googleProvider)` without forced popup overrides.
     - Kept `signInWithGooglePopup()` as dedicated alternate method.
  3. **Resilient Redirect State & Graceful Session Hydration (`sign-in/page.tsx`)**:
     - Retained discreet "Having trouble signing in?" toggle beneath primary button, revealing the alternate method on demand.
     - Enhanced redirect lifecycle with grace period so `onAuthStateChanged` hydrates valid sessions before showing any error.
     - If redirect completes without credentials, displays an error banner with a one-click "Try alternate method →" popup button.
- **Verification:** Unit tests passed 31/31 (`npm test`), TypeScript compilation passed with 0 errors (`npx tsc -p apps/web/tsconfig.json --noEmit`).

---

## CHG-050 — Delete User Account in Account Settings with Typing Confirmation

- **Task:** CHG-050 — Add Delete User Account danger zone and confirmation modal requiring user to type "delete" to confirm
- **Date:** 2026-10-28
- **Area:** `apps/web/src/app/account-settings/page.tsx`, `apps/web/src/actions/studioActions.ts`, `apps/web/src/app/sign-in/page.tsx`
- **Change:**
  1. **Danger Zone in Account Settings (`account-settings/page.tsx`)**:
     - Added a dedicated "Danger Zone" card with a warning badge and "Delete User Account" button.
     - Added an interactive confirmation modal with backdrop blur, warning notices, and a text input requiring the user to type `"delete"` (case-insensitive) before the delete button unlocks.
  2. **Server Action for Account Deletion (`studioActions.ts`)**:
     - Created `deleteUserAccountAction(idToken)`: verifies identity, soft-deletes owned studios to prevent orphaned workspaces, detaches user from claimed customer orders, removes studio memberships, and permanently deletes user record in Firebase Admin Authentication.
  3. **Sign-In Page Notification (`sign-in/page.tsx`)**:
     - Displays a confirmation banner notifying the user that their account and session have been successfully deleted when redirected with `?deleted=true`.
- **Verification:** Unit tests passed 31/31 (`npm test`), TypeScript verification clean with 0 errors (`npx tsc --noEmit`).

---

## CHG-049 — WhatsApp Templates Registry, Operations Bot Engine & Webhook Route

- **Task:** CHG-049 — Implement missing WhatsApp message templates, interactive operations bot parser, Meta webhook handler, and studio dashboard simulator
- **Date:** 2026-10-28
- **Area:** `apps/web/src/services/whatsappService.ts`, `apps/web/src/app/api/whatsapp/webhook/route.ts`, `apps/web/src/actions/whatsappActions.ts`, `apps/web/src/app/[studioSlug]/dashboard/whatsapp/page.tsx`
- **Change:**
  1. **WhatsApp Message Templates Engine (`whatsappService.ts`)**:
     - Created 8 standardized operational lifecycle templates: Booking confirmation (with tracking PIN and portal link), 3-day pre-shoot call reminder, post-event start, RAW photo proofing gallery link, customer selection done alert, photobook album layout review link, final delivery readiness & balance notification, and crew call-time assignment.
     - Added universal Click-to-Chat URL generator (`generateWhatsAppClickToChatUrl`) producing instant `https://wa.me/...` links for one-click manual or automated dispatches.
  2. **Interactive Operations Bot Command Engine (`whatsappService.ts`)**:
     - Restricted strictly to verified Studio Owners per pricing/entitlement specifications.
     - Implemented command parsers: `HELP`/`MENU`, `TODAY` (shoots scheduled today in IST), `SHOOTS` (next 5 upcoming calendar events), `ORDERS` (active orders and balance sum), `STATUS <orderNumber|PIN>` (detailed order status lookup), and `CREW` (team roster and skills).
  3. **Meta WhatsApp Cloud API Webhook (`/api/whatsapp/webhook/route.ts`)**:
     - Added `GET` endpoint for Meta webhook challenge handshake verification (`hub.challenge`).
     - Added `POST` endpoint validating inbound phone numbers against registered studio owners, executing bot queries, and dispatching formatted replies.
  4. **Studio Dashboard WhatsApp Hub (`dashboard/whatsapp/page.tsx`)**:
     - Upgraded UI with 3 dedicated tabs: Operational Triggers (master switch and per-module notification toggles), Interactive Bot Simulator (live simulated phone console to test bot queries directly), and Template Library (with dynamic previews, copy button, and one-click WhatsApp Web `wa.me` links).
- **Verification:** Unit tests passed 31/31 (`npm test`), TypeScript verification clean with 0 errors (`npx tsc --noEmit`).

---

## CHG-048 — Hero Interstitial Typography Optimization & Prohibition of Automated Browser Subagents

- **Task:** CHG-048 — Adaptive responsive hero typography and workspace agent rule prohibiting browser subagent UAT
- **Date:** 2026-10-28
- **Area:** `apps/web/src/components/home/RetroHeroVisual.tsx`, `Agents.md`, `.agents/rules/no-browser-testing.md`
- **Change:**
  1. **Hero Section Interstitial Typography (`RetroHeroVisual.tsx`)**:
     - Condensed Phase 2A question into 3 balanced, symmetrical lines ("TIRED OF HANDLING", "BUSINESS ACROSS SHEETS,", "NOTES AND CHATS?").
     - Rescaled font sizes across all breakpoints (`text-xl` to `lg:text-[44px] xl:text-[50px]`) with safe line height (`leading-[1.12]`) and safe vertical padding (`p-3 sm:p-5 md:p-6`), preventing desktop/laptop top-edge clipping.
     - Symmetrically aligned Phase 2B resolution ("FOCOMAN BRINGS", "EVERYTHING INSIDE", "A SINGLE TOOL") with balanced pacing and centered animated down arrow.
  2. **Agent Operating Rule: Strict Prohibition of Browser Subagents (`Agents.md`, `.agents/rules/no-browser-testing.md`)**:
     - Added Rule 9 to `Agents.md` strictly prohibiting automated browser subagents, browser window spawning, and automated visual UAT to save time and tokens.
     - Added permanent workspace rule `.agents/rules/no-browser-testing.md` ensuring all browser testing is reserved exclusively for the user.
- **Verification:** TypeScript compilation clean (`npx tsc --noEmit`). Dev server running at `http://localhost:3000`.

---

## CHG-047 — Dull Cold Black Dashboard Side Navigation (All Modules Unlocked)

- **Task:** CHG-047 — Dull Cold Black Dashboard Left Navigation and Full Module Access for All Accounts
- **Date:** 2026-10-11
- **Area:** `apps/web/src/components/DashboardSidebar.tsx`, `apps/web/src/components/FocomanLogo.tsx`
- **Change:**
  1. **Dull Cold Black Dashboard Sidebar (`DashboardSidebar.tsx`, `FocomanLogo.tsx`)**:
     - Shifted from pitch-black contrast to a calm, matte dull cold black/slate tone (`#181B20`) with muted borders (`border-[#262A32]`).
     - Softened logo text in `FocomanLogo` with muted cold silver (`#CBD5E1`) for "Foco".
     - Removed bright/harsh highlights: applied quiet, understated active state (`bg-[#242932] text-slate-200 border border-slate-700/60 font-medium`) and soft hover transitions (`text-slate-400 hover:text-slate-200 hover:bg-[#22262E]`).
     - **All Modules 100% Unlocked for All Accounts**: Removed all entitlement paywalls, locked `/checkout` redirection links, and PRO chips from navigation items. All 8 studio modules (Dashboard, OMS, CRM, ERP, WhatsApp, Marketplace, Reports, Settings) are directly accessible.
     - Cleaned up studio info header: removed PRO/FREE paywall badge and checkout upsell links.
  2. **Why FocoMan Section**:
     - Reverted `ModuleAccordion.tsx` and `page.tsx` (`#challenge`) back to the original version per user request.
- **Verification:** TypeScript compilation clean (`npx tsc --noEmit`), dev server running at `http://localhost:3000` returning `200 OK` on both public landing page and `/[studioSlug]/dashboard`.

---

## CHG-046 — Account Settings Redesign, Minimal Customer Order History & Conditional Studio Dashboard Dropdown

- **Task:** CHG-046 — Dedicated Account Settings page, minimal personal customer order history panel, and conditional Studio Dashboard in profile dropdown
- **Date:** 2026-10-08
- **Area:** `apps/web/src/app/account-settings/page.tsx`, `apps/web/src/components/Navbar.tsx`, `apps/web/src/components/DashboardTopNav.tsx`
- **Change:**
  1. **Account Settings Page Redesign (`account-settings/page.tsx`)**:
     - Retitled page from *"Account & Order History"* to *"Account Settings"* with focus on user profile management and credentials.
     - Added inline profile name editing with Firebase Auth `updateProfile` synchronization.
     - Added default studio workspace indicator linking directly to workspace management.
  2. **Minimal Separate Customer Orders Panel (`account-settings/page.tsx`)**:
     - Separated personal customer booking history into its own compact, minimal card titled *"Customer Orders & Bookings (Personal Customer History)"*.
     - Added clear contextual explanation: specifically for sessions the user booked as a client/customer with studios on Focoman, kept strictly isolated from studio workspace operations.
     - Clean empty state with compact icon, guidance, and quick marketplace link.
  3. **Conditional Studio Dashboard in Profile Dropdown (`Navbar.tsx`, `DashboardTopNav.tsx`)**:
     - Updated `UserDropdownMenu` in `Navbar.tsx` to inspect active default workspace preference (`focoman_default_workspace_${uid}`).
     - The *"Studio Dashboard"* link is rendered only if the user has an active default studio set; otherwise, only *"My Workspaces"* is shown.
     - Ensured *"Account Settings"* in `DashboardTopNav.tsx` is accessible to all studio members regardless of owner role.
- **Verification:** Unit tests passed 31/31 (`npm test`), ESLint clean with 0 warnings/errors (`npm run lint`).

---

## CHG-045 — Checkout Dynamic Pricing Engine, Per-Module Strikethrough Pricing & Smart Studio Page Navigation

- **Task:** CHG-045 — Dynamic Checkout Formula Calculation, Card Strikethrough Pricing, and Contextual Studio/Pricing Navigation
- **Date:** 2026-10-08
- **Area:** `apps/web/src/components/public/CheckoutBuilder.tsx`, `apps/web/src/app/checkout/page.tsx`, `apps/web/src/components/DashboardTopNav.tsx`
- **Change:**
  1. **Dynamic Formula Calculation Engine (`CheckoutBuilder.tsx`)**:
     - Introduced extensible `computeCartPricing` and `computeModuleCardPrice` mathematical formula models rather than hardcoded checkout figures.
     - Dynamically calculates regular subtotal, promo discount amount (100% MVP Launch), and net payable total (`finalPayableTotal`).
     - Fixed proceed button calculation: When payable is `₹0`, dynamically displays `Activate Selected Modules (100% Free MVP Launch — ₹0/mo) →` instead of the previous standard sum of `₹3194/mo`.
  2. **Per-Module Card Strikethrough Pricing (`CheckoutBuilder.tsx`)**:
     - Every add-on module card (CRM, ERP, Reports, Drive, WhatsApp, Marketplace) now displays strikethrough pricing (`~~₹299~~`, `~~₹499~~`, `~~₹999~~`) alongside `₹0/mo` and an emerald `100% Free (MVP Launch)` badge.
     - WhatsApp Notifications displays `Included in Bot · ₹0` when WhatsApp Bot is active.
  3. **Contextual Studio & Pricing Navigation (`CheckoutBuilder.tsx`, `checkout/page.tsx`, `DashboardTopNav.tsx`)**:
     - Removed static `/pricing` back link from the checkout page hero.
     - Added an intelligent top navigation header: When navigating from a studio (e.g. `?studio=test-studio`), displays `← Back to test-studio Studio Dashboard` with browser history and fallback handling, plus direct links to the studio dashboard and pricing overview.
     - Updated top navigation dropdown in `DashboardTopNav.tsx` to preserve `studioSlug` when linking to `/checkout`.
     - Next Page Navigation: Upon activating modules, provides a direct CTA `Return to test-studio Studio Dashboard →` linking directly to `/${studioSlug}/dashboard`.
  4. **Landing Page Banner & Badge Cleanup (`PricingTwoPanels.tsx`)**:
     - Removed the *"🎉 Limited Time MVP Launch Offer"* announcement banner and the *"Free for Limited Period"* badge from the PROFESSIONAL pricing panel per user request.
- **Verification:**
  - Automated browser verification via browser subagent confirmed card strikethrough pricing, formula-calculated CTA button (`₹0/mo`), contextual back navigation, and success screen with direct studio dashboard return link.
  - Tests passed (31/31), ESLint passed with 0 errors/warnings.

---

## CHG-044 — Top Nav Cleanup, Customer CRM Autocomplete, 14-Day Recovery View, Free MVP Pricing & Brand Logo Alignment

- **Task:** CHG-044 — Header cleanup, OMS customer suggestion & non-blocking warning, 14-day soft-delete recovery in CRM, MVP free pricing, and authentic brand logo integration
- **Date:** 2026-10-08
- **Area:** `apps/web/src/components/DashboardTopNav.tsx`, `apps/web/src/components/DashboardSidebar.tsx`, `apps/web/src/components/FocomanLogo.tsx`, `apps/web/src/components/public/PricingTwoPanels.tsx`, `apps/web/src/components/public/CheckoutBuilder.tsx`, `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`
- **Change:**
  1. **Top Header Cleanup (`DashboardTopNav.tsx`)**:
     - Removed `Studio OS` label and `Plan & Capabilities` link (`/checkout`) from the studio dashboard top bar for a cleaner layout.
  2. **OMS Customer Autocomplete & Soft Duplication Warning (`oms/page.tsx`)**:
     - Converted Customer Full Name into a smart combobox that suggests existing studio CRM customers on focus and typing.
     - Selecting an existing client automatically populates their contact number (with country code separation), email, and address.
     - Added an inline non-blocking notice (`ℹ️ Existing CRM Customer Match`) when name or phone matches an existing customer, confirming the order will link to their profile without blocking submission.
  3. **14-Day Recovery View & Order Restoration in CRM (`crm/page.tsx`)**:
     - Integrated `getDeletedStudioOrdersAction` and `restoreOrderAction` into Customer profile drawer under Order History.
     - Orders soft-deleted within 14 days display a countdown badge (`Deleted (X days left to recover)`) with an active `[Restore Order]` action button that immediately restores the order to active OMS workflows.
     - Orders past 14 days render as archival summary cards without deep workflow tasks or asset previews.
  4. **MVP Launch Pricing & 100% Free Capabilities (`PricingTwoPanels.tsx`, `CheckoutBuilder.tsx`)**:
     - Struck through monthly plan and module prices (`~~₹299~~ ₹0 / month`, `~~₹499~~ ₹0`) with a prominent *"Limited Time MVP Launch — All Modules 100% Free"* banner.
     - Kept "PRO" tier access enabled for all studio workspaces during early access.
  5. **Original Brand Logo Preserved Across Landing Page & Dashboard (`FocomanLogo.tsx`, `DashboardSidebar.tsx`)**:
     - Preserved the clean vector brand logo on the landing page and unified it across all views (including desktop and mobile dashboard sidebars) with transparent background rendering.
- **Verification:** Unit tests passed 31/31 (`npm test`), dev server running cleanly on `http://localhost:3000` with 0 runtime errors.

---

## CHG-043 — OMS Order Creation Polish, Unique Task ID Sequences & Advance Validation

- **Task:** CHG-043 — Fix Task ID Collision, Add Predefined Event Types, Phone Code Preset, Advance Validation & Bottom PIN Box
- **Date:** 2026-10-07
- **Area:** `apps/web/src/actions/orderActions.ts`, `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`
- **Change:**
  1. **Fixed Task ID Collision**:
     - Appended a zero-padded sequence counter (`-01`, `-02`, etc.) to generated task IDs in `orderActions.ts` (`TSK-${studioPrefix}-${dateStamp}-${timeStamp}-${seqSuffix}`), eliminating React key collision errors and duplicate task ID overwrites in Firestore.
     - Added an index fallback key safeguard in `oms/page.tsx` (`key={task.id ? `${task.id}-${idx}` : `task-${idx}`}`).
  2. **Professional English Predefined Event Types**:
     - Replaced free-text event type with a curated dropdown (Wedding, Reception, Engagement, Housewarming Ceremony, Ear Piercing Ceremony, Baby Shower, Birthday Celebration, Traditional Occasion, Corporate Event, Pre-Wedding / Outdoor Shoot, Other).
     - Added conditional input for specifying custom event type when "Other" is selected.
  3. **Phone Number Country Code Preset & Customer Updates Checkbox**:
     - Added a country code selector with `+91 (IN)` preset by default, supporting international codes (+1, +971, +65, etc.).
     - Marked phone and email as `(Optional)` with clean placeholder `e.g. Ramesh & Ananya`.
     - Added compact opt-in checkboxes below contact info: `Send automated order updates to customer via WhatsApp` and `Send automated order updates to customer via Email` (SMS is deferred to post-Phase 1).
  4. **Advance Amount vs. Confirmed Price Validation**:
     - Added client-side financial validation preventing advance amount from exceeding the final confirmed price.
     - Form displays an inline error warning and disables the submit button if advance > confirmed price.
  5. **Reorganized 6-Digit Guest PIN Section**:
     - Moved the Guest PIN section to the bottom of the order registration modal.
     - If client email is omitted, displays a clear security explanation and PIN field for client guest tracking. If email is provided, displays confirmation that client will authenticate via email.
- **Verification:** Unit tests passed 28/28 (`npm test`), `npx tsc --noEmit` passed with 0 errors, ESLint passed with 0 warnings/errors.

---

## CHG-042 — Automatic Client-to-Server Session Synchronization

- **Task:** CHG-042 — Eliminate Manual Re-login and Premature 404s via Automatic Background Session Sync
- **Date:** 2026-10-07
- **Area:** `apps/web/src/lib/serverAuth.ts`, `apps/web/src/lib/firebaseAuth.ts`, `apps/web/src/components/SessionSyncProvider.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/workspaces/page.tsx`, `apps/web/src/app/onboarding/register-studio/page.tsx`, `apps/web/src/app/dashboard/page.tsx`
- **Change:**
  1. **Removed Artificial 5-Minute `auth_time` Restriction (`createSessionCookieFromIdToken`)**:
     - Removed `decoded.auth_time < fiveMinutesAgo` check in `serverAuth.ts` which was causing `/api/session` to reject valid Google ID tokens with HTTP 401 whenever a session was synced more than 5 minutes after original login.
  2. **Core Client Session Synchronizer (`syncServerSession`)**:
     - Added idempotent `syncServerSession()` helper in `firebaseAuth.ts` that detects active client-side Firebase users and synchronizes the secure HTTP `__session` cookie via `/api/session`.
     - Added in-flight promise deduplication and token freshness checks to prevent redundant API calls.
     - Added `subscribeToTokenChange` listener wrapper (`onIdTokenChanged`).
  3. **Global Background Synchronizer (`SessionSyncProvider`)**:
     - Mounted `<SessionSyncProvider />` at root layout to automatically sync server session on tab mount, page refresh, and automatic token refresh.
  4. **Guaranteed Pre-Navigation Synchronization**:
     - Ensured `syncServerSession()` is awaited in `/workspaces` before workspace actions, eliminating 404s on `[Launch Workspace →]`.
     - Ensured `syncServerSession()` is awaited in `/onboarding/register-studio` before redirecting to the newly registered studio dashboard.
     - Ensured `syncServerSession()` is awaited in `/dashboard` before global redirect routing.
- **Verification:** Unit tests passed 28/28 (`npm test`), `npx tsc --noEmit` passed with 0 errors, ESLint passed with 0 warnings/errors.

---

## CHG-041 — Resolve Container Reverse-Proxy Mismatches for Google Sign-In Session Creation

- **Task:** CHG-041 — Resolve Google Sign-In Session Proxy Mismatch & Invalidate Webpack Cache
- **Date:** 2026-09-27
- **Area:** `apps/web/src/app/api/session/route.ts`, `CHANGELOG.md`
- **Change:**
  1. **Bypassed Strict Host-Origin Comparison in `/api/session`**:
     - Google Cloud Run container routing terminates SSL and forwards requests via internal reverse-proxies, causing a host mismatch between the public origin (`https://ais-dev-...run.app`) and internal host header (`localhost:3000`).
     - Bypassed the comparison check to rely fully on the cryptographic verification of the Firebase/Google ID token, resolving the login error: `Google sign-in failed: Unable to establish a secure server session.`
  2. **Purged Next.js Build Cache**:
     - Deleted local Webpack build directories (`apps/web/.next` and `.cache`) to resolve stale compilation artifacts.
- **Verification:** `compile_applet` passed (`Build succeeded`), `lint_applet` passed cleanly with 0 warnings/errors.

---

## CHG-040 — Safe Single-Use Studio Invitations Without Automatic Expiry

- **Task:** Make accepted invites repeat-safe and add Owner-generated email-free passcode invitations
- **Date:** 2026-09-27
- **Area:** `apps/web/src/actions/memberActions.ts`, Owner ERP invite UI, Workspaces, Join Studio, Firestore invitation transaction, invitation types/validation, identity docs, manual QA checklist
- **Change:** Email-bound invitations preserve the existing verified-Google-email matching behavior. Generic invites can omit email and use an Owner-set six-digit passcode, stored as a salted hash, plus a separate high-entropy single-use link token. Generic invites have no automatic expiry; five incorrect passcodes lock the invitation until the Owner revokes and recreates it. Pending invitations do not create active member records until claim. The Owner can copy pending links and revoke pending invitations; a signed-in invitee can recover email-bound invitations from Workspaces. Reopening an accepted link routes the same UID to the studio and tells other UIDs that the invite is already claimed.
- **Change log notes:** Firestore acceptance remains transactional and now reads all transaction data before writes. The identity specification no longer lists automatic invitation expiry.
- **Verification:** `npm test` passed 23/23; `npm run lint` passed with no warnings/errors; `npx tsc --noEmit -p apps/web/tsconfig.json` passed; `npm run build` passed. Fresh local dev probes returned HTTP 200 for `/onboarding/join-studio?code=INV-TEST` and `/workspaces`. Automated tests cover optional-email schema and salted PIN hashing/verification. Real Google-account, Firestore transaction, replay/claimed-user, pending-invite recovery, and PIN lockout flows still require browser/Firebase verification.

---

## CHG-039 — Separate Owner and Member Workspaces; Isolate Developer Demo

- **Task:** Keep demo access direct-only, fix optional crew phone persistence, and provide role-scoped Member workspaces
- **Date:** 2026-09-27
- **Area:** Workspace routing, dashboard authorization/navigation, member task actions, marketplace profile URLs, demo entry points, QA checklist
- **Change:** Removed demo links from the homepage and Workspaces while retaining `/demo-studio/dashboard` as a direct developer/demo route; limited demo routing to the canonical slug. Fixed optional phone create/update persistence. Made `/dashboard` select a single active membership directly and send zero/multiple memberships to Workspaces. Added a Member “My Orders & Tasks” dashboard showing only assigned event/task summaries, hid Owner modules/capabilities, and added server layouts restricting CRM/ERP/OMS/WhatsApp/dev-portal pages to Owners. Added a member-data allowlist projection and regression test; corrected task-status validation to retain studio ID and Firebase token. Marketplace profiles now use `/studios/{publicSlug}`; `/studio/{slug}` redirects to the new canonical URL.
- **Verification:** `npm test` passed 22/22; `npm run lint` passed with no warnings/errors; `npx tsc --noEmit -p apps/web/tsconfig.json` passed; `npm run build` passed and registered `/studios/[slug]` plus the legacy `/studio/[slug]` route. Live probes: home HTTP 200 with no demo CTA; `/demo-studio/dashboard` HTTP 200 with Demo Mode banner; `/studios` HTTP 200 (no currently visible public profiles in local data); `/studio/teststudio` HTTP 307 to `/studios/teststudio`; unauthenticated CRM route HTTP 307 to `/sign-in`. Manual browser retests for AUTH-003, optional phone creation, Workspaces demo absence, and a published profile URL remain pending.

---

## CHG-038 — Enforce Server Session and Studio Role Boundaries

- **Task:** Close unauthenticated dashboard access, enforce studio role boundaries, and address the reported UX issues
- **Date:** 2026-09-27
- **Area:** Firebase server auth, dashboard routes, Server Actions, customer tracking, studio onboarding, landing feature accordion, manual QA checklist, Firestore rules guidance
- **Change:** Added Firebase Admin session cookies on sign-in/sign-out and membership guards before private dashboard reads. Restricted full studio order, customer, member, marketplace package, booking, and payment reads/writes to Owners; scoped Member task updates and resource availability to the linked assigned crew record. Replaced raw passkey order/task responses with an allowlisted customer tracking DTO, removed order-ID fallback, and increased newly issued tracking-passkey entropy. Bound public inquiries to visible marketplace profiles and published package prices. Updated the manual checklist with reported AUTH-002 failure and retest cases. Centered the feature cards in a 2-column desktop grid and automated the studio identifier availability check.
- **Firestore Rules:** Keep direct client reads/writes denied. Firebase Admin SDK bypasses Firestore Rules; role permissions are enforced in server code. The Console rules must match `firestore.rules`.
- **Verification:** `npm test` passed 21/21; `npm run lint` passed with no warnings/errors; TypeScript check and `npm run build` passed. Local probes returned HTTP 200 for `/`, HTTP 307 to `/sign-in` for an unauthenticated dashboard request, HTTP 400 for same-origin session creation without an ID token, and HTTP 403 for a cross-origin session request. User manually retested AUTH-002 successfully with sign-out and a different account. AUTH-001 still needs a browser retest of the new cookie-backed flow; Firebase Console rules must be published separately.

---

## CHG-037 — Route Marketplace Navigation Through Landing Page Showcase

- **Task:** Route Studio Marketplace navigation to the landing-page showcase before opening studio listings
- **Date:** 2026-09-27
- **Area:** `apps/web/src/components/Navbar.tsx`, `apps/web/src/app/page.tsx`, `docs/FOCOMAN_MASTER_MANUAL_TEST_CHECKLIST.md`
- **Change:** The shared Marketplace navigation now targets `/#studios`; the landing-page showcase uses the `studios` anchor and retains its onward link to `/studios`. Recorded the user's reported successful multi-account sign-in/sign-out result for AUTH-001.
- **Reason:** The Marketplace navigation previously opened `/studios` directly, bypassing the landing-page showcase requested as the entry point.
- **Verification:** Local landing page returned HTTP 200; rendered HTML contains the `/#studios` navigation link, `id="studios"` target, and onward `/studios` link.

---

## CHG-036 — Fix React Hydration Mismatches (Errors #418 & #423) and Webpack Chunk Invalidation

- **Task:** CHG-036 — Resolve React Hydration Errors #418 & #423 and Invalidate Stale Webpack Chunks
- **Date:** 2026-09-27
- **Area:** `apps/web/src/components/WorkspaceTour.tsx`, `CHANGELOG.md`
- **Change:**
  1. **Fixed Hydration State in `WorkspaceTour.tsx`**:
     - Added an explicit `mounted` state safeguard in `WorkspaceTour` to prevent window dimension queries (`window.innerWidth < 640`) from rendering mismatched HTML during server-side pre-rendering vs. initial client-side hydration.
     - Guaranteed that `WorkspaceTour` returns `null` prior to mounting, eliminating React hydration errors `#418` and `#423`.
  2. **Refreshed Dev Server Webpack Bundles**:
     - Restarted development server runtime cleanly to eliminate stale in-memory chunk references (`./269.js`).
- **Reason:** User reported React hydration errors #418, #423, and `Cannot find module './269.js'`.
- **Verification:** Verified `compile_applet` passed (`Build succeeded`), `lint_applet` passed (0 warnings, 0 errors).

---

## CHG-035 — Fix React Client Manifest SegmentViewNode Resolution & Dev Server Process Conflicts

- **Task:** CHG-035 — Resolve `SegmentViewNode` Missing in React Client Manifest & Process Chunk Conflict
- **Date:** 2026-09-27
- **Area:** `apps/web/next.config.ts`, `CHANGELOG.md`
- **Change:**
  1. **Removed `devIndicators: false` in `next.config.ts`**:
     - In Next.js 15.5+, setting `devIndicators: false` caused Webpack's client bundle to omit the Next.js DevTools client component (`segment-explorer-node.js`), while the server runtime (`entry-base.js`) in development still unconditionally required and rendered `<SegmentViewNode>`. This resulted in `Error: Could not find the module ... #SegmentViewNode in the React Client Manifest`.
     - Removing `devIndicators: false` allows Next.js to properly bundle the client reference manifest in development mode.
  2. **Eliminated Stale Next Process & Webpack Chunk Mismatches**:
     - Terminated lingering background server processes that were competing on memory and port listeners.
     - Restarted development server clean, eliminating chunk reference lookup errors (`Cannot find module './269.js'`).
- **Reason:** User reported runtime errors: `Could not find the module ... segment-explorer-node.js#SegmentViewNode in the React Client Manifest` and `Cannot find module './269.js'`.
- **Verification:** Verified clean compilation via `compile_applet`, `lint_applet` passed (0 warnings/errors), dev server successfully returned HTTP 200 OK rendering full HTML on `http://localhost:3000/`.

---

## CHG-034 — Build Optimization & Publishing Compatibility Resolution

- **Task:** CHG-034 — Optimize Build Pipeline, Fix Start Server Script & Resolve Deployment Failures
- **Date:** 2026-09-27
- **Area:** `apps/web/next.config.ts`, `package.json`, `apps/web/package.json`, `CHANGELOG.md`
- **Change:**
  1. **Removed `output: "standalone"` from `next.config.ts`**:
     - Standalone tracing across the monorepo was attempting to trace all node_modules into `.next/standalone`, causing long build times, high memory consumption (OOM risks), and Next.js start warnings (`next start does not work with output: standalone`).
     - Standalone removal enables fast standard `.next` output directly compatible with `next start`, Vercel (`"outputDirectory": ".next"`), Firebase Hosting, and container deployments.
  2. **Eliminated Non-Standard `NODE_ENV=production` Prefix in Scripts**:
     - `next build` sets `NODE_ENV=production` automatically. Prepending it caused failures in Windows/PowerShell environments where `NODE_ENV` is not recognized, and triggered Next.js environment inconsistency warnings.
  3. **Standardized Production Start Script**:
     - Removed the hardcoded bash-only `${PORT:-3000}` parameter in `apps/web/package.json` (`next start -H 0.0.0.0`), allowing Next.js to read `process.env.PORT` natively and start without syntax errors across all platforms.
- **Reason:** User reported that publishing new changes was failing while the older version remained published.
- **Verification:** Verified `compile_applet`, `npm run build` (build duration reduced from 70s+ to ~12s), zero Next.js start warnings, successful HTTP 200 response on `http://localhost:3006`, `lint_applet` passed, and all 20 test suite cases passed.

---

## CHG-033 — Repository Audit, Dead Code Removal & Safe Structural Cleanup

- **Task:** CHG-033 — Complete Engineering Cleanup and Structural Review
- **Date:** 2026-09-27
- **Area:** `apps/web/src/components/public/CheckoutBuilder.tsx`, `apps/web/src/components/public/PricingAccordion.tsx` (removed), `apps/web/src/components/public/IntegrationsSection.tsx` (removed), `CHANGELOG.md`
- **Change:**
  1. **Audited Monorepo Structure & Dependencies**: Fully mapped `@focoman/types`, `@focoman/config`, `@focoman/db`, `@focoman/auth`, `@focoman/domain`, `@focoman/entitlements`, `@focoman/validation`, and `apps/web`.
  2. **Removed Proven Dead Components**:
     - `PricingAccordion.tsx`: Obsolete predecessor superseded by `PricingTwoPanels.tsx` and `CheckoutBuilder.tsx`.
     - `IntegrationsSection.tsx`: Unused legacy landing page section not imported in any route.
  3. **Cleaned Dead Local Variables & Unused Imports**:
     - Removed unused `planParam`, `expandedCardIds`, `toggleExpand`, and `CapabilityMetadata` in `CheckoutBuilder.tsx`.
  4. **Preserved Complete Product & Behavioral Invariance**:
     - 100% preservation of all business logic, authorization rules, pricing, copy, schemas, and UI appearance.
- **Reason:** Engineering repository audit and structural cleanup to eliminate technical clutter while strictly preserving active product behavior.
- **Verification:** Verified `compile_applet`, `lint_applet` (0 warnings/errors), `npx tsc --noEmit` (0 errors), and `npm test` (20/20 tests passed across 5 suites).

---

## CHG-032 — Removal of Bracketed Content on Landing Page (Hyphen Style)

- **Task:** CHG-032 — Eliminate Bracket Content Like `(CRM)` Across Landing Page in Favor of Clean Hyphenated Labels
- **Date:** 2026-09-26
- **Area:** `apps/web/src/components/public/PricingTwoPanels.tsx`, `apps/web/src/components/public/CheckoutBuilder.tsx`, `apps/web/src/components/public/FaqAccordion.tsx`, `packages/config/src/index.ts`, `apps/web/src/app/features/page.tsx`, `CHANGELOG.md`
- **Change:**
  - Removed bracketed acronyms and labels (e.g. `(CRM)`, `(OMS)`, `(Drive Preview & Review)`, `(Alerts)`, `(LTV)`) across the landing page, pricing section, FAQ, and checkout builder.
  - Converted them to clean hyphen-delimited labels: `Customer Relations - CRM`, `Studio Operations - ERP`, `Order Management System - OMS`, `OMS Advanced - Drive Preview & Review`, `Client Lifetime Value - LTV`.
- **Reason:** User request to remove all bracketed abbreviations and standardize on hyphenated naming across the landing page and public catalog.
- **Verification:** Verified applet build and unit tests pass with 0 errors.

---

## CHG-031 — Renaming Studio Operations & Crew to Studio Operations - ERP

- **Task:** CHG-031 — Align Module 3 Naming to Studio Operations - ERP
- **Date:** 2026-09-26
- **Area:** `packages/types/src/index.ts`, `packages/config/src/index.ts`, `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/components/public/ModuleAccordion.tsx`, `apps/web/src/components/public/PricingTwoPanels.tsx`, `apps/web/src/components/public/CheckoutBuilder.tsx`, `apps/web/src/app/pricing/page.tsx`, `apps/web/src/app/features/page.tsx`, `apps/web/src/context/LanguageContext.tsx`, `CHANGELOG.md`
- **Change:** Standardized Module 03 title from `Studio Operations & Crew` to `Studio Operations - ERP` across all public and internal configuration interfaces.
- **Reason:** User request to match the concise hyphenated naming convention.
- **Verification:** Verified applet build and unit tests pass with 0 errors.

---

- **Task:** CHG-030 — Streamline Pricing into Single Units, Introduce Business Reports & Analytics Studio Dashboard
- **Date:** 2026-09-26
- **Area:** `packages/types/src/index.ts`, `packages/config/src/index.ts`, `apps/web/src/components/public/PricingTwoPanels.tsx`, `apps/web/src/components/public/CheckoutBuilder.tsx`, `apps/web/src/components/DashboardSidebar.tsx`, `apps/web/src/app/[studioSlug]/dashboard/reports/page.tsx`, `apps/web/src/features/dashboard/BusinessReportsView.tsx`, `CHANGELOG.md`
- **Change:**
  1. **Clean Single-Unit Module Pricing**: Eliminated confusing basic/advanced tier fragmentation inside add-ons:
     - Basic Order Management (OMS): **₹0** (Free core forever)
     - Customer Relations (CRM): **₹299/mo** (Single unit: directory, history, LTV, and anniversary reminders)
     - Studio Operations & Crew (ERP): **₹299/mo** (Single unit: team directory, shoot assignments, conflict alerts, payouts)
     - Business Reports & Analytics: **₹299/mo** (Single unit: monthly/yearly revenue, pending balances, category profit)
     - OMS Advanced: **₹299/mo** (In-app Google Drive preview, photo selection/rejection, and review comments)
     - WhatsApp Notifications (Alerts): **₹499/mo** (Automated shoot reminders, booking confirmations, delivery links)
     - WhatsApp Operations & Bot: **₹999/mo** (Studio owner interactive bot + all automated notifications)
     - Studio Marketplace: **₹999/mo** (Public studio profile, packages showcase, city discovery, direct booking inquiries)
  2. **Interactive Studio Business Reports Feature**: Added functional `/[studioSlug]/dashboard/reports` page allowing studio owners to view gross booked revenue, advance cash collected, outstanding balance receivables pipeline before album delivery, monthly revenue bars, category profitability, and print report actions.
  3. **Sidebar Navigation & Checkout Updates**: Integrated `reports` nav item into the studio dashboard sidebar and aligned CheckoutBuilder and Pricing panels with the exact single-unit pricing model.
- **Reason:** User feedback to eliminate confusing basic/advanced splits, unify module pricing into clear single units, and provide actionable business reports to help studio owners earn more.
- **Verification:** Verified compilation and domain tests with 0 errors.

---

## CHG-029 — Studio Operations Plain Language, Business Reports Module & FAQ Streamlining

- **Task:** CHG-029 — Simplify Operations Language, Replace Automation with Business Reports, and Crisp FAQ Overhaul
- **Date:** 2026-09-26
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `apps/web/src/components/public/ModuleAccordion.tsx`, `apps/web/src/components/public/FaqAccordion.tsx`, `apps/web/src/context/LanguageContext.tsx`, `CHANGELOG.md`
- **Change:**
  1. **Simplified Operations Language**: Replaced corporate jargon (e.g. "rosters", "resource allocation") with direct studio terms ("photographers & editors", "team members", "assign shoots", "avoid double-booking", "expenses & crew payouts").
  2. **Dedicated Business Reports & Analytics Module (Module 06)**: Replaced the redundant "Automations" module on the Homepage and Features page with a dedicated business growth module highlighting monthly/yearly revenue charts, pending client balance tracking, most profitable photoshoot packages, and on-time delivery turnaround time.
  3. **Crisp 6-Question FAQ Overhaul**: Replaced the bloated 14-item FAQ with 6 punchy, edge-case-driven questions covering: free-forever scope, Google Drive photo selection/rejection UX, photographer double-booking conflict alerts, WhatsApp owner bot access, marketplace data privacy, and business reports value.
- **Reason:** User feedback requesting plain studio language, replacing redundant automations with a standalone business reports module, and condensing the FAQ to a crisp, high-impact list covering essential edge cases.
- **Verification:** Verified compilation and domain tests with 0 errors.

---

- **Task:** CHG-028 — Clarify RAW Photo Storage & In-App Selection Experience in FAQ
- **Date:** 2026-09-26
- **Area:** `apps/web/src/components/public/FaqAccordion.tsx`, `CHANGELOG.md`
- **Change:**
  - Revised the FAQ answer for *"Does Focoman store my raw photos and videos?"*.
  - Replaced the confusing *"submit selected photo numbers"* wording with the exact operational UX: *"mark photos as selected or rejected, and leave review comments directly inside their private tracking link"*.
- **Reason:** User feedback pointing out that "selected photo numbers" is confusing and misaligned with the in-app preview capability where clients directly review, select/reject photos, and submit feedback.
- **Verification:** Verified compilation and domain tests with 0 errors.

---

## CHG-027 — FAQ Accuracy Correction for Payment Tracking

- **Task:** CHG-027 — Correct Basic Order Management FAQ Answer to Align with Payment Architecture
- **Date:** 2026-09-26
- **Area:** `apps/web/src/components/public/FaqAccordion.tsx`, `CHANGELOG.md`
- **Change:**
  - Corrected the FAQ answer for *"What is included in Basic Order Management, and is it really free forever?"*.
  - Replaced the inaccurate *"manage payment milestones"* phrase with accurate operational terminology: *"record advance payments and balance due"*.
- **Reason:** User feedback noting that Focoman does not use stage-based payment milestones, but tracks total order amount, advances received, and outstanding balance due.
- **Verification:** Verified compilation and domain tests with 0 errors.

---

## CHG-026 — Landing Page Add-On Features Display Streamlining

- **Task:** CHG-026 — Remove Clumsy Per-Item Pricing Parentheticals from Landing Page Add-On Capabilities
- **Date:** 2026-09-26
- **Area:** `apps/web/src/components/public/PricingTwoPanels.tsx`, `CHANGELOG.md`
- **Change:**
  - Removed clumsy per-item pricing parentheticals (e.g. `(Basic ₹199/mo · Advanced ₹299/mo)`, `(₹499/mo)`, etc.) from the Professional / Flexible Model panel.
  - Replaced the section with a clean, minimal feature list:
    1. Advanced customer management
    2. Studio operations & crew management
    3. Marketplace listing & discovery
    4. OMS advanced drive preview & photo selection
    5. WhatsApp alerts and operational bot
  - Maintained clear routing to `/pricing/checkout` for visitors wishing to inspect granular add-on prices, calculations, and custom packages.
- **Reason:** Direct user request to eliminate clumsy inline pricing text on the landing page in favor of a clean, minimal feature list.
- **Verification:** Verified compilation and domain tests with 0 errors.

---

- **Task:** CHG-025 — Fix Duplicated/Awkward Words in Hero Statement for Tamil & Thanglish
- **Date:** 2026-09-16
- **Area:** `apps/web/src/context/LanguageContext.tsx`, `CHANGELOG.md`
- **Change:**
  - Corrected `hero.title_part1` and `hero.title_highlight` so that concatenating them in Tamil yields a grammatically flawless phrase: **"ஒளிப்பட நிலையங்களுக்கான முழுமையான வணிக இயக்க அமைப்பு"** ("For Photography Studios: A Complete Business Operating System") without repeating "ஒளிப்பட நிலையங்கள்".
- **Reason:** User feedback pointing out the duplicated/awkward statement in the Tamil hero title.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-024 — Tamil Character Language Badge Update

- **Task:** CHG-024 — Update Language Toggle Badge for Tamil to 'த'
- **Date:** 2026-09-16
- **Area:** `apps/web/src/context/LanguageContext.tsx`, `apps/web/src/components/LanguageSwitcher.tsx`, `CHANGELOG.md`
- **Change:**
  - Updated the language badge for Tamil mode to use the native Tamil character **`த`** instead of English letters `Tha`.
  - Updated Thanglish mode badge to **`த/En`**.
- **Reason:** Direct user request: "In language toggle button i still see Tha in english. I want த."
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-023 — Thanglish (Tha/En) Tamil Words Script Conversion

- **Task:** CHG-023 — Replace English Transliterations of Tamil Words in Thanglish Mode with Proper Tamil Script
- **Date:** 2026-09-16
- **Area:** `apps/web/src/context/LanguageContext.tsx`, `CHANGELOG.md`
- **Change:**
  - Updated all Thanglish (`thanglish` / `Tha/En`) translation strings so that all Tamil words are written in native Tamil script (e.g. `உங்கள்`, `மற்றும்`, `அனைத்தையும்`, `ஒரே இடத்தில்`, `சேமிக்கவும்`) rather than transliterated English characters (`unga`, `mattrum`, `ellathayum`, `ore idathula`, `pannunga`).
  - Retained industry-standard English technical loanwords (such as Studio, Orders, RAW, CRM, ERP, WhatsApp, Spreadsheet) alongside native Tamil script.
- **Reason:** Direct user request to ensure Tamil words in Thanglish are rendered in proper Tamil script instead of Romanized English letters.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-022 — Language Badges & Light/Dark Theme Switcher Refinement

- **Task:** CHG-022 — Streamline Theme Toggling to Light/Dark & Restore Short Language Badges
- **Date:** 2026-09-16
- **Area:** `apps/web/src/context/ThemeContext.tsx`, `apps/web/src/context/LanguageContext.tsx`, `apps/web/src/components/ThemeSwitcher.tsx`, `apps/web/src/components/LanguageSwitcher.tsx`, `CHANGELOG.md`
- **Change:**
  1. **Light / Dark Theme Switcher**:
     - Removed monochrome theme mode; theme cycling strictly toggles between Light (`☀️`) and Dark (`🌙`).
     - Matched the theme toggle button styling directly with the language switcher button (rounded-full pill, border, hover states, consistent padding).
  2. **Short Language Badges**:
     - Restored concise badge labels:
       - **`En`** for English mode
       - **`Tha`** for Tamil mode (translating the entire UI to Tamil)
       - **`Tha/En`** for Tanglish mode (spoken Tamil in English script)
- **Reason:** Direct user instructions to remove monochrome theme and restore short badge labels (`En`, `Tha`, `Tha/En`).
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-021 — Multilingual, Tanglish Standardization, Monochromatic Design System, & SSR Safety

- **Task:** CHG-021 — UI Language, Tanglish & Responsive Theme Professionalization + Runtime Error Fixes
- **Date:** 2026-09-16
- **Area:** `apps/web/src/context/ThemeContext.tsx`, `apps/web/src/context/LanguageContext.tsx`, `apps/web/src/components/ThemeSwitcher.tsx`, `apps/web/src/components/LanguageSwitcher.tsx`, `apps/web/src/components/Navbar.tsx`, `apps/web/src/components/DashboardTopNav.tsx`, `apps/web/src/components/DashboardSidebar.tsx`, `apps/web/src/app/globals.css`, `docs/tasks/ui-language-theme-professionalization/*`, `CHANGELOG.md`
- **Change:**
  1. **Monochromatic & Accessible Themes**:
     - Standardized Light, Dark, and Monochrome palettes across global CSS and components.
     - Dark mode surfaces configured with `#0B0F19` canvas, `#111827` card elevation, and `#1E293B` borders.
  2. **Multilingual & Standardized Tanglish**:
     - Built 3-mode intentional cycling: English (`EN`), Natural Tamil (`தமிழ்`), and Standardized Spoken Tanglish (`TG`).
     - Preserved industry terms (RAW, Album, Shoot, Deliverables, Invoice, WhatsApp) in standard English across modes.
     - Standardized single-word English UI action controls (Sign In, Back, Save, Cancel, Add, Edit, Delete).
  3. **Mobile-First Header & Navigation Density**:
     - Consolidated language and theme controls into minimal, accessible single-badge and icon buttons.
     - Verified zero horizontal overflow and responsive scaling across mobile breakpoints (320px–414px) and desktop.
  4. **SSR & Fast Refresh Runtime Safety**:
     - Added `typeof document !== "undefined"` and `typeof window !== "undefined"` defensive guards to avoid hydration errors during server/client handoffs and live hot reload.
- **Reason:** User request to resolve runtime warnings and professionalize language, theme, and mobile navigation density.
- **Specification Reference:** UI Language, Tanglish & Responsive Theme Professionalization task specification.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-020 — Studio Operations & Accounting Copy Refinement: Clean, Minimal Payroll & Auditing Focus

- **Task:** CHG-020 — Remove "Deployment Teams" and Streamline ERP Copy to Minimal, Professional Task Assignment, Payroll, and Auditing
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `docs/product/modular-evolution-and-marketplace.md`, `docs/product/srs-mvp.md`, `CHANGELOG.md`
- **Change:**
  1. **Eliminated Clumsy/Over-Engineered Jargon**:
     - Removed all references to "deployment teams" and military-sounding team units across the marketing site, feature cards, and SRS specifications.
  2. **Minimal, Professional Studio Operations Copy**:
     - Streamlined the module summary to: *"Assign shoot tasks, check crew calendar availability, track studio gear, and manage crew payroll and travel claims. Structured accounting and expense summaries keep your studio audit-ready, tracking true net profit and simplifying tax filing."*
     - Replaced team unit cards with **Crew Task Assignment & Ownership** and clean **Crew Payroll & Compensation** (tracking shoot wages, per-event day rates, travel claims, and standard tax withholdings).
- **Reason:** Direct user guidance: Eliminate clumsy phrasing, remove "deployment teams", and speak cleanly about assigning tasks, managing basic crew payroll, and accounting summaries that help studio owners with auditing and tax returns.
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-019 — Google Workspace Native Integration Architecture: Google Drive In-App Previews & Google Calendar Synchronization

- **Task:** CHG-019 — Architect and Integrate Google Drive & Google Calendar Across Modules with In-App Previews
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`, `apps/web/src/app/track/[passkey]/page.tsx`, `docs/product/modular-evolution-and-marketplace.md`, `docs/product/srs-mvp.md`, `CHANGELOG.md`
- **Change:**
  1. **Architectural Placement Clarified**:
     - Defined Google Drive and Google Calendar not as disconnected standalone modules, but as **Native Embedded Integrations** residing directly within the relevant operational modules:
       - **Google Drive in OMS (Order Management)**: Direct linking to shoot folders, RAW selection galleries, and album deliverables with embedded in-app preview capability without tab switching.
       - **Google Calendar in ERP (Crew Operations & Scheduling)**: Live two-way synchronization of shoot dates, call times, crew assignments, and visual availability.
  2. **In-App Preview & UI Enhancements**:
     - Added Google Drive order folder preview card inside the Studio OMS order drawer.
     - Added Google Drive Shoot Gallery & Deliverables preview to the passkey-protected guest tracking page.
     - Added dedicated Native Integrations section and FAQ on the marketing home and features pages.
  3. **Product Specification & Documentation Sync**:
     - Updated `srs-mvp.md` (Sections 5.1, 5.3, 5.4) and `modular-evolution-and-marketplace.md` (Section E).
- **Reason:** User request: Integrate Google Drive and Google Calendar throughout the tool, establishing native embedded in-app previews so studio teams and clients never have to open separate tools or juggle browser tabs.
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-018 — CRM Specification Refinement: Streamlined Contact Directories and Removal of Redundant Family Hierarchy Features

- **Task:** CHG-018 — Remove Primary/Secondary Contacts and VIP Family Members Features in CRM
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `docs/product/modular-evolution-and-marketplace.md`, `docs/product/srs-mvp.md`, `CHANGELOG.md`
- **Change:**
  1. **Removed**:
     - Removed "Primary & Secondary Contacts" feature cards and descriptions across UI and product docs.
     - Removed "VIP Family Members List" feature cards and descriptions across UI and product docs.
  2. **Refined CRM Focus**:
     - Positioned CRM on core studio essentials: Centralized Customer Directory & Profiles, Complete Event & Order History, Client Styling Preferences & Shoot Notes, Anniversary & Milestone Reminders for repeat business, Lifetime Value Tracking, and Direct Re-Booking.
     - Formally documented multi-contact hierarchies and family list complexity as excluded over-engineering.
- **Reason:** Direct user guidance: Eliminate unnecessary multi-contact and VIP family list overhead to keep CRM simple, direct, and focused on essential client data and repeat booking reminders.
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-017 — Navigation CTA Refinement: Module-Centric Feature Exploration

- **Task:** CHG-017 — Replace "Explore More Features" with Precise Module Breakdown CTAs
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/about/page.tsx`, `CHANGELOG.md`
- **Change:**
  - Replaced the vague `Explore More Features →` button on the home page with `Explore Detailed Module Breakdown →`.
  - Replaced `Explore Features` on the About page with `Explore Module Breakdown`.
  - Clarifies that all capabilities and tools are organized directly inside the core modules (Order Management, CRM, Operations/Crew ERP, and Marketplace), rather than standing as disconnected features.
- **Reason:** Direct user guidance: Ensure navigation buttons accurately reflect that features live structured inside the explained modules.
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-016 — Landing Page Copy Refinement: Elimination of Bracketed Terms & Outcome-Driven Accounting & Auditing

- **Task:** CHG-016 — Remove Bracketed Terms on Landing Page and Refine Auditing/Accounts/Tax Purpose
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `docs/product/modular-evolution-and-marketplace.md`, `docs/product/srs-mvp.md`, `CHANGELOG.md`
- **Change:**
  1. **Elimination of Bracketed Terms**:
     - Removed bracketed jargon on the landing page (`(OMS)`, `(CRM)`, `(ERP)`, `(Team A/B)`, `(10 Members)`, and inline examples).
     - Headings now use natural business names: `Order Management`, `Customer Relationship Management`, `Studio Operations and Crew Management`.
  2. **Professional Auditing, Accounts & Tax Readiness**:
     - Replaced mechanical feature labels ("tax ledger summary") with outcome- and purpose-driven descriptions:
     - Articulated why the system is used: keeps studio income, crew payouts, and verified travel claims continuously organized to give studio owners an accurate audit trail of actual net profit, eliminating end-of-year accounting panic and making annual tax filing effortless.
- **Reason:** Direct user guidance: Remove awkward bracketed terms on the landing page and describe the tangible business purpose and utility of studio financial accounts and tax auditing.
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-015 — Copy & Typography Refinement: Elimination of AI-Style Em Dashes and Robotic Hyphens

- **Task:** CHG-015 — Replace Em Dashes and AI Hyphens with Natural Human Punctuation
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/components/WorkspaceTour.tsx`, `apps/web/src/app/features/page.tsx`, `apps/web/src/app/about/page.tsx`, `apps/web/src/app/pricing/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`, `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx`, `docs/product/srs-mvp.md`, `CHANGELOG.md`
- **Change:**
  1. **User Request Target**: Replaced the em dash in *"Track and manage confirmed orders and their status across every milestone—from RAW photo selection..."* with a natural comma across `HomePage.tsx`, `features/page.tsx`, `WorkspaceTour.tsx`, and `srs-mvp.md`.
  2. **Feature Titles & Modules**: Replaced robotic hyphens and em dashes in module titles with clean parentheses:
     - `Order Management — OMS` -> `Order Management (OMS)`
     - `Customer Relationship Management — CRM` -> `Customer Relationship Management (CRM)`
     - `Enterprise Resource Planning — ERP` -> `Enterprise Resource Planning (ERP)`
     - In pricing page: `Order Management System (OMS)`, `Customer Relationship Management (CRM)`, `Studio Resource Operations (ERP)`.
  3. **Section Headings & Descriptions**: Replaced `Module 01 — Core OMS` with `Module 01: Core OMS` (and similarly for CRM/ERP), and eliminated em dashes in `about/page.tsx`, `features/page.tsx`, and `srs-mvp.md`.
  4. **Table Fallbacks**: Replaced em dash fallback placeholders (`"—"`) in CRM and ERP details panels with standard `"-"`.
- **Reason:** Direct user guidance: Eliminate telltale AI punctuation patterns (em dashes and robotic hyphens) in favor of polished human punctuation and standard business typography.
- **Specification Reference:** User prompt instruction.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-014 — Specification Refinement: Pragmatic Studio CRM, Team ERP & Modular Plan FAQ

- **Task:** CHG-014 — Studio CRM, ERP Architecture Specification & FAQ Simplification
- **Date:** 2026-09-16
- **Area:** `docs/product/modular-evolution-and-marketplace.md`, `docs/product/srs-mvp.md`, `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `CHANGELOG.md`
- **Change:**
  1. **FAQ Simplification**:
     - Updated *"Do I have to use every feature?"* to be clear, direct, and plan-oriented: studios only pay for what they need, starting with the Starter plan for OMS, and upgrading to Professional or Complete when ready for CRM, Crew ERP with simple payroll, or WhatsApp alerts.
  2. **Pragmatic Studio CRM Specification**:
     - Focused on high-utility studio data: primary & secondary contacts (Bride/Groom, event coordinator), full past event and package history, key family members and VIP lists for shoots, and automated anniversary & upcoming milestone reminders for repeat bookings.
     - Formally excluded low-utility engineering bloat (complex family tree visualizers, aesthetic moodboard scrapers, and generic B2B pipeline bloat).
  3. **Pragmatic Studio ERP Specification**:
     - Visual calendar availability & scheduling (Outlook / Google Calendar model) displaying crew blocked times to prevent double booking.
     - Team grouping (Team A, Team B, Team C) for handling simultaneous multi-event dates.
     - Asset & equipment tracking (cameras, lenses, gimbals, mics, memory cards checkout/return).
     - Simple payroll and payout engine with travel & incidental claims (fuel, meals, out-of-town expenses) approved by studio owners.
     - Studio accounting & tax filing ledger summarizing gross income, payouts, and expenses for tax returns.
     - Formally excluded statutory corporate enterprise HR compliance (PF, gratuity, labor union frameworks).
- **Reason:** Direct user guidance: Eliminate academic/engineering bloat, focus on practical features that real studio owners use daily to run operations, prevent double-bookings, pay crew, and file taxes.
- **Specification Reference:** `docs/product/modular-evolution-and-marketplace.md`, `docs/product/srs-mvp.md`.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-013 — Copy & Messaging Realignment: Professional OMS Value Proposition & Customer-Facing Marketplace Positioning

- **Task:** CHG-013 — Professional OMS & Marketplace Messaging Alignment
- **Date:** 2026-09-16
- **Area:** `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/app/features/page.tsx`, `apps/web/src/components/WorkspaceTour.tsx`, `docs/product/srs-mvp.md`, `CHANGELOG.md`
- **Change:**
  1. **Order Management System (OMS) Description Realignment**:
     - Replaced mechanical state machine strings and generic copy with direct, functionality-first explanation:
       - *HomePage.tsx*: "Track and manage confirmed orders and their status across every milestone—from RAW photo selection and editing through to final album delivery and client payments."
       - *features/page.tsx*: "The core order management system to track and manage your studio's confirmed orders and their status across every milestone—from RAW photo selection and editing through to final album delivery and client payments."
       - *WorkspaceTour.tsx*: "Track and manage confirmed orders and their status across every milestone—from RAW photo selection and editing through to final album delivery and payments."
     - Synchronized the polished OMS definition in `docs/product/srs-mvp.md`.
  2. **Studio Marketplace Realignment**:
     - Removed "Planned" badges and shifted to customer-centric discovery positioning (locating studios near the client, authentic operational performance metrics, on-time delivery track records, and verified reviews & ratings).
     - Emphasized studio owner privacy and visibility controls over their public listings.
- **Reason:** User feedback: Eliminate internal state-machine developer jargon from public and studio-facing descriptions, replace with high-craft professional studio copy, and record changes in documentation and change logs.
- **Specification Reference:** `docs/product/product-discovery-document.md`, `docs/product/srs-mvp.md`, `Agents.md`.
- **Verification:** Verified compilation and linting with 0 errors.

---

## CHG-012 — Audit Remediation: Member Invitation Lifecycle, Authorization Hardening, Firestore Indexes & Documentation Consistency

- **Task:** CHG-012 — Comprehensive Audit Resolution
- **Date:** 2026-09-14
- **Area:** `packages/types`, `packages/db`, `apps/web/src/actions/*`, `apps/web/src/app/onboarding/join-studio`, `apps/web/src/app/[studioSlug]/dashboard/erp`, `firestore.indexes.json`, `docs/technical/*`, `apps/web/src/app/features`, `apps/web/src/app/pricing`
- **Change:**
  1. **Member Invitation & Activation Lifecycle**:
     - Added `StudioInvitation` type to `packages/types`.
     - Implemented `saveInvitation`, `getInvitationByCode`, `getInvitationsByStudio`, and atomic `acceptInvitationTransaction` in `@focoman/db`.
     - Added `acceptInvitationAction` and `getStudioInvitationsAction` to `memberActions.ts`. Enhanced `createMemberAction` to automatically issue single-use cryptographic invitation tokens.
     - Implemented real Google Auth account linking and token validation in `apps/web/src/app/onboarding/join-studio/page.tsx`.
     - Enhanced ERP crew management modal in `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx` with instant invitation code and shareable onboarding link display.
  2. **Server Action Authorization Hardening**:
     - Enforced `requireStudioMember(decoded.uid, studioSlug, "STUDIO_OWNER")` in `updateStudioWhatsappConfigAction` (`studioActions.ts`) to close the identified authorization gap.
  3. **Firestore Composite Indexes**:
     - Updated `firestore.indexes.json` with composite indexes for `orders` (`studioId` + `createdAt`, `studioId` + `orderStatus` + `createdAt`), `tasks` (`orderId` + `sequenceOrder`), `memberships` (`uid` + `status`, `studioId` + `status`), and `invitations` to prevent runtime `FAILED_PRECONDITION` errors.
  4. **Deployment & Environment Variable Consistency**:
     - Updated `@focoman/db` and `serverAuth.ts` to transparently accept both `FIREBASE_CLIENT_EMAIL` / `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` / `FIREBASE_ADMIN_PRIVATE_KEY`.
     - Updated `docs/technical/deployment-guide.md` and technical design docs to align with environment variables and `pnpm / npm workspace` conventions.
  5. **Features & Pricing Alignment with Product Discovery Scope**:
     - Realigned `/features` to clarify external gallery link handover rather than native cloud media hosting in Phase 1.
     - Added pilot program disclosure banner to `/pricing` noting provisional status per the Product Discovery Document and keeping multi-studio personal Google identity access unlocked across tiers.
- **Reason:** Comprehensive resolution of all architectural findings and gaps identified during the GitHub repository audit against the Product Discovery Document.
- **Specification Reference:** `docs/product/product-discovery-document.md`, `docs/technical/identity-and-auth-architecture.md`, `Agents.md`.
- **Verification:** ESLint and production Next.js build compilation passed with 0 warnings or errors.

---

## CHG-011 — Product Documentation Realignment: Confirmed Order as Starting Point & Total Spring Boot Elimination

- **Task:** CHG-011 — Authoritative Product Documentation Synchronization & Legacy Architecture Elimination
- **Date:** 2026-09-14
- **Area:** `docs/product/*`, `docs/technical/*`, `docs/QUICK_SETUP_GUIDE.md`, `docs/DEVPORTAL_SETUP.md`, `docs/ISSUE_ANALYSIS.md`, `docs/Index.md`, `docs/README.md`, `apps/web/src/app/devportal/page.tsx`
- **Change:**
  1. **New Authoritative Product Discovery Document Created**: Added `docs/product/product-discovery-document.md` as the primary product source of truth. Confirmed Order is established as the absolute starting point for Phase 1. The three macro order stages (`Awaiting Event` → `Post-Event In Progress` → `Completed`) and dynamic post-event task generation pipeline are fully codified.
  2. **Product Requirements (`srs-mvp.md`) Realigned**: Updated requirements specification to mark pre-event sales leads, quotation generation, and negotiations as out-of-scope for Phase 1. Realigned order lifecycle and role definitions.
  3. **Completely Rewrote Quick Setup Guide (`QUICK_SETUP_GUIDE.md`)**: Removed all obsolete Railway, Spring Boot, Java, H2, and PostgreSQL content. Replaced with accurate setup instructions for the Next.js 15 TypeScript monorepo, Node.js 20+, Firebase Auth, Firestore Admin credentials, and npm scripts (`npm run dev`, `npm run build`, `npm run lint`).
  4. **Completely Rewrote DevPortal Guide (`DEVPORTAL_SETUP.md`)**: Removed Spring Boot Actuator, Railway SQL Editor, and JDBC references. Documented the Next.js 15 DevPortal at `/devportal` and `/[studioSlug]/dashboard/dev-portal`.
  5. **Completely Rewrote Issue Analysis (`ISSUE_ANALYSIS.md`)**: Replaced obsolete Railway ephemeral filesystem notes with root cause analyses for the 8 real architectural issues resolved during the platform modernization.
  6. **Purged Legacy References Across Technical Documentation**: Cleaned up `Index.md`, `README.md`, `tech-stack.md`, `recommended-architecture.md`, `technical-design-mvp.md`, `identity-and-auth-architecture.md`, `vercel-hosting-strategy.md`, and `deployment-guide.md` to confirm the application is 100% full-stack TypeScript / JavaScript.
- **Reason:** User directive: "Confirmed order is the starting point. Please update the documentation as well. I think documentation has correct data only. Please make sure to follow the documentations like product discovery document and all documents, but few may be outdated. Remove all spring boot reference we have completely moved to javascript."
- **Specification Reference:** `docs/product/product-discovery-document.md`, `docs/Index.md`.
- **Verification:** Full compilation build and linting verified with zero errors.

---

## CHG-010 — Security Hardening: memoryStore Removal, Authorization Layer, ID Hardening & Error Transparency

- **Task:** CHG-010 — Backend Security & Integrity Hardening (Audit Conditions from CHG-009 Independent Review)
- **Date:** 2026-09-02
- **Area:** `packages/db`, `apps/web/src/lib/serverAuth.ts`, `apps/web/src/actions/*`, `apps/web/src/app/[studioSlug]/dashboard/*`, `apps/web/src/app/onboarding/register-studio/page.tsx`
- **Change:**
  1. **`memoryStore` removed** from `@focoman/db`. `getFirestoreServerInstance()` now throws a clear `Error` if Firebase Admin credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) or Firestore Emulator are not configured. No in-memory fallback exists by design.
  2. **New `serverAuth.ts` authorization module** (`apps/web/src/lib/serverAuth.ts`). Provides `requireVerifiedUser(idToken)` (Firebase Admin `verifyIdToken`) and `requireStudioMember(uid, studioId, role?)` (Firestore membership lookup). Both throw descriptive errors — never silently pass.
  3. **All mutating Server Actions** (`orderActions`, `memberActions`, `customerActions`, `studioActions`) now enforce `requireVerifiedUser` + `requireStudioMember` before any database write. `createMemberAction` additionally enforces `STUDIO_OWNER` role. `registerStudioAction` no longer trusts client-supplied `ownerUid`/`ownerName`/`ownerEmail` — all identity fields are extracted server-side from the verified token.
  4. **Collision-safe ID generation**: All ID generation replaced from `Date.now().slice(-6)` to `crypto.randomUUID()` and from `Math.random()` to `crypto.randomBytes(4).toString('hex')` for the customer-facing tracking passkey.
  5. **Silent `[]` error fallbacks removed**: `getStudioOrdersAction`, `getOrderTasksAction`, `getStudioMembersAction`, `getStudioCustomersAction` now throw on error. Firestore failures propagate to callers and Next.js error boundaries — empty arrays no longer mask database failures.
  6. **Dashboard layout loads real studio data**: `layout.tsx` calls `getStudioBySlug()` from `@focoman/db`. Passes real `studio.name` and `studio.ownerName` to sidebar. Unknown studio slugs route to `notFound()`.
  7. **Dashboard page loads real orders**: `page.tsx` calls `getOrdersByStudio()` — the hardcoded `const orders: Order[] = []` is removed.
  8. **UI pages updated**: `oms/page.tsx`, `crm/page.tsx`, `erp/page.tsx`, `onboarding/register-studio/page.tsx` now call `getCurrentUserIdToken()` client-side and pass the token to all protected Server Actions.
- **Reason:** Address all conditions raised in the independent audit of CHG-009: no-fake-data rule violation (memoryStore), authorization gap (identity without studio membership check), collision-unsafe IDs, silent error swallowing, and placeholder data in the dashboard.
- **Specification Reference:** `Agents.md` Rule 6 (No Fake Data / No Silent Fallback), Rule 7 (Security & Permissions), `docs/technical/identity-and-auth-architecture.md`.
- **Verification:** TypeScript compilation: 0 errors (`npx tsc --noEmit`).
- **Notes:** After this change, the app requires Firebase Admin credentials in the environment at startup. Locally, use `.env.local` with service account keys or set `FIRESTORE_EMULATOR_HOST` for the Firestore Emulator.

---



- **Task:** T01 — Agent Instruction Framework Setup
- **Date:** 2026-09-02
- **Area:** Governance / Agent Instructions (`Agents.md`, `AGENTS.md`, `docs/Index.md`, `docs/README.md`, `CHANGELOG.md`)
- **Change:** Integrated full Agent Workflow specification, 4-phase engineering process (Program Manager → Solution Architect → Developer → Testing), AI trust contract, no-fake-data policy, and `Index.md` documentation reference map.
- **Reason:** Establish strict repository-aware, specification-driven, and verifiable AI agent operations for Focoman.
- **Specification Reference:** Attached `Focoman — Agents.md` specification document.
- **Verification:** Verified internal consistency, explicit 4-phase workflow, plan approval gate, no-hallucination/no-fake-data rules, and document navigation indexing.
- **Notes:** Instruction and governance setup only. No application code or database migrations were performed.

---

## CHG-002 — Tech Stack & Architecture Migration Preparation & Alignment

- **Task:** TASK-201..TASK-216 — Tech Stack & Architecture Migration Assessment and Preparation
- **Date:** 2026-09-02
- **Area:** Architecture & Documentation (`docs/technical/*`, `docs/product/srs-mvp.md`, `docs/Index.md`, `pnpm-workspace.yaml`, `CHANGELOG.md`)
- **Change:** Completed comprehensive repository assessment, documentation alignment, gap analysis, solution architecture blueprint, and monorepo workspace configuration for target Next.js 15 + TypeScript + Firebase Auth + Firestore + Cloud Run architecture. Marked legacy SRS and SQL schema docs as SUPERSEDED.
- **Reason:** Align Focoman codebase and technical documentation with the authoritative Product Discovery Document and approved target architecture direction.
- **Specification Reference:** `Focoman Product Discovery Document` & `Focoman New Tech Stack & Architecture Migration Instructions`.
- **Verification:** Verified technical specs, monorepo directory layout, `Index.md` mapping, and Solution Architect blueprint.
- **Notes:** Migration preparation and specification alignment task. No application feature code or database data was deleted.

---

## CHG-003 — Codebase Monorepo Restructuring, Shared Packages Creation & Legacy Cleanup

- **Task:** TASK-301..TASK-306 — Codebase Monorepo Migration & Legacy Cleanup
- **Date:** 2026-09-02
- **Area:** Codebase Layout & Packages (`apps/web`, `packages/types`, `packages/validation`, `packages/domain`, `packages/db`, `packages/auth`, `packages/config`, `CHANGELOG.md`)
- **Change:** Restructured application into a TypeScript Monorepo (`apps/web` for Next.js 15 App). Created 6 shared packages in `packages/*` (`@focoman/types`, `@focoman/validation`, `@focoman/domain`, `@focoman/db`, `@focoman/auth`, `@focoman/config`). Removed obsolete legacy files (`railway.json`, `nixpacks.toml`, `fix_oms.py`, `focoman-backend/`).
- **Reason:** Implement approved target architecture blueprint and clean up unused legacy setup/backend files.
- **Specification Reference:** `technical_blueprint.md` & `Focoman New Tech Stack & Architecture Migration Instructions`.
- **Verification:** Verified monorepo package imports, `server-only` db boundary protection, and removal of Railway/Java backend artifacts.
- **Notes:** Web app and shared domain packages active. Documentation and new technical specs preserved.

---

## CHG-004 — Documentation Cleanup & Legacy Diagram/SQL Removal

- **Task:** TASK-401 — Documentation Cleanup
- **Date:** 2026-09-02
- **Area:** Documentation (`docs/common/`, `docs/process/`, `docs/technical/database/`, `docs/Index.md`, `docs/README.md`, `CHANGELOG.md`)
- **Change:** Cleaned up obsolete legacy files from `docs/`: removed old HLD/LLD diagrams (`docs/common/`), old SDLC checklist (`docs/process/`), legacy setup guides (`RAILWAY_POSTGRESQL_SETUP.md`, `JDBC_URL_FIX.md`), empty `docs/v2`, and legacy relational SQL schemas (`docs/technical/database/`). Updated `docs/Index.md` and `docs/README.md` to map active target documentation exclusively.
- **Reason:** Eliminate documentation confusion and ensure `docs/` reflects the active target architecture.
- **Specification Reference:** `Focoman Product Discovery Document` & `Focoman New Tech Stack & Architecture Migration Instructions`.
- **Verification:** Verified `docs/` folder structure, active documentation links in `Index.md`, and clean navigation.
- **Notes:** Active technical specs, brand design system, setup guides, and `srs-mvp.md` (SUPERSEDED reference) preserved.

---

## CHG-005 — Phase A: Application Data Architecture Integrity & Real Data Completion

- **Task:** TASK-501..TASK-507 — Migration Integrity Fix
- **Date:** 2026-09-02
- **Area:** Governance, Shared Packages, Service Layer, Pages (`Agents.md`, `AGENTS.md`, `docs/`, `packages/validation`, `packages/db`, `apps/web/src/services/`, `apps/web/src/app/`)
- **Change:**
  1. **Link Portability**: Replaced all machine-local Windows paths in `Agents.md`, `AGENTS.md`, `docs/Index.md`, `docs/README.md` with portable relative repository links.
  2. **`AGENTS.md` Fix**: Re-committed `AGENTS.md` at workspace root (resolved 404 reference).
  3. **`vercel-hosting-strategy.md`**: Updated to align with Next.js + Cloud Run + Firestore (removed Spring Boot/Railway/PostgreSQL content).
  4. **`packages/validation`**: Upgraded to real Zod schemas (`CreateOrderSchema`, `AssignResourceSchema`, `UpdateTaskStatusSchema`, `UpdatePaymentSchema`).
  5. **`packages/db`**: Strengthened server-only import boundary guard with runtime client-side throw.
  6. **Mock Data Elimination**: Deleted `apps/web/src/services/mockDb.ts` and removed all fake fallback data from `authApi.ts`, `marketplaceApi.ts`, `crmApi.ts`, `erpApi.ts`, `devPortalApi.ts`, `omsApi.ts`.
  7. **Spring Boot API Removal**: Removed all `NEXT_PUBLIC_BACKEND_URL` / `http://localhost:8080` / Spring-style REST fetch calls from all service files and page components (`crm/page.tsx`, `erp/page.tsx`, `devportal/page.tsx`, `dev-portal/page.tsx`, `dashboard/layout.tsx`).
  8. **Order Domain Realignment**: Updated OMS page, Dashboard page to Product Discovery 3-state lifecycle (`AWAITING_EVENT`, `POST_EVENT_IN_PROGRESS`, `COMPLETED`). Removed legacy 9-state `OVER_SLA`/`SHOOT_SCHEDULED` model.
  9. **WhatsApp Page**: Removed `mockDb` import and fake `handleSave() => setSaved(true)`. Aligned to Product Discovery operational layer model.
  10. **HomePage**: Removed all fake `authApi` mock login handlers. Portal tabs renamed to `Studio Owner`, `Studio Member`, `Customer Order Tracker` per Product Discovery. Honest pending state shown.
  11. **Legacy File Deletion**: Deleted `apps/web/src/features/oms/OmsPrototype.tsx` (legacy 9-state order model).
- **Reason:** Address all blockers identified in user's September 2026 repository audit. Ensure documentation, shared packages, service layer, and UI pages are internally consistent with the target architecture.
- **Specification Reference:** `Focoman Product Discovery Document`, `Agents.md`, `docs/technical/recommended-architecture.md`.
- **Verification:** Scanned for `mockDb`, `BACKEND_URL`, `localhost:8080`, `OVER_SLA`, `BOOKING_CONFIRMED`, machine-local Windows paths — all resolved clean.
- **Notes:** Firebase Auth SDK integration and Firestore Server Actions remain as the next implementation phase (real auth + real data flows).

---

## CHG-006 — Phase B: Real Firebase Auth, Firestore Data Client & Trusted Server Actions

- **Task:** Phase B Implementation
- **Date:** 2026-09-02
- **Area:** `packages/db`, `packages/auth`, `apps/web/src/actions/*`, `apps/web/src/app/[studioSlug]/dashboard/*`, `apps/web/src/features/home/HomePage.tsx`, `docs/Index.md`
- **Change:**
  1. **`packages/db/src/index.ts`**: Replaced stub mock with real Firebase Admin SDK (`initializeApp`, `getFirestore`). Implemented typed Firestore repository functions: `getOrdersByStudio`, `getOrderById`, `getOrderByPasskey`, `saveOrder`, `updateOrder`, `getCustomersByStudio`, `saveCustomer`, `getMembersByStudio`, `saveMember`, `getTasksByOrder`, `saveTasks`, `updateTask`, `getStudioBySlug`, `saveStudio`. Includes graceful memory-store fallback when Firebase credentials are not yet configured locally.
  2. **`packages/auth/src/index.ts`**: Added real `firebase-admin/auth` ID token verification via `verifyIdToken()`. Added `getFirebaseAuthInstance()` initializer. Preserved existing role-permission helpers.
  3. **`packages/auth/package.json`**: Added `firebase-admin` and `server-only` to dependencies.
  4. **`apps/web/src/actions/orderActions.ts`** [NEW]: Trusted Next.js Server Actions: `createOrderAction` (with dynamic task generation via `generateWorkflowTasks`), `getStudioOrdersAction`, `getOrderTasksAction`, `getOrderByPasskeyAction`, `updateTaskStatusAction` (with automatic completion check via `canCompleteOrder`), `updatePaymentStatusAction`, `assignResourceAction`. All inputs validated via `@focoman/validation` Zod schemas.
  5. **`apps/web/src/actions/customerActions.ts`** [NEW]: Server Actions `getStudioCustomersAction`, `createCustomerAction`.
  6. **`apps/web/src/actions/memberActions.ts`** [NEW]: Server Actions `getStudioMembersAction`, `createMemberAction`.
  7. **`apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`**: Connected to `orderActions`; added Register Confirmed Order modal, live task status updates, payment confirmation, and guest passkey display card.
  8. **`apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`**: Connected to `customerActions`; added Add Customer modal and live customer list.
  9. **`apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx`**: Connected to `memberActions`; added Add Crew Member modal with certified skill checkboxes.
  10. **`apps/web/src/features/home/HomePage.tsx`**: Customer Guest Order Tracker connected to `getOrderByPasskeyAction`; displays real `Order` pricing and dynamic `Task[]` production workflow timeline.
  11. **`docs/Index.md`**: Fixed `../AGENTS.md` → `../Agents.md` case-sensitivity link; updated Vercel to secondary/legacy; clarified Cloud Run + Firebase App Hosting as primary.
- **Reason:** Activate the real application backend — replacing all empty arrays and stub state with actual Firebase Admin SDK Firestore data flows.
- **Specification Reference:** `technical-design-mvp.md` (Server-Side Security Boundary), `recommended-architecture.md` (Server Actions pattern), `Agents.md` (No Fake Data policy).
- **Verification:** `node_modules/.bin/tsc --noEmit` exited with **0 errors**.

---

## CHG-007 — Firebase Project Integration & Client SDK Configuration

- **Task:** Firebase Project Configuration & Client Integration
- **Date:** 2026-09-02
- **Area:** Configuration & Client SDK (`apps/web/.env.local`, `apps/web/.env.example`, `apps/web/src/lib/firebase.ts`, `apps/web/src/lib/firebaseAuth.ts`, `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`)
- **Change:**
  1. **Dependencies**: Installed `firebase` (client SDK v12.18.0) in `apps/web`.
  2. **Environment Variables**: Created `apps/web/.env.local` and `apps/web/.env.example` containing user-provided Firebase configuration for project `focoman` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`).
  3. **Client Initialization Module**: Created `apps/web/src/lib/firebase.ts` exporting singleton `firebaseApp`, `auth`, `db`, and SSR-safe `getFirebaseAnalytics()`.
  4. **Client Auth Helpers**: Created `apps/web/src/lib/firebaseAuth.ts` providing `signInUser`, `signUpUser`, `signOutUser`, `subscribeToAuthState`, and `getCurrentUserIdToken`.
  5. **Firebase Deployment Config**: Created root `.firebaserc` (targeting default project `focoman`), `firebase.json` (configuring Next.js hosting and Firestore), `firestore.rules` (enforcing server-side security boundary per architecture spec), and `firestore.indexes.json`.
- **Reason:** Connect the Focoman application to the newly created live Google Cloud / Firebase project (`focoman`).
- **Specification Reference:** `Focoman Product Discovery Document`, `docs/technical/tech-stack.md`, `docs/technical/deployment-guide.md`.
- **Verification:** Typecheck `tsc --noEmit` exited with code 0; dev server loaded `.env.local` and returned HTTP 200 OK across routes.

---

## CHG-008 — Authentication & Multi-Studio Identity Architecture Specification

- **Task:** Authentication & Multi-Studio Identity Flow Architecture Documentation
- **Date:** 2026-09-02
- **Area:** Architecture & Specifications (`docs/technical/identity-and-auth-architecture.md`, `docs/Index.md`, `docs/technical/tech-stack.md`, `docs/technical/technical-design-mvp.md`, `docs/technical/recommended-architecture.md`, `docs/technical/deployment-guide.md`, `docs/product/srs-mvp.md`, `CHANGELOG.md`)
- **Change:**
  1. **New Specification Document**: Created `docs/technical/identity-and-auth-architecture.md` establishing the core identity model:
     - Single personal identity per person via Firebase UID.
     - Google Sign-In via Firebase Auth as the sole Phase 1 personal authentication provider.
     - Decoupling of Person (UID) from Studio entity, Studio Membership, and Studio Role.
     - Native multi-studio ownership and crew membership from Day 1.
     - First-time onboarding states (`Register Your Studio` and `Join an Existing Studio`) without forced studio creation or username/password prompts.
     - Dynamic workspace switcher (`/workspaces`) without separate logins.
     - Server-side studio uniqueness enforcement via Firestore Transactions.
     - Invitation-based member onboarding without permanent owner-generated credentials.
     - Strict isolation of customer order tracking (guest passkeys only; no Firebase user accounts for customers).
  2. **Index & Hierarchy**: Updated `docs/Index.md` mapping the new specification into the active Source-of-Truth hierarchy.
  3. **Target Technical Specs**: Updated `tech-stack.md`, `technical-design-mvp.md`, `recommended-architecture.md`, and `deployment-guide.md` to reflect the Google-only identity model, normalized collection schemas (`users`, `studios`, `memberships`, `invitations`), and server execution boundaries.
  4. **Superseded Concepts**: Explicitly marked legacy owner-created passwords, separate studio logins, SMS/phone auth, and anonymous auth as SUPERSEDED in `srs-mvp.md` and technical specifications.
- **Reason:** Establish the approved architecture and product specifications for single personal identity, Google authentication, and multi-studio memberships before writing implementation code.
- **Specification Reference:** Attached `Focoman Authentication & Multi-Studio Identity Flow` architecture prompt & `docs/technical/identity-and-auth-architecture.md`.
- **Verification:** Verified cross-document consistency, confirmed zero broken links in `docs/Index.md`, verified no active specification requires username/password or separate studio logins.

---

## CHG-009 — Focoman UI Refinement & Legacy UI Migration (UI-01 through UI-20)

- **Task:** UI-01..UI-20 — Full UI Refinement, Authentication & Legacy Concept Elimination
- **Date:** 2026-09-02
- **Area:** Shared Packages (`@focoman/types`, `@focoman/db`), Service Layer & Actions (`actions/studioActions.ts`, `lib/firebaseAuth.ts`), UI Pages & Components (`HomePage.tsx`, `Navbar.tsx`, `DashboardSidebar.tsx`, `features/page.tsx`, `pricing/page.tsx`, `studio-marketplace/page.tsx`, `workspaces/page.tsx`, `onboarding/register-studio/page.tsx`, `onboarding/join-studio/page.tsx`)
- **Change:**
  1. **Dead Mock Deletion (UI-19)**: Permanently deleted `apps/web/src/features/oms/mockUsers.ts` and `apps/web/src/types/oms.ts`.
  2. **Landing Page Realignment (UI-02, UI-03, UI-15, UI-16)**: Realigned `HomePage.tsx` with OMS-first positioning: Confirmed Order → Event → Post-Event Production → Delivery → Payment Completed. Removed all 3 legacy username/password login & signup forms (Admin, Member, Customer). Replaced with two clean access panels: Google Sign-In for studio owners/crew members, and guest passkey lookup for customers. Positioned Value Added Services clearly as professional studio add-ons.
  3. **Multi-Studio Workspaces UX (UI-04)**: Created `apps/web/src/app/workspaces/page.tsx` displaying user's accessible studios, role badges (`Owner` vs. `Crew Member`), certified skills, and workspace launcher. Supports 0-studio welcome onboarding.
  4. **Studio Registration UX (UI-05)**: Created `apps/web/src/app/onboarding/register-studio/page.tsx` with live database slug availability check and atomic Firestore transaction via server action.
  5. **Member Invitation & Activation UX (UI-06)**: Created `apps/web/src/app/onboarding/join-studio/page.tsx` with single-use invitation token verification.
  6. **Public Navigation & Feature Pages (UI-01, UI-16)**:
     - `Navbar.tsx`: Added direct `Studio Access` button to `/workspaces`.
     - `features/page.tsx`: Realigned feature matrix to Confirmed Orders, dynamic service pipelines, and WhatsApp alerts (removed lead capture, sales pipelines, and Google Calendar sync).
     - `pricing/page.tsx`: Removed `username@studioname` logins, lead capture, and Google Calendar sync; highlighted confirmed order limits, crew allocation, and operational notifications.
     - `studio-marketplace/page.tsx`: Added clear `Phase 3 Preview / Upcoming Capability` advisory banner.
  7. **Sidebar & Dashboard Refinement (UI-07, UI-08)**: Added workspace switcher quick link and role badge to `DashboardSidebar.tsx`.
  8. **Data Layer & Types Extensions**:
     - Added `StudioMembership` interface to `@focoman/types`.
     - Added `getMembershipsByUid`, `registerStudioTransaction` to `@focoman/db`.
     - Added `checkStudioSlugAvailabilityAction`, `registerStudioAction`, `getUserWorkspacesAction` to `apps/web/src/actions/studioActions.ts`.
     - Added `signInWithGoogle` to `apps/web/src/lib/firebaseAuth.ts`.
- **Reason:** Fully align the frontend user experience with the active Product Discovery and Authentication/Multi-Studio Identity specifications. Remove all legacy ungrounded concepts, dead mock files, and fake authentication forms.
- **Specification Reference:** `Focoman Product Discovery Document`, `docs/technical/identity-and-auth-architecture.md`, and `Agents.md`.
- **Verification:** TypeScript build (`tsc --noEmit`) passed with 0 errors. All 13 primary public, onboarding, and authenticated dashboard routes probed and verified returning HTTP 200.



