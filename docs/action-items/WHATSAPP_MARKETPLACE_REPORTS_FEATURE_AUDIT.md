# FocoMan — WhatsApp, Studio Marketplace & Business Reports Feature Audit & Action Items

**Audit Date:** 2026-11-06  
**Scope:** Module 04 (WhatsApp Operations & Interactive Bot), Module 05 (Studio Marketplace), Module 06 (Business Reports & Analytics)  
**Purpose:** Evidence-based audit comparing the 12 finalized landing-page feature panels across Modules 04, 05, and 06 against the actual FocoMan repository implementation, documenting gaps and pending work items for future development sprints.

---

## A. Feature Implementation Matrix

| Module | # | Feature Name | Implementation Status | Existing Functionality | Missing Functionality | Relevant Source Files | Verification Requirements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **04 — WhatsApp** | 1 | **Automated WhatsApp Notifications** | `PARTIAL` | Studio Owners can toggle `masterEnabled` and 11 granular notification triggers (`upcoming_3day`, `post_event_start`, `raw_photos_sent`, `customer_selection_done`, `album_review_done`, `ready_for_delivery`, `assignment_confirm`, `task_assigned`, `customer_post_event`, `customer_ready_delivery`, `customer_payment_remind`) persisted on `studio.whatsappConfig` via `updateStudioWhatsappConfigAction`. `WHATSAPP_TEMPLATES` and `sendWhatsAppMessageOrFallback` (Meta Cloud API `v21.0` with `wa.me` fallback) are defined in `whatsappService.ts`. | `sendWhatsAppMessageOrFallback` is **never invoked** when orders are created, tasks change status, gallery links are added, or payments are recorded (`orderCrudOperations.ts`, `orderTaskOperations.ts`, `orderPaymentOperations.ts`, `orderCustomerOperations.ts` only call email helpers in `emailService.ts`). No workflow trigger checks `studio.whatsappConfig` flags to automatically send outbound customer WhatsApp notifications. | `apps/web/src/app/[studioSlug]/dashboard/whatsapp/page.tsx:17-62,134-154`, `apps/web/src/actions/whatsappActions.ts:44-97`, `apps/web/src/services/whatsappService.ts:52-176,447-507` | Verify outbound Meta Cloud API dispatch on order creation, gallery link update, and task transitions when corresponding `whatsappConfig` trigger is enabled. |
| **04 — WhatsApp** | 2 | **Interactive Studio Operations Bot** | `PARTIAL` | `processWhatsAppBotMessage` handles read-only operational commands (`HELP`/`MENU`/`?`, `TODAY`, `SHOOTS`/`UPCOMING`, `ORDERS`/`ACTIVE`, `STATUS <Order#>`, `CREW`/`TEAM`), querying Firestore for active orders, upcoming shoots, and crew lists. Accessible via the in-dashboard Bot Simulator (`simulateWhatsappBotQueryAction`) and Meta Cloud API webhook (`POST /api/whatsapp/webhook`). | 1. `POST /api/whatsapp/webhook` does not verify Meta `X-Hub-Signature-256` HMAC signatures (allowing unauthenticated spoofed webhook payloads).<br>2. Webhook linearly scans all documents in `studios` (`db.collection('studios').get()`) and only matches the studio owner's phone (`contactPhone`/`phone`/`ownerPhone`), failing to disambiguate if an owner owns multiple studios or if an authorized crew member queries the bot. | `apps/web/src/services/whatsappService.ts:211-429`, `apps/web/src/actions/whatsappActions.ts:16-39`, `apps/web/src/app/api/whatsapp/webhook/route.ts:27-95` | Verify Meta webhook HMAC signature validation, indexed phone lookup, multi-studio disambiguation, and crew read-command access. |
| **04 — WhatsApp** | 3 | **WhatsApp-Based Workflow Actions** | `NOT IMPLEMENTED` | None. `processWhatsAppBotMessage` explicitly states `" Read-Only Mode: For security, status mutations are disabled via chat"` (`whatsappService.ts:258`), and `/api/whatsapp/webhook/route.ts:68-78` rejects all non-owner phone numbers. | No WhatsApp bot commands exist to update task statuses (e.g., `START`, `DONE`, `COMPLETE`) or order statuses. No studio member phone authentication/permission check against `members` collection (`assignedMemberId`), and no integration with `updateTaskStatusCore` or `order.auditLog`. | `apps/web/src/services/whatsappService.ts:211-429`, `apps/web/src/app/api/whatsapp/webhook/route.ts:46-83`, `apps/web/src/actions/orders/orderTaskOperations.ts:84-260` | Verify authorized studio owner and assigned crew member can update supported task/order statuses via WhatsApp commands and that unauthorized crew are blocked. |
| **04 — WhatsApp** | 4 | **Crew Reminders & Call Times** | `PARTIAL` | `WHATSAPP_TEMPLATES` includes `crew_assignment_alert` ("Crew Assignment & Call-Time Alert") and `crew_task_assigned` ("Production Task Assigned") (`whatsappService.ts:149-175`), and trigger toggles `assignment_confirm` and `task_assigned` exist in `whatsapp/page.tsx:48-49`. | 1. `Order` and `ResourceAssignment` schemas lack a dedicated `callTime` field (only `eventDate` and `eventLocation` are stored).<br>2. `assignResourceCore` and `assignTaskCrewCore` (`orderCrewOperations.ts:131-155,216-237`) only send emails (`sendCrewShootAssignedEmail`) and do not dispatch WhatsApp alerts.<br>3. No scheduled cron job or background worker exists to send pre-event crew call-time reminders ahead of `eventDate`. | `apps/web/src/services/whatsappService.ts:149-175`, `apps/web/src/actions/orders/orderCrewOperations.ts:47-240`, `packages/types/src/index.ts` | Verify `callTime` persistence on shoot assignments, instant WhatsApp notification on crew assignment, and scheduled pre-shoot reminder execution. |
| **05 — Marketplace** | 1 | **Public Studio Profile & Direct Inquiries** | `IMPLEMENTED` | Studio Owners can configure `isVisible`, studio name, city, bio, logo, and service specializations in `MarketplaceSettingsClient.tsx` (`saveMarketplaceProfile`). Prospective customers can browse/search public studios (`/studios`, `searchPublicMarketplace`), visit `/studios/[slug]` (`StudioPublicProfilePage.tsx`), and submit direct booking inquiries (`createBookingRequestAction`). | None for core profile showcase and inquiry submission. | `apps/web/src/features/marketplace/MarketplaceSettingsClient.tsx:303-442`, `apps/web/src/features/marketplace/StudioPublicProfilePage.tsx:36-174`, `apps/web/src/features/marketplace/PublicStudioPackagesClient.tsx:212-475`, `apps/web/src/actions/marketplaceActions.ts:68-167,258-317` | Runtime verification of public visibility toggle, public URL rendering, and guest inquiry submission. |
| **05 — Marketplace** | 2 | **Configurable Service Packages** | `IMPLEMENTED` | Studio Owners can create, publish/unpublish, and delete customized packages with pricing, description, included service tags, and optional price negotiation (`isNegotiable`) via `MarketplaceSettingsClient.tsx` (`createStudioPackageAction`, `updateStudioPackageAction`, `deleteStudioPackageAction`). Published packages render on `/studios/[slug]` with `"Negotiable"` badges when enabled. | Minor UI parity gap: creating a package from the Services tab (`apps/web/src/app/[studioSlug]/dashboard/services/page.tsx:804`) hardcodes `isNegotiable: false` (unlike `MarketplaceSettingsClient.tsx:583-591`), and existing package cards only have a Publish/Unpublish toggle + Delete button without an inline Edit modal to toggle `isNegotiable` or edit price after creation. | `apps/web/src/features/marketplace/MarketplaceSettingsClient.tsx:445-625`, `apps/web/src/actions/marketplaceActions.ts:169-254`, `apps/web/src/app/[studioSlug]/dashboard/services/page.tsx:466-591,804` | Verify package creation, `isNegotiable` flag behavior on public studio page, and publish/unpublish toggling. |
| **05 — Marketplace** | 3 | **Booking Requests & Confirmation** | `PARTIAL` | Customers can submit package or custom booking requests (`createBookingRequestAction`) and optionally record advance payment proof during submission (`recordPaymentAction`). Studio Owners can review inquiries, confirm agreed booking amounts & advance requests (`negotiateBookingRequestAction`), and verify submitted payments to convert bookings into OMS orders (`verifyPaymentAction`). | 1. **Post-Negotiation / Offline Advance Payment Gap:** When a studio confirms an agreed amount (`negotiateBookingRequestAction` -> status `AWAITING_PAYMENT`) or when a customer submits a booking inquiry without checking "Record Advance Payment" upfront, there is no public customer UI to submit the advance payment later, nor a studio-owner action in `MarketplaceSettingsClient.tsx:627-809` to record/confirm advance payment and convert the booking into an OMS order without an existing `PaymentRecord`.<br>2. **Order ID & Passkey Mismatch (`OMS-001`):** `verifyPaymentAction` (`marketplaceActions.ts:460-559`) still creates legacy `ORD-${randomUUID}` IDs and `FOC-...` `trackingPasskey` instead of canonical `ORD-<STUDIO>-YYMMDD-HHMMSS` + 6-digit numeric passkey, and does not upsert the customer into CRM. | `apps/web/src/actions/marketplaceActions.ts:258-566`, `apps/web/src/features/marketplace/MarketplaceSettingsClient.tsx:627-809`, `apps/web/src/features/marketplace/PublicStudioPackagesClient.tsx:137-205,403-453` | Verify end-to-end flow for both immediate-advance bookings and negotiated bookings (`NEGOTIATING` -> `AWAITING_PAYMENT` -> payment recorded -> `CONFIRMED` OMS order). |
| **05 — Marketplace** | 4 | **Privacy Protected Operations** | `IMPLEMENTED` | Public marketplace endpoints (`searchPublicMarketplace`, `getPublicMarketplaceProfile`, `getPublishedStudioPackages`) strictly return `marketplace_profiles` (only when `isVisible === true && !isDeleted`) and published `studio_packages`. Internal collections (`orders`, `customers`, `tasks`, `members`, `payments`) are protected by server-side `requireVerifiedUser` / `requireStudioMember` / `requireStudioOwner` guards and Firestore security rules. | None. | `apps/web/src/actions/marketplaceActions.ts:113-182`, `apps/web/src/lib/dashboardAccess.ts`, `firestore.rules` | Verify unauthenticated visitors cannot read studio orders, CRM records, crew members, or unpublished packages. |
| **06 — Reports** | 1 | **Monthly & Yearly Revenue Reports** | `PARTIAL` | `BusinessReportsView.tsx` provides timeframe filters (`all`, `ytd`, `last6m`, `last30d`), calculates Total Booked Revenue, Cash Collected, Pending Balance Due, and Avg Order Value (`calculateOrderPaymentBreakdown`), and renders a 6-month revenue bar chart (`monthlyRevenueData`). | 1. `monthlyRevenueData` (`BusinessReportsView.tsx:127-153`) is hardcoded to the last 6 rolling months regardless of the selected `timeframe`, includes `CANCELLED` orders (`orders.filter` instead of `activeFilteredOrders`), and reads `o.pricing?.finalConfirmedPrice` directly.<br>2. There is no yearly / multi-year revenue view, 12-month annual breakdown, or period-over-period growth comparison. | `apps/web/src/features/dashboard/BusinessReportsView.tsx:24-92,127-155,403-534` | Verify revenue calculations exclude `CANCELLED` orders across all charts and support both monthly (12-month) and yearly comparisons. |
| **06 — Reports** | 2 | **Exportable Business Reports** | `IMPLEMENTED` | `handleExportReportsExcel` (`BusinessReportsView.tsx:161-314`) and `exportWorkbookToExcel` (`excelExport.ts:241-453`) generate a multi-sheet `.xlsx` workbook (`Orders & Payments Ledger`, `Pending Receivables`, `Category Breakdown`, `Monthly Revenue Trend`) with formatted currency columns and automatic summary totals (`sumInTotals: true`). Also supports `Print Report`. | None for core Excel export; once `REP-001` and `REP-002` are completed, the exported workbook should include the excluding-cancelled category/monthly figures and production/delivery SLA sheet. | `apps/web/src/features/dashboard/BusinessReportsView.tsx:161-314,379-398`, `apps/web/src/utils/excelExport.ts:241-453` | Verify `.xlsx` download opens cleanly in Excel/Google Sheets and column totals match on-screen KPI cards. |
| **06 — Reports** | 3 | **Shoot Category Performance** | `PARTIAL` | `categoryStats` (`BusinessReportsView.tsx:105-124,537-587`) aggregates booking volume (`count`), booked revenue (`revenue`), and revenue share percentage (`pct`) grouped by `o.eventType`, sorted highest-to-lowest with progress bars and included in the Excel export (`Category Breakdown` sheet). | `categoryStats` (`BusinessReportsView.tsx:108`) iterates over `filteredOrders` (which includes `CANCELLED` orders) instead of `activeFilteredOrders`, and uses `o.pricing?.finalConfirmedPrice || 0` instead of `calculateOrderPaymentBreakdown(o).confirmedPrice`. This can cause category revenue sums and percentages (`data.revenue / totalRevenue`) to exceed 100% when cancelled orders exist. | `apps/web/src/features/dashboard/BusinessReportsView.tsx:104-124,537-587` | Verify category volume, revenue, and share `%` exclude `CANCELLED` orders and sum to 100% of `totalRevenue`. |
| **06 — Reports** | 4 | **On-Time Delivery & Production Performance** | `NOT IMPLEMENTED` | The AOV card subtitle (`BusinessReportsView.tsx:88-89,474-476`) shows `{completedOrdersCount} completed · {inProgressOrdersCount} in production`. SLA utilities exist in OMS (`OmsOrderSubsections.tsx`). | `BusinessReportsView.tsx` has **no** On-Time Delivery & Production Performance section, metrics, or charts. It does not compute or display delayed/overdue order counts, average delivery turnaround time, on-time completion rate (`%`), or stage/task bottleneck metrics in the Business Reports dashboard or Excel export. | `apps/web/src/features/dashboard/BusinessReportsView.tsx:87-91,474-477`, `apps/web/src/components/oms/OmsOrderSubsections.tsx:6-106` | Verify Business Reports displays completed vs delayed orders, average turnaround days, on-time completion `%`, and production stage bottlenecks. |

