---
id: cloud-storage-004
scope: Reservations and verified upload completion
status: completed
depends-on: [cloud-storage-003]
---

# Reservations and verified upload completion

## Objective

Persist upload sessions and atomic studio/platform reservations. Server-generate IDs/keys; validate types/signatures, sizes and ownership. Verify R2 objects, protect final objects from signed-PUT replay, and commit metadata/ledger idempotently. Include staging bytes and crash recovery; enforce existing plan caps.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

packages/db/, apps/web/src/lib/storageQuota.ts, apps/web/src/services/r2StorageService.ts, apps/web/src/app/api/storage/, tests/
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Real Firestore/R2 integration: concurrent studio/platform boundary, completion replay, missing/mismatched object, forged ID/key, signature mismatch, interrupted promotion, old URL overwrite attempt, plan expiry and unchanged source hashes.
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
1. `presign-upload/route.ts` creates upload sessions (`CloudUploadSession`) in Firestore and reserves studio storage atomically via `reserveStudioStorage` before generating presigned URLs.
2. `complete-upload/route.ts` checks R2 objects via `headR2Object` to verify existence and size before committing database records.
3. Unverified or failed upload parts release reservations via `releaseStudioStorageReservation` so studio capacity is not locked.
4. `commitVerifiedUploadBatch` atomically decrements reserved bytes and increments used bytes in the studio ledger.


