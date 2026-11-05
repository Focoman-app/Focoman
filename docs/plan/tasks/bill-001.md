---
id: BILL-001
scope: minimal order invoices and payment receipts
status: pending
depends-on: []
---

## Objective
After plan approval and architect blueprint, implement minimal optional billing profile, issued snapshots and direct PDF/print from real order/payment data.

## Context
`../analysis/minimal-billing-exports-drive.md`, `../../Index.md`, `../../../Agents.md`, product discovery and current identity/security specifications. Pending status includes the user approval gate.

## Path
Existing `packages/types`, `packages/validation`, `packages/domain`, `packages/db`; relevant order/marketplace actions, studio settings and OMS/detail components in `apps/web/src`. Architect chooses new document module paths.

## Verification
Deduplicate payment representations; verify amounts, unique/idempotent document IDs, stable snapshots, Unicode PDF pagination, permissions and empty optional sections. User performs print/browser UAT.