---

## B. Development Action Items

### `WA-001` — Wire Up Automated Outbound WhatsApp Notification Triggers Across Order & Task Workflows
- **Feature & Module:** Module 04 (WhatsApp Operations & Interactive Bot) — Panel 1: Automated WhatsApp Notifications
- **Current Behavior:** Studio Owners can configure `studio.whatsappConfig` toggles in `apps/web/src/app/[studioSlug]/dashboard/whatsapp/page.tsx`, and `sendWhatsAppMessageOrFallback` + `WHATSAPP_TEMPLATES` exist in `apps/web/src/services/whatsappService.ts`. However, order creation, payment recording, Google Drive gallery publishing, and task status updates only send emails via `emailService.ts` and never invoke `sendWhatsAppMessageOrFallback`.
- **Required Behavior:** When an order or workflow event occurs (booking confirmation, post-event start, raw photos/gallery link added, customer selection/review done, ready for delivery, payment reminder), check `studio.whatsappConfig.masterEnabled` and the corresponding trigger flag, format the message using `WHATSAPP_TEMPLATES`, and dispatch via `sendWhatsAppMessageOrFallback`.
- **Missing Functionality:**
  1. Create a helper `dispatchStudioWhatsAppNotification(studioSlug, triggerId, recipientPhone, templateParams)` in `whatsappService.ts` that reads `studio.whatsappConfig` and dispatches via `sendWhatsAppMessageOrFallback` when enabled.
  2. Invoke this helper in `createOrderCore`, `updateTaskStatusCore`, `updateOrderDriveDeliverablesCore`, `submitClientDeliverableReviewCore`, and `recordOrderPaymentCore`.
