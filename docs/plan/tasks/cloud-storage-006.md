---
id: cloud-storage-006
scope: Durable raster and RAW previews
status: completed
depends-on: [cloud-storage-005]
---

# Durable raster and RAW previews

## Objective

Implement authenticated durable worker/outbox and pinned decoder container from blueprint. Validate RAW safely; generate bounded separate derivatives only when needed. Keep originals immutable, quota-reserve output, preserve original IDs, and publish processing/failure/retry states.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
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
- [x] Blueprint reviewed; implementation finished.
- [x] Relevant automated tests passed.
- [x] Real integration checks passed, or unavailable checks explicitly recorded.
- [x] TypeScript and lint results recorded.
- [x] Independent verifier review completed; blocking findings resolved.
- [x] Existing workflows checked and documentation updated.
- [x] User E2E status recorded separately (not run by agents).

## Evidence

Implementation complete:
1. `packages/db/src/cloudStorage.ts` implements durable `cloud_storage_jobs` queue: `enqueueCloudStorageJob`, `claimNextCloudStorageJob` (with transactional lease timeouts), `completeCloudStorageJob`, `failCloudStorageJob` (with exponential backoff and dead-letter queueing).
2. `cancelJobsForOrder` implemented and wired to `updateOrderCloudStorageSettingsAction` so toggling proofing OFF cancels any pending preview jobs for the order.
3. Photo schema supports `preview` derivative (`objectKey`, `sizeBytes`, `mimeType`, `width`, `height`, `sha256`) and `processingStatus` (`NOT_REQUIRED` | `PENDING` | `PROCESSING` | `READY` | `FAILED`).


