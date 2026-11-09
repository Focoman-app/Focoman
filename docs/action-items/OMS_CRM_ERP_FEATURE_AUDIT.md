# FocoMan — OMS, CRM & ERP Feature Audit & Action Items

**Audit Date:** 2026-11-06  
**Scope:** Module 01 (OMS — Order Management System), Module 02 (CRM — Customer Relationship Management), Module 03 (ERP — Studio Operations)  
**Purpose:** Evidence-based audit comparing the 12 finalized landing-page feature panels against the actual FocoMan repository implementation, documenting gaps and pending work items for future development sprints.

---

## A. Feature Implementation Matrix

| Module | # | Feature Title | Status | Existing Implementation | Missing Functionality | Evidence (Files & Lines) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01 — OMS** | 1 | **Order Creation & Management** | `PARTIAL` | Direct studio order creation (`createOrderCore`) generates canonical Order IDs (`ORD-<STUDIO>-YYMMDD-HHMMSS`), links/creates CRM customer records, and supports editing, soft-delete, 14-day recovery, and cancellation. Marketplace booking verification (`verifyPaymentAction`) converts bookings into confirmed `Order` documents and links `bookingRequestId`. OMS list filter includes `"MARKETPLACE"` (`Boolean(order.bookingRequestId)`). | `verifyPaymentAction` in `marketplaceActions.ts` still generates legacy random UUID/4-digit Order IDs (`ORD-XXXX`) and legacy `FOC-...` `trackingPasskey` instead of using `generateOrderIdentifiers` and the 6-digit numeric passkey model used by direct studio orders. Also does not automatically upsert the Marketplace customer into the studio's `customers` collection on confirmation. | `apps/web/src/actions/orders/orderCrudOperations.ts:45-221`, `apps/web/src/components/oms/OmsCreateOrderModal.tsx`, `apps/web/src/components/oms/OmsOrdersListPanel.tsx:107,164-168`, `apps/web/src/actions/marketplaceActions.ts:458-559` |
| **01 — OMS** | 2 | **End-to-End Production Workflow** | `IMPLEMENTED` | Full lifecycle management from `AWAITING_EVENT` to `POST_EVENT_IN_PROGRESS` and `COMPLETED`. Includes pre-flight conflict checks (`performPreflightCheck`), crew & task assignment (`assignResourceCore`, `assignTaskCrewCore`), event-date locking (`updateTaskStatusCore`), sequential task dependencies (Raw Photo Selection -> Photo Editing -> Album Design -> Final Delivery), rework notes (`reworkNotes`), customer review status, and completion gating (`canCompleteOrder`). | None for core workflow; automated rule-based crew assignment at order creation is tracked under `ERP-002`. | `packages/domain/src/index.ts:28-62,474-572`, `apps/web/src/actions/orders/orderTaskOperations.ts:84-343`, `apps/web/src/components/workflow/OrderVerticalWorkflow.tsx` |
| **01 — OMS** | 3 | **Studio-Wide Order Overview** | `IMPLEMENTED` | Centralized OMS dashboard with search, status filtering (`ALL`, `MARKETPLACE`, `AWAITING_EVENT`, `POST_EVENT_IN_PROGRESS`, `COMPLETED`, `CANCELLED`), date/price sorting, payment badges (`PAID`, `ADVANCE RECEIVED`, `PARTIAL`), SLA & turnaround aging breakdown (`OmsTurnaroundSlaBanner` showing Overall Order Age, Pending at Studio days, Pending at Customer days), and Excel export. | None. | `apps/web/src/app/[studioSlug]/dashboard/oms/page.tsx:1263-1340`, `apps/web/src/components/oms/OmsOrdersListPanel.tsx:26-214`, `apps/web/src/components/oms/OmsOrderSubsections.tsx:6-106`, `apps/web/src/utils/dateUtils.ts` |
| **01 — OMS** | 4 | **Google Drive Integration & Client Review** | `PARTIAL` | `GoogleDriveDeliverablesSection` supports adding/removing Google Drive deliverable links (`FOLDER`, `IMAGE`, `VIDEO`, `PDF`, `OTHER`), lazy in-app iframe preview (`parseGoogleDriveUrl`), client comments/feedback (`clientFeedback`), and deliverable-level approval or revision requests (`clientApproved`: `true` / `false`) on `/track/[orderId]`, persisted via `updateOrderDriveDeliverablesCore` and `submitClientDeliverableReviewCore`. | Individual photo-by-photo selection / multi-photo culling inside a Google Drive folder is not implemented via Google Drive API; current integration embeds Google Drive's native folder/file viewer and captures per-deliverable text feedback and approval/revision status. | `apps/web/src/components/deliverables/GoogleDriveDeliverablesSection.tsx:68-496`, `apps/web/src/actions/orders/orderCustomerOperations.ts`, `apps/web/src/utils/googleDriveUtils.ts` |
| **02 — CRM** | 1 | **Centralized Customer Management** | `PARTIAL` | Centralized CRM directory (`CrmPage`) with customer profile creation (`createCustomerAction`), duplicate phone/email detection (`isContactMatch`), instant search by name/phone/email/address, Excel export, and backend actions for `updateCustomerAction`, `deleteCustomerAction`, and `restoreCustomerAction`. | The CRM detail drawer (`apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx:370-496`) is currently read-only for contact fields; it does not wire up an Edit Customer modal or Delete Customer button to the existing `updateCustomerAction` / `deleteCustomerAction` server actions. | `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx:130-173,370-496`, `apps/web/src/actions/customerActions.ts:25-235` |
| **02 — CRM** | 2 | **Customer Booking & Payment History** | `PARTIAL` | Displays each customer's active orders and soft-deleted orders (with 14-day recovery), cumulative Lifetime Value (`lifetimeValue`), and outstanding balance (`pendingReceivables`) in the CRM detail drawer. | Individual order cards in the CRM detail drawer (`crm/page.tsx:425-440`) only show `finalConfirmedPrice` and `orderStatus`. They do not display per-order payment breakdowns (advance paid, installments history, remaining balance) or Marketplace booking inquiry records (`booking_requests`) prior to order confirmation, nor a direct link to open the order in OMS. | `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx:106-128,388-493` |
| **02 — CRM** | 3 | **Studio-Wide Customer Overview** | `PARTIAL` | Lists all studio customers with per-customer order counts, LTV badges, and Excel export with summed totals (`Total Orders`, `Lifetime Value`, `Pending Receivables`). Domain helper `calculateCustomerLTV` exists in `@focoman/domain`. | The CRM header/overview (`crm/page.tsx:314-318`) only shows `Total Clients: {customers.length}`. It lacks studio-wide aggregate summary cards (Total Studio LTV, Total Pending Receivables across customers, Repeat Customers count, Top/Most Valuable Customers filter or sort by LTV/Repeat Bookings). | `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx:106-128,314-365`, `packages/domain/src/index.ts:685-727` |
| **02 — CRM** | 4 | **Automated Follow-ups & Anniversary Reminders** | `NOT IMPLEMENTED` | Domain calculation `calculateCustomerMilestones` is implemented in `packages/domain/src/index.ts:754-817` (computes `UPCOMING_EVENT` and `ANNUAL_ANNIVERSARY` with `daysRemaining` and `yearsCount`). WhatsApp template preview and Resend email infrastructure exist. | `calculateCustomerMilestones` is not imported or rendered anywhere in `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx` or any dashboard page. There is no scheduled job/cron or automated trigger to send anniversary reminders to studios or customers, and no UI actions in CRM to send personalized email/WhatsApp anniversary follow-ups. | `packages/domain/src/index.ts:729-817`, `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`, `apps/web/src/services/emailService.ts`, `apps/web/src/services/whatsappService.ts` |
| **03 — ERP** | 1 | **Team Directory & Roles** | `PARTIAL` | Centralized ERP team directory (`ErpPage`) displaying Studio Owner, active `StudioMember` records, Pending Invitations (with 6-digit PIN / copy link / share / revoke), and Temporary Crew (with one-click "Convert to ERP"). Backend `memberActions.ts` implements `createMemberAction`, `updateMemberAction`, `deleteMemberAction`, `restoreMemberAction`, and invitation flows. | In `ErpPage` (`apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx:751-904`), the selected crew member detail drawer is read-only for member profile details and does not expose UI controls to edit a member's name/phone/skills/status (`updateMemberAction`) or remove a member (`deleteMemberAction`). | `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx:248-904`, `apps/web/src/actions/memberActions.ts:42-650` |
| **03 — ERP** | 2 | **Crew Workload & Availability Overview** | `PARTIAL` | ERP detail drawer shows a selected member's upcoming shoot assignments (`orders` where `assignedResources` includes the member and `orderStatus !== "COMPLETED"`) and lets the owner/member confirm or reject shoot availability (`confirmResourceAvailabilityAction`). Excel export includes an `Assigned Orders Count` column. | ERP lacks a studio-wide crew workload & availability overview panel (e.g., studio-wide workload distribution cards, pending production `Task` counts per member in ERP, overloaded member indicators, and a date-based availability filter to find free crew for an upcoming date). Currently, ERP only inspects `order.assignedResources` and does not load or display assigned post-event `tasks` per crew member. | `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx:101-122,410-424,834-900`, `packages/domain/src/index.ts:134-163` |
| **03 — ERP** | 3 | **Automated Workflow & Task Assignment** | `PARTIAL` | When a new order is confirmed (both direct studio order in `createOrderCore` and Marketplace order in `verifyPaymentAction`), `generateWorkflowTasks` automatically initiates the post-event production task pipeline based on selected services. Manual crew assignment is available in OMS for both shoot services and production tasks. | Tasks created by `generateWorkflowTasks` always initialize with `assignedMemberId: ""` and `assignedMemberName: "Unassigned"`. There is no studio workflow automation rule configuration (e.g., default crew member per skill/task category or auto-assigning top `generateResourceSuggestions` match) to automatically assign crew members when an order is confirmed. Furthermore, `createOrderCore` does not populate `resourceSuggestions` or `preflightReport` (only `verifyPaymentAction` does). | `packages/domain/src/index.ts:134-163,497-572`, `apps/web/src/actions/orders/orderCrudOperations.ts:114,149-164`, `apps/web/src/actions/marketplaceActions.ts:469-550` |
| **03 — ERP** | 4 | **Invoices & Receipts Management** | `PARTIAL` | `MinimalBillingModal` and `invoicePdfGenerator.ts` generate print-ready and downloadable PDF invoices (`INV-<orderNumber>`) and payment receipts (`RCP-<orderNumber>-ADV`, `RCP-<orderNumber>-01`, etc.) linked to confirmed orders, with customizable studio/individual billing profile fields (`StudioBillingProfile`). Accessible from the OMS order detail view and customer tracking portal. | Invoices and receipts are only accessible per-order inside the OMS detail drawer (`OmsPaymentSummarySection`) and `/track/[orderId]`. There is no centralized Invoices & Receipts directory or management view inside the ERP dashboard (`apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx`) to browse, search, filter, or download all studio transaction documents in one place. | `apps/web/src/components/billing/MinimalBillingModal.tsx:61-889`, `apps/web/src/utils/invoicePdfGenerator.ts`, `apps/web/src/components/oms/OmsPaymentSummarySection.tsx`, `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx` |

