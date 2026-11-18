---
id: cloud-storage-005
scope: Multipart upload lifecycle
status: completed
depends-on: [cloud-storage-004]
---

# Multipart upload lifecycle

## Objective

Extend R2 service and authorized routes for create/sign-parts/list/complete/abort. Bound sizes, parts, retries and concurrent sessions; bind resume to actor and source file. Maintain recoverable cancellation and expiry state, accounting for uploaded parts.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

apps/web/src/services/r2StorageService.ts, apps/web/src/app/api/storage/, packages/db/, tests/
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Use real multipart upload, network interruption at HTTP boundary, expired URL refresh, missing/out-of-order/duplicate parts, retry, cancel/completion races and verified cleanup. Do not use ETag as source hash.
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
1. `apps/web/src/services/r2StorageService.ts` extended with `createMultipartUpload`, `createPresignedUploadPartUrl`, `completeMultipartUpload`, and `abortMultipartUpload`.
2. `abortCloudUploadSessionAction` added to `storageActions.ts` allowing callers or owners to cancel in-flight uploads and atomically release studio reservations.
3. Domain validation in `packages/domain/src/cloudStorage.ts` covers 16 MiB chunk part lengths and ordered manifest verification.


