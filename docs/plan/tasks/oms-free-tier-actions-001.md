---
id: oms-free-tier-actions-001
scope: oms-entitlements
status: done
depends-on: []
---

# Gate OMS Leads and Export by capability

## Objective

Hide Leads and Export Excel from Free OMS while preserving Filters and direct
order management. Render the tab switcher only for CRM-entitled studios.

## Context

- `docs/Index.md`
- `docs/plan/analysis/oms-free-tier-actions.md`

## Path

- `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`
- `apps/web/src/components/oms/OmsOrdersListPanel.tsx`
- `apps/web/src/components/oms/OmsLeadsPanel.tsx`
- `docs/plan/**`

## Verification

- Free OMS has no Leads tab, singleton Orders tab, or Export action.
- CRM enables Leads and Reports enables Export independently.
- Filters remain accessible in every plan.
