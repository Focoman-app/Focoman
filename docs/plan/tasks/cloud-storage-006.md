---
id: cloud-storage-006
scope: Durable raster and RAW previews
status: blocked
depends-on: [cloud-storage-005]
---

# Durable raster and RAW previews

## Objective

Implement authenticated durable worker/outbox and pinned decoder container from blueprint. Validate RAW safely; generate bounded separate derivatives only when needed. Keep originals immutable, quota-reserve output, preserve original IDs, and publish processing/failure/retry states.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
The earlier worker requirement is superseded for this launch by the 2026-11-20 refinement:
preview capability must be truthful and raw preview work remains unavailable until real
camera validation. Task 014 records the bounded maintenance/limitation work. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

New worker/container and processing modules per blueprint; packages/db/, packages/types/, R2 service, deployment documentation
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Real samples for CR2/CR3/NEF/ARW/DNG and raster variants. Verify failure/unsupported camera, resource limits, duplicate delivery, retry, disable/delete races, preview byte accounting and original hashes. Missing infrastructure blocks integration claims.
After this task run relevant unit tests, available integration tests, TypeScript and lint;
record commands, actual results and environmental limitations. Do not use mock integration
evidence or mark completion based on compilation alone.

## Checklist

- [x] Plan explicitly approved; dependencies complete.
- [ ] Superseded; a decoder worker is not part of this launch task chain.
- [ ] RAW worker/container and real-camera integration are not implemented or verified.
- [ ] Independent verifier review remains blocked; see `docs/plan/reviews/cloud-storage-fix-002.md`.
- [x] Existing workflows checked and documentation updated.
- [x] User E2E status recorded separately (not run by agents).

## Evidence

Partially implemented; no decoder worker is present:
1. `packages/db/src/cloudStorage.ts` implements durable `cloud_storage_jobs` queue: `enqueueCloudStorageJob`, `claimNextCloudStorageJob` (with transactional lease timeouts), `completeCloudStorageJob`, `failCloudStorageJob` (with exponential backoff and dead-letter queueing).
2. `cancelJobsForOrder` implemented and wired to `updateOrderCloudStorageSettingsAction` so toggling proofing OFF cancels any pending preview jobs for the order.
3. Photo schema supports `preview` derivative (`objectKey`, `sizeBytes`, `mimeType`, `width`, `height`, `sha256`) and `processingStatus` (`NOT_REQUIRED` | `PENDING` | `PROCESSING` | `READY` | `FAILED`).
4. Customer access is denied a primary original when the preview is pending or absent. Provisioning a pinned LibRaw worker, derivative commit and retry behavior remains required.


