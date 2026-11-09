---
id: INTEGRATION-002
scope: reviewed Gemini regressions and remaining operational gaps
status: ready
depends-on: [BILL-001, EXPORT-001, DRIVE-001]
---

## Objective

Complete the remaining feasible operational work identified in the approved rebase/completion review. Preserve Gemini's useful UI/refactors while restoring prior implemented PWA/email behavior and closing verified security/data-integrity defects.

## Context

Read `../../../Agents.md`, `../../Index.md`, `../analysis/rebase-completion-2026-11-09.md`, and the three `../../action-items/` audit documents. User approved completion on 2026-11-09 and explicitly requested rebase without creating branches. Work serially in current branch. No browser automation, external dispatch tests, production data writes, push or deploy.

## Technical blueprint

1. WhatsApp preview: authenticate owner before loading studio/order; exact studio match; actual order required for customer preview; no demo personal/payment/passkey values. Webhook: raw-body HMAC SHA256 with configured Meta secret before parsing; missing secret fails closed; no default verification token. Test malformed/unsigned/tampered payload rejection and scoped access.
2. Marketplace confirmation: atomically verify payment + booking studio/state, allocate one canonical order/customer/tasks and link booking/payment. Concurrent retries return existing result. A rejected payment cannot independently reconfirm a confirmed order. Owner-recorded offline advance must be explicit amount/date/method/reference; no payment invention. Never sum marketplace verification records again over order advances.
3. Reports: use canonical amounts and same noncancelled filtered orders across KPI/category/chart/workbook. Add monthly/yearly comparisons and production metrics only from real timestamps/SLA data; unavailable historical completion times remain unavailable, never inferred from mutable updatedAt.
4. Plan enforcement: reconcile the newer three-tier audit with actual runtime routes/actions while preserving historical data. No client-controlled plan upgrade grants paid capabilities without authoritative entitlement. Free users retain core OMS; eligible trials and existing lifetime owners retain approved access. Distinguish module visibility from server authorization.
5. Restore PWA offline fallback/registration compatible with Gemini's current icons/widget. Do not cache authenticated HTML, billing PDFs, API responses or Server Action payloads. Preserve current icon styling and prevent false install-success claims.
6. Restore approved dual-provider email routing and owner notifications lost in the remote diff using `b298cdc` as historical reference. Preserve new Gemini payment/billing behavior; replace obsolete development origin fallbacks with configured/canonical origin. No actual emails sent during verification.
7. Remaining WhatsApp event/reminder/workflow automation requires authenticated sender mapping, explicit entitlement, trigger toggles, deduplication and shared domain transition guards. Provider credentials/templates and scheduler deployment are external gates. Do not introduce permissive phone-suffix identity shortcuts or fake send success.
8. Marketplace package editing/negotiation parity and CRM/ERP audit items can follow their existing specifications. Auto-assignment follows system-suggests/owner-confirms rules in the authoritative product docs; do not silently assign crew from a new heuristic.

## Path

WhatsApp actions/service/webhook; marketplace actions/UI and transaction repository; reporting; entitlement helpers/routes; PWA registration/offline resources; email service and notification call sites; relevant types/validation and focused tests. Developer must coordinate shared billing/domain files after predecessor handoff.

## Verification

Meaningful contract/security tests, typecheck, production build and full test suite. Inspect all remote changes versus `b298cdc`, not just the latest commit. Record every completed and remaining audit ID. Manual mobile/Drive/print UAT and provider-backed tests remain explicit external checks. No universal completion claim from passing compilation alone.