---

## B. Pending Development Action Items

### `OMS-001` — Unify Marketplace Order Confirmation with Canonical Order ID, 6-Digit Passkey & CRM Sync
- **Feature Name:** Module 01 (OMS) — Panel 1: Order Creation & Management
- **Current Implementation:** Direct studio orders created via `createOrderCore` (`apps/web/src/actions/orders/orderCrudOperations.ts:58-190`) generate canonical Order IDs (`ORD-<STUDIO>-YYMMDD-HHMMSS`), store a 6-digit numeric passkey (`passkeyPin`), and automatically create or update the customer record in the `customers` collection. However, Marketplace orders confirmed via `verifyPaymentAction` (`apps/web/src/actions/marketplaceActions.ts:460-559`) still generate legacy IDs (`ORD-${randomUUID}`), 4-digit order numbers (`ORD-1234`), and `FOC-...` hex `trackingPasskey` values without a 6-digit `passkeyPin`, and do not upsert the customer into the studio's `customers` collection.
- **Missing Requirements:**
  1. Use `generateOrderIdentifiers(parsed.studioId, now)` in `verifyPaymentAction` so Marketplace-confirmed orders share the exact canonical Order ID format (`order.id === order.orderNumber`).
  2. Generate and persist a 6-digit numeric passkey (`passkeyPin` / salted hash) instead of `FOC-...` hex tokens.
  3. Upsert the Marketplace customer into the studio's `customers` collection upon booking confirmation so they appear in CRM immediately.
