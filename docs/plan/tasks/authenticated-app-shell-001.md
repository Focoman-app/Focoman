---
id: authenticated-app-shell-001
scope: application-navigation
status: done
depends-on: []
---

# Make the signed-in PWA workspace-first

## Objective

Make authenticated Focoman navigation resolve to the default studio dashboard,
while providing an explicit `Landing Page` sidebar link immediately above
`Sign out`.

## Context

- `docs/Index.md`
- `docs/technical/identity-and-auth-architecture.md`
- `docs/plan/analysis/authenticated-app-shell.md`

## Path

- `apps/web/public/manifest.json`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/components/DashboardSidebar.tsx`
- `apps/web/src/lib/workspaceDefaults.ts`
- `docs/technical/identity-and-auth-architecture.md`
- `docs/plan/**`

## Verification

- The manifest opens `/dashboard`.
- Dashboard resolver uses the configured default workspace for one or multiple
  active memberships, with documented workspace-selector states.
- Both dashboard logo instances link to `/dashboard`.
- Desktop sidebar and mobile drawer show `Landing Page` immediately before
  `Sign out`; only this action links to `/`.
- Customer tracking sign-in redirects remain unchanged.
- Run targeted static scans, `git diff --check`, and available type checks.
