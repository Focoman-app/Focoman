---
id: EXPORT-001
scope: Excel exports for every real business table/report dataset
status: pending
depends-on: [BILL-001]
---

## Objective
Implement shared typed XLSX downloads using the canonical financial calculations and complete authorized filtered data. Cover all live dashboard tables, OMS, CRM, ERP, member work and report datasets identified in the architect coverage map.

## Context
`../analysis/minimal-billing-exports-drive.md`, `../../Index.md`, `../../../Agents.md`.

## Path
`apps/web/src/features/dashboard/*`, relevant studio dashboard pages and their data actions; a new shared export module to be named by the architect. Reuse BILL-001 amount normalization.

## Verification
Read files back; compare full row counts/totals/types/order with requested filters; test literal formula-like input, secret-column exclusion, multi-page results and studio/role isolation. Empty/large exports must behave explicitly.
