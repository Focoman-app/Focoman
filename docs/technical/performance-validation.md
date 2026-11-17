# Loading performance validation

The loading work adds opt-in duration instrumentation. No production baseline or speed improvement has been measured by the agent. Browser validation is performed by the user.

## Enable measurements

Set `NEXT_PUBLIC_PERFORMANCE_LOGS=true` before building to enable client timings. Set `PERFORMANCE_LOGS=true` on the server for server-only timings. Leave both unset for normal operation. The helper in `apps/web/src/lib/performance.ts` logs only fixed operation names, elapsed milliseconds and whether the promise completed without throwing. A resolved business-error response must still be interpreted by the caller; `succeeded` is not a database-commit assertion. No tokens, IDs, URLs, contacts or payloads are logged by this helper.

Entry labels are `auth.session.sync`, `auth.recovery.check`, `workspace.resolve`, `studio.register`, and `dashboard.access`. Workspace instrumentation uses the same helper for its loaders and mutations. Client and server durations are different spans and must not be added as if independent.

## Before/after comparison

Use the same production-mode build settings, browser, connection, account, studio and actual data volume. Development compilation time is not a production loading measurement. Record baseline using the preceding deployed version and compare the updated version after the user deploys it. Do not invent or seed customer records for a benchmark.

For each flow, record five warm runs and a separate cold first visit after inactivity. Record median and slowest observed time, number of requests, transferred bytes, time until useful content, and time until the requested save is confirmed. Keep cold and warm results separate; server startup and network latency can dominate the first visit.

| Flow | What to inspect manually |
|---|---|
| Public home | Initial HTML/JS size, first visible content, hero animation/scroll responsiveness, reduced-motion setting |
| Google sign-in | Recovery and consent retained; session POST completes before protected navigation; no forced token refresh solely to recreate a cookie |
| Dashboard entry | Session sync and token-authenticated workspace discovery overlap; default selection remains explicit; failed loads show retry |
| Studio registration | Name uniqueness still enforced server-side; default preference is persisted on choice; registration timing excludes subsequent navigation |
| Dashboard / OMS / CRM / ERP | Initial request count and rows; hidden tabs do not block visible content; complete summary totals |
| Order/customer save | Separate mutation duration from subsequent list/summary work; confirmed record appears without a whole-module reload |

Never share raw HAR files containing tokens, cookies or customer data. Report aggregate timings/counts instead.

## Security and error checks

Check first-time consent, existing users, recoverable accounts, sign-out, account switching, expired/revoked sessions, missing studio membership, and direct protected links. Cookie repair uses the SDK's valid ID token, while explicit `getCurrentUserIdToken(true)` still requests refreshed claims for callers that need it. Dashboard membership reuse is React request-scoped and does not cache mutation authorization or skip revocation checking.

Confirm failed session synchronization remains on an explicit error/retry flow. Confirm public hero replay and scroll behavior, especially returning to the top, without repeated autoplay restarts.

## Hosting boundary

Repository Firebase hosting points at the framework app; architecture documents mention Cloud Run but do not prove current deployed region, minimum instances, or database location. No hosting settings were changed. Only inspect/change those settings after cold/warm measurements establish a hosting bottleneck.