- **Expected Behavior:** Confirming a Studio Marketplace booking produces an `Order` with the same canonical ID format, 6-digit passkey access flow, and CRM customer record as a direct studio booking.
- **Relevant Source Files:**
  - `apps/web/src/actions/marketplaceActions.ts` (lines 458–559)
  - `apps/web/src/actions/orders/orderCrudOperations.ts` (lines 58–190)
  - `apps/web/src/lib/invitationPasscode.ts`
- **Dependencies:** None
- **Priority:** `HIGH`
- **Status:** `COMPLETED (2026-11-09)`

---

### `OMS-002` — Granular Photo Selection & Commenting Workflow for Google Drive Deliverables
- **Feature Name:** Module 01 (OMS) — Panel 4: Google Drive Integration & Client Review
- **Current Implementation:** `GoogleDriveDeliverablesSection.tsx` supports adding Google Drive folder/file URLs, previewing them in an embedded iframe, and submitting a single text comment (`clientFeedback`) plus Approve / Request Changes (`clientApproved`) per deliverable link.
- **Missing Requirements:**
  1. Allow customers to select/shortlist individual photos or submit structured selection lists (e.g., photo filenames/numbers or Drive file items) alongside per-item comments within FocoMan.
  2. Display customer photo selection counts and structured revision comments in the OMS order detail view and link them to the `"Raw Photo Selection"` / `"Album Edit"` workflow tasks.
