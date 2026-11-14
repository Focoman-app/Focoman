# Review: authenticated-app-shell-001 re-verification

## Findings

1. **P2 — blocking:** The corrected runtime behavior and the active identity
   architecture document still disagree for a single active membership with no
   saved default. `resolveAndSyncDefaultWorkspace` now correctly returns
   `null` whenever no explicit valid default exists, and `/dashboard` routes
   that state to `/workspaces`. But
   `docs/technical/identity-and-auth-architecture.md` still states that
   **1 Membership** routes directly to `/{studioSlug}/dashboard`, without the
   required configured-default condition. Amend the routing table to express
   the documented contract consistently before delivery.

## Verification

- **No silent selection:** The prior `activeWorkspaces[0]` branch and its
  persistence call have been removed from
  `apps/web/src/lib/workspaceDefaults.ts`. An unset local and server
  preference now returns `null` without mutation.
- **Dashboard fallback:** `apps/web/src/app/dashboard/page.tsx` sends a null
  default to `/workspaces`, satisfying the approved no-default selector state.
- **PWA and shell links:** `apps/web/public/manifest.json` sets `start_url` to
  `/dashboard`; both dashboard logo links point to `/dashboard`; the shared
  desktop/mobile sidebar places `Landing Page` immediately above `Sign Out`
  and it is the component's sole root (`/`) link.
- **Customer redirect:** `apps/web/src/app/sign-in/page.tsx` retains
  `redirectUrl || saved || "/dashboard"`.
- **Out of scope:** The webhook, WhatsApp API-validation, and payment-gateway
  items remain backlog documentation only.
- `git diff --check` passes.

## Conclusion

**blocked** — align the one-membership no-default row in the active identity
architecture document with the implemented and approved routing contract.
