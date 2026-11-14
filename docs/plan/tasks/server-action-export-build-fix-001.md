---
id: server-action-export-build-fix-001
scope: legal-consent-build
status: done
depends-on: []
---

# Fix invalid exports from legal-consent Server Action

## Objective

Remove invalid non-function exports from the legal-consent Server Action module
without changing consent behavior or stored legal version values.

## Context

- `docs/Index.md`
- `docs/plan/analysis/server-action-export-build-fix.md`

## Path

- `apps/web/src/actions/legalConsentActions.ts`
- `docs/plan/**`

## Verification

- The Server Action module exposes only async Server Action functions.
- No consumer depends on exported version constants.
- Consent record versions remain `2026-11-10`.
- Run focused scan, `git diff --check`, and `npm run build --workspace @focoman/web` when available.
