---
id: DRIVE-001
scope: Google-hosted preview feasibility and conditional implementation
status: blocked
depends-on: []
---

## Objective
After approval, define Drive file association/access and validate Google-hosted viewing without routing full originals through FocoMan. Add in-app embedding only where real-file user UAT proves it works; otherwise provide an explicit authorized viewer link and explain the limitation.

## Context
`../analysis/minimal-billing-exports-drive.md`, `../../Index.md`, current product entitlements and authorization specifications.

## Path
`apps/web/src/app/track/[passkey]/TrackOrderClient.tsx`, order/deliverable UI/actions and new Drive module chosen in blueprint; affected types/validation/database storage only as necessary.

## Verification
Real permitted files; file/studio ownership, resource keys, revoked/private/unsupported file handling, lazy loading, token confidentiality and entitlement gates. No public-sharing shortcut; user conducts browser UAT. Remove hardcoded gallery examples from the touched flow.

## Delivery record — 2026-11-05

Approved research/cleanup implemented: removed unused fake photo filenames, seeded review and success-without-persistence handler. Corrected tracking copy that promised unavailable gallery/review behaviour, and added a plain media-unavailable notice. Existing role storage/sharing actions are unchanged; no gallery entitlement or Google permission was granted.

The [Drive preview guide](../../technical/drive-preview.md) records official `webViewLink`, resource-key and thumbnail limits, the required authorized data path, and pending user checks. No unused URL helper or unverified iframe was introduced.

Research and cleanup are complete; actual preview integration remains blocked on authorized order/file association and permitted representative files plus user UAT. This is the conditional boundary allowed by the approved plan; it does not block billing/Excel delivery.

Verification: `git diff --check` passed. Source search found none of the removed fake gallery state/handler names. Full web typecheck was attempted with the root TypeScript binary and an isolated-worktree dependency junction; it could not analyze application code because the shared installation lacked TypeScript standard library files (`lib.dom.d.ts`, `lib.dom.iterable.d.ts`, `lib.esnext.d.ts`) and therefore global types. Recheck after dependency installation is stable. No browser or real-file access test has run.
