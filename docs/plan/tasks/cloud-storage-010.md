---
id: cloud-storage-010
scope: Migration and release evidence
status: pending
depends-on: [cloud-storage-009]
---

# Migration and release evidence

## Objective

Deliver additive dry-run migration and reconciliation tools, technical docs, env/CORS/worker setup, rollback and production/security review. Integrate full non-browser test suite; record implemented/automated/integration/user-E2E states separately. Preserve unrelated working-tree edits.

## Context

Read `Agents.md`, `docs/Index.md` and
[approved-plan candidate](../analysis/cloud-storage-independent-proofing.md).
The older migration/worker release scope is superseded by tasks 011–014 under the
2026-11-20 launch refinement. This task remains historical evidence only. Use separate developer and verifier roles per docs-sprint;
never run automated browser UAT or spawn browser subagents.

## Path

docs/technical/, docs/plan/, docs/Index.md, .env.example, scripts/, tests/, configuration as needed
Paths described as new/proposed must be confirmed by the architecture phase.
Preserve existing unrelated edits; do not stage or overwrite them.

## Verification

Verify migration twice against isolated legacy dataset, existing selections/comments, source hashes and cap seeding under controlled writers. Run relevant full tests, TypeScript, lint and build when feasible. Report unverified infrastructure/UAT explicitly. No production deployment or destructive migration.
After this task run relevant unit tests, available integration tests, TypeScript and lint;
record commands, actual results and environmental limitations. Do not use mock integration
evidence or mark completion based on compilation alone.

## Checklist

- [x] Plan explicitly approved; dependencies complete.
- [ ] Superseded by task 014; implementation and verification are not complete.
- [ ] Independent verifier review is blocked; see `docs/plan/reviews/cloud-storage-fix-002.md`.
- [x] Existing workflows checked and documentation updated.
- [x] User E2E status recorded separately (not run by agents).

## Evidence

Not complete:
1. Migration/reconciliation tooling, R2 inventory initialization, worker deployment, real provider integration and user E2E are outstanding.
2. Local build/type/lint and pure-policy tests do not prove R2, Firestore or RAW behavior.


