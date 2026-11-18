# Cloud storage and independent client proofing

Status: implementation blueprint; approved plan followed by user “Proceed” on 2026-11-18.
Implementation and verification status remain in `docs/plan/tasks/cloud-storage-*.md`.
This document specifies behavior, not evidence that infrastructure is deployed.

## Boundaries and reuse

Extend the existing Next.js routes, `r2StorageService.ts`, `storageActions.ts`,
`cloud_photos` collection, Firestore Admin SDK and existing gallery components.
The first gallery remains the order's existing gallery, with `galleryId = order.id`.
Do not introduce a separate product or change theme, typography or layout conventions.
All credentials remain server-only. Browser Firestore rules remain deny-all.

Use new focused modules rather than enlarge existing monolithic files unnecessarily:

- `apps/web/src/lib/cloudStoragePolicy.ts`: pure settings/type/size/representation policy.
- `apps/web/src/services/cloudStorageService.ts`: trusted upload/cleanup orchestration.
- `packages/db/src/cloudStorage.ts`: Firestore sessions, jobs, ledger and transactions.
- `apps/storage-worker/`: TypeScript job runner, pinned native decoder container.
- `scripts/cloud-storage-maintenance.*`: dry-run-first inventory/migration tools.

Names are the intended implementation contract; record any necessary changes here.

## Settings and compatible records

Add `Order.cloudStorageSettings`:

```ts
{ version: 1; compressionEnabled: boolean; proofingEnabled: boolean }
```

Owners alone update settings. New order/gallery creation persists `{version:1,
compressionEnabled:true, proofingEnabled:false}`. Missing settings resolve to compression
ON and proofing ON only when real legacy `cloud_photos` or review history exists.
Do not rely solely on `cloudPhotoCount`: it can be stale. Existing explicit values win.
Perform this resolution in the trusted data layer, then project resolved settings into
studio/customer views. An empty existing order without gallery history uses new defaults.

Settings changes never rewrite stored objects or clear selections/comments/reviews.
Uploads snapshot settings at admission. Proofing OFF immediately denies new customer
gallery actions and URL issuance; it cancels unstarted processing, not original uploads.
Proofing ON schedules missing previews after capacity reservation. Processing failures
do not change original integrity or prevent permitted staff downloads.

Extend `OrderCloudPhoto` additively, retaining ID and legacy properties:

```ts
schemaVersion?: 1;
galleryId?: string;
storageKind?: 'ORIGINAL' | 'OPTIMIZED';
sourceFileName?: string; // original user-visible filename, never a storage path
sourceSizeBytes?: number;
sourceMimeType?: string;
sha256?: string; // hash of actual persisted bytes, not multipart ETag
compressionEnabled?: boolean; // upload-time setting
preview?: { objectKey: string; sizeBytes: number; mimeType: 'image/jpeg';
            width: number; height: number; sha256: string };
processingStatus?: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
processingError?: string;
deletionStatus?: 'PENDING';
```

Existing `objectKey`, `sizeBytes`, `mimeType` always describe the primary stored object.
`fileName` remains the source filename for Lightroom and export compatibility. Download
content type and a separately generated safe extension must describe stored bytes when
compression changed their encoding. Never call an optimized legacy image an original.
Legacy photos without `schemaVersion` remain optimized proofing records, read at their
existing keys. No historical originals can be reconstructed from these records.

Staff DTO may contain metadata but need not contain object keys. Customer DTO is an
explicit allowlist: ID, filename/display name, preview URL, preview dimensions,
processing state, selected/selectedBy/selectedAt/comment. Never spread storage records
into customer responses. Original keys, original signed URLs, upload identities, hashes
and internal errors are excluded. Legacy optimized images may supply their own preview.

## File policy

Accept JPEG, PNG, WebP and RAW extensions CR2/CR3/NEF/ARW/DNG. MIME and extension are
admission hints only. Verify byte signatures/container metadata before commit; TIFF
magic alone cannot distinguish NEF/ARW/DNG. A bounded server parser must verify relevant
camera/container tags or reject as unsupported. No HTML/SVG/executable fallbacks.
Reject path separators, control characters and excessive filenames at admission; retain
ordinary Unicode display names separately from server-generated keys.

