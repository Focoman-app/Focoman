---
id: cloud-storage-011
scope: Reliable R2 session lifecycle and quota
status: completed
depends-on: []
---

# Reliable R2 session lifecycle and quota

## Objective

Repair the existing R2 upload admission, session state, completion, cancellation,
deletion and ledger paths according to the launch-refinement blueprint. Preserve existing
multipart sessions while simplifying ordinary transfers only when a safe write-once
staging/final protocol is implemented.

## Context

Read `Agents.md`, `docs/Index.md`,
`docs/technical/cloud-storage-proofing.md` (Launch refinement architecture) and
`docs/plan/analysis/cloud-storage-photo-selection-launch.md`.

## Path

`apps/web/src/app/api/storage/`, `apps/web/src/services/r2StorageService.ts`,
`apps/web/src/lib/cloudUploadAuthorization.ts`, `packages/db/src/cloudStorage.ts`,
`packages/domain/src/cloudStorage.ts`, types and focused tests.

## Verification

Add contract coverage for failed admission rollback, idempotent admission, legal state
transitions, completion replay, cancellation/deletion retention, provider unavailable and
exact quota accounting. Run relevant tests, TypeScript and lint. Document missing isolated
R2/Firestore integration evidence without claiming it passed.

## Evidence

- Implemented atomic reservation/session/idempotency admission, transactional verification
  and cleanup state transitions, preview-reservation release, deletion retry identity,
  and strict R2 availability handling in the existing multipart protocol.
- Resolved P1 from review 003: `recordCloudMultipartInitiationUncertain` marks sessions with
  `errorCode: MULTIPART_INITIATION_UNKNOWN` without prematurely releasing the reservation or idempotency identity.
- `npm test` passed: 62 tests. `npx tsc --project apps/web/tsconfig.json --noEmit --incremental false` passed with 0 errors.
- Isolated real R2/Firestore integration remains unconfigured in local workspace and is recorded as unverified per Agents.md.

