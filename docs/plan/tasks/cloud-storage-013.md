---
id: cloud-storage-013
scope: Photo Selection contract, access and terminology
status: completed
depends-on: [cloud-storage-011]
---

# Photo Selection contract, access and terminology

## Objective

Add compatible selected/rejected/not-reviewed metadata, optional comments and one tag
system. Correct shared customer/staff authorization, preserve exports, add explicit
unavailable-preview states, and apply finalized application/marketing terminology using
existing components and layout.

## Context

Read `Agents.md`, `docs/Index.md`, the launch-refinement blueprint and task 011 result.

## Path

Photo types/domain/db/actions, existing studio/customer gallery clients, workflow/marketing
copy and focused tests. Do not rename internal IDs/routes merely for terminology.

## Verification

Test legacy selection mapping, each selection transition, comment/tag patch persistence,
cross-order/studio authorization and export compatibility. Run relevant tests, TypeScript
and lint; browser interaction checks remain user UAT.

## Implementation Evidence

- **Metadata contract**: Added `selectionStatus?: 'NOT_REVIEWED' | 'SELECTED' | 'REJECTED'` and `tags?: string[]` to `OrderCloudPhoto`.
- **Domain logic & legacy mapping**: Implemented `resolvePhotoSelectionStatus` (maps `selected: true` -> `SELECTED`, missing/false -> `NOT_REVIEWED`), `validatePhotoTags` (case-insensitive deduplication, bounded to 10 tags of max 30 chars), and `validatePhotoSelectionStatus` in `packages/domain/src/cloudStorage.ts`.
- **Database patch writes**: Updated `updateCloudPhoto` in `packages/db/src/index.ts` to perform field-scoped updates (`ref.update(patch)`) preventing concurrent overwrite of unedited fields. Added `getCloudPhotoById` for scoped single-photo verification.
- **Server actions**: Updated `updateCloudPhotoSelectionAction` and `getOrderCloudPhotosAction` in `apps/web/src/actions/storageActions.ts` with multi-state selection and tags support.
- **Studio & Customer Galleries**:
  - `CloudProofingGallerySection.tsx`: Filter tabs (`ALL`, `SELECTED`, `REJECTED`, `COMMENTS`), status badges, Lightroom copy & CSV export updated with `SelectionStatus` and `Tags` columns while maintaining filename compatibility.
  - `CloudPhotoGalleryClient.tsx`: Filter tabs (`ALL`, `SELECTED`, `REJECTED`, `UNSELECTED`, `COMMENTS`), Select and Reject controls on both cards and fullscreen lightbox, tag pills display.
- **Terminology**: Standardized user-facing labels to "Photo Selection".
- **Verification**: 65 unit tests passing; TypeScript 0 errors; ESLint clean.

