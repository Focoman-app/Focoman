---
id: loading-entry-001
scope: authentication, navigation, public rendering, timing
status: in-progress
depends-on: []
---

## Objective
Implement the approved entry-flow performance work in ../analysis/page-loading-performance.md. Preserve all consent/recovery/auth checks. Audit the actual latest code, remove redundant forced session/preference work, reuse access within a render where safe, optimize public rendering where justified, and add privacy-safe opt-in timing utilities with a manual measurement guide. Do not claim live speed gains.

## Context
Read Agents.md, docs/Index.md, docs/technical/identity-and-auth-architecture.md, and the analysis blueprint.

## Path
apps/web/src/lib/serverAuth.ts, dashboardAccess.ts, firebaseAuth.ts, workspaceDefaults.ts; public/auth/onboarding/global dashboard routes and components; new performance helpers; related focused tests. Do not edit studio dashboard pages/layout, packages/db, or OMS/CRM/ERP components/actions (owned by loading-workspace-001).

## Verification
Typecheck, appropriate existing tests, source review of all auth callers. No browser automation. Commit implementation before independent review. Record changed paths, executed checks, and any unresolved limitations.
