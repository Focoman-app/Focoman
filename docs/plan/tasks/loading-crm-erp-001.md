---
id: loading-crm-erp-001
scope: CRM and ERP loading integration
status: pending
depends-on: [loading-workspace-001 foundation]
---

## Objective
Integrate the approved loading blueprint into CRM/ERP using the verified workspace page APIs. Load customer/member rows progressively, load deleted records and invitations only on demand, retain complete financial totals, workload, substring search and export semantics, and update authoritative mutation results without a whole-module refresh. Explicitly separate any retained full metadata/projection scans from bounded row loading. Do not hide failures with empty lists or zero totals.

## Context
Agents.md, docs/Index.md, docs/plan/analysis/page-loading-performance.md, docs/technical/identity-and-auth-architecture.md.

## Path
apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx; apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx; apps/web/src/actions/customerActions.ts; apps/web/src/actions/memberActions.ts; new CRM/ERP-specific helpers/actions/tests. Shared DB helper changes must be coordinated with workspace developer. Do not edit OMS/dashboard or entry/auth files.

## Verification
Typecheck, targeted contracts and existing tests. Ensure deep-linked records outside first page still open; global search/export and workload totals remain complete; mutation changes refresh related summaries; stale responses cannot overwrite changed studio/filter state. No automated browser UAT. Commit before independent review.