Compression ON runs the existing raster compressor; preserve its current quality/edge
defaults. RAW is explicitly labelled “stored unchanged”; no browser RAW decoding.
Compression OFF sends the original `File` bytes without any canvas, conversion or resize.
Embedded metadata stays in originals; derivative metadata excludes GPS/EXIF by default.

Initial safety limits: original 512 MiB, optimized raster 10 MiB, preview 2 MiB,
120 million decoded pixels, 200 files per batch, existing 2,000 files per order,
16 MiB upload parts, four browser transfers at once, 20 active sessions per actor,
200 active sessions per studio. Limits are server-enforced and exposed to the UI.
These are explicit product safety limits, not assertions about provider maximums.

## Upload protocol: multipart for every file

Use multipart even for small files (one final part). Only server code can create or
complete uploads. Client capabilities are scoped `UploadPart` URLs for a persisted
upload ID/part number/exact length; never issue new browser `PutObject` URLs.
Each file uses a cryptographically random session ID/photo ID and immutable final key:
`studios/{studioId}/orders/{orderId}/files/{photoId}/primary`.
Validate canonical studio/order identifiers from authenticated database records, not
lossy caller key sanitization. Originals and derivatives never share keys.

This replaces staging/copy with an equivalent write-once protocol: completion consumes
the multipart ID, so an old part URL cannot overwrite the committed primary object.
Do not introduce a staging-copy path unless it implements conditional source verification,
accounts for both copies, and holds reservations until old PUT URLs expire and cleanup
is confirmed. That more complicated path is unnecessary for this implementation.

Persist `cloud_upload_sessions/{sessionId}`:

```ts
{ id, photoId, studioId, orderId, galleryId, actorUid,
  sourceFileName, sourceSizeBytes, sourceMimeType,
  uploadSizeBytes, uploadMimeType, expectedSha256?, storageKind,
  settings, objectKey, multipartUploadId?, partSizeBytes,
  state, reservedBytes, previewReservedBytes,
  createdAt, expiresAt, lastSignedUrlExpiresAt?, leaseUntil?, leaseToken?,
  actualSizeBytes?, sha256?, errorCode? }
```

State machine: `RESERVED -> UPLOADING -> VERIFYING -> COMMITTED`; any failed/cancelled
noncommitted state moves to `CLEANUP_PENDING -> CLEANED`. `COMMITTED` retries return
the existing record without resetting customer data. Session ownership is uploader UID
plus current assigned-order permission; owners may cancel another studio session, but
must not assume its identity to resume it. Sessions expire after 24 hours; URL lifetime
is five minutes. Resume asks the user to reselect the same local file and checks filename,
size, lastModified and hash before reuse. Never persist browser file contents in storage.

### Concrete HTTP contracts

All routes require Firebase bearer/session authentication and verify studio/order access.
All return `{error, code}` with 400 invalid input, 401 unauthenticated, 403 forbidden,
404 inaccessible/missing, 409 conflict, 413 quota/size and 503 unavailable; do not leak
provider credential/key details in error text. Reuse existing route locations where shown.

1. `POST /api/storage/presign-upload` accepts `{studioId, orderId, files:[{
   fileName, sourceSizeBytes, sourceMimeType, sizeBytes, mimeType, sha256?, lastModified?
   }]}`. Server resolves settings; rejects incompatible optimized/original claims.
   Response `{uploads:[{sessionId, photoId, fileName, sizeBytes, mimeType,
   partSizeBytes, partCount, expiresAt}], quota, settings}`. Never return object keys.
   Each file is admitted independently; partial batch admission reports per-file errors.
2. `POST /api/storage/upload-parts` accepts `{sessionId, partNumbers:number[]}`.
   Response `{parts:[{partNumber, url, sizeBytes, expiresAt}]}`. At most eight signed
   parts per call. Server computes exact part byte lengths from session manifest.
3. `POST /api/storage/upload-status` accepts `{sessionId}`. Response contains state,
   immutable source manifest and actual completed parts from R2 `ListParts` (number,
   length and ETag), never arbitrary key/upload ID supplied by the browser.
