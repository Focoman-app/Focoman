---
id: pricing-checkout-simplification-001
scope: checkout
status: done
depends-on: []
---

# Simplify per-studio plan checkout

## Objective

Replace modular capability checkout with fixed per-studio plan selection and
read-only included-feature detail.

## Context

- `docs/Index.md`
- `docs/plan/analysis/pricing-checkout-simplification.md`

## Path

- `apps/web/src/components/public/CheckoutBuilder.tsx`
- `apps/web/src/app/checkout/page.tsx`
- `apps/web/src/actions/**`
- `packages/{config,types}/src/**`
- `docs/plan/**`

## Verification

- Owner can select exactly one workspace and one fixed plan.
- No module/capability selection control or count is rendered.
- Server determines the capability set for the submitted plan.
- All visible checkout copy avoids ampersands and em dashes.
