# OMS Workflow Simplification

Status: Approved

## Product decisions

- Keep the existing five-phase workflow and the Production Turnaround/SLA
  banner.
- Remove only its duplicate `Event Scheduled` state. The only pre-event
  reminder is `Event upcoming in 3 days` when applicable.
- Do not date-lock post-event production tasks or display user-facing `Locked`
  states. Tasks remain editable according to the studio's entitlement.
- Normalize all pre-event task labels to `Awaiting Event`.
- The `Assigned` badge is visible only when ERP/crew capability is enabled;
  basic/free users do not see it.
- Remove pre-flight operational-check calculation, persistence, and display.
- Preserve automatic order completion: completion requires final delivery tasks
  and full payment. Do not invent a billing email attachment flow; it needs a
  separately defined invoice-delivery contract.
- Keep billing controls visible but disabled when the plan is not entitled.
  Remove the current Billing Documents modal and its free-plan recipient flow.
- Remove the mail glyph from Send Reminder.

## Workflow contract

```text
Awaiting Event
  └─ tasks may be planned/updated; no Locked wording
Post-event production
  └─ task progress continues; crew labels only for entitled studios
Final delivery complete + payment PAID
  └─ existing automatic order completion
```

## Boundaries

- Resource assignments and paid-plan crew controls remain; only basic-plan
  display is simplified.
- Billing records and server-side billing actions are retained. This task
  removes the unsuitable OMS modal surface, not financial history.
- A future ₹999 receipt package may define its own direct receipt configuration
  and automatic invoice-email delivery.
