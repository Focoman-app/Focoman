---
id: billing-002
scope: direct payment receipts and final invoice eligibility
status: pending
depends-on: []
---

## Objective

Replace the generic billing-document workspace entry with direct payment receipts and a final-invoice flow that is only eligible after payment and both delivery confirmations.

## Context

- `docs/Index.md`
- `docs/plan/analysis/billing-and-plan-experience-blueprint.md`
- `docs/plan/analysis/oms-approved-workflow-blueprint.md`

## Path

- `apps/web/src/components/oms/OmsPaymentSummarySection.tsx`
- `apps/web/src/components/billing/OrderBillingPanel.tsx`
- `apps/web/src/actions/billingActions.ts`
- `apps/web/src/app/api/billing/`
- `apps/web/src/utils/invoicePdfGenerator.ts`
- `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx`
- `packages/types/src/`
- `packages/validation/src/`
- `packages/domain/src/`
- `tests/`
- `docs/plan/analysis/billing-and-plan-experience-blueprint.md`

## Verification

- Direct receipt invocation preserves the selected payment source.
- Server rejects ineligible invoice issuance.
- Receipt/invoice PDFs render only durable order/payment/profile data.
- Run affected tests and type/build validation.