- **Relevant Files:**
  - `apps/web/src/services/whatsappService.ts` (lines 52–176, 447–507)
  - `apps/web/src/actions/orders/orderCrudOperations.ts`
  - `apps/web/src/actions/orders/orderTaskOperations.ts`
  - `apps/web/src/actions/orders/orderCustomerOperations.ts`
  - `apps/web/src/actions/orders/orderPaymentOperations.ts`
- **Dependencies:** `WHATSAPP_BUSINESS_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` environment variables for live Meta Cloud API delivery.
- **Priority:** `HIGH`
- **Status:** `TODO`

---

### `WA-002` — Add Meta Webhook HMAC Signature Verification & Indexed Multi-Role Phone Lookup
- **Feature & Module:** Module 04 (WhatsApp Operations & Interactive Bot) — Panel 2: Interactive Studio Operations Bot
- **Current Behavior:** `POST /api/whatsapp/webhook` (`apps/web/src/app/api/whatsapp/webhook/route.ts:27-95`) accepts any JSON payload without verifying `X-Hub-Signature-256`, fetches all documents in `studios` (`db.collection('studios').get()`), and only matches the studio owner's phone number.
- **Required Behavior:** Verify Meta webhook signatures using `WHATSAPP_APP_SECRET`, resolve sender phone numbers against both studio owners and active crew members (`members` collection), and handle multi-studio disambiguation cleanly.
- **Missing Functionality:**
  1. Validate `X-Hub-Signature-256` header using HMAC-SHA256 with `process.env.WHATSAPP_APP_SECRET`.
  2. Query studios and active `members` by normalized 10-digit phone rather than scanning the entire `studios` collection in memory.
  3. Allow authorized crew members to execute read-only bot queries (`TODAY`, `SHOOTS`, `STATUS <Order#>`) scoped to their studio/assignments.