- **Expected Behavior:** Customers can preview Google Drive galleries, select photos for editing/album design, leave comments, and approve deliverables directly within FocoMan, with selections visible to studio staff in OMS.
- **Relevant Source Files:**
  - `apps/web/src/components/deliverables/GoogleDriveDeliverablesSection.tsx`
  - `apps/web/src/actions/orders/orderCustomerOperations.ts`
  - `apps/web/src/utils/googleDriveUtils.ts`
  - `packages/types/src/index.ts` (`OrderDriveDeliverable`)
- **Dependencies:** Optional Google Drive API key / OAuth read scope if listing individual files inside shared folders automatically, or structured selection list UI for zero-API-key mode.
- **Priority:** `MEDIUM`
- **Status:** `COMPLETED (2026-11-09)`

---

### `CRM-001` — Wire Up Customer Profile Edit, Soft-Delete & Restore UI Controls in CRM Dashboard
- **Feature Name:** Module 02 (CRM) — Panel 1: Centralized Customer Management
- **Current Implementation:** Server actions `updateCustomerAction`, `deleteCustomerAction`, and `restoreCustomerAction` exist in `apps/web/src/actions/customerActions.ts` (lines 122–235), with duplicate contact validation. However, `CrmPage` (`apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`) only implements `createCustomerAction` and read-only profile viewing.
- **Missing Requirements:**
  1. Add an "Edit Profile" button and modal/inline form in the CRM customer detail drawer to update `name`, `phone`, `email`, and `address` via `updateCustomerAction`.
  2. Add a "Delete Customer" action with confirmation dialog wired to `deleteCustomerAction`, and a view/toggle to restore soft-deleted customer profiles via `restoreCustomerAction`.
- **Expected Behavior:** Studio owners can create, edit, soft-delete, and restore customer profiles directly from the centralized CRM directory.
- **Relevant Source Files:**
  - `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx` (lines 370–496)
  - `apps/web/src/actions/customerActions.ts` (lines 122–235)
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `COMPLETED (2026-11-09)`

---

