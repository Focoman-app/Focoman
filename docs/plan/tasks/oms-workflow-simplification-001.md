---
id: oms-workflow-simplification-001
scope: oms-workflow
status: done
depends-on: []
---

# Simplify OMS production workflow

## Objective

Remove pre-flight checks and user-facing task locks; normalize pre-event task
status; conditionally show crew assignment; simplify billing and reminder UI;
keep only the three-day event reminder in the existing SLA banner.

## Context

- `docs/Index.md`
- `docs/plan/analysis/oms-workflow-simplification.md`

## Path

- `apps/web/src/components/workflow/OrderVerticalWorkflow.tsx`
- `apps/web/src/components/oms/OmsOrderSubsections.tsx`
- `apps/web/src/components/oms/OmsPaymentSummarySection.tsx`
- `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`
- `apps/web/src/actions/orders/**`
- `apps/web/src/actions/leadActions.ts`
- `packages/{domain,types}/src/**`
- `docs/plan/**`

## Verification

- No pre-flight report is created or rendered.
- No visible Locked/Event Scheduled/Event not started/Pending event status
  remains in the workflow; `Awaiting Event` is used consistently.
- Assigned badge only renders for ERP-entitled studios.
- Billing controls are disabled rather than hidden for ineligible plans; no
  Billing Documents modal is reachable from OMS.
- Existing completion condition stays final delivery plus fully paid.
