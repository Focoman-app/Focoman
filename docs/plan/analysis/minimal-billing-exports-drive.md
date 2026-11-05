# Minimal billing documents, Excel exports and Drive previews

Date: 2026-11-05. Status: explicitly approved by the user on 2026-11-05. This document is the Program Manager plan; implementation and verification are tracked separately.

## User outcome

Solo photographers and studios can issue plain invoices and payment receipts with minimal entry, download real PDF files or print, and export business tables/reports as real Excel workbooks. Controls use existing application styles and Lucide/SVG icons, without emoji or decorative document templates. Explore a Drive-hosted preview path that avoids serving original media through the application server.

## Inspected baseline

- `apps/web/src/features/dashboard/BusinessReportsView.tsx` has a Print Report button calling `window.print()`; no Excel implementation was found in the inspected source/dependencies.
- Live HTML tables occur in DashboardOverviewView (two), DashboardHomeView (one), BusinessReportsView (one). CRM, ERP, OMS and MemberWorkDashboardView also expose business lists/cards requiring export coverage. Marketing tables in RetroHeroVisual are illustrations, not exportable business records.
- Order/OrderPricing/OrderInstallment and Studio/Customer types exist in `packages/types/src/index.ts`; studio has name, optional logo/contact fields, but no billing-document snapshot model.
- `orderActions.ts` maintains advances/installments. `marketplaceActions.ts` records and verifies PaymentRecord entries persisted by `packages/db/src/index.ts`. A verified marketplace payment can become an order advance: summing both representations would double-count it.
- Tracking UI `apps/web/src/app/track/[passkey]/TrackOrderClient.tsx` contains hardcoded photo names and review text. No operational Drive OAuth/file-listing integration was found in the inspected source. Those entries cannot become real gallery/export data.
- Existing app dependencies include lucide-react and zod; no PDF or XLSX library is declared in apps/web/package.json. Library selection/version/security review belongs to the architect stage.

## Proposed behaviour

### Billing documents

Scope: studio-to-customer order documents, not FocoMan's own subscription billing. Prefill from the selected order and studio.

Required invoice information: issuer display name (individual name accepted), customer name, meaningful service description, confirmed charge amount and currency. Generate a stable document number and issue date. Prefill order reference. If only an aggregate order price exists, use one aggregate service line; do not fabricate per-service prices.

Required receipt information: issuer, customer, order reference, actual recorded payment amount and payment date; generate a stable receipt number. Support separate advance and installment receipts. Do not infer receipt evidence solely from PAID status. Require confirmation of missing historical payment facts rather than inventing a date/method.

Optional business information: logo, address, phone, email, website, payment reference, bank/UPI details, notes, signature, due date and payment method where not recorded. Omit empty sections entirely. Registered-business details are not required to use the basic non-tax workflow. Tax invoices are a separate conditional mode: do not label a document as a compliant tax invoice merely because a GST field is supplied; mandatory tax information must be designed/validated if that mode is introduced.

Document: plain white page, readable dark text, small optional logo, compact lines/totals, no ornamental graphics. Provide direct Download PDF and Print actions; a print dialog's Save as PDF is not a substitute for direct PDF download. Support long content, page breaks, Tamil/Unicode text and currency formatting. UI controls match the current application theme.

Issue documents as server-authorized snapshots with stable per-studio identifiers, recording source order/payment and issuer. Re-download must preserve issued figures when profiles/orders later change. Repeated clicks must not create duplicate receipts/numbers. Define explicit correction/void behaviour in the blueprint; do not silently overwrite issued documents.

### Excel exports

Provide `.xlsx` files, not CSV renamed as Excel. Export current filtered/sorted results across all matching pages, not only visible DOM rows. Show scope and row count. Include typed numbers/dates/currency, readable headers, sensible widths, a frozen header and filters. Write user-controlled text as strings, never executable formulas; preserve phone numbers/IDs and Unicode.

Coverage inventory: dashboard summary/order tables, OMS order and installment/payment lists, CRM customers and customer-order histories, ERP crew/workload lists, member-visible task/order lists, and report datasets (monthly revenue, service/category breakdowns, outstanding balances). Include archived/deleted records only when explicitly selected by the existing view. Confirm all actual UI datasets during the architect inventory; no business table is silently excluded because it uses cards/divs rather than `<table>`.

