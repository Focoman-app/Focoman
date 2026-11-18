# Cloud storage, independent compression and proofing

Status: approved by the user's explicit "Proceed" on 2026-11-18; implementation underway.
Review date: 2026-11-18. Baseline: `821f878` plus existing uncommitted payment/UI changes.

## Review scope and evidence

Repository-wide file inventory and integration searches covered apps, packages, tests,
scripts, rules, configuration, documentation and the latest R2 commit (37 files).
Detailed review focused on storage and its callers; this is not a claim that every
unrelated source line or production resource has been audited. No live bucket,
Firestore data, production permissions or browser flow has been inspected.

Read the governance and documentation index, product/identity/architecture references,
deployment guidance and brand tokens. Current repository hosting configuration is
Firebase framework hosting plus a Vercel config; target docs describe Cloud Run,
but no Dockerfile appeared in the file inventory. Worker deployment must therefore
be an explicit infrastructure deliverable, not assumed to exist.

### Reuse map

| Module | Existing responsibilities and connections |
| --- | --- |
| `apps/web/src/services/r2StorageService.ts` | Server-only S3 client, signed PUT/GET, object keys, batch delete |
| `apps/web/src/app/api/storage/{presign-upload,complete-upload}/route.ts` | Firebase auth, studio membership, order lookup, upload validation and quota calls |
| `apps/web/src/lib/storageQuota.ts` | Free 0 / Trial 10 / Starter 20 / Professional 50 GiB, formatting, Lightroom names |
| `packages/db/src/index.ts` | `cloud_photos`, photo CRUD, transactional usage adjustment, order summary |
| `packages/types/src/index.ts`, `packages/domain/src/index.ts` | Photo identity, selections/comments, order review fields and customer projections |
| `apps/web/src/actions/storageActions.ts` | Customer/staff access, selection, comments, review, workflow updates, deletion |
| `apps/web/src/actions/orders/orderAccessHelpers.ts` | Existing assigned-order restriction for crew; reuse for storage |
| `CloudProofingGallerySection.tsx`, `imageCompression.ts` | Gallery UI, browser raster compression, upload queue, usage, deletion, CSV/Lightroom export |
| OMS page, `OrderVerticalWorkflow.tsx`, tracking page and `CloudPhotoGalleryClient.tsx` | Existing studio and customer gallery entry points and approval experience |
| Studio actions, dev metrics, settings and entitlement/config packages | Studio purge, cap reporting, quota presentation and plans |
| `firestore.rules` | Browser data access denied; Admin SDK actions must authorize every operation |

### Confirmed source-level defects and gaps

1. Completion accepts caller-provided photo IDs/keys/sizes, checks only key prefix,
   and never performs R2 HEAD verification or matches a persisted upload session.
   `saveCloudPhotosBatch` overwrites supplied document IDs; replay can reset selections
   and increment usage again. Ownership must come from a server-created session.
2. Quota checks occur outside the usage transaction. Concurrent upload batches can
   each pass. Metadata, usage and order summaries are separate writes.
3. `R2_PLATFORM_CAP_GB` is exposed through metrics but absent from upload admission.
   Preserve its setting and implement actual enforcement rather than claiming it exists.
4. `R2_PUBLIC_BASE_URL` bypasses signed reads. Private storage cannot use this branch.
5. Delete ignores per-object R2 errors and can report skipped deletion when unconfigured;
   callers still delete metadata/decrement usage. Studio purge catches errors and continues.
6. Upload workers reject on one failure without settling/cancelling the others; successful
   objects may remain without metadata. No durable reservations, cleanup or multipart flow.
7. Storage membership checks omit the existing crew assigned-order restriction.
   Gallery authorization permits passkey reads even for email-locked orders while UI
   requires sign-in. Server policy must enforce the intended customer access boundary.
8. All uploads are browser-compressed raster images (10 MiB output limit). No independent
   settings, original representation, RAW worker, preview lifecycle or original download grant.
9. Gallery reads return the stored object as a preview and spread its full metadata.
   Reusing this unchanged for originals would expose original signed URLs to customers.
10. Existing storage tests cover quota arithmetic and filenames only, not R2, route
    authorization, transactions, concurrency, cleanup or proofing integration.

## Proposed behavior for approval

| Compression | Proofing | Storage and customer behavior |
| --- | --- | --- |
| ON | ON | Optimize supported raster input; proof against optimized image |
| ON | OFF | Optimize supported raster input; staff storage only |
| OFF | ON | Store exact original bytes; separate preview; customer actions retain original photo ID |
| OFF | OFF | Store exact original bytes; no proofing processing or customer access |

New galleries explicitly persist compression ON and proofing OFF. Existing populated
galleries and recorded reviews retain proofing ON unless an explicit prior setting says
otherwise. Migration checks real photo records as well as potentially stale summaries.
Existing empty orders without proofing history get new-gallery defaults. Never reset
selection, comment, review, ID or key fields. The initial gallery is the existing order
gallery; add a stable gallery identity to grouping without building a separate gallery app.