- **Relevant Files:**
  - `apps/web/src/app/api/whatsapp/webhook/route.ts` (lines 27–95)
  - `apps/web/src/services/whatsappService.ts` (lines 211–429)
- **Dependencies:** `WHATSAPP_APP_SECRET` environment variable.
- **Priority:** `HIGH`
- **Status:** `TODO`

---

### `WA-003` — Implement WhatsApp-Based Workflow Action Commands with Member Permission Checks
- **Feature & Module:** Module 04 (WhatsApp Operations & Interactive Bot) — Panel 3: WhatsApp-Based Workflow Actions
- **Current Behavior:** `processWhatsAppBotMessage` (`whatsappService.ts:211-429`) is strictly read-only (`HELP`, `TODAY`, `SHOOTS`, `ORDERS`, `STATUS`, `CREW`) and explicitly states status mutations are disabled via chat.
- **Required Behavior:** Allow authorized studio owners and assigned crew members to update supported task and order statuses through WhatsApp commands (e.g., `START <Order#> <Task>`, `DONE <Order#> <Task>`), enforcing role/assignment permission checks, event-date locks, and sequential task dependencies, and synchronizing updates to Firestore (`tasks` and `orders.auditLog`).
- **Missing Functionality:**
  1. Add command parsers in `processWhatsAppBotMessage` for workflow actions (e.g., updating task status to `IN_PROGRESS` or `COMPLETED`).
  2. Authenticate the sender's phone number against the studio owner or the `assignedMemberId` of the target task (`members` collection).
  3. Reuse or invoke the domain validation rules from `updateTaskStatusCore` (`canCompleteOrder`, event-date lock, sequential task dependencies) and write an audit log entry (`Updated via WhatsApp Bot`).
- **Relevant Files:**
  - `apps/web/src/services/whatsappService.ts` (lines 211–429)
  - `apps/web/src/app/api/whatsapp/webhook/route.ts`
  - `apps/web/src/actions/orders/orderTaskOperations.ts` (lines 84–260)
- **Dependencies:** `WA-002` (sender identity & role resolution in webhook).
- **Priority:** `HIGH`
- **Status:** `TODO`

