# Review: cloud-storage-011-001

## Scope and method

Static independent review of task 011 against `Agents.md`, `docs/Index.md`, the 2026-11-20 launch-refinement section of `docs/technical/cloud-storage-proofing.md`, and `docs/plan/analysis/cloud-storage-photo-selection-launch.md`. Reviewed the existing dirty working tree without browser, Firestore or R2 operations.

## Improvements observed

- The presign route now assigns rollback ownership only after a reservation transaction succeeds, avoiding the previous unconditional release of another request's capacity.
- Platform capacity is now required instead of silently defaulting to 500 GiB.
- Completion has a Firestore verification lease and checks R2 HEAD before trying to consume a multipart upload again.
- R2 head and delete helpers no longer treat an unconfigured provider as a successful absent/delete result.
- Cancellation is state-guarded, and disabling Photo Selection cancels only preview jobs.

## Findings

### P1 — blocking — Reserved preview capacity is never released or converted

Admission reserves primary plus `CLOUD_PREVIEW_BYTES` for every ORIGINAL when Photo Selection is enabled. Each session keeps the split in `reservedBytes` and `previewReservedBytes`, but `commitCloudUploadSession` converts/releases only `reservedBytes`; it neither stores the preview reservation in a durable job/photo nor subtracts it when preview processing is unavailable. Since task 011 has no preview commit/release path, every such successful upload permanently inflates studio and platform `reservedBytes`, eventually blocking valid uploads.

- Contract: launch-refinement blueprint, “Representation and preview policy” and “Small-file and multipart protocol”.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:55-68`, `packages/db/src/cloudStorage.ts:580-660`, `apps/web/src/app/api/storage/complete-upload/route.ts:43-45`.

### P1 — blocking — Admission idempotency still races and reservation/session creation is not atomic

The idempotency query occurs before the reservation transaction and session creation. Two identical requests can both find no session, both reserve capacity, create separate R2 multipart uploads and then store sessions with the same actor/order/idempotency key. The retry lookup then fails with reconciliation, while both reservations remain owned by separate sessions. A process failure after reservation and before `createCloudUploadSessions` also leaves capacity without a durable session for task 014 to discover.

- Contract: launch-refinement blueprint, “Small-file and multipart protocol” requires an atomic reservation/session identity and duplicate retry return.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:32-73`, `packages/db/src/cloudStorage.ts:24-80`, `:91-105`, `:122-141`.

### P2 — blocking — No focused automated tests cover the task’s new persistence contracts

Task 011 requires tests for rollback ownership, idempotent admission, legal transitions, completion replay, cancellation/deletion retention and exact accounting. The changed `tests/backend-crud.test.ts` assertion is unrelated; `cloud-storage-policy.test.ts` continues to test pure policy helpers only. The reported test/type/lint passes therefore do not exercise the new Firestore/R2 lifecycle paths or even a repository-backed fake that validates transaction inputs and transitions.

- Contract: task 011 “Verification”; docs-sprint contract discipline test rules.
- Code/tests: `tests/backend-crud.test.ts`, `tests/cloud-storage-policy.test.ts`, `packages/db/src/cloudStorage.ts`.

### P2 — blocking — Deletion retry can finalize a broader pending job than the current selection

When the selected records are pending, `beginCloudPhotoDeletion` returns the existing job based on its ID but does not confirm that its `photoIds` equal the current selected set. The action then deletes/finalizes the whole prior job. A later retry selecting one photo can delete all photos from an earlier failed multi-photo request, and returns/audits the current selection count rather than the actually finalized count.

- Contract: launch-refinement blueprint, “Cleanup and authorization” requires retries to resume the same deletion job safely.
- Code: `packages/db/src/cloudStorage.ts:247-266`, `apps/web/src/actions/storageActions.ts:650-680`.

### P3 — non-blocking — Route error responses remain inconsistent

The new paths generally return raw `Error.message` under HTTP 500, including expected authorization, quota, state conflict and expiry outcomes. The blueprint calls for classified client-safe error codes/statuses. Consolidating this can be done while fixing the blocking lifecycle issues.

- Contract: launch-refinement blueprint, “Small-file and multipart protocol”.
- Code: all storage route catch blocks, especially `presign-upload/route.ts:76-79`, `complete-upload/route.ts:49-51`, and `cancel-upload/route.ts:24-25`.

## Verification evidence

Developer-reported checks: `npm test` 59/59 passed; TypeScript passed; lint passed with 11 pre-existing warnings. I did not rerun them because the task’s required provider and transaction contracts have no targeted coverage. No R2, Firestore, RAW, production or browser validation was run.

## Conclusion

**Blocked.** The changes resolve several important prior defects, but preview-reservation leakage and non-atomic idempotent admission can corrupt effective quota and prevent safe retry. Resolve the P1/P2 findings and re-review before treating task 011 as complete.
