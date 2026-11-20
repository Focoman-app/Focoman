# Cloud Storage & Photo Selection launch refinement

Status: proposed; awaiting explicit user approval before code changes.
Audit date: 2026-11-20. Scope: current working tree, including pre-existing changes.

## Governing scope

Read `Agents.md` and `docs/Index.md`. This request refines the existing implementation,
preserves the current retro UI, and supersedes conflicting directions in the older
cloud-storage blueprint (multipart for every file and a required separate decoder worker).
That older plan's approval is not approval of this revised implementation plan.
After approval, the Solution Architect stage updates the existing technical blueprint
before Developer implementation and independent Testing review.

No production deployment, data migration execution, pricing changes, hosting migration,
browser automation, or unrelated workflow changes are included. Existing uncommitted
work is part of the audit baseline and must be preserved.

## Existing architecture and reusable paths

Next.js routes/server actions authorize Firebase identities and studio memberships;
Firestore Admin SDK persists orders, photos and upload accounting. Browser Firestore
access is denied. R2 uses the existing AWS S3 SDK service. The browser already transfers
file bytes directly to R2. Order tracking/passkeys and optional customer identity are
the existing customer access mechanisms; no additional login is needed.

Relevant source boundaries:

- `apps/web/src/services/r2StorageService.ts`: R2 client, signed transfers, multipart,
  object verification and deletion.
- `apps/web/src/app/api/storage/`: admission, signing, status, completion, cancellation.
- `packages/db/src/cloudStorage.ts`: reservations, sessions, commits, deletion and jobs.
- `packages/domain/src/cloudStorage.ts`, `packages/types/src/cloudStorage.ts`: policies
  and additive settings/session contracts; `OrderCloudPhoto` remains in types/index.ts.
- `apps/web/src/actions/storageActions.ts`: gallery access, comments, selection,
  settings, downloads and deletion.
- `CloudProofingGallerySection.tsx`, `CloudPhotoGalleryClient.tsx`, `imageCompression.ts`:
  existing studio/customer UI, compression, exports and gallery interactions.

## Classification from source inspection

“Implemented” below means present and reusable, not live-provider/browser verification.
No area is certified production-working based on static inspection alone.

| Area | Classification | Finding / reuse |
| --- | --- | --- |
| R2 integration | Implemented but incomplete | Private signed reads, direct multipart uploads, HEAD/hash verification exist; lifecycle recovery is incomplete. |
| Upload authorization | Needs correction | Route helper rechecks assignment; alternate server actions and gallery authorization do not consistently apply the same checks. |
| Quota | Needs correction | Transactional studio/platform reservations exist; failed admission rollback can release unrelated reservations. |
| Order file management | Implemented but incomplete | Metadata listing, staff download, tombstone deletion exist; failed deletions lack an executable retry path. |
| Compression | Implemented but incomplete | Independent toggles; OFF passes original bytes; RAW bypasses raster compressor. Add requested warnings and truthful stored-format feedback. |
| Customer gallery | Implemented but incomplete | Existing order links, lazy images, selection/comments and legacy previews; ORIGINAL derivative generation is absent. |
| Selection | Needs correction | Boolean selected supports select/clear, but cannot distinguish rejected from not reviewed. |
| Comments | Implemented; runtime verification pending | Existing optional per-photo comments and staff visibility should be retained. |
| Tags/grouping | Missing | No photo-tag definitions/associations or controls found. |
| Export | Implemented; runtime verification pending | Existing filename CSV/Lightroom exports should be extended compatibly. |
| Order workflow | Needs terminology correction | Preserve stage identifiers and behavior; change user-facing RAW Photo Selection labels only. |
| Landing/features/pricing | Needs terminology correction | Reuse existing sections/configuration; apply Cloud Storage & Client Proofing without layout or price changes. |

## Confirmed launch blockers

