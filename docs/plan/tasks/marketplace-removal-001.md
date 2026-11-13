---
id: marketplace-removal-001
scope: marketplace-removal
status: blocked
depends-on: []
---

# Permanently remove Studio Marketplace

## Objective

Remove Studio Marketplace code and references while preserving the private
Services package catalog and OMS direct-order workflow. Provide a server-side
audit/purge mechanism for approved legacy data, without fabricating a purge
result when credentials are unavailable.

## Context

- `docs/Index.md`
- `docs/product/product-discovery-document.md`
- `docs/plan/analysis/marketplace-removal.md`

## Path

- `apps/web/src/**`
- `packages/{config,db,types,validation}/src/**`
- `docs/**`
- `tests/**`
- `scripts/**`

## Verification

- Repository reference scan is clean for removed concepts.
- Lint, typecheck, and tests run when dependencies are installed.
- Data audit/purge command reports real counts or a truthful credentials error.

## Verification blocker

This checkout has no installed application dependencies and no Firebase server
credentials. `npm run audit:marketplace-data`, lint, typecheck, and the full
test suite cannot complete until those prerequisites are supplied. The audit
and purge script intentionally performs no data access when they are absent.
