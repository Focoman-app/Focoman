# OMS Approved Workflow Blueprint

Status: approved

## Objective

Make confirmed-order operations clear, durable, and owner-controlled: a registration must visibly finish before navigation; each booked service can have multiple crew members; payment/receipt/invoice actions must reflect durable Firestore state; and post-event production must describe the actual photography review cycle.

Icons are explicitly out of scope for this delivery.

## Module Decomposition

| Module | Responsibility | Real integration |
| --- | --- | --- |
| OMS page and create-order modal | Registration busy state, busy-date calendar, current-order refresh | `createOrderAction` then `getStudioOrdersAction` |
| Order data contracts | Multiple per-service assignments; payment mode/reference/proof metadata; proof/review linkage | `@focoman/types`, `@focoman/validation` |
| Crew actions | Atomically replace the submitted crew list for one service, with owner authorization and audit entries | `assignResourceCore` / Firestore `orders` |
| Workflow UI | Same searchable assignment control in Phase 1 and individual production tasks; schedule editing and human-readable production state | `OrderVerticalWorkflow` callbacks |
| Task actions | Enforce production prerequisites, update task/order state, write audit history, and invoke only configured real notification channels | `updateTaskStatusCore` |
| Drive/offline reviews | A raw-selection or final-proof task can be sent through a Drive deliverable or confirmed by the owner as an offline handoff; a customer response drives the linked task's review/completion/rework state | `OrderDriveDeliverable`, tracking action, Firestore |
| Payments and billing | Persist payment entries, expose payment mode, and allow final invoice only when paid in full | payment action, billing context/issuance, billing PDF route |
| Billing dialog | Opaque white document panel, issued-document list, PDF download and print | `OrderBillingPanel`, `/api/billing/[documentId]/pdf` |

## Data and Authorization Contract

### Crew assignments

- One service may contain zero or more distinct `ResourceAssignment` records. Assignment identity is `(normalized service name, memberId)`; the same person cannot be added twice to the same service.
- Saving the Phase 1 list replaces only that service's assignments, not assignments for other services.
- A Studio Owner is required. Temporary crew remain supported and are persisted to the studio exactly as today.
- Existing orders with one assignment remain valid and render as one selected member.

### Task/review relationship

- A Drive deliverable gains an optional linked task identifier and review purpose (`PHOTO_SELECTION` or `FINAL_PROOF`). The link is explicit; an arbitrary Drive item must never change a task.
- An offline handoff is recorded against the linked task with the owner as actor and an audit entry. It does not invent a Drive URL.
- Customer/customer-editor review authorization remains restricted to the order's primary customer, a permitted editor collaborator, or active studio staff. A customer response can only update the explicitly linked task.

### Payments and billing

- Each installment records the payment method (`CASH`, `UPI`, or `BANK_TRANSFER`) and optional UPI reference and proof metadata. A UPI proof is optional; there is no fictional acknowledgement workflow for cash.
- “Add payment” is not a save operation. The screen must call it **Add to unsaved payments** and retain a prominent **Save payments** action; only server success changes persisted totals. Errors retain the draft and name the failure.
- Receipt issuance is available for each recorded payment. A Final Invoice is disabled until durable payments equal the confirmed order value and the payment status is `PAID`.
- Issued documents are immutable. They remain downloadable/printable and a correction uses the existing void-and-reissue path.

## Production State Contract

The existing persisted task statuses remain `AWAITING_EVENT → ASSIGNED → IN_PROGRESS → REVIEW → (REWORK | COMPLETED)`. Labels are task-specific so status does not falsely imply a customer action.

| Milestone | Before event | Working / pending state | Owner / customer transition | Result |
| --- | --- | --- | --- | --- |
| RAW Photo Selection | `Awaiting Event — shoot not started` | `Preparing photo selection — collecting and processing RAW files` | Owner shares Drive proof or records offline handoff | `Pending with customer` (`REVIEW`) |
| Customer selection | N/A | `Pending with customer` | Customer approves/selects in the portal, or owner confirms offline selection received | RAW selection becomes `COMPLETED`; editing is unlocked |
| Photo editing | Locked until RAW selection complete | `Editing in progress` | Editor submits proof for review | `Pending with customer` (`REVIEW`) |
| Final-proof response | N/A | `Pending with customer` | Customer approves or requests corrections | Approval completes linked task; corrections move it to `REWORK` with feedback; resubmission returns to `REVIEW` |

The task state machine rejects an invalid server-side transition (for example, editing before photo selection completes or an unlinked deliverable attempting to complete a task). The UI is only a representation of this rule.

## Notification Contract

- The existing email and WhatsApp template systems are the only notification paths used. No mock sending, fabricated success state, or client-only notification log is allowed.
- This delivery prepares task-specific templates for: proof ready for selection, offline selection recorded, customer selection completed, editing proof ready, corrections requested, and editing task assigned.
- Dispatch uses a configured real channel. If the messaging gateway is not configured, the existing click-to-chat/logged behavior is labeled as such; it is not presented as a sent WhatsApp message.
- Owner/member notifications occur after a real customer selection or rework submission; customer notifications occur only after an owner/staff explicitly sends a linked proof for review.

## Layout Contract

### Registration

```text
┌──────────────── Confirmed order dialog ────────────────┐
│ Form fields + availability month calendar               │
│  busy dates: highlighted, still selectable              │
│                                                         │
│ [Register confirmed order]                              │
└─────────────────────────────────────────────────────────┘
              │ submit
              ▼
┌──────────── opaque busy layer ──────────────────────────┐
│ Registering confirmed order…                             │
│ Saving order and preparing the OMS workflow              │
└─────────────────────────────────────────────────────────┘
              │ durable success + refreshed list
              ▼
        modal closes; created order opens
```

### Crew and production task row

```text
Service / task title                         [status badge]
Selected crew: [Anu ×] [Ravi ×]
Add a member [search existing crew or type a name] [Add]
                                                    [Save crew assignments]

RAW Photo Selection             [Preparing photo selection]
Crew: [select/search crew]      [Start] [Send for review]
```

Dropdowns render above the panel clipping boundary and close on outside click/Escape. On narrow screens, they fit the viewport rather than extending below it.

### Billing dialog

```text
darkened OMS backdrop
┌────────────── opaque white billing panel ───────────────┐
│ Billing documents                                  Close │
│ Receipts: [Issue] → issued history [Download PDF] [Print]│
│ Final invoice: [disabled until paid in full]             │
└─────────────────────────────────────────────────────────┘
```

## State Variants

| Area | Loading/busy | Error | Empty/constrained |
| --- | --- | --- | --- |
| Order registration | Blocking progress layer; form preserved on error | Explicit server/action error in modal | No prior orders means no highlighted calendar dates |
| Crew save | Per-section saving state | Keep staged chips and show action error | `No crew found`; typed temporary name remains an explicit choice |
| Review delivery | Saved/dispatching feedback | Do not advance linked task or claim customer delivery | Offline flow offers confirmation, Drive flow requires an explicit linked deliverable |
| Payment save | Disable save, identify persistence state | Restore persisted view and retain unsaved draft | No installments shows add-payment action |
| Billing panel | Loads real billing context | Explicit unavailable/authorization response | No issued documents shows empty state; never transparent |

## Verification Contract

- Type/build verification must cover all changed contracts.
- Backend tests must prove authorization, per-service multiple assignment persistence, invalid task transitions, linked review effects, and final-invoice gating.
- UI-level checks cover no missing Tailwind token, registration busy/success/error transitions, non-clipped dropdown placement logic, and billing action availability.
- Automated browser UAT is prohibited by repository governance; the user will perform manual browser validation.