4. `POST /api/storage/complete-upload` accepts `{sessionIds:string[]}` (bounded batch).
   Browser ETags/sizes/keys are not authority. Server lists all expected parts, validates
   exact lengths/count, completes under a transaction lease, HEADs actual object, streams
   validation/hash, then atomically creates photo + transitions session + updates ledger
   and order summary + enqueues preview job. Response per session is committed, processing
   or failed with quota/summary. Large validation may be deferred to the durable worker;
   return 202 while VERIFYING and never advertise an unverified photo as saved.
5. `POST /api/storage/cancel-upload` accepts `{sessionId}`. Return cleanup-pending until
   abort and object deletion are confirmed; committed sessions require file deletion.

Browser uses byte-progress-capable transfers, bounded exponential retries with jitter,
fresh part URLs after expiry, and settles/aborts every in-flight transfer before exit.
Cancellation does not mean “clear local UI and release quota”. Repeated start uses an
idempotency token bound to actor/order/source manifest to avoid duplicate reservations.

### Integrity, races and capacity caveat

Part signatures must include exact `Content-Length`; inspect generated signed headers
and test that R2 rejects wrong length. Browser supplies Blob body and lets the browser
set its matching header. If this cannot be enforced in the real runtime, direct signed
uploads must be disabled or routed through an authenticated bounded streaming gateway;
do not claim a physical-byte hard cap from client-provided lengths alone.

Before CompleteMultipartUpload, freeze the session with a lease and persist the actual
part manifest. Completion uses the manifest's ETags; provider errors caused by a racing
part replacement require relisting/revalidation. After completion old part URLs cannot
write, and HEAD/stream validation sees immutable bytes. ETags are not content hashes.
On completion timeout, use HEAD and persisted ownership/manifest to recover the same key;
never create a second photo. VERIFYING may be recovered by the worker after lease expiry.

Abort can race in-flight parts: retain reservation until the last issued URL expiration
plus two minutes, abort again/list parts, confirm no object/parts, then release exactly
once. Set session cancellation before abort; no further URLs are issued. Long-running
provider operations whose state is unknown retain capacity and surface pending cleanup.

## Ledger and concurrency

Studio retains `storageUsedBytes` and `storageFileCount`; add `storageReservedBytes` and
`storageReservedFileCount`. Maintain `cloud_storage_platform/current` with `usedBytes`,
`reservedBytes`, `initializedAt`, `inventoryVersion`, `admissionsEnabled`.
These are integer nonnegative safe values. No silent `max(0)` hiding accounting defects:
inconsistent counters block mutation and request reconciliation.

Admission transaction reads studio, order, platform, idempotency record and settings.
Check actual used + all reservations + requested primary + bounded preview reservation
against BOTH plan cap and platform `R2_PLATFORM_CAP_GB`. Reserve file counts too. A single
platform document is deliberate serialization; do not use sharded counters for hard-cap
admission. Use transaction retry/backoff and return retryable busy errors under contention.
Free/Trial/Starter/Professional limits remain 0/10/20/50 GiB (existing display says GB).

`usedBytes` covers committed primary and derivative bytes, including objects pending
deletion. Reservations conservatively cover uncommitted parts/objects and future output.
No duplicate staging copy exists in the multipart protocol. At commit, move verified
primary bytes from reserved to used atomically. Keep derivative reservation until preview
commit/failure cleanup. Preview commit moves its actual HEAD size to used and releases
unused allowance. If output exceeds reserved bound, delete it before release and fail.
Plan expiry/downgrade blocks new admissions, not reads/deletion of existing stored files;
never delete originals to force compliance. An admitted in-flight upload may commit
within its prior reserved allocation, while no additional quota is granted.

Firestore transaction cannot encompass R2 side effects. Leases, idempotency keys,
per-object deletion results and recoverable job records are mandatory at each boundary.
Storage accounting updates, file/session state and immutable audit event creation belong
in the same Firestore transaction. Do not call the legacy standalone adjustment helper
from new mutation paths.

## Preview jobs and runtime

Use Firestore `cloud_storage_jobs` as a durable outbox; atomically create deterministic
job IDs `verify:{sessionId}`, `preview:{photoId}:v1`, `cleanup:{sessionId}`. A scheduled
Cloud Run Job polls due jobs, claims a transactional lease, processes bounded work and
exits. No public worker webhook or queue token is needed. Scheduling identity has only
Cloud Run job execution permission; runtime uses its own service account and R2 secret.

