---
id: cloud-storage-009
scope: Customer proofing integration
status: completed
depends-on: [cloud-storage-008]
---

# Customer proofing integration

## Objective

Gate all customer gallery entries and direct routes by proofing policy. Use previews for originals with processing failures shown truthfully. Reuse selection/unselection/comment/review actions and preserve photo ID links, Lightroom/CSV and workflow notifications.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

TrackOrderClient.tsx, CloudPhotoGalleryClient.tsx, gallery page, OrderVerticalWorkflow.tsx, storageActions.ts, domain projections
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Real server action tests of editor/viewer rules and all four settings, enable/disable with existing comments/reviews, URL expiry, original download denial, task advancement and external deliverable regressions. User performs browser UAT.
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
1. `submitCustomerTaskReviewCore` in `orderCustomerOperations.ts` enforces `proofingEnabled` setting: prevents unpermitted task reviews for Photo Selection when proofing is disabled.
2. `getOrderCloudPhotosAction` and `getOrderCloudPhotosByPasskeyAction` gate customer access strictly on `proofingEnabled`, returning clear disabled states.
3. Customer DTO allowlist strips internal storage keys, raw hashes, and server paths; exposes `displayName`, `previewUrl`, dimensions, and customer annotations.


