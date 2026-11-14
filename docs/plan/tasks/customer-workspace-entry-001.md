---
id: customer-workspace-entry-001
scope: customer-navigation
status: done
depends-on: []
---

# Restore the customer entry in Workspaces

## Objective

Restore the `I am a Customer` choice in the zero-workspace state and route it
to the existing `/track` customer page, where a signed-in customer already sees
their linked orders list and can track another order with a passkey.

## Context

- `docs/Index.md`
- `docs/technical/identity-and-auth-architecture.md`
- `docs/plan/analysis/customer-account-lifecycle-and-navigation.md`

## Path

- `apps/web/src/app/workspaces/page.tsx`
- `docs/plan/**`

## Constraints

- Do not change customer Gmail matching, passkey claim, order-query, or
  authorization code.
- Do not introduce a Marketplace route or customer studio membership.

## Verification

- A signed-in user with no studio memberships can choose `I am a Customer`.
- The action routes to `/track`.
- Existing `/track` remains the customer access-code and linked-orders page.
- Run focused scan and `git diff --check`.
