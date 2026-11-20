# Review: cloud-storage-fix-002

## Scope and method

Second independent static review of the final working-tree changes, with special
attention to the tombstone/finalize delete path. Reviewed against `Agents.md`,
`docs/Index.md`, and `docs/technical/cloud-storage-proofing.md`. No browser,
Firestore, or R2 operation was performed.

## Improvements verified in this pass

- All four live multipart routes now call `authorizeCloudUploadSession`, which
  rechecks current membership, order tenancy, soft-delete state, and assignment.
- Completion now streams the completed object, computes its SHA-256, checks the
  expected hash, and validates raster magic bytes before committing metadata.
- Customer DTOs do not expose original keys or URLs; legacy/pre-schema optimized
  gallery entries are again allowed to use their primary proof image.
- `beginCloudPhotoDeletion` tombstones records before R2 deletion, and
  `finalizeCloudPhotoDeletion` atomically removes records and decrements studio,
  order, and platform used-byte/file counters after the deletion call returns.
- The alternate customer-task review path no longer falls back from an identity
  token to broad passkey access for locked orders.

## Findings

### P1 — blocking — Required preview and RAW processing runtime still does not exist

The implementation creates no worker/container and no code consumes preview or
cleanup jobs. On an ORIGINAL upload with proofing enabled, completion either
marks the image `FAILED` while the worker flag is false, or marks it `PENDING`
when the flag is true. It does not enqueue a preview job in either case and no
process can generate a derivative. RAW data is also only hash-checked; no
bounded RAW container/camera parser exists. The OFF/ON storage/proofing
combination therefore cannot provide customer proofing.

- Design: `docs/technical/cloud-storage-proofing.md`, “File policy” and
  “Preview jobs and runtime”.
- Code: `apps/web/src/app/api/storage/complete-upload/route.ts:33-35`,
  `packages/db/src/cloudStorage.ts:487-560`.
- Evidence: there is no `apps/storage-worker/` or other caller of
  `claimNextCloudStorageJob` / `completeCloudStorageJob`; task 006 itself says
  the decoder worker is absent.

### P1 — blocking — A publicly exported cancel action bypasses the live authorization and cleanup contract

`abortCloudUploadSessionAction` remains callable as a server action. For the
original uploader it performs no current membership or assigned-order check,
and it calls R2 abort before checking whether the session is already committed.
It then creates a cleanup job without a worker to execute it. This bypasses the
new route-level authorization and leaves reservations permanently retained.

- Design: `docs/technical/cloud-storage-proofing.md`, “State machine”,
  “Concrete HTTP contracts”, and “Authorization, management and audit”.
- Code: `apps/web/src/actions/storageActions.ts:776-816`; compare the correct
  recheck in `apps/web/src/lib/cloudUploadAuthorization.ts:10-25`.

### P1 — blocking — Deletion tombstones have no durable retry executor

The new transaction correctly protects accounting when R2 deletion succeeds,
but a failed `deleteR2Objects` call leaves a `PENDING` deletion-job document and
tombstoned photos. The UI creates a new random job ID for a retry; the selected
photos remain pending and `beginCloudPhotoDeletion` rejects them. No worker,
scheduled processor, or retry action consumes `cloud_storage_deletion_jobs`.
Thus a transient provider failure creates an unrecoverable user-visible delete
state rather than the required safe retry.

- Design: `docs/technical/cloud-storage-proofing.md`, “Authorization,
  management and audit” and “Preview jobs and runtime”.
- Code: `packages/db/src/cloudStorage.ts:152-175`,
  `apps/web/src/actions/storageActions.ts:657-662`; the only references to
  `cloud_storage_deletion_jobs` are creation/finalization.

### P2 — blocking — Multipart replay and physical part-size protections remain incomplete

Admission persists `idempotencyKey` but never queries or reuses it, while the UI
generates a fresh key on every retry. Part URLs are not signed with an exact
content length and there is no transaction lease/recovery around completion.
The final manifest and object hash protect committed metadata, but do not meet
the required replay, capacity, and interrupted-completion contracts.

- Design: `docs/technical/cloud-storage-proofing.md`, “Upload protocol” and
  “Integrity, races and capacity caveat”.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:15,43-48`,
  `apps/web/src/components/deliverables/CloudProofingGallerySection.tsx:253-256`,
  `apps/web/src/services/r2StorageService.ts:206-229`, and
  `apps/web/src/app/api/storage/complete-upload/route.ts:23-35`.

### P2 — blocking — Required management audit, upload retry/cancel UI, and test coverage are still absent

Original-download issuance only writes the order audit log, not the required
append-only cloud storage audit. The UI does one attempt per part, exposes no
cancel control, and does not cancel already-admitted sessions on a batch error.
The test suite has no route/Firestore/R2 contract tests for authorization,
tombstone recovery, concurrent quota, RAW, multipart interruption, or customer
permission behavior.

- Design: `docs/technical/cloud-storage-proofing.md`, “Concrete HTTP
  contracts”, “Authorization, management and audit”, and “Verification and baseline”.
- Code: `apps/web/src/actions/storageActions.ts:695-775`,
  `apps/web/src/components/deliverables/CloudProofingGallerySection.tsx:277-327`,
  `tests/cloud-storage-policy.test.ts`.

### P3 — non-blocking — Task checklists still claim a resolved independent verification

Tasks 005 and 006 retain checked “Independent verifier review completed; blocking
findings resolved” items even though this second independent review is blocked
and the worker is explicitly outstanding.

- Documentation: `docs/plan/tasks/cloud-storage-005.md` and
  `docs/plan/tasks/cloud-storage-006.md`.

## Local verification evidence

| Check | Result |
| --- | --- |
| `npx tsc --noEmit --project apps/web/tsconfig.json` | Passed. |
| `npm test` | Passed: 59 tests. The storage set remains eight pure-policy tests; it does not cover the runtime findings above. |
| Live R2 / Firestore / worker / browser | Not run by scope and environment restriction. |

## Conclusion

**BLOCKED.** The authorization, actual-byte integrity, legacy customer preview,
and atomic ledger improvements resolve important earlier findings. The missing
preview/RAW runtime and missing cleanup/retry executors still prevent delivery of
the requested independent cloud storage and proofing system. The remaining P1
findings must be resolved before the feature can be represented as complete.