---

### `WA-004` — Add Shoot Call-Time Field & Scheduled Crew Reminder Dispatch
- **Feature & Module:** Module 04 (WhatsApp Operations & Interactive Bot) — Panel 4: Crew Reminders & Call Times
- **Current Behavior:** `crew_assignment_alert` and `crew_task_assigned` templates exist in `whatsappService.ts:149-175`, but `Order` / `ResourceAssignment` lack a `callTime` field, `orderCrewOperations.ts` only sends email notifications, and no scheduled job dispatches pre-event crew reminders.
- **Required Behavior:** Store event call times on shoot assignments/orders, send WhatsApp assignment notifications when crew are assigned (when `assignment_confirm` / `task_assigned` toggles are enabled), and dispatch scheduled reminders to assigned crew members with event date, call time, venue location, and required shoot information.
- **Missing Functionality:**
  1. Add `callTime?: string` to `Order` and/or `ResourceAssignment` in `packages/types/src/index.ts` and expose it in OMS shoot/crew assignment UI.
  2. Call `sendWhatsAppMessageOrFallback` with `crew_assignment_alert` / `crew_task_assigned` in `assignResourceCore` and `assignTaskCrewCore` (`apps/web/src/actions/orders/orderCrewOperations.ts`).
  3. Create a scheduled cron endpoint (e.g., `/api/cron/whatsapp-reminders`) to send upcoming shoot call-time reminders (`upcoming_3day` / 24h crew reminder) to assigned crew members and studio owners.
- **Relevant Files:**
  - `packages/types/src/index.ts`
  - `apps/web/src/actions/orders/orderCrewOperations.ts` (lines 47–240)
  - `apps/web/src/services/whatsappService.ts` (lines 149–175)
- **Dependencies:** `WA-001`
- **Priority:** `MEDIUM`
- **Status:** `TODO`

---

### `MKT-001` — Complete Post-Negotiation Advance Payment & Studio Booking Confirmation Flow
- **Feature & Module:** Module 05 (Studio Marketplace) — Panel 3: Booking Requests & Confirmation
- **Current Behavior:** When a customer submits a booking request (`createBookingRequestAction`) without immediately recording an advance payment, or when a negotiable booking is reviewed by the studio (`negotiateBookingRequestAction` sets `bookingStatus: 'AWAITING_PAYMENT'`, `confirmedPrice`, and `advanceRequested`), there is no UI for the customer to submit the requested advance payment afterward, and no button in `MarketplaceSettingsClient.tsx` for the studio owner to record an offline advance payment and convert the booking into an OMS order (`verifyPaymentAction` requires an existing `PaymentRecord` ID).
- **Required Behavior:** Studio owners can review inquiries, confirm the agreed booking amount, request advance payments, record or verify advance payments, and convert verified bookings into studio orders seamlessly—whether the advance payment was submitted upfront, after price negotiation, or collected offline by the studio.
- **Missing Functionality:**
  1. Add a `"Record & Verify Advance / Convert to Order"` action in `MarketplaceSettingsClient.tsx` (`lines 627-809`) for inquiries in `BOOKING_REQUEST` or `AWAITING_PAYMENT` status so studio owners can record an advance payment (or confirm collection) and convert the inquiry into an OMS `Order`.
  2. Provide a customer inquiry lookup or link to submit advance payment proof (`recordPaymentAction`) once a negotiable inquiry transitions to `AWAITING_PAYMENT`.
  3. Align `verifyPaymentAction` with `OMS-001` (canonical `ORD-<STUDIO>-YYMMDD-HHMMSS` Order ID, 6-digit numeric passkey, and CRM customer upsert).
- **Relevant Files:**
  - `apps/web/src/features/marketplace/MarketplaceSettingsClient.tsx` (lines 627–809)
  - `apps/web/src/actions/marketplaceActions.ts` (lines 341–566)
  - `apps/web/src/features/marketplace/PublicStudioPackagesClient.tsx`
- **Dependencies:** `OMS-001` (canonical Order ID & 6-digit passkey unification).
- **Priority:** `HIGH`
- **Status:** `TODO`

---

### `MKT-002` — Package Edit Modal & Negotiation Toggle Parity Across Marketplace and Services Pages
- **Feature & Module:** Module 05 (Studio Marketplace) — Panel 2: Configurable Service Packages
- **Current Behavior:** `MarketplaceSettingsClient.tsx` allows setting `isNegotiable` during package creation (`lines 583-591`), but existing package cards only support Publish/Unpublish and Delete (`lines 499-520`). Additionally, creating a package from `apps/web/src/app/[studioSlug]/dashboard/services/page.tsx:804` hardcodes `isNegotiable: false`.
- **Required Behavior:** Studio owners can configure and edit package details (name, price, description, services, and `isNegotiable`) both at creation time and when editing an existing package across both management views.
- **Missing Functionality:**
  1. Add an "Edit Package" modal/form in `MarketplaceSettingsClient.tsx` wired to `updateStudioPackageAction` (including toggling `isNegotiable`, editing price, description, and deliverables).
  2. Add the `Allow Negotiation` toggle to the package creation/edit modal in `apps/web/src/app/[studioSlug]/dashboard/services/page.tsx`.
