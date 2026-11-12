---
id: settings-001
scope: settings subscription-plan presentation
status: pending
depends-on: []
---

## Objective

Replace editable module-selection UI in Settings with a read-only current-plan presentation and existing checkout upgrade path.

## Context

- `docs/Index.md`
- `docs/product/major-design-amendment-final-packaging-and-landing-page.md`
- `docs/plan/analysis/billing-and-plan-experience-blueprint.md`

## Path

- `apps/web/src/app/[studioSlug]/dashboard/settings/page.tsx`
- `apps/web/src/actions/studioActions.ts`
- `apps/web/src/lib/proEntitlements.ts`
- `packages/config/src/index.ts`
- `tests/`
- `docs/plan/analysis/billing-and-plan-experience-blueprint.md`

## Verification

- Settings displays resolved plan/capabilities without editable module controls.
- Upgrade action only navigates to checkout and cannot activate entitlement locally.
- Run type/build validation.
