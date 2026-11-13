# OMS Minimal Layout

Status: Approved

## Design Principles

- One OMS title and one studio context source: the dashboard shell owns the
  title and workspace identity; OMS content must not duplicate either.
- The same information architecture applies at every viewport. Responsive CSS
  may reflow controls but must not introduce separate desktop/mobile content.
- Orders are the primary content. Secondary controls start collapsed.

## Overall Structure

```text
Dashboard top bar: Order Management System | user profile
OMS content: pending and open orders
Tabs: Orders (count) | Leads (count)
Actions: Register Confirmed Order | Export Excel
Filters: collapsed by default
Scrollable order or lead list
```

## Region Layout

- Remove the OMS badge, studio-slug badge, and duplicate in-panel title from
  Orders and Leads headers.
- Use only `Orders (n)` and `Leads (n)` tab labels.
- Keep Export Excel in the top action area so it remains reachable on mobile.
- Filters contain search, state, and sort controls. They are hidden until the
  user opens the Filters control.
- Order cards show the customer/order identity, lifecycle status, price, event
  date, and services. Do not render an `ADVANCE RECEIVED` list badge.

## Responsive Behavior

Desktop and mobile use the same regions and labels. Wide screens align actions
horizontally; narrow screens stack or wrap them. The filter content remains
collapsed by default at every width.

## State Variants

- Loading, empty, refresh-error, and selected-order drawer behavior remains
  unchanged.
- A selected order continues to hide the list on narrow screens; this task does
  not alter drawer navigation.

## Component Tree

```text
DashboardTopNav (OMS title)
└─ OMS page
   ├─ OmsOrdersListPanel
   │  ├─ minimal header / tabs / actions / filters
   │  └─ order cards
   └─ OmsLeadsPanel
      └─ matching minimal header / tabs / filters
```