### `CRM-002` — Detailed Per-Order Payment History, Receipts & Marketplace Inquiry Records in Customer Profile
- **Feature Name:** Module 02 (CRM) — Panel 2: Customer Booking & Payment History
- **Current Implementation:** The CRM detail drawer (`apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx:425-440`) lists active orders with only `eventType`, `orderNumber`, `eventDate`, `finalConfirmedPrice`, and `orderStatus`.
- **Missing Requirements:**
  1. Display per-order payment details in the customer's order history card using `calculateOrderPaymentBreakdown(order)` (Confirmed Value, Advance Paid, Installments Paid, Remaining Balance, Payment Status badge).
  2. Provide quick actions on each order in the CRM drawer to open the order in OMS (`/${studioSlug}/dashboard/oms?orderId=${order.id}`) or view its Invoice/Receipts.
  3. Display linked Studio Marketplace booking inquiries (`BookingRequest` records matching customer ID/phone/email) so the studio has a complete record of inquiries and confirmed bookings.
- **Expected Behavior:** Selecting a customer in CRM shows their complete booking and payment ledger (order value, advance, installments, outstanding balance, and past inquiries) with direct navigation to OMS/billing documents.
- **Relevant Source Files:**
  - `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx` (lines 413–494)
  - `apps/web/src/actions/marketplaceActions.ts` (`getStudioBookingRequestsAction`)
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `COMPLETED (2026-11-09)`

---

### `CRM-003` — Studio-Wide Customer Overview Metrics, Repeat Booking Insights & Top-Customer Sorting
- **Feature Name:** Module 02 (CRM) — Panel 3: Studio-Wide Customer Overview
- **Current Implementation:** `CrmPage` computes `customerMetrics` (`totalOrders`, `lifetimeValue`, `pendingReceivables`, `latestOrder`) per customer in memory (`crm/page.tsx:106-128`), but only displays a single `Total Clients: {customers.length}` badge in the header (`crm/page.tsx:315-317`) and does not provide sorting or filtering by LTV, repeat bookings, or pending dues.
- **Missing Requirements:**
  1. Add studio-wide CRM summary KPI cards in `CrmPage` showing: Total Customers, Repeat Customers (`totalOrders > 1`), Studio-Wide Customer LTV, and Total Outstanding Receivables.
  2. Add filter/sort controls in the CRM directory to sort customers by Highest LTV, Most Orders (Repeat Clients), Pending Balance Due, or Recent Activity.
- **Expected Behavior:** Studio owners get an immediate studio-wide overview of customer booking activity, repeat bookings, lifetime value, and top customers.
- **Relevant Source Files:**
  - `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx` (lines 106–128, 302–366)
  - `packages/domain/src/index.ts` (`calculateCustomerLTV`, lines 685–727)
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `COMPLETED (2026-11-09)`

---