Job fields: `{kind, studioId, orderId, photoId?, sessionId?, state, attempt,
availableAt, leaseUntil?, leaseToken?, lastError?}`. States PENDING/RUNNING/SUCCEEDED/
FAILED/CANCELLED. Lease tokens fence stale workers from committing. Four attempts with
backoff (1/5/15 minutes); explicit retry resets a failed job after authorization.
One native decode at a time per job execution; preview limit 2 MiB, edge 2048px, JPEG.

Worker container: Node.js TypeScript runner, pinned sharp raster encoder and pinned
LibRaw native helper, built from a verified release checksum. Helper accepts a local
temporary file path only, no shell interpolation; emits a bounded raster into private
temporary directory. Prefer the embedded thumbnail when adequate, otherwise decode
within 120M-pixel/memory/time limits. Strip metadata in final JPEG. RAW validation uses
LibRaw/container inspection; no filename-only acceptance. Missing decoder is an explicit
unavailable/failed status. Worker never writes to the primary key.

Recheck order proofing and photo deletion immediately before work and before commit.
Use deterministic derivative key `.../files/{photoId}/preview-v1.jpg`; maintain exclusive
lease fencing and object checksum/size verification. Stale writers must be unable to
replace a committed preview: use unique attempt keys then commit one pointer, tracking
every attempt's reserved bytes until cleanup. Never allow simultaneous native attempts
under one output reservation; expired leases require cleanup/reconciliation first.
Proofing OFF keeps existing previews/annotations but does not enqueue new previews.
Optimized raster primary may itself serve as proof; ORIGINAL raster/RAW requires separate
derivative even if the original happens to be small.

## Authorization, management and audit

Every staff operation calls verified identity, active studio membership, order studio
match and `requireAssignedOrderAccess`; owner bypasses only assignment restriction.
Soft-deleted orders/studios deny new mutations and customer access. Original downloads
are staff-only in this release; customer proofing permission does not grant downloads.
Use a dedicated download action accepting photo IDs, resolve records server-side,
authorize each, audit each issued capability, and return signed attachment URLs (60 sec).
Preview URLs expire after 300 sec and are issued only following current authorization.

For customers: proofing must be ON. Email/UID-bound order requires matching primary
customer or an explicit collaborator. EDITOR can select/comment/review; VIEWER can read.
Passkey-only access is allowed only when the order has no email/UID lock. Do not fall
back from a failed restricted signed-in identity to broad passkey permission. Keep
existing genuine tracking passkey/PIN behavior; order IDs/numbers are not new secrets.

Multiselect management IDs are distinct UI state from customer selected flags.
Download selected issues per-file authorized URLs, without unbounded in-memory ZIPs.
Delete selected tombstones each photo and cancels processing, deletes primary/derivative
objects, records per-object results and decrements exact confirmed bytes once. Leave
failed object records and usage intact; retry safely. Studio permanent purge must await
the same cleanup protocol and must not swallow R2 errors before removing ownership data.

Use append-only `cloud_storage_audit` event documents for upload admission/commit,
settings changes, download issuance, deletion outcomes, cleanup and reconciliation.
Fields: eventId, UTC time, actor UID/service identity, studio/order/photo/session IDs,
action, result, byte delta and safe error code. No signed URLs, passkeys or credentials.
Existing order review audit/workflow notifications continue on existing photo IDs.
Also enforce proofing policy in `submitCustomerTaskReviewCore` for cloud-specific photo
selection/review tasks; that alternate path must not bypass the gallery action checks.
Keep unrelated external-deliverable task review functional. Preserve task IDs required
by `TrackOrderClient` review calls; projection privacy fixes must not remove them.
All four existing studio purge entry points must funnel through durable storage cleanup,
including sessions/jobs, before removing studio ownership records.

## Infrastructure configuration (to provision, not deployed)

