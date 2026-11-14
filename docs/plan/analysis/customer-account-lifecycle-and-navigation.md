# Customer access, account recovery, and minimal navigation

Status: approved

## Objective

Restore the intentionally retained customer order-claim experience after the
Marketplace removal, make closed accounts recoverable or permanently removable
by an explicit user choice, and remove redundant navigation/copy.

## Existing verified customer behavior

The customer flow was not deleted with Marketplace:

1. `/track/[passkey]` renders guest order tracking.
2. A signed-in Google user can claim an unclaimed order through
   `syncOrderToAccountAction` when their email matches the order customer
   email, or when the passkey authorizes the claim.
3. `getMySyncedOrdersAction` retrieves orders across studios by customer UID
   and matching email.
4. `/track` already renders the signed-in customer's linked orders.

Marketplace commit `f4f8a22` removed Marketplace booking records from Account
Settings; it did not remove the above customer claim path. The workspace
no-membership screen must expose this existing path through `I am a Customer`
and link to `/track`.

## Account lifecycle contract

```text
Close account
  ├─ Standard closure → recoverable 30-day closure
  │    └─ Sign in → Recover account | Permanently start fresh
  └─ Immediate deletion checkbox → explicit irreversible confirmation
       └─ delete active application data and Firebase identity
```

- Standard closure retains recoverable data for 30 days and records sufficient
  closure state to restore the actor's closed sole-owner studios and prior
  memberships.
- A user signing in during the recovery window sees the recovery decision before
  workspace routing. `Recover account` restores the preserved account data.
- `Permanently start fresh` finalizes the recoverable closure, deletes the
  Firebase identity and active application data, and signs the person out. A
  later Google sign-in begins with a new UID and an empty Focoman account.
- Immediate deletion requires the existing typed `delete` confirmation plus a
  separate acknowledgement checkbox. It permanently deletes active data owned
  by the account, including its sole-owner studios and their associated
  application records; co-owned studio data remains and only the actor's
  membership is removed.
- Permanent deletion is irreversible from active systems. The UI must state
  that provider backups follow their normal retention lifecycle and cannot be
  restored for ordinary access.

## Navigation and copy

```text
No studio memberships
  ┌─────────────────────────────────────┐
  │ I run a Studio │ I am a Crew Member  │
  │ I am a Customer → /track             │
  └─────────────────────────────────────┘

Signed-in customer
  /track → access-code form + My Synced Orders
```

- Hide the Workspaces back control when there are no memberships and no pending
  invitations; keep it for an existing workspace/navigation context.
- Remove the redundant standard sign-in legal-consent helper sentence. The
  gated new-account legal view remains unchanged.
- The dashboard account menu displays only the package name: `Free`, `Starter`,
  or `Professional`, with no price in the badge.
- The public landing footer remains minimal: support email, concise
  support/bug/feature-request copy, and `24/7 Support` only.

## Integration enumeration

1. Account settings and studio settings both invoke one lifecycle API with the
   selected closure mode.
2. The sign-in flow queries verified closure state before its ordinary default
   workspace redirect and invokes either recovery or permanent finalization.
3. Permanent finalization deletes user-scoped preferences/consent and Firebase
   identity only after the owner/co-owner data boundary has been enforced.
4. Workspace customer CTA reaches the existing `/track` claim/list flow.
5. Customer tracking keeps passkey access and staff authorization checks.

## State variants

| State | Behavior |
|---|---|
| No closure record | Ordinary sign-in behavior. |
| Recoverable closure active | Show recovery decision; do not redirect. |
| Recovery window expired | Never offer restore; route as a new account after cleanup. |
| Immediate deletion selected | Show irreversible warning and require acknowledgement. |
| No memberships/invitations | No Workspaces back control; show three role choices. |
| Customer without claimed orders | `/track` shows honest empty state and passkey entry. |
