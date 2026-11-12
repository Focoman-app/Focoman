# OMS Entitlement, Responsibility, and Mobile UX Blueprint

Status: approved

## Objective

Keep OMS core workflow usable on the Free plan without exposing ERP crew operations, make the next responsible party explicit for every workflow task, and remove registration/list layout ambiguity on mobile.

## Product Rules

| Area | Free (₹0) | ERP-enabled paid tier (₹999 or above) |
| --- | --- | --- |
| OMS order registration and task workflow | Available | Available |
| Studio members, crew search, temporary crew, resource suggestions | Not available | Available |
| Service/task crew assignment | Not available | Available |
| Initial studio-owned workflow work | Assigned to Studio Owner | Assigned to selected crew or Studio Owner under existing assignment flow |
| Customer selection/proof response | Customer action through the existing secure tracking flow | Same |

The entitlement source of truth is the server-side `STUDIO_ERP` capability, not a client-side visual flag. A Free studio must not create or change a crew assignment through direct action calls.

## Responsibility Model

Task status remains the existing persisted state machine. `nextActionOwner` is a derived presentation value, not a fabricated crew/customer assignment record.

| Task condition | Next action owner | OMS and tracking text |
| --- | --- | --- |
| `AWAITING_EVENT`, `ASSIGNED`, `IN_PROGRESS`, or `REWORK` | Studio | `Next action: Studio` |
| `REVIEW` after a linked proof/selection is sent | Customer | `Next action: Customer` |
| `COMPLETED` | None | `Completed` |

Examples: RAW Photo Selection is Studio-owned while preparing; it becomes Customer-owned when in review. Photo Editing is Studio-owned while editing; it becomes Customer-owned when its proof is in review. This applies to every task shown in OMS and the passkey tracking page.

## Ownership and Integration Flow

```text
Studio plan + selected capabilities
       │
       ├─ server entitlement gate ──► crew mutation actions
       │                                │
       │                                └─ reject Free requests
       │
       └─ OMS feature state ──► workflow UI controls
                                  │
Confirmed order creation ─────────┴─► new tasks
                                        │
        Free: Studio Owner assigned ───┤
        ERP: current assignment flow ──┘
                                        │
Task status + linked review state ──► derived next-action owner
                                        ├─ OMS selected-order workflow
                                        └─ customer tracking workflow
```

## Registration and List UX

```text
Package / Combo (optional)
├─ published package exists: enabled selector → selecting it selects its services
└─ no published package: disabled "No packages configured" selector
                          helper: "No packages configured. Manage catalog to add one."

Submit → rotating FocoMan logo busy state → durable save success
                                      │
                                      ▼
                              order list: Refreshing orders…
                                      │
                                      ▼
                           refreshed list including the new order
```

The package selector is optional in every state. The old right-aligned `Manage Catalog` link is removed.

## Responsive Layout

```text
Mobile OMS header
┌────────────────────────────────────┐
│ Orders | Leads                      │
│ [ Search                              ] │
│ [ All stages ] [ Earliest date ]    │
│ (controls wrap rather than overflow)│
└────────────────────────────────────┘
```

On narrow widths, filter controls have a minimum-safe width and may wrap to a second row. No horizontal overflow is permitted. Desktop layout remains unchanged.

## State Variants

| Region | Busy / empty / error behavior |
| --- | --- |
| Registration | Rotating FocoMan mark is used in the submit button and blocking dialog state. Validation/action errors keep the form data. |
| Package field | No active package produces a disabled optional selector and helper text; it does not block registration. |
| Order list refresh | After save success, old rows are replaced by a truthful `Refreshing orders…` state. Success shows the fetched list including the saved order; failure shows an explicit refresh failure and retains/recoverably restores known data. |
| Free workflow | No crew UI or temporary crew affordance. Studio/customer responsibility badge remains visible. |
| ERP workflow | Existing crew controls remain subject to owner authorization and server capability check. |

## Verification Contract

- Type/build validation covers all touched modules.
- Backend tests prove `STUDIO_ERP` is required for every crew mutation and Free order creation assigns studio-owned tasks to the owner.
- Component tests or deterministic render checks prove the Free/ERP responsibility labels and the mobile filter containment rules.
- Automated browser UAT is excluded; the user performs it.