- **Relevant Files:**
  - `apps/web/src/features/marketplace/MarketplaceSettingsClient.tsx` (lines 445–625)
  - `apps/web/src/app/[studioSlug]/dashboard/services/page.tsx` (lines 466–591, 800–815)
  - `apps/web/src/actions/marketplaceActions.ts` (lines 213–237)
- **Dependencies:** None
- **Priority:** `LOW`
- **Status:** `TODO`

---

### `REP-001` — Yearly Revenue Comparison, Dynamic Monthly Trend & Cancelled-Order Filtering in Business Reports
- **Feature & Module:** Module 06 (Business Reports & Analytics) — Panel 1: Monthly & Yearly Revenue Reports & Panel 3: Shoot Category Performance
- **Current Behavior:**
  1. `monthlyRevenueData` (`BusinessReportsView.tsx:127-153`) is hardcoded to the last 6 rolling months (`for (let i = 5; i >= 0; i--)`), ignores the selected `timeframe`, includes `CANCELLED` orders, and reads `o.pricing?.finalConfirmedPrice` directly.
  2. `categoryStats` (`BusinessReportsView.tsx:105-124`) iterates over `filteredOrders` (including `CANCELLED` orders) while dividing by `totalRevenue` (which excludes `CANCELLED` orders).
  3. There is no yearly revenue summary or period-over-period comparison view.
- **Required Behavior:** Track both monthly (12-month) and yearly studio revenue, compare performance across periods, and ensure all charts and category breakdowns consistently exclude `CANCELLED` orders using `calculateOrderPaymentBreakdown(o).confirmedPrice`.
- **Missing Functionality:**
  1. Update `monthlyRevenueData` and `categoryStats` in `BusinessReportsView.tsx` to use `activeFilteredOrders` and `calculateOrderPaymentBreakdown(o).confirmedPrice`.
  2. Add a Monthly (12-Month) vs Yearly revenue toggle/chart and period-over-period growth comparison metrics in `BusinessReportsView.tsx` and the Excel export (`Monthly Revenue Trend` / `Yearly Revenue Summary`).
- **Relevant Files:**
  - `apps/web/src/features/dashboard/BusinessReportsView.tsx` (lines 104–155, 266–313, 480–588)
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `TODO`

---

### `REP-002` — Add On-Time Delivery, Turnaround Time & Production Bottleneck Analytics to Business Reports
- **Feature & Module:** Module 06 (Business Reports & Analytics) — Panel 4: On-Time Delivery & Production Performance
- **Current Behavior:** `BusinessReportsView.tsx` only displays a single line of text (`{completedOrdersCount} completed · {inProgressOrdersCount} in production`) beneath the AOV card (`line 475`). It does not display delayed/overdue orders, delivery turnaround times, on-time completion rate, or production bottleneck metrics.
- **Required Behavior:** Monitor production progress, completed and delayed orders, average delivery turnaround times, on-time completion percentage, and stage/task bottlenecks in `BusinessReportsView.tsx` and include a production performance sheet in the exported Excel report.
- **Missing Functionality:**
  1. Compute studio-wide production metrics from `activeFilteredOrders`:
     - Completed orders count vs Delayed/Overdue orders count (based on SLA target days / `eventDate` aging).
     - On-Time Delivery rate (`%` of completed orders delivered within SLA).
     - Average turnaround time (days from `eventDate` to order completion).
     - Order count by current workflow stage / pending responsibility (`Pending at Studio` vs `Pending at Customer`) to highlight bottlenecks.
  2. Render an **On-Time Delivery & Production Performance** panel in `BusinessReportsView.tsx` and add a `Production & SLA Performance` worksheet to `handleExportReportsExcel`.
- **Relevant Files:**
  - `apps/web/src/features/dashboard/BusinessReportsView.tsx`
  - `apps/web/src/utils/dateUtils.ts`
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `TODO`

---

## C. Testing Checklist

> **Note on Verification Method:** The "Code Inspection Status" column reflects static analysis of the repository source files during this audit. The "Runtime Test Scenarios" column defines the end-to-end verification checks required during QA and after implementing the action items above.

