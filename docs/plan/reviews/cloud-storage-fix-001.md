# Review: cloud-storage-fix-001

## Scope and method

Reviewed the current uncommitted cloud-storage fixes against:

- `Agents.md`
- `docs/Index.md`
- `docs/technical/cloud-storage-proofing.md`
- tasks `cloud-storage-005`, `cloud-storage-006`, and `cloud-storage-010`

This was a static/local verification only. No browser UAT, production deployment,
Firestore mutation, or R2 request was performed.

## Findings

### P1 — blocking — Active authorization is not checked after upload admission

The blueprint requires every upload route to validate the authenticated caller's
current studio membership and assigned-order access. `upload-parts`,
`upload-status`, `complete-upload`, and `cancel-upload` only compare the current
UID with the persisted `actorUid`. A crew member whose membership is revoked or
whose assignment is removed can retain access to an unexpired session.

- Design: `docs/technical/cloud-storage-proofing.md`, “State machine” and
  “Concrete HTTP contracts”.
- Code: `apps/web/src/app/api/storage/upload-parts/route.ts:12-17`,
  `apps/web/src/app/api/storage/upload-status/route.ts:9`,
  `apps/web/src/app/api/storage/complete-upload/route.ts:17-29`, and
  `apps/web/src/app/api/storage/cancel-upload/route.ts:9`.

### P1 — blocking — Persisted objects are never content-validated or hash-verified

The client-supplied SHA-256 is copied to `OrderCloudPhoto.sha256`; completion
only validates multipart part lengths and the R2 HEAD size/content-type. It does
not stream the object, recompute the hash, inspect raster signatures, or validate
RAW container/camera metadata. A caller that owns a session can store arbitrary
same-length bytes under a permitted claimed type, and the metadata describes an
unverified hash as actual persisted bytes.

- Design: `docs/technical/cloud-storage-proofing.md`, “File policy” and
  “Concrete HTTP contracts”, item 4.
- Code: `apps/web/src/app/api/storage/complete-upload/route.ts:24-27`,
  `packages/db/src/cloudStorage.ts:450-493`; `validateRasterSignature` in
  `packages/domain/src/cloudStorage.ts:122-140` has no call site.

### P1 — blocking — Original-file proofing cannot produce previews

Original uploads with proofing enabled correctly create a pending preview job,
but no worker/container, RAW decoder, derivative write, preview ledger commit,
or failed-state processor exists. Consequently customer proofing for every
ORIGINAL raster/RAW upload remains pending indefinitely. This is a required
behavior for the OFF/ON configuration, not an optional integration check.

- Design: `docs/technical/cloud-storage-proofing.md`, “Preview jobs and runtime”.
- Code: `apps/web/src/app/api/storage/complete-upload/route.ts:26`,
  `packages/db/src/cloudStorage.ts:446-493`; no `apps/storage-worker/` exists.
- Documentation evidence: `docs/plan/tasks/cloud-storage-006.md` explicitly
  records that the RAW worker/container is not implemented.

### P1 — blocking — Deletion and cancellation do not preserve the ledger/durable-cleanup contract

Bulk delete removes R2 objects and Firestore photo records, then uses the legacy
studio-only counter helper. It does not atomically decrement the platform ledger,
does not tombstone work before object deletion, and has no per-object durable
retry/audit record. This can permanently overstate platform usage and block new
admissions after deletion.

Cancellation marks cleanup pending but immediately releases primary and preview
reservations after `AbortMultipartUpload`. It neither waits for issued part URLs
to expire plus the required grace period nor confirms absence of parts/object.
The R2 abort helper deliberately swallows provider errors, so an unknown cleanup
state can release capacity.

- Design: `docs/technical/cloud-storage-proofing.md`, “Integrity, races and
  capacity caveat”, “Ledger and concurrency”, and “Authorization, management and audit”.
- Code: `apps/web/src/actions/storageActions.ts:655-674`,
  `apps/web/src/app/api/storage/cancel-upload/route.ts:9`,
  `apps/web/src/actions/storageActions.ts:781-820`, and
  `apps/web/src/services/r2StorageService.ts:258-276`.

### P1 — blocking — Existing optimized customer galleries are inaccessible

