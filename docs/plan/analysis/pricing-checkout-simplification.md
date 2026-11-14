# Pricing Checkout Simplification

Status: Approved

## Commercial model

Each studio has one independent plan. Selecting a workspace in checkout changes
the studio being configured; it does not apply a plan to multiple studios.

```text
Choose studio → choose fixed plan → review included features → continue
```

## UI contract

- Use one owner-workspace dropdown; remove active-workspace display.
- Plans are Free, Starter (₹999/month), and Professional (₹1,999/month).
- Free is named `Free`; do not repeat ₹0/zero-forever labels.
- Plans have read-only feature lists. No capability/module checkbox or bulk
  selection action exists.
- Summary identifies the selected plan and its included feature scope without
  capability counts or order-breakdown rows.
- Replace visible ampersands with `and` and remove visible em dashes.
- Replace Pricing Overview controls with a simple back action.

## Data contract

The checkout submit path maps the selected fixed plan to its existing canonical
capability set server-side. Clients do not submit arbitrary module selections.