1. `presign-upload/route.ts:39-54` assigns rollback state before the reservation succeeds.
   A failed transaction can therefore release another upload's reserved capacity.
   Reservation/session creation are separate operations; crash recovery is incomplete.
2. `CloudProofingGallerySection.tsx:277-341` rejects the batch when any worker fails;
   other workers can continue, while completed transfers are never finalized.
   It sends all successes in one completion request, although
   `complete-upload/route.ts:10` accepts only 20 and admission allows 200.
3. Completion changes session state without a transaction lease/state guard, consumes
   multipart completion before DB commit, and cannot reliably recover provider success
   followed by a database/network failure. Admission stores but does not reuse idempotency keys.
4. Cleanup jobs and deletion tombstones have persistence but no executing recovery path.
   Cancellation/expiry can retain quota indefinitely. Alternate cancel action authorization
   differs from route authorization.
5. ORIGINAL photos have no implemented preview generator. A worker-enabled flag cannot
   create one. RAW signature validation is skipped at completion. Accepted extensions
   do not establish camera compatibility or safe decoding.
6. Upload UI lacks transferred-byte progress, speed, ETA, automatic/manual retry and
   cancellation. Its success message claims processing that may be unavailable.
7. Gallery authorization allows a nonowner membership without an active member record
   to bypass assignment checking (`storageActions.ts:76-95`). Email-lock handling differs
   across gallery read/edit and review routes; consolidate the existing intended policy.
8. Global cap is already configurable but silently defaults to 500 GiB. Preserve plan
   allowances (Free 0 / Trial 10 / Starter 20 / Professional 50 GiB, displayed as GB).
   Make platform-cap policy explicit so a small implicit default cannot block growth.
9. Deletion finalizes even when the R2 helper reports `skipped` because configuration is
   unavailable. Downloads can label optimized bytes as originals and use the source
   extension for a different encoding. Fix both representations and confirmed-delete checks.
10. Annotation writes spread a previously read photo into a merge write
    (`packages/db/src/index.ts:1732-1745`), risking lost concurrent changes. Update only
    authorized changed fields, and fetch the scoped photo rather than every order photo.
11. Disabling Photo Selection currently cancels all pending job kinds, including cleanup.
    Keep cleanup independent. HEAD must distinguish missing objects from provider errors.
    Actual part-byte bounds require provider verification, not just declared file sizes.

## Proposed implementation sequence for approval

1. **Storage lifecycle and quota.** Reuse routes/service/collections. Bind reservations
   to durable session identities transactionally, make admission/completion idempotent,
   enforce legal state transitions and completion/cancel leases, and recover interrupted
   commits. Recheck authorization through one existing-policy helper. Release only the
   exact owned reservation after confirmed cleanup. Make deletion retries resume the same
   tombstone job. Add a small bounded maintenance entry point for expiry/cleanup/recovery,
   with documented scheduling; no distributed processing platform.
2. **Upload method and representations.** Prefer signed single-object uploads for ordinary
   photos, retain existing SDK multipart for large files. Architect must resolve replay/
   overwrite protection before changing the protocol: an unexpired upload URL must not
   mutate a committed object. Temporary storage, if required, is quota-accounted and
   cleaned; no silently retained full-resolution duplicate. Retain current route names
   and compatibility with already-created multipart sessions.
3. **Compression and previews.** Keep current raster compression defaults and exact
   original bytes when OFF. Reuse the browser raster compressor for small separate
   viewing previews when retaining originals; validate and count every stored derivative.
   Investigate bounded embedded-preview extraction for supported RAW containers before
   adding processing infrastructure. Validate with real camera files. If a camera variant
   cannot yield a safe preview, expose an explicit unavailable state and document that
   limitation; do not claim RAW Photo Selection complete or substitute full originals.
   Add the two exact requested contextual warnings once in their appropriate controls/views.
