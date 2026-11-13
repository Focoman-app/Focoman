# Review: oms-workflow-simplification-001

## Findings

1. **P1 — blocking**
   - **Design location:** `docs/plan/analysis/oms-workflow-simplification.md`, Product decisions and Workflow contract.
   - **Code location:** `apps/web/src/components/workflow/OrderVerticalWorkflow.tsx`, `assignedServicesCount` / `preEventCompleted` and the Phase 01 header.
   - For a basic/free studio (`hasErp === false`), `preEventCompleted` still depends on crew assignments. Because the free UI exposes no crew-assignment controls, orders with services remain labelled `Crew Allocation In Progress` and show an allocated-services count that cannot be satisfied from that plan. Treat Phase 01 as ready when ERP is unavailable, and hide crew-allocation language/counts from the free view.

2. **P3 — non-blocking**
   - **Design location:** `docs/plan/analysis/oms-workflow-simplification.md`, Billing boundary.
   - **Code location:** `apps/web/src/components/oms/OmsPaymentSummarySection.tsx`.
   - Invoice/receipt controls are intentionally disabled for all plans while the direct receipt configuration is deferred. This is safe and matches the no-modal decision, but future entitled receipt behavior remains a separately scoped feature.

## Verification

- No `PreflightConflictReport`, preflight domain function, creation/persistence, or OMS pre-flight panel remains in source or tests.
- No workflow date/prerequisite lock UI, `Event Scheduled`, `Event not started`, or `Pending event` user-facing status remains.
- The SLA banner preserves the three-day event reminder and its turnaround metrics.
- Resource-suggestion `Assigned` UI is rendered only under the ERP-gated parent; task assignment UI is ERP-gated.
- Billing modal plumbing is absent from OMS. Receipt/invoice controls remain visible and disabled; the Send Reminder mail glyph is removed.
- Existing `canCompleteOrder` checks remain on both task and payment updates.
- `git diff --check` passes.
- Typecheck has no reported task-specific error, but remains blocked by stale ignored Next route artifacts and unrelated `lucide-react`/Firebase declaration errors.

## Conclusion

**blocked** — the production workflow cleanup is otherwise aligned, but the free-plan Phase 01 crew-allocation state contradicts the approved entitlement boundary and must be corrected before delivery.
