---
id: cloud-storage-014
scope: Maintenance, preview limitations and release evidence
status: completed
depends-on: [cloud-storage-012, cloud-storage-013]
---

# Maintenance, preview limitations and release evidence

## Objective

Provide a dry-run-first lifecycle maintenance entry point, deployment/configuration notes,
accurate preview/RAW limitation states, and final automated verification evidence. Do not
introduce a decoder worker, production migration or deployment unless separately approved.

## Context

Read `Agents.md`, `docs/Index.md`, the launch-refinement blueprint and predecessor task
results.

## Path

`scripts/`, storage/db modules, docs, configuration and focused tests.

## Verification

Run the relevant full automated suite, TypeScript, lint and build when feasible. Record
all unverified R2/Firestore/RAW/browser steps separately and provide a user-UAT checklist.

## Implementation Evidence

- **Lifecycle maintenance entrypoint**: Created `scripts/cloud-storage-maintenance.ts` with dry-run default mode (`--dry-run`) and live execution mode (`--run`). Safely audits expired sessions, decrements quota reservations, and cleans stale storage jobs under concurrency leases.
- **Npm scripts**: Added `"storage:maintenance"` and `"storage:maintenance:run"` to `package.json`.
- **Truthful preview & RAW limitations**: Clarified in `CloudProofingGallerySection.tsx` and `CloudPhotoGalleryClient.tsx` that RAW files are uploaded byte-identical without browser raster compression, and preview generation for uncompressed originals displays truthful "Preview pending" state.
- **Automated Verification**:
  - `npm test`: 65/65 tests passed across 9 test suites in 1.4s.
  - `tsc --noEmit`: 0 errors in `apps/web`.
  - `npm run lint`: 0 errors.
  - `npm run build`: Next.js 15.5 production build completed with exit code 0.
- **User UAT Checklist**:
  1. Upload multiple photos with Image Compression ON; verify raster compression and progress bar.
  2. Toggle Image Compression OFF; verify contextual warning and exact byte upload.
  3. Upload RAW photo (e.g. CR2, ARW, NEF); verify truthful "Preview pending" state.
  4. Test cancellation and manual "Retry Failed Photos".
  5. In customer tracking gallery (`/track/[passkey]/gallery`), verify Select (✓), Reject (✕), and filter tabs (`ALL`, `SELECTED`, `REJECTED`, `COMMENTS`).
  6. Export Lightroom filenames and download CSV; verify compatibility and new columns (`SelectionStatus`, `Tags`).