Settings are independent and owner-controlled. Compression changes affect future uploads
only. Snapshot settings/version into upload sessions. Disabling proofing denies new
customer reads and writes immediately, retains annotations and existing previews, and
stops unnecessary pending generation. Previously issued URLs expire shortly; already
downloaded content cannot be revoked. Enabling proofing queues missing previews with quota
reservation and visible processing/failed status. It must not alter existing originals.

RAW policy: accept validated CR2, CR3, NEF, ARW and DNG originals. Compression ON optimizes
supported browser raster inputs only; clearly label RAW as stored unchanged rather than
silently substituting a JPEG for a RAW original. RAW proofing uses a sandboxed server worker.
Camera/codec support must be demonstrated with real samples, not inferred from extension.
This policy and worker choice will be finalized in the Solution Architect phase.

## Proposed implementation boundaries

Keep `cloud_photos` and existing IDs. Add versioned settings, representation metadata
(original/optimized/preview), validated size/type/hash, original display filename,
gallery ID and processing state. Customer DTOs contain only permitted display metadata,
preview URLs and proofing fields, never original keys/URLs. Preserve embedded metadata
by preserving original bytes; remove sensitive metadata from customer derivatives.

Persist server-generated upload sessions with actor/studio/order/gallery, exact object
keys, expected bytes/type, expiry, mode, state and optional multipart upload ID. Never
accept arbitrary object keys or record IDs at completion, download or deletion.
Reserve studio AND platform capacity transactionally before signing, including bounded
derivative capacity and in-flight file counts. Keep actual stored bytes and reservations
separate. Check current plan limits again at transitions; plan expiry must not delete files.

Stage uploads under session-specific private keys. Completion validates actual R2 size,
type signature and integrity, then promotes to a server-only immutable final key (or an
equivalent proven write-once protocol). An unexpired PUT URL must not overwrite a finalized
object. Account for temporary/staged copies and multipart parts in capacity protection;
do not release reservation until cleanup is verified and reusable upload URLs have expired.
Bound file sizes, decode dimensions, part counts, active sessions and request rates.

Use a recoverable state machine because R2 and Firestore cannot share a transaction:
reserved -> uploading -> verifying -> committed; cancellation/failure -> cleanup pending
-> cleaned. Metadata/ledger/session transitions are atomic and idempotent in Firestore;
R2 effects are retried and reconciled. Do not publish unverified data. Protect transitions
against completion/cancellation, delete/worker and settings-change races.

Multipart: server creates/lists/completes/aborts; client receives short-lived scoped part
URLs, retries boundedly with backoff and resumes only the same file/session. Verify parts
and total size server-side. Refresh authentication on resume. Cancellation aborts the
multipart upload and clears staged data before capacity is released. Do not interpret
multipart ETags as full-file hashes.

Proposed preview runtime: TypeScript job coordinator with a pinned native LibRaw decoder
in a resource-limited container, plus raster encoding. Durable job/outbox dispatch,
authenticated worker identity, bounded retries, time/memory/pixel/output limits, lease
recovery and orphan cleanup are required. No browser RAW decoding or pretend-success
placeholder previews. Final hosting/queue choice is part of the approved architecture work.

Delete uses tombstones and per-object results, retains failed work and decrements only
confirmed bytes exactly once. Include preview objects and studio-purge integration.
Reconciliation compares object inventory, sessions and metadata, reports mismatches,
and defaults to a dry run. Never auto-delete unexplained legacy objects.

## UI contract

Reuse existing components, tokens, type, spacing and responsive gallery layout.

```text
Existing order Cloud Storage section
  Compression       [ON / OFF]   Client Proofing [ON / OFF]
  Used / quota      Reserved     Estimated upload size
  [Choose files]    [Upload]     [Cancel]
  Per-file progress / processing / error / retry
  [Select files]    [Download selected] [Delete selected]
  Existing file grid, metadata, filters, lightbox and proofing export
```

Management multi-selection is separate from customer selections. Show exact source
bytes for originals, estimated then actual prepared bytes for compression, and bounded
preview overhead before upload. No fabricated compression ratio. RAW without previews
has a truthful file/status row. Existing customer layout remains; disabled proofing has
no customer gallery entry and is enforced server-side even through direct URLs/actions.
Original downloads are staff-only by default, with explicit server authorization on
every request; customer grants, if exposed, must be explicit and separate from proofing.

## Delivery sequence and integration checklist

See task files `cloud-storage-001` through `cloud-storage-010`. Plan approval is recorded above; technical blueprint precedes developer work.