4. **Upload manager.** Extend existing panel with a per-file queue, four concurrent
   transfers, byte progress, completed/failed counts, smoothed speed, remaining bytes and
   approximate ETA. Maximum three automatic transient retries with jitter/backoff;
   structured error codes distinguish quota/validation/auth failures. Refresh expired
   URLs through authorized flow. Finalize successful files in bounded batches independently
   of failures. Retry Failed Files reuses session identity and skips committed files.
   Cancel settles active requests and schedules confirmed cleanup. No speed test or
   promise of uploads surviving browser closure.
5. **Photo Selection metadata.** Add a three-state field compatibly: legacy selected=true
   maps to Selected, legacy false/missing maps to Not Reviewed; do not invent historical
   rejections. Keep existing boolean projections/contracts synchronized where needed.
   Reuse comments. Add one order-scoped tag vocabulary and bounded photo tag-ID lists;
   default suggestions and custom names share this system. Enforce existing customer/editor
   permissions. No file copy/move for metadata edits. Show counts and review comments/tags
   in the existing views; preserve filename export and add status/tags without breaking
   existing Lightroom filename output.
   Keep mutations field-scoped so concurrent comment, tag and selection changes do not
   overwrite one another. Preserve legacy workflow title matching when changing labels.
6. **Sharing, naming and launch verification.** Reuse order links, locked identities and
   collaborator roles. Preserve private preview-only customer DTOs, scoped expiring URLs,
   lazy loading and bounded URL refresh/caching. Rename user-facing application labels to
   Photo Selection and marketing copy to Cloud Storage & Client Proofing. Preserve internal
   RAW/proofing identifiers, navigation and styling. Update the existing blueprint and task
   evidence to reflect actual implementation and unresolved launch limitations.

Existing layout remains:

```text
Existing Cloud Storage section
  Compression [toggle]  Photo Selection [toggle]
  [contextual compression warning when applicable]
  Storage usage  [Choose files] [Upload / Cancel] [Retry Failed Files]
  Upload progress, counts, speed, remaining bytes, approximate time
  Existing gallery / lightbox / export
    Not Reviewed / Selected / Rejected   optional comment   tags
```

## Verification and release evidence

Use existing Node tests, TypeScript, lint and production build. Add meaningful coverage
for lifecycle policy, state transitions, legacy selection mapping, tags and retry rules.
Real isolated R2/Firestore verification must cover authorization, concurrent admission,
completion replay, expiry, cancellation, failure cleanup, deletion accounting and signed
upload constraints. Pure helper tests are not provider-integration evidence. Use genuine
JPEG/RAW fixtures and compare original/download hashes with compression OFF.

User performs browser validation: single/multiple files, both compression settings,
interruption/retry/cancel, slow connection feedback, gallery persistence, all selection
transitions, comments/tags, customer/studio visibility, filename export and mobile theme.
Do not use browser agents or automated browser UAT.

Record implementation, automated checks, provider integration and user UAT separately.
No production-ready claim until required live and user checks pass. Infrastructure setup,
private bucket/CORS, initialization from real existing inventory and maintenance scheduling
must be documented; never seed fabricated zero usage or run a destructive migration.

## Provider reference

Cloudflare documents direct browser signed uploads and multipart for larger transfers:
https://developers.cloudflare.com/r2/objects/upload-objects/
Signed URLs are scoped temporary capabilities and remain usable until expiry:
https://developers.cloudflare.com/r2/api/s3/presigned-urls/

These establish provider capabilities, not verification of this application's integration.

## Current baseline

- `npm test`: executed, 59 passed, 0 failed. Storage coverage is 4 quota and 8 domain-policy
  helper tests; it does not establish R2/Firestore lifecycle correctness.
- `npx tsc --project apps/web/tsconfig.json --noEmit --incremental false`: passed.
- `npm run lint`: passed with 11 existing warnings (ten image-element warnings,
  one OMS effect-ref warning), plus the Next lint deprecation notice.
- Production build, live-provider tests, real RAW decoding and user browser UAT: not run.