| Variable/config | Consumer and value contract |
| --- | --- |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Existing server/worker secrets; private bucket only |
| `R2_PLATFORM_CAP_GB` | Existing cap, default 500; validate positive finite value; enforced ledger admission |
| `R2_PUBLIC_BASE_URL` | Deprecated; never used for private file URLs |
| `FIREBASE_PROJECT_ID` | Existing project identity; worker uses service-account ADC, no browser credential |
| `CLOUD_STORAGE_WORKER_ENABLED` | Server readiness flag; false until worker actually provisioned and health verified |
| `CLOUD_STORAGE_JOB_BATCH_SIZE` | Worker integer 1–20, default 5 |
| `CLOUD_STORAGE_JOB_LEASE_SECONDS` | Default 900, greater than per-file decode deadline |
| `CLOUD_STORAGE_DECODE_TIMEOUT_SECONDS` | Default 120, upper bound 300 |
| `LIBRAW_HELPER_PATH` | Worker absolute built binary path `/usr/local/bin/focoman-raw-preview` |

Cloud Run Job: one task, parallelism 1, 2 vCPU, 4 GiB memory, task timeout 15 minutes,
bounded scratch space, non-root container, no shell/native process network access where
runtime permits; limits also enforced in helper/process. Cloud Scheduler invokes the job
every minute using OAuth service-account authentication to Google Cloud Run Jobs API.
Document exact project/region/service-account names as environment-specific deployment
inputs; never invent an existing project resource. Firestore Admin runtime IAM remains
server-only; least privilege for scheduler and secret access. No production provisioning
or deployment occurs without explicit approval.

R2 CORS: explicit approved app origins; GET/HEAD/PUT, required Content-Type headers,
exposed ETag, no wildcard credentials. Browser uses S3 API endpoint; buckets, r2.dev and
custom domains must have public access disabled. Multipart lifecycle abort after one
day is a safety backstop, not the ledger release mechanism. Daily read-only inventory
reconciliation and frequent cleanup job polling are required. Alert on stale reservations,
failed jobs, partial deletes, negative/mismatched accounting and cap thresholds.

Indexes: jobs `(state, availableAt)`, sessions `(state, expiresAt)`, photos
`(studioId, orderId)` and any actual pagination order-by indexes. Add only indexes used
by implemented queries; document deployment commands separately.

## Migration and rollout

Migration tool defaults to report-only. It inventories R2 objects, incomplete multipart
uploads, Firestore photos and counters; computes settings from photo/review evidence;
reports missing/extra objects and bytes. It never deletes unidentified legacy objects.
Apply mode is additive, explicitly invoked, checkpointed and idempotent. Back up
Firestore and write a report of old/new values for rollback.

Safe cutover: disable upload admissions, deploy new protocol without enabling writes,
wait existing 10-minute PUT URLs out plus safety grace, inventory/reconcile actual bytes
and old incomplete uploads, initialize platform/studio ledger and settings, then enable
admissions. Maintain authorized legacy reads throughout. Missing platform initialization
fails new uploads with a setup-required message; never seed zero for an existing bucket.
Objects that cannot be attributed still consume platform bytes and are reported for
manual review. No destructive migration or live execution is authorized by plan approval.

Rollback disables new admissions/worker first, retains versioned records, original keys
and accounting evidence. Do not roll back to code that issues original customer URLs or
ignores reservations. Turning off a feature is safer than downgrading the security protocol.

## Verification and baseline

Test policy matrix, pure arithmetic/state rules and validation units without claiming
provider behavior. Real Firestore/R2 integration must prove concurrent admission,
signed length enforcement, consumed-upload replay, cancellation races, integrity and
per-object deletion; real camera samples must prove RAW preview compatibility. No
mocked substitute counts as an integration pass. Browser UAT is performed by user only.

Preimplementation baseline: npm test 50/51, storage tests 4/4; TypeScript two existing
errors in already-modified files; lint passes with 11 warnings. Customer tracking test
expects crew assignments omitted but current projection includes them. Do not blindly
remove projection fields to make that test pass: existing workflow consumers must be
traced before any privacy correction. This blueprint does not fix or waive that failure.
Implementation completion, automated pass, real integration pass and user E2E pass are
separate task checklist states. Missing live resources means unverified, not successful.

## Provider references

[Cloudflare upload guidance](https://developers.cloudflare.com/r2/objects/upload-objects/)
and [signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) describe
multipart and temporary capabilities. [LibRaw releases](https://www.libraw.org/download)
and [camera support](https://www.libraw.org/supported-cameras) determine the pinned decoder
and tested camera variants. Exact compatibility remains an integration gate.
