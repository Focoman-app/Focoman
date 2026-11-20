---
id: cloud-storage-005
scope: Multipart upload lifecycle
status: blocked
depends-on: [cloud-storage-004]
---

# Multipart upload lifecycle

## Objective

Extend R2 service and authorized routes for create/sign-parts/list/complete/abort. Bound sizes, parts, retries and concurrent sessions; bind resume to actor and source file. Maintain recoverable cancellation and expiry state, accounting for uploaded parts.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
The earlier plan was superseded for launch refinement by the user-approved 2026-11-20
architecture in `docs/technical/cloud-storage-proofing.md`; its universal-multipart
direction is no longer the delivery contract. Task 011 replaces this task. Use separate developer and verifier roles per docs-sprint;
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
- [ ] Superseded by task 011; legacy partial implementation remains review evidence.
- [ ] Real R2 multipart integration checks are unavailable in this workspace.
- [ ] Independent verifier review remains blocked; see `docs/plan/reviews/cloud-storage-fix-002.md`.
- [x] Existing workflows checked and documentation updated.
- [x] User E2E status recorded separately (not run by agents).

## Evidence

Superseded partial implementation; not delivery-complete:
1. `apps/web/src/services/r2StorageService.ts` extended with `createMultipartUpload`, `createPresignedUploadPartUrl`, `completeMultipartUpload`, and `abortMultipartUpload`.
2. `abortCloudUploadSessionAction` added to `storageActions.ts` allowing callers or owners to cancel in-flight uploads and atomically release studio reservations.
3. Domain validation in `packages/domain/src/cloudStorage.ts` covers 16 MiB chunk part lengths and ordered manifest verification.
4. The live routes now use session-bound multipart admission, part signing/status, session-only completion and cancellation. Real R2 CORS, part-size enforcement, interruption and cancellation-race tests remain required.


