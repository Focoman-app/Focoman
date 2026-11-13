---
id: oms-minimal-layout-001
scope: oms-ui
status: done
depends-on: []
---

# Apply the minimal OMS layout

## Objective

Implement the approved shared OMS layout across Orders and Leads without
duplicated titles, workspace names, or tab qualifiers. Make filters collapsed
by default and remove the order-list advance-received badge.

## Context

- `docs/Index.md`
- `docs/plan/analysis/oms-minimal-layout.md`

## Path

- `apps/web/src/components/DashboardTopNav.tsx`
- `apps/web/src/components/oms/OmsOrdersListPanel.tsx`
- `apps/web/src/components/oms/OmsLeadsPanel.tsx`
- `docs/plan/**`

## Verification

- Source review confirms no duplicate OMS/studio header remains in either panel.
- Orders and Leads tabs display only their names and counts.
- Filters default to collapsed without changing filter behavior after opening.
- Order cards have no Advance Received badge and retain lifecycle/payment data.