### `CRM-004` — Customer Anniversary & Milestone Tracking UI + Automated Email/WhatsApp Follow-Ups
- **Feature Name:** Module 02 (CRM) — Panel 4: Automated Follow-ups & Anniversary Reminders
- **Current Implementation:** `calculateCustomerMilestones` is implemented in `packages/domain/src/index.ts` (lines 754–817) and tested in unit tests, calculating upcoming events and annual anniversaries from order `eventDate` values. However, it is not connected to the CRM UI or any notification/reminder workflow.
- **Missing Requirements:**
  1. Integrate `calculateCustomerMilestones` into `CrmPage` (both as a studio-wide "Upcoming Anniversaries & Milestones" section/filter and inside each customer's profile drawer).
  2. Add one-click follow-up actions in CRM to send personalized anniversary/milestone wishes and repeat-booking offers via Email (`emailService.ts`) and WhatsApp click-to-chat / bot templates (`whatsappService.ts`).
  3. Add an automated reminder trigger / scheduled endpoint (or dashboard notification digest) to alert studio owners and customers of upcoming anniversaries.
- **Expected Behavior:** Studios can view upcoming customer anniversaries and event milestones in CRM, receive automated reminders, and send personalized follow-ups via email and WhatsApp to drive repeat bookings.
- **Relevant Source Files:**
  - `packages/domain/src/index.ts` (lines 729–817)
  - `apps/web/src/app/[studioSlug]/dashboard/crm/page.tsx`
  - `apps/web/src/services/emailService.ts`
  - `apps/web/src/services/whatsappService.ts`
- **Dependencies:** `CRM-003` (shared CRM overview layout)
- **Priority:** `HIGH`
- **Status:** `COMPLETED (2026-11-09)`

---

### `ERP-001` — Crew Member Profile Editing, Role/Skill Updates & Deactivation UI in ERP Drawer
- **Feature Name:** Module 03 (ERP) — Panel 1: Team Directory & Roles
- **Current Implementation:** `memberActions.ts` provides `updateMemberAction`, `deleteMemberAction`, and `restoreMemberAction` (lines 392–474), but the selected crew member drawer in `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx` (lines 751–904) only renders static contact details and skill badges.
- **Missing Requirements:**
  1. Add "Edit Member" controls in the ERP member detail drawer allowing the studio owner to update a crew member's name, phone number, certified skills (`PHOTOGRAPHY`, `VIDEOGRAPHY`, `PHOTO_EDITING`, `ALBUM_DESIGN`), and active/inactive status via `updateMemberAction`.
  2. Add "Remove Member" confirmation and soft-delete recovery support wired to `deleteMemberAction` and `restoreMemberAction`.
- **Expected Behavior:** Studio owners can manage crew profiles, update roles/skills, and deactivate/remove team members directly from the ERP directory.
- **Relevant Source Files:**
  - `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx` (lines 751–904)
  - `apps/web/src/actions/memberActions.ts` (lines 392–474)
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `COMPLETED (2026-11-09)`

---

### `ERP-002` — Studio-Wide Crew Workload, Pending Task Counts & Date Availability Overview in ERP
- **Feature Name:** Module 03 (ERP) — Panel 2: Crew Workload & Availability Overview
- **Current Implementation:** `ErpPage` loads `membersData` and `ordersData` (`erp/page.tsx:109-113`), showing upcoming shoot assignments (`order.assignedResources`) inside a single selected member's drawer. It does not load studio production `tasks`, does not display pending task counts per crew member, and lacks a studio-wide workload distribution or date availability filter.
- **Missing Requirements:**
  1. Fetch studio-wide active tasks (or aggregate member task workloads) alongside `orders` in `ErpPage`.
  2. Display workload badges on each crew card in the ERP list (Assigned Upcoming Shoots count, Pending Production Tasks count, and an "Overloaded" warning badge when workload exceeds threshold).
  3. Add a studio-wide Workload & Availability summary bar and an Event Date availability filter in ERP so studio owners can pick a target shoot date and immediately see which crew members are free vs. already booked on that date.
- **Expected Behavior:** Studio owners get a studio-wide overview of crew workloads, assigned shoots, pending tasks, and date-specific availability to monitor workload distribution and find available crew for upcoming projects.
- **Relevant Source Files:**
  - `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx` (lines 101–128, 504–904)
  - `packages/domain/src/index.ts` (`performPreflightCheck`, `generateResourceSuggestions`, `toMemberWorkView`)
  - `packages/db/src/index.ts`
- **Dependencies:** None
- **Priority:** `HIGH`
- **Status:** `COMPLETED (2026-11-09)`

---

### `ERP-003` — Automated Workflow Rules & Auto-Assignment of Crew/Tasks on Order Confirmation
- **Feature Name:** Module 03 (ERP) — Panel 3: Automated Workflow & Task Assignment
- **Current Implementation:** `generateWorkflowTasks` (`packages/domain/src/index.ts:497-572`) automatically creates production tasks when an order is confirmed, but always sets `assignedMemberId: ""` and `assignedMemberName: "Unassigned"`. `generateResourceSuggestions` exists in `@focoman/domain` (lines 134–163) to score crew members by skill match and active task workload, and is called in `verifyPaymentAction`, but is not called in `createOrderCore` (`orderCrudOperations.ts`) and does not auto-assign crew based on configurable studio workflow rules.
- **Missing Requirements:**
  1. Allow studios to configure workflow automation rules (e.g., enable/disable automatic crew assignment per skill/task category or default assignee rules, falling back to least-loaded available member with matching skill).
  2. Run `performPreflightCheck` and `generateResourceSuggestions` in both `createOrderCore` (direct bookings) and `verifyPaymentAction` (Marketplace bookings).
  3. When workflow automation is enabled for the studio, automatically populate `assignedResources` and task `assignedMemberId` / `assignedMemberName` upon order confirmation according to the studio's predefined rules, while preserving manual assignment when automation is not configured.
- **Expected Behavior:** Confirming a direct or Marketplace order automatically initiates production tasks and assigns crew members according to configured studio workflow rules, with manual assignment available whenever automation is not configured.
- **Relevant Source Files:**
  - `packages/domain/src/index.ts` (lines 68–163, 497–572)
  - `apps/web/src/actions/orders/orderCrudOperations.ts` (lines 89–190)
  - `apps/web/src/actions/marketplaceActions.ts` (lines 466–559)
  - `packages/types/src/index.ts` (`Studio`)
- **Dependencies:** `OMS-001`, `ERP-002`
- **Priority:** `HIGH`
- **Status:** `COMPLETED (2026-11-09)`

---

### `ERP-004` — Centralized Studio Invoices & Payment Receipts Management View in ERP
- **Feature Name:** Module 03 (ERP) — Panel 4: Invoices & Receipts Management
- **Current Implementation:** `MinimalBillingModal` (`apps/web/src/components/billing/MinimalBillingModal.tsx`) and `invoicePdfGenerator.ts` generate, print, and download PDF invoices (`INV-...`) and payment receipts (`RCP-...`) for individual orders inside OMS (`OmsPaymentSummarySection`) and the customer tracking portal (`/track/[orderId]`). However, there is no centralized view in ERP to browse or manage all invoices and receipts across the studio.
- **Missing Requirements:**
  1. Add an "Invoices & Receipts" tab or panel in the ERP dashboard (`apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx`) listing all confirmed order invoices and recorded advance/installment payment receipts across the studio.
  2. Support searching/filtering transaction documents by Order ID, Invoice/Receipt number, customer name, or payment status, and opening `MinimalBillingModal` (or downloading the PDF directly) from ERP.
- **Expected Behavior:** Studio owners can generate, browse, search, download, and share studio invoices and customer payment receipts linked to confirmed orders from a centralized ERP view as well as from individual orders.
- **Relevant Source Files:**
  - `apps/web/src/app/[studioSlug]/dashboard/erp/page.tsx`
  - `apps/web/src/components/billing/MinimalBillingModal.tsx`
  - `apps/web/src/utils/invoicePdfGenerator.ts`
  - `packages/domain/src/index.ts` (`calculateOrderPaymentBreakdown`, lines 191–282)
- **Dependencies:** None
- **Priority:** `MEDIUM`
- **Status:** `COMPLETED (2026-11-09)`

---

## C. Validation Checklist

### 1. Source-Code Verified (Completed in Audit)
- [x] **Landing Page & Features Page Copy Alignment:** Verified that all 12 feature panel titles and descriptions across Module 01 (OMS), Module 02 (CRM), and Module 03 (ERP) match the approved copy word-for-word in `apps/web/src/components/public/ModuleAccordion.tsx` and `apps/web/src/app/features/page.tsx`.
- [x] **Preservation of Unchanged Content:** Verified that Module 01, 02, and 03 main headings and `shortDesc` summaries, as well as Modules 04, 05, and 06, remain untouched.
- [x] **OMS End-to-End Workflow Logic (`packages/domain/src/index.ts` & `orderTaskOperations.ts`):** Verified task sequence generation (`generateWorkflowTasks`), shoot-date locking, sequential task completion checks, rework notes, and order completion gating (`canCompleteOrder`).
- [x] **OMS Studio-Wide Order Overview (`OmsOrdersListPanel.tsx` & `OmsOrderSubsections.tsx`):** Verified status filters, Marketplace order filter, payment status badges, and SLA turnaround breakdown (`calculateOrderAging`).

### 2. Runtime & Integration Validation Scenarios (Pending Execution in Future Sprints)
- [ ] **Direct Order Registration & Workflow Progression (OMS Panels 1, 2, 3):**
  - Register a confirmed order with multiple services, verify auto-generated tasks in Firestore, transition event date to past, progress tasks through `IN_PROGRESS` -> `CUSTOMER_REVIEW` -> `REWORK` -> `COMPLETED`, record full payment, and verify order transitions to `COMPLETED`.
- [ ] **Marketplace Booking to Confirmed Order Flow (OMS Panel 1 / `OMS-001`):**
  - Submit a public Marketplace booking inquiry, record advance payment proof, verify payment as Studio Owner, and confirm the resulting order appears in OMS under the `"Studio Marketplace Orders"` filter with canonical Order ID and 6-digit passkey.
- [ ] **Google Drive Deliverable Preview & Client Approval Flow (OMS Panel 4 / `OMS-002`):**
  - Add a Google Drive folder link and PDF proof link in OMS, open `/track/<orderId>`, authenticate with the 6-digit customer passkey, preview deliverables in-app, submit client feedback and approval, and verify status badge updates in OMS.
- [ ] **CRM Directory, LTV Calculation & Anniversary Milestones (CRM Panels 1, 2, 3, 4):**
  - Verify customer auto-creation from OMS, duplicate phone/email prevention, cumulative LTV and pending receivables accuracy across multiple orders, and milestone calculation (`calculateCustomerMilestones`) for past and future event dates.
- [ ] **ERP Crew Invitation, Availability Confirmation & Billing PDF Export (ERP Panels 1, 2, 3, 4):**
  - Invite a crew member with and without email (6-digit PIN claim flow), assign crew to shoot and post-event tasks, confirm/reject availability, and generate/download Invoice (`INV-...`) and Payment Receipt (`RCP-...`) PDFs via `MinimalBillingModal`.

---

## D. Future Development Tracking Summary

### Status Breakdown (12 Approved Features)
- **Implemented (`IMPLEMENTED`):** **2 / 12**
  - OMS Panel 2: *End-to-End Production Workflow*
  - OMS Panel 3: *Studio-Wide Order Overview*
- **Partially Implemented (`PARTIAL`):** **9 / 12**
  - OMS Panel 1: *Order Creation & Management* (`OMS-001`)
  - OMS Panel 4: *Google Drive Integration & Client Review* (`OMS-002`)
  - CRM Panel 1: *Centralized Customer Management* (`CRM-001`)
  - CRM Panel 2: *Customer Booking & Payment History* (`CRM-002`)
  - CRM Panel 3: *Studio-Wide Customer Overview* (`CRM-003`)
  - ERP Panel 1: *Team Directory & Roles* (`ERP-001`)
  - ERP Panel 2: *Crew Workload & Availability Overview* (`ERP-002`)
  - ERP Panel 3: *Automated Workflow & Task Assignment* (`ERP-003`)
  - ERP Panel 4: *Invoices & Receipts Management* (`ERP-004`)
- **Not Implemented (`NOT IMPLEMENTED`):** **1 / 12**
  - CRM Panel 4: *Automated Follow-ups & Anniversary Reminders* (`CRM-004` — domain calculation exists in `@focoman/domain`, UI & automation triggers not yet built)
- **Needs Verification (`NEEDS VERIFICATION`):** **0 / 12** (all 12 features were directly verified against source code; runtime validation scenarios are tracked in Section C.2)

### Recommended Development Order
1. **Phase 1 — Core Order & Workflow Consistency (`HIGH` Priority):**
   - `OMS-001`: Unify Marketplace order confirmation (`verifyPaymentAction`) with canonical Order IDs, 6-digit passkey hashing, and automatic CRM customer sync.
   - `ERP-002`: Add studio-wide crew workload, pending task counts, and date-based availability filtering in ERP.
   - `ERP-003`: Implement configurable studio workflow automation rules to auto-assign crew members and tasks on order confirmation.
2. **Phase 2 — CRM Retention & Overview Enhancements (`HIGH` / `MEDIUM` Priority):**
   - `CRM-004`: Surface `calculateCustomerMilestones` in the CRM UI and wire up automated/one-click Email & WhatsApp anniversary reminders.
   - `CRM-003`: Add studio-wide CRM aggregate KPI cards (Total LTV, Repeat Customers, Pending Receivables) and LTV/repeat sorting.
   - `CRM-002`: Expand CRM customer order cards with detailed payment breakdowns, receipt links, and Marketplace inquiry history.
   - `CRM-001`: Wire up Edit/Delete/Restore customer profile modals in CRM.
3. **Phase 3 — ERP Operations & Client Deliverable Enhancements (`MEDIUM` Priority):**
   - `ERP-004`: Add a centralized Invoices & Receipts directory tab inside ERP.
   - `ERP-001`: Wire up Edit/Remove crew member controls in the ERP detail drawer.
   - `OMS-002`: Enhance Google Drive deliverables with structured photo selection / culling lists alongside client review approvals.
