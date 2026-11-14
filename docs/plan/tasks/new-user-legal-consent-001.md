---
id: new-user-legal-consent-001
scope: auth-consent
status: done
depends-on: []
---

# Gate new Google users on legal consent

## Objective

Require Terms and Privacy acceptance only for newly created Google identities.
Both documents are initially open and must be scrolled to completion before
the agreement checkbox and submit action can be used.

## Context

- `docs/Index.md`
- `docs/plan/analysis/new-user-legal-consent.md`

## Path

- `apps/web/src/app/sign-in/**`
- `apps/web/src/actions/**`
- `packages/db/src/**`
- `packages/types/src/**`
- `docs/plan/**`

## Verification

- Existing credentials bypass the consent screen in redirect and popup flows.
- New credentials cannot navigate until acceptance persists successfully.
- Both scroll gates and the checkbox are required for submit.
- Consent writes are authenticated server-side and versioned.
