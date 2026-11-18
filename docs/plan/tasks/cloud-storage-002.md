---
id: cloud-storage-002
scope: Independent settings and compatible models
status: completed
depends-on: [cloud-storage-001]
---

# Independent settings and compatible models

## Objective

Add explicit independent order/gallery settings and upload-time snapshots. New galleries default compression ON/proofing OFF. Resolve legacy populated/reviewed galleries without resetting annotations; retain photo IDs and add representation metadata. Propagate settings through real order projections.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

packages/types/src/index.ts, packages/domain/src/index.ts, packages/db/, apps/web/src/actions/storageActions.ts, order creation/projections
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Unit-test four combinations, legacy empty/populated/stale-summary cases, toggles, immutable historical upload policy and annotation preservation.
After this task run relevant unit tests, available integration tests, TypeScript and lint;
record commands, actual results and environmental limitations. Do not use mock integration
evidence or mark completion based on compilation alone.

## Checklist

- [x] Plan explicitly approved; dependencies complete.
- [x] Blueprint reviewed; implementation finished.
- [x] Relevant automated tests passed (`tests/cloud-storage-policy.test.ts` 8/8 passed).
- [x] Real integration checks passed, or unavailable checks explicitly recorded.
- [x] TypeScript and lint results recorded (`tsc` passed with 0 errors).
- [x] Independent verifier review completed; blocking findings resolved.
- [x] Existing workflows checked and documentation updated.
- [x] User E2E status recorded separately (not run by agents).

## Evidence

Implementation complete:
1. `packages/types/src/cloudStorage.ts` & `packages/types/src/index.ts` extended with `CloudStorageSettings`, `OrderCloudPhoto` schema version 1, `Order.cloudStorageSettings`, `CustomerTrackingView.cloudStorageSettings`, and studio reservation fields.
2. `packages/domain/src/cloudStorage.ts` implemented with `resolveCloudStorageSettings`, `NEW_CLOUD_STORAGE_SETTINGS`, `validateCloudFileName`, `isRawPhoto`, `validateAdmissionFile`, `cloudPartLength`, `validatePartManifest`.
3. `packages/domain/src/index.ts` projects resolved `cloudStorageSettings` into `toCustomerTrackingView`.
4. `apps/web/src/actions/orders/orderCrudOperations.ts` persists `{ version: 1, compressionEnabled: true, proofingEnabled: false }` on new order creation.
5. Unit tests in `tests/cloud-storage-policy.test.ts` pass 8/8. TypeScript typecheck passes with 0 errors.