- [x] Map repository and inspect storage implementation/callers.
- [x] Record reusable modules, observed gaps and proposed behavior.
- [x] Write implementation tasks and verification matrix.
- [x] User approves plan.
- [x] Solution Architect publishes [technical blueprint](../../technical/cloud-storage-proofing.md) before developer work.
- [ ] Settings -> order/customer projections -> all gallery entry points.
- [ ] UI queue -> authorized session/reservation -> R2 -> verified completion -> DB ledger.
- [ ] Committed original -> durable job -> worker -> derivative ledger -> customer preview.
- [ ] Preview -> existing photo ID -> selection/comment/review -> workflow/notification.
- [ ] File management -> scoped download/delete -> R2 outcomes -> ledger/audit.
- [ ] Cleanup/reconciliation -> reservations/platform cap -> dev metrics/studio purge.
- [ ] Separate developer and verifier review; no browser subagents or automated browser UAT.
- [ ] User performs browser UAT; report separately from automated tests.

## Verification matrix and reporting

Every task records implemented / automated-test-passed / integration-verified /
user-E2E-verified independently. Run relevant unit and available real integration tests,
TypeScript and lint after each task. No deployment or destructive migration is authorized.
Use real media fixtures with provenance and isolated Firestore/R2 resources; never replace
provider integration evidence with mocks. Missing infrastructure means unverified, not passed.

| Area | Required evidence |
| --- | --- |
| Four combinations | Settings matrix, upload path and customer access, toggling existing galleries |
| Formats | JPEG/PNG/WebP and CR2/CR3/NEF/ARW/DNG, malformed/signature mismatch, unsupported camera variant |
| Integrity | Source/download hashes equal with compression OFF; filenames/metadata preserved |
| Previews | Real RAW decoding, separate keys, pending/failure/retry, duplicate jobs, disable/delete race |
| Large files | Multipart success, interruption/resume, expired URLs, same-file check, retry/cancel |
| Quota | Exact plan caps, originals + previews, concurrent near-limit studio/platform admission, temporary bytes |
| Authorization | Assigned/unassigned staff, customer/editor/viewer/passkey/email lock, disabled proofing, cross-studio |
| Downloads | No original URL in customer DTO; unauthorized grants/downloads denied; URL expiry |
| Reliability | Completion replay, forged IDs/keys/sizes, partial deletion, cleanup crashes, reconciliation |
| Migration | Legacy access, stale summaries, populated/empty galleries, selections/comments/reviews unchanged |
| Regression | OMS progressive loading, external deliverables, Lightroom/CSV, review tasks, plan expiry, studio lifecycle |

## Infrastructure and migration deliverables

Retain server-only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`, `R2_PLATFORM_CAP_GB` and existing Firebase server credentials.
Deprecate public-base reads; production rollout must verify public bucket/custom-domain
access is disabled without breaking authorized legacy reads. Document exact additional
worker/queue identity, endpoint, region, resource limits and scheduling configuration
after architecture selection; these variables do not exist yet.

Provide restricted R2 CORS (allowed app origins, required methods/headers, exposed ETag),
least-privilege worker/app credentials, multipart lifecycle cleanup, queue retries/dead
letters, scheduled cleanup/reconciliation, Firestore indexes and monitoring guidance.
Signed URLs are bearer capabilities: redact them and credentials from audit/log output.

Migration is additive, resumable and dry-run-first with a recorded cutoff/version,
backup instructions, per-record report and rollback guidance. Keep legacy keys readable;
never recompress historical objects. Seed platform usage from reconciled inventory before
opening new admissions, without racing existing writers. Do not claim previously
compressed files have recoverable originals. No migration execution without approval.

## Baseline verification (before implementation)

Read-only verifier ran these against the existing dirty working tree:

| Command | Actual result |
| --- | --- |
| `npm test` | 51 tests: 50 passed, 1 failed; all four storage tests passed |
| `npx tsc --project apps/web/tsconfig.json --noEmit --incremental false` | Failed: TS2367 at `studioActions.ts:691`; TS2448 at `CheckoutBuilder.tsx:232` |
| `npm run lint` | Exit 0, 11 warnings (10 image warnings, one OMS hook cleanup warning); next lint deprecation notice |

Failing test: `tests/backend-crud.test.ts:559` expects private crew assignments to be
absent from the customer tracking projection; `packages/domain/src/index.ts:267`
retains `assignedResources`. Both TypeScript errors occur in files already modified
before this request. These are baseline failures, not introduced by this documentation.
Lint regenerated `next-env.d.ts`; the verifier restored that generated change.
No R2/Firestore integration, RAW processing, browser UAT or production check was run.
New functionality is not implemented, automated-test-passed or E2E-verified.

## External references checked during planning

- [Cloudflare signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/):
  temporary object capabilities, S3 API endpoint, no custom-domain signed URLs.
- [Cloudflare upload guidance](https://developers.cloudflare.com/r2/objects/upload-objects/).
- [LibRaw camera support](https://www.libraw.org/supported-cameras): support depends on
  decoder build and camera variant; format extension alone is insufficient.

These references inform proposed work; no worker capability has been implemented or tested.
