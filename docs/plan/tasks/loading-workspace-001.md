---
id: loading-workspace-001
scope: database, workspace data loading and tables
status: in-progress
depends-on: []
---

## Objective
Implement the approved workspace loading work in ../analysis/page-loading-performance.md end to end: entitlement-first reads, deferred hidden/form data, efficient server loaders, targeted mutation refresh, database pagination with progressive lists, complete independent summaries and targeted lookups where semantics permit. Cover dashboard, OMS, CRM and ERP. Preserve all recent upstream changes and full search/export/crew availability semantics. Provide explicit legacy compatibility and index rollout details; do not run production migrations.

## Context
Read Agents.md, docs/Index.md, relevant product/technical docs and the analysis blueprint.

## Path
packages/db, related shared types/domain helpers, firestore.indexes.json, migration scripts if needed; apps/web/src/actions; apps/web/src/app/[studioSlug]/dashboard; related workspace components/features/hooks and tests. Do not edit auth/public entry files owned by loading-entry-001. Request any cross-boundary change from orchestrator.

## Verification
Typecheck/build and relevant domain/security/contract tests. Validate real implementation integration statically and through non-browser checks. No mock production data or browser automation. Commit changes before independent review; record exact checks and any missing live evidence.
