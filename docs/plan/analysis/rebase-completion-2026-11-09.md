# Rebase and completion guide

Date: 2026-11-09. User approved completion with rebase and explicitly prohibited creating another branch. This guide supplements the approved billing/export/Drive blueprint after inspecting Gemini's actual fetched implementation.

## Baseline and preservation

Current branch `task/bill-001` was rebased onto `origin/main` at `46e4fd9`; the local planning commit is now `d2dfec2`. Original uncommitted billing work remains recoverable in the named Git stash. No new branch is required. Existing `main` and the old Drive worktree are preserved; their presence does not indicate newly created work.

Remote code already contains a minimal billing modal, a handwritten PDF generator, an XLSX writer, persisted Drive deliverable links, and refactored order operations. The earlier stale-tree assessment must not be used as the completion baseline. Preserve useful implementation and repair verified contract defects.

## Technical decisions

- Preserve Gemini's extracted session-security helpers: they reject synthetic cookies, require active undeleted memberships, and restrict ownership recovery to verified identity. Do not restore earlier bypasses.
- Keep Gemini's `Studio.billingProfile` contract compatible. Immutable issuance may use a separate `issuedBillingProfile`, reading existing profile defaults where no new profile exists. Issued document contents remain immutable.
- Route billing issuance/download through owner-authorized server snapshots. Reuse the existing billing entry points. Customer previews must not become owner issuance endpoints or claim mutable live calculations are issued documents.
- Use one monetary calculation based on recorded advances/installments; a payment status alone never creates money, a receipt, or a date. Preserve overpayments explicitly.
- Replace ASCII-only PDF output for issued documents with bundled-font rendering, validating Tamil and long content. No arbitrary server fetching of logos.
- Existing XLSX code may be retained where tested against the approved contract, rather than introducing ExcelJS solely to replace a functioning implementation. Dates, numeric precision, literal hostile strings, complete filtered rows, unique sheet names, bounds, and excluded secrets remain mandatory.
- Drive parsing requires HTTPS, exact Google hosts, safe IDs and resource-key preservation. Existing authorized association/review paths are reviewed. Embedding success remains conditional on user testing with permitted real files.
- Broader audit items are tracked separately from these four delivery tasks. Implement verified missing behaviors under the existing product specifications; external configuration, actual dispatch, production migrations, and browser UAT cannot be marked complete by source inspection.

## User interface contract

```text
Existing order billing entry
  -> profile defaults / payment selection / truthful missing-date confirmation
  -> Issue snapshot -> Download PDF / Print
  -> Issued history -> redownload / explicit void and replacement

Existing table export
  -> all matching authorized rows -> typed workbook or explicit error

Existing deliverable
  -> on-demand Google preview + Open in Google Drive
  -> permission/unsupported state remains Google's decision
```

All controls retain current application styling, readable busy/error/empty states and mobile wrapping. Issuance is an explicit user action. No automatic browser UAT.

## Verification and scope accounting

Developer records exact tests, typecheck/build outcomes and unmet contracts. A separate verifier reviews final code and records blocking findings. Full test execution must include existing dev-portal tests, which remote `npm test` omitted. Generated build caches are disposable, but user source and local credentials are preserved. No push or deployment is included.

Task statuses distinguish implemented source, verified output and externally pending UAT. The broader `docs/action-items` inventory remains authoritative for reporting unfinished items; do not label all app work complete merely because a build passes.
