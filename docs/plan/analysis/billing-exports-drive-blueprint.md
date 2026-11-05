# Minimal billing, Excel exports and Drive: solution blueprint

Date: 2026-11-05. Stage: Solution Architect. The user approved the companion [implementation plan](minimal-billing-exports-drive.md). This blueprint is a design, not a claim that features or verification already exist.

## Delivery ownership

Billing and Excel share financial calculations, packages/types, packages/domain, OMS, dependencies and security helpers. Implement these serially in the main workspace. A separate Drive worktree may own only the tracking gallery cleanup, a standalone Drive research document/helper and its tests. It must not modify billing/export files, shared types, auth, package manifests, Index or CHANGELOG; the integration owner updates those. Drive embedding remains conditional on representative permitted files and user UAT. No browser automation or deployment.

## Verified boundaries and important corrections

- Order actions authorize with `requireVerifiedUser` and `requireStudioOwner` from `apps/web/src/lib/serverAuth.ts`; member task access additionally checks active crew identity and order/task assignment. CRM and ERP financial/contact datasets are owner-only. Do not widen these roles for exports.
- `requireVerifiedSession` currently accepts `dev_session:` without checking environment. The new financial boundary must reject synthetic identity in production. Minimal compatible fix: accept the existing development cookie only when `NODE_ENV === 'development'`; reject it in production and test unless the existing test harness supplies a separately explicit nonproduction opt-in. Inspect existing tests before choosing that opt-in; never let a runtime flag override production. Cover production rejection. Do not use `dashboardAccess` preview fallbacks to authorize financial documents.
- `updatePaymentStatusAction` and OMS's `handleUpdatePayment` can synthesize installments with `_auto` IDs and notes `Final Payment (Marked Paid)`. A PAID flag or such an installment is not independent proof that cash was received. Retain existing historical pricing for reconciliation, but require owner confirmation of amount/date before issuing its receipt.
- Verified marketplace payment may already be represented by `order.pricing.advanceAmount`. Never sum `PaymentRecord` again onto order advances/installments.
- `BusinessReportsView` sums only advances as collected revenue, and `toCustomerTrackingView` in packages/domain reports only advance as amountPaid. Introduce one canonical order calculation and update touched totals/exports together.
- `firestore.rules` already denies all client reads/writes. New documents/counters remain server-only through Firebase Admin; no rule relaxation.
- Integration-owner inspection also found synthetic `owner-` / `dev-` UID prefixes in membership auto-healing. Remove those as ownership evidence; verify actual studio owner identity and require ACTIVE membership. Preserve real owner UID/email recovery only under verified authentication, never a UID naming convention.

Minimal UI placement:

```text
Order details    [Invoice PDF] [Print]   Issued INV-2026-000001
Payment row      Amount / Date         [Receipt PDF] [Print]
Table header     Search / Filters      [Export Excel · 123 rows]
Settings         Billing name (required); contact/payment details (optional)
Deliverables     No files connected     (until real authorized files exist)
```

## BILL-001 contracts

### Data and pure calculations

Add exported types in `packages/types/src/index.ts` (or a re-exported billing module):

```ts
type BillingKind = 'INVOICE' | 'RECEIPT';
type ReceiptSource = { kind: 'ADVANCE' } | { kind: 'INSTALLMENT'; id: string };
interface BillingProfile {
  displayName: string;
  address?: string; phone?: string; email?: string; website?: string;
  paymentInstructions?: string; notes?: string;
}
```

Add `Studio.billingProfile?: BillingProfile`. Studio name is the initial issuer display name, not an invented legal company name. Profile and issuance forms may omit all optional details. Currency is explicitly INR for this release because existing order prices/UI are INR and have no currency field. Display the currency choice as fixed INR, never infer another currency.

`BillingDocument` stores schema version, id, studioId, orderId, kind, number, issuedAt, issuedByUid, status (`ISSUED`/`VOID`), issuer/customer snapshots, orderNumber, description, currency, amountMinor, invoice paid/balance-at-issue values, optional due date/notes/payment instructions, receipt sourceKey/paymentDate/method/reference, and optional void reason/time/actor/replacementOf. Store money as safe integer minor units. Snapshot source amount/date plus source revision fingerprint. Required strings are trimmed and bounded; reject nonfinite/negative numbers and invalid calendar dates. Invoice amount zero is permissible; receipt amount must be positive. One aggregate service line uses real order services/event description and finalConfirmedPrice; do not invent individual service prices.

New pure functions in `packages/domain/src/billing.ts`, re-exported by its existing index:

- `toMinorUnits(amount)` validates and rounds decimal currency once; reject unsafe results.
- `getOrderFinancials(order)` returns confirmed, advance, installmentsTotal, paid, remaining in minor units. Paid is advance plus installments once; remaining is max(confirmed-paid,0). Expose any overpayment separately instead of losing it. No status-based payment invention.
- `getReceiptSources(order)` returns advance (if positive) and each actual installment, source key, amount, known date and `requiresConfirmation`. Missing advanceDate and legacy auto installments require explicit owner confirmation. No fabricated payment date. Duplicate installment IDs are an error.
- Use existing `getStudioCalendarDate` for issue date presentation; date-only payment dates must survive timezone conversion unchanged.

### Persistence and idempotency

Add server repository methods in `packages/db/src/billing.ts`, re-exported through index. Use `getFirestoreServerInstance`, no in-memory fallback:

- `issueBillingDocumentTransaction(input)` reads current order, studio, document identity and counter in a Firestore transaction, validates source values, then atomically allocates the number and writes immutable snapshot.
- `getBillingDocument(studioId, documentId)` and `listOrderBillingDocuments(studioId, orderId)` return only matching studio/order docs.
- `voidBillingDocumentTransaction(studioId,id,reason,actor)` changes lifecycle metadata only. Never delete or edit issued financial content.

Collections: `billingDocuments/{id}`, `billingCounters/{studioId_kind_year}`, `billingDocumentKeys/{hash}`. Deterministic key is studio + order + kind + sourceKey + explicit revision. First invoice revision=1, receipt revision=1 for each advance/installment source. Hash keys avoid slash/path injection. Transaction reads key first: repeated or concurrent issue requests return the same document without incrementing the counter. Stable numbers `INV-YYYY-000001` / `REC-YYYY-000001` are unique within studio and kind/year; studioId is part of storage identity. Server year/date decides numbering.

Keep initial UI simple: one current invoice and one receipt per source; opening an issued document offers redownload/print. If source/profile later changes, show that the issued snapshot is unchanged. Correction is explicit Void with required reason, then Issue replacement referencing the voided document and next revision/number. Retries of replacement also use deterministic revision identity. An old snapshot is never silently regenerated with new totals. No deletion of issued documents when orders are archived. A source change between form opening and issuance produces a review-required conflict instead of issuing stale data.

`ReceiptSource` selects an existing order advance/installment; the client cannot supply an arbitrary receipt amount. Owner confirmation resolves missing/legacy facts, persists confirmation metadata on the document with actor/time and explicit payment date, and must match the stored source amount. Existing verified payment may supply method/reference only when its association to this source is explicit and uniquely verified; do not guess from matching amounts. It is not a second receipt source.

### Server action and PDF interfaces

Create `apps/web/src/actions/billingActions.ts`:

- `getOrderBillingContextAction({ studioId, orderId, idToken })`: owner authorization, exact studio match, live order/profile + receipt source choices + issued snapshots.
- `saveBillingProfileAction({ studioId, profile, idToken })`: owner authorization, schema bounds, update only billing profile.
- `issueBillingDocumentAction({ studioId, orderId, kind, source?, expectedSourceFingerprint, optionalFields, receiptConfirmation?, replacementOf?, idToken })`: authorizes and validates before transaction. Server derives amounts, identity, timestamps and source data. Return discriminated success/document or error; do not swallow errors.
- `voidBillingDocumentAction({ studioId, documentId, reason, idToken })`: owner-only and studio-bound.

New `apps/web/src/app/api/billing/[documentId]/pdf/route.ts` uses Node runtime; GET reads studioId and documentId, verified bearer Firebase ID token or verified session, requires owner and loads stored snapshot. Return `application/pdf`, safe attachment filename, `Cache-Control: private, no-store`; no credentials in URL. Unauthorized/absent document cannot leak metadata. Download UI uses authorized fetch → Blob → object URL, revokes URL when done. Print fetches the identical generated PDF and opens its browser viewer/print action from an explicit user click; document view also has a plain print stylesheet if viewer print is unavailable. Explain browser printing fallback truthfully.

### PDF choice and Unicode

Use `@react-pdf/renderer` v4, Node `renderToBuffer`, implemented in `apps/web/src/lib/billing/renderBillingPdf.tsx`. Resolve and pin the actual compatible published version during dependency installation; record manifest/lock changes and audit results. Do not install a guessed version. Official API supports server buffers and flowing/paginated documents. Use static, locally bundled Noto Sans and Noto Sans Tamil regular/bold TTF fonts with their OFL license under `apps/web/src/lib/billing/fonts/`; configure Next output tracing so server deployment includes them. No runtime remote font dependency or default Helvetica for Tamil. Split mixed-script text into font runs at grapheme boundaries where needed; keep combining marks with their Tamil run. Disable inappropriate automatic hyphenation for names.