| # | Test Area | Code Inspection Status | Runtime Test Scenarios (To Execute in QA) |
| :--- | :--- | :--- | :--- |
| 1 | **Studio Owner Permissions** | **Verified in code:** `requireStudioMember(uid, studioSlug, 'STUDIO_OWNER')` and `requireStudioOwner` guard WhatsApp config (`whatsappActions.ts:24,52`), Marketplace settings (`marketplaceActions.ts:34-49`), and Reports page (`reports/page.tsx:10` via `verifyDashboardAccess`). | Sign in as Studio Owner; verify access to `/dashboard/whatsapp`, `/dashboard/marketplace`, and `/dashboard/reports`. Verify non-owners receive access denied / redirect. |
| 2 | **Crew Member Permissions** | **Gap identified (`WA-002`, `WA-003`):** Dashboard routes restrict WhatsApp/Marketplace/Reports to `STUDIO_OWNER`, and `/api/whatsapp/webhook` currently blocks all non-owner phone numbers (`!isOwner`). | Verify crew members cannot modify studio WhatsApp/Marketplace settings or view financial reports; after `WA-002`/`WA-003`, verify crew can run allowed WhatsApp commands for their assigned tasks only. |
| 3 | **WhatsApp Bot Commands & Workflow Actions** | **Partial (`WA-003`):** Read commands (`HELP`, `TODAY`, `SHOOTS`, `ORDERS`, `STATUS <Order#>`, `CREW`) are implemented in `whatsappService.ts:242-428`. Workflow mutation commands are not yet implemented. | Test all 6 read commands in the Dashboard Bot Simulator and via webhook POST. After `WA-003`, test task status update commands (`START`/`DONE`) and verify `tasks` + `orders.auditLog` updates. |
| 4 | **Notification Triggers & Scheduled Reminders** | **Gap identified (`WA-001`, `WA-004`):** Trigger toggles persist to Firestore (`studio.whatsappConfig`), but workflow actions do not yet call `sendWhatsAppMessageOrFallback` and no cron job dispatches call-time reminders. | Toggle triggers on/off in `/dashboard/whatsapp`; after `WA-001`/`WA-004`, verify creating an order, assigning crew, adding Drive links, and running the reminder cron dispatch WhatsApp messages only when enabled. |
| 5 | **Meta Webhook Authentication & Security** | **Gap identified (`WA-002`):** `GET /api/whatsapp/webhook` checks `hub.verify_token === process.env.WHATSAPP_VERIFY_TOKEN`, but `POST /api/whatsapp/webhook` does not verify `X-Hub-Signature-256`. | Send `GET` challenge request with valid/invalid `hub.verify_token`. After `WA-002`, send `POST` requests with valid/invalid `X-Hub-Signature-256` HMAC headers and verify unsigned payloads return `401`/`403`. |
| 6 | **Marketplace Profile Visibility** | **Verified in code:** `getPublicMarketplaceProfile` and `searchPublicMarketplace` (`marketplaceActions.ts:113-167`) filter by `isVisible === true` and `!isDeleted`. | Toggle "Public Profile Visibility" off in `/dashboard/marketplace`; verify `/studios` search and `/studios/[slug]` no longer expose the studio profile. Toggle on and verify immediate public visibility. |
| 7 | **Package Configuration & Negotiation Settings** | **Verified in code (with `MKT-002` edit gap):** `createStudioPackageAction` persists `isNegotiable` and `isPublished`. Public page (`PublicStudioPackagesClient.tsx:251-256`) displays `"Negotiable"` badge and enables custom price input only when `isNegotiable === true`. | Create both a fixed-price package (`isNegotiable: false`) and a negotiable package (`isNegotiable: true`). Verify public inquiry modal only shows the negotiation input for the negotiable package. |
| 8 | **Public Booking Requests** | **Verified in code:** `createBookingRequestAction` (`marketplaceActions.ts:258-317`) validates input via `CreateBookingRequestSchema`, rejects requests if studio `isVisible` is false, and creates `booking_requests` documents with `NEGOTIATING` or `BOOKING_REQUEST` status. | Submit both a package booking inquiry and a custom event inquiry from `/studios/[slug]`. Verify both appear in the Studio Owner's `/dashboard/marketplace` "Booking Inquiries & Negotiation" list. |
| 9 | **Advance-Payment Verification** | **Partial (`MKT-001`):** `recordPaymentAction` creates a `PAY-...` record and sets `bookingStatus: 'PAYMENT_SUBMITTED'`; `verifyPaymentAction` verifies or rejects the payment. Missing UI to record advance payment *after* negotiation (`AWAITING_PAYMENT`). | Submit an inquiry with advance payment proof checked; verify Studio Owner sees "Verify & Confirm Order" and "Reject Payment" buttons in `/dashboard/marketplace`. |
| 10 | **Marketplace-to-OMS Conversion** | **Partial (`OMS-001`, `MKT-001`):** `verifyPaymentAction` (`marketplaceActions.ts:460-559`) creates an OMS `Order` and generates workflow tasks, but uses legacy Order ID/passkey format instead of canonical `ORD-<STUDIO>-YYMMDD-HHMMSS` + 6-digit passkey. | Verify payment on a Marketplace inquiry; confirm the new order appears in `/dashboard/oms` under the `MARKETPLACE` filter with generated production tasks. After `OMS-001`, verify canonical Order ID, 6-digit passkey, and CRM customer creation. |
| 11 | **Cross-Studio Data Isolation** | **Verified in code:** Server actions verify `studioSlug` membership and filter queries by `studioId == studioSlug`; public endpoints only return public profile and published packages for the requested `studioSlug`. | Create data in Studio A and Studio B; verify Studio A owner cannot view or mutate Studio B's WhatsApp config, Marketplace packages/inquiries, or Business Reports. |
| 12 | **Revenue Calculation Accuracy** | **Partial (`REP-001`):** Top KPI cards in `BusinessReportsView.tsx:55-86` exclude `CANCELLED` orders and use `calculateOrderPaymentBreakdown(o)` (avoiding double-counting advances + installments). However, the 6-month bar chart (`lines 139-144`) still includes `CANCELLED` orders. | Compare Total Booked Revenue, Cash Collected, and Pending Balance Due in `/dashboard/reports` against OMS order totals across `All Time`, `YTD`, `6 Months`, and `30 Days` filters, including with a `CANCELLED` order present. |
| 13 | **Excel Export Correctness** | **Verified in code:** `exportWorkbookToExcel` (`excelExport.ts:241-453`) builds a valid OpenXML `.xlsx` ZIP archive with 4 worksheets and summed total rows (`sumInTotals: true`). | Click "Export Excel" in `/dashboard/reports`; open the downloaded `.xlsx` file and verify all 4 sheets (`Orders & Payments Ledger`, `Pending Receivables`, `Category Breakdown`, `Monthly Revenue Trend`) and `TOTAL` rows match dashboard figures. |
| 14 | **Shoot Category Calculations** | **Partial (`REP-001`):** `categoryStats` (`BusinessReportsView.tsx:105-124`) groups by `eventType` and calculates count, revenue, and `%`, but currently includes `CANCELLED` orders in `filteredOrders`. | Create orders across multiple event types (e.g., Wedding, Engagement, Baby Shoot); verify category counts, revenue totals, and revenue share percentages on `/dashboard/reports`. |
| 15 | **Production & Delivery-Performance Metrics** | **Not Implemented (`REP-002`):** `BusinessReportsView.tsx` currently lacks delayed order counts, turnaround time averages, and on-time completion `%` panels. | After implementing `REP-002`, verify completed vs delayed order counts, average delivery turnaround days, and on-time delivery `%` match OMS SLA statuses. |