For every non-staff caller, gallery hydration now issues a signed URL only for
`p.preview.objectKey`. Existing optimized `cloud_photos` records store their
viewable image at the primary `objectKey` and normally have no `preview`. They
therefore return empty `previewUrl` values even though compatibility resolution
enables proofing for legacy galleries. This violates the requirement to keep
existing studio files and customer proofing access working during migration.

- Design: `docs/technical/cloud-storage-proofing.md`, “Settings and compatible
  records” (legacy optimized images may supply their own preview) and “Migration and rollout”.
- Code: `apps/web/src/actions/storageActions.ts:323-355`.

### P1 — blocking — Alternate client review route permits prohibited passkey fallback

`submitCustomerTaskReviewCore` catches a failed/restricted signed-in token path
and can then authorize a passkey. Unlike gallery editing, this route does not
deny passkey-only access when the order has an email/UID lock. That permits a
restricted identity with a passkey to approve/rework a photo-selection task,
which the blueprint expressly forbids.

- Design: `docs/technical/cloud-storage-proofing.md`, “Authorization,
  management and audit”.
- Code: `apps/web/src/actions/orders/orderCustomerOperations.ts:540-599`.

### P2 — blocking — Multipart replay, idempotency, length enforcement, and recovery are incomplete

Admissions persist an idempotency key but never look it up or reuse a matching
session. The client creates a fresh key for every attempt, so retries reserve
duplicate capacity. The part presign command does not sign an exact content
length, and no active-session limits are enforced. Completion changes state
outside a transaction lease and does not recover a completed R2 multipart upload
after a failure between provider completion and Firestore commit.

- Design: `docs/technical/cloud-storage-proofing.md`, “Upload protocol:
  multipart for every file” and “Integrity, races and capacity caveat”.
- Code: `apps/web/src/app/api/storage/presign-upload/route.ts:18-48`,
  `apps/web/src/app/api/storage/upload-parts/route.ts:12-17`,
  `apps/web/src/services/r2StorageService.ts:206-229`, and
  `apps/web/src/app/api/storage/complete-upload/route.ts:24-27`.

### P2 — blocking — Required upload retry/cancellation and audit behavior is absent or incomplete

The UI performs a single fetch for each part and aborts the whole batch on an
error. It exposes no bounded retry, cancellation of the sessions it admitted,
or resumable same-file workflow. Sensitive original-download issuance only
writes the order audit log rather than the required append-only
`cloud_storage_audit` event.

- Design: `docs/technical/cloud-storage-proofing.md`, “Concrete HTTP contracts”,
  item 5, and “Authorization, management and audit”.
- Code: `apps/web/src/components/deliverables/CloudProofingGallerySection.tsx:276-309`,
  `apps/web/src/actions/storageActions.ts:747-772`.

### P3 — non-blocking — Task checklists overstate completion

Tasks 005 and 006 mark independent verifier resolution and automated verification
as complete while required provider/worker work is explicitly outstanding. Task
010 is still `pending` but also marks verifier resolution complete. This is
inconsistent with the documented requirement to distinguish implementation,
automated, integration, and user verification.

- Design: `docs/technical/cloud-storage-proofing.md`, “Verification and baseline”.
- Documentation: `docs/plan/tasks/cloud-storage-005.md`,
  `docs/plan/tasks/cloud-storage-006.md`, and
  `docs/plan/tasks/cloud-storage-010.md`.

## Local verification evidence

| Check | Result |
| --- | --- |
| `npm test` | Passed: 59 tests. Storage coverage is eight pure-policy tests only; it does not exercise routes, Firestore, R2, cleanup races, customer access, or RAW conversion. |
| `npx tsc --noEmit --project apps/web/tsconfig.json` | Passed. |
| `npm run lint` | Passed with existing warnings (11). |
| `npm run build` | Started but did not produce a completion result in the available command window; do not treat it as passed. |
| R2 / Firestore / RAW / browser verification | Not run, by scope and environment restriction. |

## Conclusion

**BLOCKED.** The fixes improve isolation by moving the active UI protocol to
multipart sessions and avoid directly returning original keys in the normal
customer gallery DTO. However, the P1 authorization, integrity, preview-worker,
cleanup/ledger, legacy-access, and alternate-review authorization failures mean
the implementation does not meet the approved cloud-storage proofing contract.
