# Workspace foundation review

Interim review of foundation commit `995b73a`; this is not a review of completed UI integration. Reviewed after upstream `9468b8e` was incorporated into the worktree.

## Findings

1. **P2, blocking: current order status overwritten by older metadata.** In `packages/db/src/workspacePaging.ts`, `readOrderListPage` first reads metadata, then hydrates full documents, but assigns `orderStatus: page[index].orderStatus`. A concurrent Completed/Cancelled change can therefore be replaced with the earlier snapshot's status. Blueprint `docs/plan/analysis/page-loading-performance.md` requires authoritative data and preserved workflow semantics. Compute the effective status from the hydrated record, as the ID-batch continuation does, and handle changed filter membership explicitly.
2. **P3, non-blocking: repeated scanned documents.** `readStudioPage` fetches 100 documents even when the page size is 20, consumes only through the twentieth match, then returns that consumed ID as cursor. Following pages read the already-downloaded remainder again. This is bounded and legacy-compatible but wastes reads. Prefer bounded scanning sized to remaining page capacity or document the tradeoff.
3. **P2, delivery pending: integration not yet present in foundation.** `getOmsPageAction`, ID hydration, customer/member cursor action and LoadMoreRows are not sufficient alone. Completed UI paths must demonstrate global search/export/totals, stale-response rejection, detail deep links, mutation invalidation, and next-page metadata reuse. This is tracked work, not a source defect in the helper itself.

## Checks

- Independently ran `node --experimental-strip-types --test tests/list-paging.test.ts`: 2 passed. These cover filter/page-size validation, not live Firestore cursors.
- `git diff --check main...HEAD` passed at review time.
- Both order-page actions authorize the owner before database access; selected-ID hydration enforces studio ownership, maximum 50 IDs, and excludes deleted documents.
- ID-ordered generic scans preserve records missing `createdAt` or `isDeleted`. Empty pages may legitimately return a continuation cursor; callers must not interpret these as end-of-list.
- OMS projected metadata remains O(n) per initial/filter request by the approved refinement. Continuation must use ID hydration, not repeat `readOrderListPage`.

## Conclusion

**blocked** pending finding 1 and completed integration review. No browser or production database validation was performed.