This is a concrete rendering route, not a guarantee of all Unicode scripts: verify Tamil shaping and ₹ with an actual rendered artifact before declaring support. If unsupported glyphs are entered, surface an explicit validation error rather than silently replacing with boxes. Include multipage/long descriptions; bounded optional input means unbounded hostile layouts cannot exhaust the renderer. A4 white page, dark text, modest headings, repeated page number, totals together, empty optional sections omitted. No decorative template or emoji.

Optional logo/signature can only be included from a bounded, validated snapshot of user-approved bytes (PNG/JPEG, size/dimension cap), never arbitrary server URL fetching. Do not SSRF-fetch `studio.logoUrl` blindly or depend on a mutable remote logo for historical PDFs. If that asset snapshot path is not implemented, omit the optional image control and disclose this small limitation; text-only documents satisfy the minimal base workflow.

New `components/billing/OrderBillingPanel.tsx` owns minimal form/dialog, receipt selection, issue/re-download/print/void controls. Integrate in OMS selected-order details and its payment section; no duplication of logic inside the large page. New `components/billing/BillingProfileForm.tsx` in Settings is optional defaults only. Controls use existing token classes plus Lucide FileText/Download/Printer; accessible labels and loading/error states.

## EXPORT-001 contracts and complete coverage

Use ExcelJS, dynamically imported only on export; resolve/pin compatible published version and inspect dependencies during implementation. Use its actual `Workbook.xlsx.writeBuffer()` writer, not CSV. New `apps/web/src/lib/exports/workbook.ts` exports `downloadWorkbook({filename,sheets,scope})`; sheet schema explicitly lists safe columns with key/title/type/width, never spreads database objects. Types are string/finite number/boolean/Date/null, never formula or hyperlink objects. `=`, `+`, `-`, `@` user strings remain string cells. Use text number format for identifiers/phone, numeric currency formats, actual date cells built from date-only components at UTC midnight, frozen row 1, filters, sanitized unique <=31-character sheet names. Empty values stay empty rather than false/zero invention. Include a Scope sheet with filters, export date, row counts and any intentional exclusions.

`components/exports/ExportExcelButton.tsx` accepts pre-whitelisted sheet datasets and scope; uses shared styles, Download icon, visible exported-row count, busy/error state, disables while authorized data is still loading. Maximum 10,000 total data rows/workbook initially; exceed => explicit narrow-filters error, never slice silently. This is a truthful client safety bound, not a promise of scalable bulk exports. On empty datasets explain no matching records.

No new broad unauthenticated export endpoint is needed: existing owner/member-authorized actions supply complete data; builders only receive the same authorized datasets. If any source is currently limited server-side, fetch all matching records through a bounded authorized action before export or visibly report incomplete scope and refuse the full export. UI slicing is applied only after the export projection. Keep filtering/sorting expressions shared, not reimplemented differently for Excel. Existing privileged data access must stay on the server; member data may only include their assigned orders/tasks, never owner financial columns.

Integration coverage (paths below `apps/web/src/`):

| View/file | Export datasets and authoritative input |
|---|---|
| `features/dashboard/DashboardHomeView.tsx` | Full `displayedOrders` before `.slice(0,20)`; revenue/order chart datasets `revChartData`, `ordChartData` with their distinct periods clearly named |
| `features/dashboard/DashboardOverviewView.tsx` | `displayedOrders`, `upcomingShoots`, `marketplaceLeads`, `chartBuckets`; current status/search/period scope |
| `features/dashboard/BusinessReportsView.tsx` | Summary, filtered order detail, `monthlyRevenueData`, `categoryStats`, `pendingOrders`; separate earned/order-value vs actually collected labels; canonical advance+installment collected total |
| `app/[studioSlug]/dashboard/oms/page.tsx` | Full `filtered` orders; selected-order installments/advance; selectedTasks; resource assignments; sorted audit history where shown. Payment source confirmation status appears in payment export; no false bank-proof claim |
| `app/[studioSlug]/dashboard/crm/page.tsx` | `filtered` customers and selected customer order history; explicit archived/deleted history sheet only when selected; real lifetime value/pending metrics |
| `app/[studioSlug]/dashboard/erp/page.tsx` | `filtered` crew; selected-member workload orders; `temporaryCrewList`; pending invitation summaries with name/email/status/date only, never token/passcode/share URL |
| `features/dashboard/MemberWorkDashboardView.tsx` | Member-visible assigned orders and task rows only; no financial/contact data absent from member view |
| `app/[studioSlug]/dashboard/services/page.tsx` | Current services and packages catalogs with actual configured price/enabled/published state; distinguish unsaved configuration if export uses local unsaved state |

