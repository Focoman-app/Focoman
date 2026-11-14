# Review: authenticated-app-shell-001

## Findings

1. **P2 — blocking:** The no-default-workspace routing contract is not
   implemented. `docs/plan/analysis/authenticated-app-shell.md` and
   `docs/technical/identity-and-auth-architecture.md` require a user with
   active memberships but no configured default to reach `/workspaces`.
   However, `apps/web/src/app/dashboard/page.tsx` calls
   `resolveAndSyncDefaultWorkspace`, whose documented and implemented fourth
   rule in `apps/web/src/lib/workspaceDefaults.ts` automatically chooses and
   persists the first active workspace. Therefore `/dashboard` never reaches
   the documented workspace-selector state for an unset default. Either the
   resolver must distinguish an unset default and route to `/workspaces`, or
   the approved routing contract must explicitly authorize automatic default
   selection before delivery.

## Verification

- `apps/web/public/manifest.json` parses and sets `start_url` to `/dashboard`.
- Both the desktop and mobile dashboard-logo links in
  `apps/web/src/components/DashboardSidebar.tsx` point to `/dashboard`.
- The shared sidebar bottom region places `Landing Page` immediately before
  `Sign Out`; it is the sole `href="/"` in that component and therefore covers
  desktop and the mobile drawer.
- `apps/web/src/app/sign-in/page.tsx` retains `redirectUrl || saved ||
  "/dashboard"`, preserving customer tracking redirect priority.
- The Leads webhook, WhatsApp API validation, and payment gateway entries are
  recorded as deferred backlog items only; no implementation was added.
- `git diff --check` passes.

## Conclusion

**blocked** — correct the no-default-workspace routing mismatch before marking
this task complete.
