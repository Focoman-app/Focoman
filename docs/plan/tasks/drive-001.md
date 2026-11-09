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

## Blocking condition

Google-hosted links are parsed with exact HTTPS host and resource-key preservation, but actual embedding/access behavior cannot be truthfully marked complete until a permitted representative file is supplied and user UAT verifies private, revoked, unsupported, iPhone, and Android cases.

## Verification
Real permitted files; file/studio ownership, resource keys, revoked/private/unsupported file handling, lazy loading, token confidentiality and entitlement gates. No public-sharing shortcut; user conducts browser UAT. Remove hardcoded gallery examples from the touched flow.
