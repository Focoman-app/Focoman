---
id: settings-boundary-simplification-001
scope: settings-navigation
status: done
depends-on: []
---

# Make Studio Settings and Account Settings distinct

## Objective

Keep one global Account Settings page and make dashboard settings
studio-specific only.

## Context

- `docs/Index.md`
- `docs/plan/analysis/settings-boundary-simplification.md`

## Path

- `apps/web/src/app/account-settings/page.tsx`
- `apps/web/src/app/[studioSlug]/dashboard/settings/page.tsx`
- `apps/web/src/components/DashboardSidebar.tsx`
- `apps/web/src/components/DashboardTopNav.tsx`
- `docs/plan/**`

## Verification

- Dashboard sidebar says `Studio Settings` and links to the studio settings
  route.
- The studio settings page has no Account Settings tab or account-closure /
  personal-profile controls.
- Dashboard profile menu links to `/account-settings`.
- Global Account Settings has one Back action and no `My Workspaces` duplicate.
- Run focused route/copy scans, `git diff --check`, and available static checks.
