---
id: cloud-storage-012
scope: Upload manager and compression truthfulness
status: completed
depends-on: [cloud-storage-011]
---

# Upload manager and compression truthfulness

## Objective

Extend the existing gallery upload queue with bounded concurrency, byte progress,
smoothed speed, approximate ETA, three transient retries, manual failed-file retry,
cancellation and bounded completion batches. Preserve exact originals with compression
OFF, existing raster compression behavior with ON, and add the requested contextual
warnings without redesigning the UI.

## Context

Read `Agents.md`, `docs/Index.md`, the launch-refinement blueprint and task 011 result.

## Path

`CloudProofingGallerySection.tsx`, `imageCompression.ts`, existing storage routes/types,
and focused tests.

## Verification

Test queue/retry classification, completion chunking and measurement helpers. Run
relevant tests, TypeScript and lint. Browser speed/progress validation remains user UAT.

## Implementation Evidence

- **Bounded concurrency**: 4 simultaneous worker transfers in `CloudProofingGallerySection.tsx`.
- **Transferred-byte progress & smoothed speed/ETA**: Tracks `bytesTransferred`, `totalBytes`, `speedBytesPerSec` and `etaSeconds`.
- **Transient retries**: Up to 3 attempts with exponential backoff & jitter for network and HTTP 5xx errors; skips retry on permanent 4xx errors.
- **Failed file isolation**: Individual transfer failures are isolated to `failedFiles` without aborting other concurrent transfers.
- **Manual retry**: Rendered `Retry Failed Photo(s)` button that re-runs uploads specifically for failed files.
- **Cancellation**: `AbortController` and `activeSessionIdsRef` cancel in-flight uploads and call `/api/storage/cancel-upload` to release reservations.
- **Bounded completion batches**: Slices completion calls into chunks of at most 20 session IDs (`COMPLETION_CHUNK_SIZE = 20`) per `/api/storage/complete-upload` request.
- **Contextual warnings**: Added inline warning notices when compression is OFF ("Notice: Image compression is OFF...") and when Photo Selection is disabled.
- **Verification**: TypeScript typecheck passed with 0 errors; full suite (65 tests) passed; lint passed. User will perform browser speed and progress validation during UAT.