Marketplace configuration forms, notification setting checkboxes, static notification templates, chat demonstration controls and marketing `RetroHeroVisual` tables are not business record reports. Do not turn those into invented transaction exports. Any actual booking/payment record list discovered in child components must use the same whitelisted export control before coverage is declared complete. All UI lists above include cards/divs as well as HTML tables. New controls should not require horizontal table scrolling on mobile.

## DRIVE-001 feasible scope and isolation

Existing `TrackOrderClient.tsx` contains hardcoded Preview_01/02, Teaser_Reel and Master_Album names, a seeded customer review and success state. It has no verified operational Drive file listing. Remove these fake seeds and any fake save success in the touched deliverable path. Show a truthful no-deliverables/not-connected state; don't create a gallery from filenames alone.

Official Drive metadata provides `webViewLink`; prefer its complete Google URL including resource key. Candidate `https://drive.google.com/file/d/{id}/preview` embeds may work for supported file types but are not a universal documented viewer contract. A helper may parse/validate an existing user-supplied Google Drive URL (HTTPS, exact allowlisted hosts, no credentials, validate file ID/resourcekey); it must never fetch arbitrary URLs, create public permission, leak owner OAuth tokens or imply that a FocoMan tracking passkey grants Google access.

There is currently no authorized order/file association model or confirmed real file. Therefore this delivery may complete research/cleanup only and mark actual embed integration awaiting a real permitted file + user UAT, exactly as the approved plan allows. Do not add file metadata to the current client-only tracking unlock. A future link action must authorize owner to attach and server-side authorized customer/collaborator to retrieve; Google still separately enforces its sharing. Keep existing plan feature gating. No new OAuth credentials or third-party viewer signup in this change.

User UAT for future iframe: permitted image/video/PDF, private Google account, logged-out client, revoked permission, unsupported media, iPhone Safari and Android; explicit Open in Google Drive link stays available. Iframe onload cannot prove permission or successful rendering. `thumbnailLink` expires and private thumbnails need authorized access; it is not a durable free CDN. Google-hosted direct preview reduces FocoMan origin transfer, not viewer bytes.

## Developer and test handoff

1. Add canonical financial/source contracts and minimal production auth guard; test before new financial endpoints depend on them.
2. Implement snapshot transaction/idempotency and owner actions, then PDF/font artifact verification and OMS/Settings UI.
3. Add workbook builder, readback validation, then coverage integrations sharing canonical amounts and existing view filters.
4. Integrate isolated Drive cleanup/research; record blocked real-file UAT honestly.
5. Update CHANGELOG, tasks and authoritative docs only with actual implementation/check outcomes. No automatic push/deploy from this blueprint.

Meaningful checks: partial and full installment accounting; payment deduplication; missing/auto payment confirmation; same-source concurrent/retry idempotency; snapshot immutability after edits; cross-studio denial and member denial; production synthetic-cookie rejection; archived behavior; XLSX numeric/date/text types and no formula cells for hostile names; all rows before pagination slicing and explicit bound error; generated PDF header, text extraction, multipage layout and Tamil shaping artifact inspection. Unit tests may use explicitly labeled test fixtures; production must never inject fake records. Firestore transaction concurrency requires emulator or real permitted test project—if neither exists, state it unverified, not passed. User performs browser/mobile/print/Drive UAT. Run repository typecheck and targeted tests; report pre-existing failures separately.

## Primary references checked for this blueprint

- [React PDF Node API](https://react-pdf.org/docs/v4/node): renderToBuffer server output.
- [React PDF fonts](https://react-pdf.org/docs/v4/fonts): register static TTF/WOFF fonts and weights; variable fonts are unsuitable for this path.
- [Fontkit](https://github.com/foliojs/fontkit): OpenType shaping engine; actual Tamil output still needs verification.
- [ExcelJS](https://github.com/exceljs/exceljs): workbook writer; use library cell types and XLSX output.
- [Drive Files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files), [file metadata](https://developers.google.com/workspace/drive/api/guides/file-metadata), [resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys): official viewer link, thumbnail restrictions and resource-key handling.
