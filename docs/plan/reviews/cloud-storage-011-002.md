# Review: cloud-storage-011-002

## Scope and method

Re-review of task 011 after the findings in `cloud-storage-011-001.md`. Static source review only; no browser, Firestore, R2, production, RAW or migration operation was run.

## Prior findings

| Prior finding | Result |
| --- | --- |
| Preview reservation leak | Resolved for the current no-worker path. Commit releases both primary and preview reservation unless a durable preview job is explicitly supplied. |
| Non-atomic Firestore idempotency admission | Improved: reservation, session and idempotency records are now created in one transaction. A remaining provider-attachment race is blocking below. |
| No focused policy tests | Improved with state-transition, preview-release and exact deletion-selection tests. The Firestore/R2 persistence contract remains untested. |
| Deletion retry broader than selection | Resolved: existing pending jobs now require the exact same photo-ID set. |

## Findings

### P1 — blocking — Concurrent reuse can create untracked multipart uploads for one session

The session/idempotency transaction now correctly serializes Firestore admission, but it deliberately commits sessions without an R2 upload ID. Two same-manifest requests can both receive the reused `RESERVED` session with no `multipartUploadId`, each create a distinct multipart upload for the same object key, then race to overwrite `multipartUploadId`. Only the last ID is retained. Cancellation and maintenance cannot abort the orphaned upload, and its parts are not represented by the reservation/session cleanup protocol. A process crash between R2 creation and the Firestore update has the same loss of provider identity.

- Contract: launch-refinement blueprint, “Small-file and multipart protocol” requires a recoverable session-owned provider operation and cleanup of abandoned uploads.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:51-61`, `packages/db/src/cloudStorage.ts:76-125`.

### P1 — blocking — A failed retry can demote an already committed session to cleanup pending

`admittedSessionIds` is set for reused as well as new sessions. If a reused batch contains a committed session and another session that fails the ready-state/expiry check, the catch path attempts cleanup for the full reused batch. `cleanFailedCloudUploadAdmission` rejects committed records, then `markCloudUploadAdmissionCleanupPending` blindly writes `CLEANUP_PENDING` to every session ID, including the committed file. This corrupts the state machine and can make a committed upload unavailable to completion/recovery paths.

- Contract: launch-refinement blueprint, “Small-file and multipart protocol” and task 011 legal-state transitions.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:48-73`, `packages/db/src/cloudStorage.ts:130-164`.

### P2 — blocking — Persistence and provider lifecycle contracts remain unverified

The added 62-test suite exercises pure domain helpers only. It does not execute the admission transaction, provider-ID attachment, completion lease, cancellation, cleanup, deletion ledger update or authorization path. Task 011 explicitly requires these contract cases; the review cannot infer them from TypeScript compilation. No isolated Firestore/R2 environment is configured, so this is an unverified delivery gate rather than a passed integration check.

- Contract: task 011 “Verification”; launch-refinement blueprint “Verification gates”.
- Evidence: `npm test` passed 62/62 locally, but `tests/cloud-storage-policy.test.ts` imports domain helpers and no route/DB/R2 integration test exists.

### P3 — non-blocking — Error classification remains incomplete

The routes still surface raw exception messages under generic 500 responses for expected conflicts, access failures and provider availability. The blueprint specifies stable client-safe codes/statuses. Address while resolving the blocking lifecycle behavior.

## Verification evidence

I ran `npm test`: 62 passed, 0 failed. It emitted existing module-type warnings. Developer-reported TypeScript and lint checks passed; I did not rerun them. Live integration and browser UAT were not run.

## Conclusion

**Blocked.** The first review’s preview-capacity and selection-retry defects are resolved, and Firestore admission is materially stronger. The remaining R2 provider-ID race and cleanup of reused/committed sessions can still corrupt storage lifecycle state, so task 011 requires another fix and re-review.