---

## D. Future Development Roadmap

### Summary by Implementation Status (Modules 04, 05 & 06 — 12 Features)
- **Implemented (`3 / 12`):**
  - Module 05, Panel 1: Public Studio Profile & Direct Inquiries
  - Module 05, Panel 2: Configurable Service Packages *(minor edit-modal enhancement tracked in `MKT-002`)*
  - Module 05, Panel 4: Privacy Protected Operations
  - Module 06, Panel 2: Exportable Business Reports *(4-sheet `.xlsx` export implemented; will inherit `REP-001`/`REP-002` data refinements)* -> **Note:** Counted as **4 Implemented**, **6 Partial**, **2 Not Implemented** across the 12 features:
    - **Implemented (4):**
      1. Module 05 — Public Studio Profile & Direct Inquiries
      2. Module 05 — Configurable Service Packages
      3. Module 05 — Privacy Protected Operations
      4. Module 06 — Exportable Business Reports
    - **Partially Implemented (6):**
      1. Module 04 — Automated WhatsApp Notifications (`WA-001`)
      2. Module 04 — Interactive Studio Operations Bot (`WA-002`)
      3. Module 04 — Crew Reminders & Call Times (`WA-004`)
      4. Module 05 — Booking Requests & Confirmation (`MKT-001`, `OMS-001`)
      5. Module 06 — Monthly & Yearly Revenue Reports (`REP-001`)
      6. Module 06 — Shoot Category Performance (`REP-001`)
    - **Not Implemented (2):**
      1. Module 04 — WhatsApp-Based Workflow Actions (`WA-003`)
      2. Module 06 — On-Time Delivery & Production Performance (`REP-002`)

### Recommended Development Order
1. **Phase 1 — Marketplace Booking Confirmation & Canonical Order Alignment (`MKT-001`, `OMS-001`, `MKT-002`)**
   - Unify `verifyPaymentAction` with canonical Order IDs (`ORD-<STUDIO>-YYMMDD-HHMMSS`), 6-digit numeric passkeys, and automatic CRM customer creation.
   - Add post-negotiation / studio-recorded advance payment confirmation UI so `AWAITING_PAYMENT` and `BOOKING_REQUEST` inquiries can always be converted into confirmed OMS orders.
2. **Phase 2 — Business Reports Accuracy & Production SLA Analytics (`REP-001`, `REP-002`)**
   - Filter out `CANCELLED` orders in `monthlyRevenueData` and `categoryStats`, add 12-month / yearly revenue comparisons, and build the On-Time Delivery & Production Performance section (plus Excel worksheet).
3. **Phase 3 — WhatsApp Webhook Security & Automated Outbound Triggers (`WA-002`, `WA-001`, `WA-004`)**
   - Enforce Meta `X-Hub-Signature-256` HMAC verification on `/api/whatsapp/webhook`, wire up `studio.whatsappConfig` triggers across order/task/gallery/payment server actions, add `callTime` to shoot assignments, and add scheduled crew call-time reminders.
4. **Phase 4 — Interactive WhatsApp Workflow Mutations (`WA-003`)**
   - Enable authenticated studio owners and assigned crew members to update supported task and order statuses via WhatsApp bot commands with full domain permission and dependency checks.
