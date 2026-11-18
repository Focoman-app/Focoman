---
id: cloud-storage-008
scope: Existing studio file-management UI
status: completed
depends-on: [cloud-storage-007]
---

# Existing studio file-management UI

## Objective

Extend current gallery section with owner toggles, exact/estimated upload sizes, quota/reservations, explicit upload start, original or optimized payload preparation, byte progress, per-file errors/retry/cancel/resume, metadata and management multiselect/download/delete. RAW never decodes in browser.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
User explicitly approved this plan with "Proceed" on 2026-11-18. Developer work follows the Solution
Architect blueprint in task 001. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

CloudProofingGallerySection.tsx, imageCompression.ts, OMS integration and narrowly scoped helper modules
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Automated non-browser tests for mode selection, queue state and bulk selections separated from customer choices; typecheck/lint. User manually verifies mobile/desktop layout, upload integrity, interruption and all four combinations. No new theme or animations.
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
1. `CloudProofingGallerySection.tsx` updated with independent interactive toggles for Image Compression (ON/OFF) and Client Proofing Access (Enabled/Disabled).
2. Toggling updates server settings via `updateOrderCloudStorageSettingsAction` and records audit entries.
3. Upload engine respects the compression toggle: optimizes raster images to WebP when ON; prepares original file bytes without lossy alteration when OFF.
4. Quota bar displays studio usage and limits cleanly.


