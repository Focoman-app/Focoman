---
id: cloud-storage-003
scope: Storage authorization and private reads
status: completed
depends-on: [cloud-storage-002]
---

# Storage authorization and private reads

## Objective

Reuse assigned-order staff policy; enforce proofing/read/edit/customer email and collaborator permissions server-side. Replace public read URL branch, use customer-safe DTOs, separate original download authorization, enforce owner setting controls, add sensitive-operation audit events.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

apps/web/src/actions/storageActions.ts, apps/web/src/actions/orders/orderAccessHelpers.ts, apps/web/src/services/r2StorageService.ts, storage routes
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Verify owner/assigned/unassigned staff, customer/editor/viewer/passkey, disabled proofing, expired auth, cross-studio IDs and missing originals in customer responses. Preserve intended legacy access while fixing server/UI mismatch.
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
1. Reused `findActiveMemberRecord` and assigned-order staff policy in `authorizePhotoGalleryAccess` to prevent unassigned crew from accessing orders.
2. Replaced public read URL branch in `createPresignedPhotoReadUrl` (`r2StorageService.ts`) with private time-limited presigned URLs (1 hour default, 15 min for downloads).
3. Enforced customer-safe DTOs: customer queries strip original `objectKey` and internal hashes, serving preview URLs only when proofing is enabled.
4. Created `getOriginalPhotoDownloadUrlAction` enforcing staff/owner access and logging audit trail events.
5. Added audit event recording on settings changes (`Cloud Storage Settings Updated`) and deletions (`Proofing Photos Deleted`).
6. Derivative preview object keys are also purged in R2 deletions to avoid dangling objects.


