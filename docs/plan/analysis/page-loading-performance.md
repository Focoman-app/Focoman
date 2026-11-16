# Page loading performance

Approved by the user on 2026-11-16 after the seven-step implementation plan. Git pull completed first, fast-forwarding main to 1890289. No deployment or browser automation is included.

## Technical blueprint

Keep Firebase authentication, studio authorization, plan enforcement, uniqueness, and complete financial totals intact. Optimize the work performed after authorization rather than bypassing checks. Reuse reads only within a request; never share authorization results between users or cache a mutation's authorization across requests.

The current call chains are public page -> global session initialization; sign-in -> recovery/consent -> session -> dashboard redirect -> membership/default -> studio layout; studio registration -> transactional creation -> preference -> session -> services; OMS/CRM/ERP -> multiple client Server Actions -> authorization -> unbounded collection reads. Mutations then repeat whole-module loaders. Dashboard reads orders before checking its plan.

### Module and integration boundaries

1. Entry task owns authentication/session/navigation, public homepage rendering, request-scoped access reuse, and shared timing utilities. Preserve legal-consent and recovery routing. Consolidate redundant forced synchronization and preference writes. Timing logs must contain operation names, duration and counts only, never tokens or customer details. Production timings are not available in this session; instrumentation and a user validation procedure must distinguish measured evidence from expectations.
2. Workspace data task owns database querying, server loaders/actions, dashboard/OMS/CRM/ERP lists and related components. Evaluate entitlements before data reads. Bundle related reads inside server execution where necessary instead of assuming client Promise.all parallelizes Server Actions. Fetch tab/form data on demand; mutation responses update confirmed rows and selectively invalidate dependent summaries.
3. Independent review verifies entry -> server loader -> database -> table and save -> response -> row/summary update paths, authorization, pagination, exports/search, errors, and existing feature compatibility.

### Data contracts

Use bounded cursor pages, stable ordering with an ID tie-breaker, validated page sizes, and studio-scoped cursors. Initial list target is 10-20 rows; next batches load near the end of the real scrolling container, with an explicit Load more control. Reset pages/cursors on filter, search or studio changes; prevent stale responses and duplicate concurrent requests. Search, export and summary semantics must cover all matching records, not only the visible page. Do not silently omit legacy records lacking deletion/date/normalization fields; if indexes/backfill are required, supply an explicit migration and rollout path. No production migration runs during this task.

Dashboard aggregate data is independent from table pages and remains complete for selected periods. Prefer lightweight server-side summaries/projections; do not send entire historical order payloads merely to calculate chart totals. Existing crew conflict/availability logic must remain correct across all relevant dates.

### UI states

```text
Page shell + navigation
  Summary section: loading | complete totals | explicit error + retry
  Filters
  Table: initial skeleton | rows | empty | error + retry
  Existing rows remain visible while fetching more
  Load more / loading next batch / end of results
  Forms fetch their options when opened; save updates confirmed data
```

Public rendering optimizations should preserve visible content and interactions. Do not introduce speculative hosting changes without measurements.

## Verification

Typecheck and production build; existing domain/security tests; focused contract tests for pagination/filter reset, legacy compatibility and stale-request handling where feasible without fabricated database responses. No automated browser tests. Document Firestore/index prerequisites, unavailable live measurements, and a manual before/after procedure for the user. No speed percentage is claimed without real measurements.
