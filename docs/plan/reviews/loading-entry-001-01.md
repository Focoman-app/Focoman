# Entry loading independent review

Reviewed implementation commit `949ee15` on worktree revision `55b34e1`, which incorporates pulled upstream `9468b8e` and main `892271f`.

## Findings

No blocking source findings in the changed entry-flow paths.

- **P3, non-blocking: validation limits.** `docs/plan/analysis/page-loading-performance.md` requires production build/typecheck and manual real-data timing. This review independently ran `node --experimental-strip-types --test tests/performance-timing.test.ts tests/dev-portal-auth.test.ts` (4 passed) and `git diff --check main...HEAD` (passed). These tests do not exercise live Firebase authentication, cookie concurrency, or browser animation. Root dependency repair/full integrated build and user browser checks remain delivery gates; no latency improvement is measured here.
- **P3, non-blocking: scope of homepage optimization.** `RetroHeroVisual.tsx` now batches scroll work with requestAnimationFrame and removes playback state from effect dependencies, preventing repeated effect teardown/autoplay restart. It does not reduce the Firebase or Framer Motion initial bundle. This is correctly a rendering optimization, not evidence that all homepage loading latency is resolved.

## Contract checks

- `dashboardAccess.ts` uses React request-scoped cache for membership verification only; role evaluation remains per caller. Mutation authorization and revoked-session verification (`verifySessionCookie(cookie, true)`) remain unchanged.
- `firebaseAuth.ts` retains legal-consent deferral, captures the current user before token retrieval, serializes differing identities' cookie writes, and makes sign-out wait for pending synchronization before DELETE. Forced cookie repair no longer forces an otherwise valid Firebase token refresh.
- `sign-in/page.tsx` stops navigation on recovery-check/session failure. Hard navigation after authentication is preserved to avoid using stale anonymous prefetched route state.
- `dashboard/page.tsx` overlaps token-authenticated workspace discovery and cookie synchronization, waits for both, rejects stale async navigation, and surfaces retry on failure.
- `workspaceDefaults.ts` removes repeated preference writes while retaining membership validation of the local routing hint; explicit set/clear paths remain responsible for persistence.
- Timing helper logs fixed operation labels/durations only and preserves results/rejections. Its `succeeded` field means promise completion, as documented, not business success.

## Conclusion

**pass** for source review of the entry task. Final integrated compilation, tests, and user-run browser validation remain required and must be reported truthfully.
