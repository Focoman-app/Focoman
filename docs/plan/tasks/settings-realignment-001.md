---
id: settings-realignment-001
scope: settings-ui
status: done
depends-on: []
---

# Realign Studio and Account Settings

## Objective

Reorder settings information, remove repeated workspace state, and replace
module-selection controls with read-only plan information and checkout upgrade.

## Context

- `docs/Index.md`
- `docs/plan/analysis/settings-realignment.md`

## Path

- `apps/web/src/app/[studioSlug]/dashboard/settings/page.tsx`
- `docs/plan/**`

## Verification

- Studio sections follow the approved order.
- Account workspace has no duplicate Active Default tag.
- Capability selection/save controls are absent; Checkout link remains.
- All Workspaces is absent from Settings.
