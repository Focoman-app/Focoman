# Review: pricing-checkout-simplification-001

## Findings

No blocking findings.

- **P3 — non-blocking:** The repository-wide web TypeScript check remains
  unavailable because stale generated Next route declarations reference removed
  Marketplace and studio routes, and pre-existing `lucide-react` and Firebase
  declaration errors remain. These errors are outside this task's modified
  checkout paths; the check reported no checkout simplification error.

## Verification

- **Owner workspace scope:** `CheckoutBuilder` obtains memberships only for
  the authenticated user, renders one native studio dropdown, and filters it
  to `STUDIO_OWNER` memberships with `ACTIVE` status. The selected studio is
  the only studio placed in the checkout URL.
- **Fixed plans and read-only scope:** the only plan options are Free, Starter,
  and Professional. Their feature lists are static `ul` content. There are no
  capability or module checkboxes, bulk-selection controls, capability counts,
  or itemized order-breakdown rows. This satisfies the read-only plan-scope
  requirement in `docs/plan/analysis/pricing-checkout-simplification.md`.
- **Server-owned capability mapping:** the client submits only the selected
  plan ID and studio ID to `selectStudioPlanAction`. The action validates that
  the caller is that studio's owner, validates the plan against the fixed
  allow-list, and resolves `PLAN_CAPABILITIES[plan]` server-side before any
  entitlement update. It accepts no client capability array.
- **Checkout copy and navigation:** focused scans of `CheckoutBuilder.tsx`
  and `checkout/page.tsx` found no user-visible `Pricing Overview`, `₹0`,
  ampersand, or em dash text. The former contextual navigation panel is now a
  single `Back` action.
- `git diff --check` passes.
- `npx tsc --noEmit -p apps/web/tsconfig.json` was run. It fails only on the
  unrelated stale generated route declarations and existing third-party module
  declaration issues described above; it reports no error in the files changed
  for this task.

## Conclusion

**pass** — the implementation meets the fixed per-studio checkout contract.
