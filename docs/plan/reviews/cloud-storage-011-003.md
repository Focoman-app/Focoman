# Review: cloud-storage-011-003

## Scope and method

Final static re-review of task 011 after `cloud-storage-011-002.md`. Reviewed current session admission, multipart initialization leases, R2 list/recovery, cleanup and state guards. No source edits, browser, live R2/Firestore, production or RAW operation was performed.

## Prior findings

| Prior finding | Result |
| --- | --- |
| Preview reservation leak | Resolved. The no-worker completion path releases primary and preview reservation together. |
| Firestore admission/idempotency race | Resolved. The transaction creates reservations, sessions and deterministic idempotency records together. |
| Concurrent multipart attachment race | Resolved in normal concurrency. Initialization uses a session lease; retries recover a single provider upload by immutable key and refuse multiple uploads. |
| Failed reused batch demotes committed session | Resolved. Only sessions newly admitted by the failing request are considered for admission cleanup. Cleanup transactions reject non-RESERVED sessions. |
| Exact deletion retry selection | Resolved. The pending job must match the exact requested photo-ID set. |

## Findings

### P1 — blocking — Unknown multipart-initiation outcomes can release the owned reservation too early

The route records a created upload only after `createMultipartUpload` returns. A timeout or transport error may occur after R2 created the multipart upload but before the SDK returns its ID. In that case `created` has no record, the catch sees an empty successful abort set, and `cleanFailedCloudUploadAdmission` releases the reservation and deletes the idempotency records. The untracked R2 multipart upload can still accept/recover parts and consume storage outside Focoman's quota ledger. The new `ListMultipartUploads` recovery is useful only while the durable session/idempotency record remains; this catch removes both before a retry can discover it.

- Contract: launch-refinement blueprint, “Small-file and multipart protocol” requires reservations to persist through unknown provider state and confirmed cleanup.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:60-75`, `packages/db/src/cloudStorage.ts:130-158`.
- Required correction: mark the relevant admitted sessions cleanup-pending for any uncertain R2 initiation/list failure. Release only after a maintenance/retry path has listed/aborted all matching provider uploads and verified cleanup. Do not treat absence of a returned upload ID as evidence that no provider operation occurred.

### P2 — blocking — Required lifecycle integration remains unverified

`npm test` covers 62 tests, including new pure state/accounting helpers. It does not execute Firestore transactions, direct signed multipart transfers, R2 list recovery, leases, cancellation/deletion accounting or authorization. No isolated R2/Firestore environment is configured, so the launch-required provider/transaction evidence is unavailable. This must stay recorded as unverified rather than passed.

### P3 — non-blocking — Error contracts remain generic

Storage routes still return raw error text under generic 500 statuses for several expected conflict, expiry and authorization paths. The blueprint calls for stable client-safe status/code mapping.

## Verification evidence

I ran `npm test`: 62 passed, 0 failed. It emitted existing module-type warnings. Developer-reported TypeScript and lint checks passed; I did not rerun them. No live R2/Firestore, browser UAT, RAW compatibility, build or production verification was performed.

## Conclusion

**Blocked.** The previous concurrency and cleanup-state findings are fixed, but unknown provider initiation still permits quota release before confirmed cleanup. Resolve that P1 condition and re-review; then task 011 may be code-complete but still requires separately recorded real R2/Firestore verification.