Exports must use the same filters and financial calculations as the UI, exclude action columns, credentials, PINs, passkeys, invite tokens and hidden unauthorized fields. Server checks enforce studio membership/role for complete datasets. Large exports need bounded fetching and a truthful limit/error message, never a silently truncated workbook. Report workbooks can contain one sheet per real dataset.

### Google Drive feasibility and conditional delivery

Preferred first path: Google-hosted viewer access, with previews loaded only when requested. File bytes then travel from Google to the viewer instead of being downloaded/re-rendered by the FocoMan server. This reduces FocoMan transfer/processing, not the viewer's data usage to zero.

Official API offers `webViewLink` for the Google viewer. An in-app iframe preview is a feasibility candidate, not a universally guaranteed API contract: validate supported media, authentication, embedding restrictions and iPhone/Android behaviour through user UAT. Where embedding is unavailable, explicitly offer Open in Google Drive rather than showing a false success.

Drive permissions remain authoritative. A FocoMan tracking link does not grant Drive access. Preserve existing sharing, resource keys and file IDs; do not make private media public or expose owner tokens. If private files must be visible to clients without Google sign-in, a scoped OAuth/access design and likely controlled thumbnail/media delivery are needed; document the remaining bandwidth cost instead of promising a zero-server solution.

`thumbnailLink` is short-lived, may require credentialed requests for private files, and Google warns against direct web-app usage due to CORS. Do not persist it as a permanent public CDN URL. Lazy metadata/thumbnail fetching may help; authenticated thumbnails may still need a bounded proxy. Do not add an unspecified external viewer service or transmit private media to one without identifying its provider and access/cost terms.

Gate: real supplied accessible and restricted Drive files plus user browser UAT establish feasibility. If no permitted representative files are available, finish the research and mark preview implementation blocked on those inputs; billing/Excel work can continue. Replace touched hardcoded gallery examples with truthful disconnected/empty/error states. Keep any existing plan entitlements intact.

## Modules and integration chains

| Task | Module and output | Integration chain |
| --- | --- | --- |
| BILL-001 | Billing profile, document snapshot, amounts, PDF/print | Order/payment → authorized normalized amounts → issued snapshot → PDF/print; Settings → optional issuer profile |
| EXPORT-001 | Shared workbook builder and full coverage | View filters → authorized matching dataset → canonical calculations → typed XLSX download; reports → sheets |
| DRIVE-001 | Viewer feasibility and permitted preview path | Authorized order/file association → validated Drive file metadata/permissions → on-demand viewer or explicit link; tracking UI → truthful states |
| DELIVERY-001 | Integration verification and documentation | Real role/source boundaries → outputs; user browser/print/Drive UAT → release readiness |

Suggested order: approve plan → architect blueprint/coverage map → BILL-001 and EXPORT-001 → DRIVE-001 feasibility/conditional implementation → DELIVERY-001. No deployment or external account/sharing changes are authorized by this planning document.

Minimal UI placement:

```text
Order details   [Invoice PDF] [Print]
Payment row     [Receipt PDF] [Print]
Table header    Search / existing filters       [Export Excel]
Deliverable     File name                       [Preview] [Open in Drive]
```

## Verification and completion

- Check advance/installment/verified-payment deduplication, missing-date handling, partial/full payment and persisted document numbering/re-download consistency.
- Check cross-studio/member restrictions and untrusted input handling on document and export endpoints.
- Read generated workbooks back to confirm row counts, totals, filters, number/date types, Unicode and literal formula-like strings.
- Inspect generated PDF content/pages and document layout, including long names/services and optional-field omission. User validates mobile PDF/print/browser behaviour; no automated browser UAT.
- Use real permitted Drive files for access-denied/revoked/unsupported preview flows; no fabricated successful gallery results.
- Typecheck and meaningful targeted tests for touched contracts. Record exactly which checks run. Update authoritative docs, index and CHANGELOG with implementation results.

## Sources

- https://developers.google.com/workspace/drive/api/reference/rest/v3/files — webViewLink, webContentLink, thumbnailLink limitations.
- https://developers.google.com/workspace/drive/api/guides/file-metadata — thumbnail retrieval, permissions and expiry.
- https://developers.google.com/workspace/drive/api/guides/resource-keys — resource-key preservation and link access.

## Open input

The previously mentioned third-party preview method/provider is not identified in this conversation. If the user supplies its name/link, compare it against the Google-hosted option. It is not a prerequisite for the invoice/receipt and Excel work.
