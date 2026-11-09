# FocoMan — Complete Feature Action Items, Three-Tier Entitlements & Value-Added Services Implementation Plan

This plan unifies all pending feature action items identified across Modules 01–06 (`OMS`, `CRM`, `ERP`, `WhatsApp Operations & Interactive Bot`, `Studio Marketplace`, and `Business Reports & Analytics`), the **Three-Tier Subscription & Entitlement Model** (`Free — ₹0`, `Professional — ₹999/month`, `Complete — ₹1,999/month`), and the **Value-Added Services Common WhatsApp Inquiry & Dev Portal Logging** workflow—while strictly preserving FocoMan’s existing tactile retro UI design system, color tokens, and typography.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Scope & Additions**
> 1. **Value-Added Services Common WhatsApp Inquiry + Dev Portal Logs**:
>    - Keep the existing **01 Branding and Website** (*Logo creation*, *Website / portfolio creation*) and **02 Data Migration** (*Migrate existing studio data into Focoman*) cards unchanged.
>    - Add **one common "Send Inquiry on WhatsApp" button** below the two Value-Added Services cards that routes to WhatsApp number **`8072333075`** (`https://wa.me/918072333075`) with a pre-filled inquiry message.
>    - Record every Value-Added Services inquiry click/submission in Firestore (`vas_inquiries`) and surface both the aggregate count and recent inquiry activity logs inside the **Dev Portal** (`/devportal` under Overview & WhatsApp tabs).
> 2. **Strict Design & Workflow Preservation**:
>    - All new modals, drawers, tabs, buttons, and tier gates will strictly use the existing FocoMan Retro UI design classes (`retro-ui`, `.retro-card`, `.retro-btn`, `.badge-brand-*`, `.header-brand-*`) without altering the application’s layout, spacing, or theme.
> 3. **Single Order ID + 6-Digit Passkey Invariant**:
>    - Marketplace bookings converted into confirmed OMS orders will be unified with direct studio bookings so every order uses one canonical Order ID (`ORD-<STUDIO>-YYMMDD-HHMMSS`) and one salted-hash 6-digit numeric Customer Passkey.

---

## 1. Overview & Application Context

- **What FocoMan Does**: FocoMan is an end-to-end business operating system for photography and videography studios. It unifies public studio discovery and booking inquiries (**Studio Marketplace**), order lifecycle and deliverable management (**OMS**), client directory and retention (**CRM**), crew scheduling, workload, and billing documents (**ERP**), mobile chat operations (**WhatsApp Operations & Interactive Bot**), financial/production performance tracking (**Business Reports & Analytics**), and optional onboarding services (**Value-Added Services**).
- **Target Personas**:
  - **Studio Owners**: Manage orders, pricing, packages, customers, crew assignments, billing, WhatsApp automation, and financial reports, or request Value-Added Services (Branding/Website & Data Migration).
  - **Studio Crew Members**: View assigned shoots and post-event production tasks, confirm availability, and update task progress via the dashboard or WhatsApp bot.
  - **Customers**: Discover studios on the public Marketplace, submit booking requests, and track active orders / review Google Drive deliverables using their Order ID and 6-digit numeric passkey.
  - **Platform Administrators (Dev Portal)**: Monitor platform-wide aggregate counts, email/WhatsApp provider status, domain validity, and Value-Added Services WhatsApp inquiry logs.

---

## 2. Visual Identity, Color Palette & Typography Used Inside the App

All new and updated components will adhere strictly to FocoMan’s established **Global Retro / Tactile Business Software Theme** (`data-ui-style="retro"`, `.retro-ui`).

### A. Color Palette & Surface Tokens

| Token / Category | Role in Application | Hex Code / CSS Token | Tailwind / Custom Class |
| :--- | :--- | :--- | :--- |
| **App Background** | Primary warm cream paper canvas across public & dashboard views | `#F7F3EE` (`--retro-bg-app`) | `bg-surface-app` / `bg-[#F7F3EE]` |
| **Alternate Cream Surface** | Top navigation bars, section headers, and subtle card wells | `#FAF7F2` (`--retro-bg-card-alt`) | `bg-[#FAF7F2]` |
| **Subtle Recessed Surface** | Table headers, segmented nav tracks, and muted wells | `#ECE6DE` (`--retro-bg-subtle`) | `bg-[#ECE6DE]` / `bg-[#F5EFEB]` |
| **Card Surface** | Primary elevated cards, drawers, and modals | `#FFFFFF` / `#FFFDF9` | `bg-white` / `bg-[#FFFDF9]` |
| **Sidebar Surface** | Persistent dark slate-navy studio navigation sidebar | `#181B20` / `#111827` | `bg-[#181B20]` (`border-[#262A32]`) |
| **Primary Border** | Crisp structural card and input borders | `#D8D2C4` (`--retro-border`) | `border-border-default` / `border-[#D8D2C4]` |
| **Strong / Bevel Border** | Hover borders and 2px physical button bottom bevels | `#BFB8A7` / `#C4BCAB` | `border-[#BFB8A7]` / `shadow-[0_2px_0_#C4BCAB]` |
| **Divider Border** | Subtle internal row and section dividers | `#E6E0D4` | `border-border-divider` / `border-[#E6E0D4]` |
| **Primary Text** | High-contrast headings, labels, and primary values | `#1C1917` (`--retro-text-primary`) | `text-text-primary` / `text-[#1C1917]` |
| **Secondary Text** | Body copy, descriptions, and table cell metadata | `#57534E` (`--retro-text-secondary`) | `text-text-secondary` / `text-[#57534E]` |
| **Muted / Tertiary Text** | Timestamps, captions, and input placeholders | `#8C857B` (`--retro-text-muted`) | `text-text-tertiary` / `text-[#8C857B]` |
| **Brand Orange** | Primary CTAs, CRM accent, active sidebar state, and alerts | Primary `#F97316`, Hover `#EA580C`, Bevel `#9A3412`, Soft `#FED7AA`, Bg `#FFF7ED` | `bg-brand-orange-primary`, `.btn-brand-orange`, `.badge-brand-orange` |
| **Brand Blue** | OMS accent, workspace actions, and Complete tier badges | Primary `#0EA5E9`, Hover `#0284C7`, Bevel `#0369A1`, Soft `#BAE6FD`, Bg `#F0F9FF` | `bg-brand-blue-primary`, `.btn-brand-blue`, `.badge-brand-blue` |
| **Brand Purple** | ERP / Crew operations accent and workflow indicators | Primary `#8B5CF6`, Hover `#7C3AED`, Bevel `#6D28D9`, Soft `#DDD6FE`, Bg `#FAF5FF` | `bg-brand-purple-primary`, `.btn-brand-purple`, `.badge-brand-purple` |
| **Status Success (Green)** | Completed orders, verified payments, Free/Marketplace & WhatsApp badges | Primary `#22C55E` / `#16A34A`, Bevel `#15803D`, Border `#86EFAC`, Bg `#F0FDF4` | `text-status-success`, `.badge-status-success` |
| **Status Warning (Amber)** | Business Reports accent, pending verifications, approaching SLAs | Primary `#F59E0B`, Border `#FDE68A`, Bg `#FFFBEB`, Text `#B45309` | `text-status-warning`, `.badge-status-warning` |
| **Status Error (Red)** | Overdue SLAs, rejected payments, destructive actions | Primary `#EF4444`, Border `#FECACA`, Bg `#FEF2F2`, Text `#B91C1C` | `text-status-error`, `.badge-status-error` |

### B. Typography & Font Families Used Inside the App

1. **Primary UI & Body Font (`Inter` — `--font-inter` / `font-sans`)**:
   - Stack: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
   - Weights: `300`, `400`, `500`, `600`, `700`, `800`, `900`
   - Usage: All dashboard navigation, tables, form controls, body paragraphs, buttons (`font-bold`), and dense operational interfaces.
2. **Editorial Display Serif (`.retro-serif-heading`)**:
   - Stack: `Georgia, Cambria, "Times New Roman", Times, serif` (`letter-spacing: -0.02em`)
   - Usage: Public landing page hero headlines, module accordion headers, pricing tier titles, and big price figures.
3. **Monospace & Tabular Numerals (`font-mono` / `tabular-nums`)**:
   - Stack: System monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`)
   - Usage: Canonical Order IDs (`ORD-LUM-261106-143025`), 6-digit passkeys, invoice/receipt numbers (`INV-...`, `RCP-...`), financial values (`₹`), SLA day counters, and bracketed kickers (`[ ... ]`).
4. **Handwritten Accent Fonts (`Caveat` & `Kalam`)**:
   - Loaded in `globals.css` (`Caveat:wght@500;600;700`, `Kalam:wght@400;700`) for visual callouts and retro hero annotations.

---

## 3. Key Product & Architectural Workstreams

### A. Value-Added Services Common WhatsApp Inquiry & Dev Portal Logging
- **Common WhatsApp Inquiry Button (`ValueAddedServices`)**:
  - Preserve the existing `[ VALUE-ADDED SERVICES ]` header, `Studio Setup and Creative Add-ons` title, subtitle, and two cards (`01 Branding and Website` and `02 Data Migration`).
  - Add a single centered common action button below the two cards: **Send Inquiry on WhatsApp** targeting **`8072333075`** (`https://wa.me/918072333075?text=...` with a pre-populated message covering Branding & Website / Data Migration).
  - Clicking the button records an inquiry log entry via a lightweight server action/API route (`logVasWhatsappInquiryAction`) storing `id`, `createdAt`, `targetPhone: "8072333075"`, `services: ["Branding and Website", "Data Migration"]`, and `sourcePage`.
- **Dev Portal Integration (`/devportal`)**:
  - Extend `/api/dev/metrics` and `DevPortal` (`Overview` and `WhatsApp` tabs) to display:
    - Total Value-Added Services WhatsApp Inquiries count (`vasInquiriesCount`).
    - Recent Value-Added Services Inquiry Logs table (`vasInquiryLogs` showing timestamp, services inquired, source path, and target WhatsApp `+91 8072333075`).

### B. Three-Tier Subscription & Routing Model
- **Free Plan (`₹0` — `FREE`)**:
  - **Included**: Basic OMS (Order Management System) + Studio Marketplace.
  - **Workspace Routing**: When a Free-plan Studio Owner launches their workspace or visits `/${studioSlug}/dashboard` (and is not in an active 30-day trial or on the lifetime Pro whitelist), they are automatically directed to `/${studioSlug}/dashboard/oms`.
  - **Sidebar & Route Gating**: The Business Dashboard (`/${studioSlug}/dashboard`) is restricted to paid plans (`PROFESSIONAL` ₹999/mo, `COMPLETE` ₹1,999/mo, or active trial).
- **Professional Plan (`₹999/month` — `PROFESSIONAL`)**:
  - **Included**: Everything in Free + **Advanced OMS** (Google Drive Photo Preview & Selection with customer review functionality) + **CRM** + **ERP** + **Basic Business Dashboard** (Order counts, Revenue overview, and Pending payment overview).
  - **Dashboard Behavior**: `/${studioSlug}/dashboard` renders the **Basic Business Dashboard** (Order counts, Revenue overview, Pending payment overview, and active orders list), while Advanced Business Reports & Excel Exports require the ₹1,999 plan.
- **Complete Plan (`₹1,999/month` — `COMPLETE`, Active Trial, or Lifetime Pro)**:
  - **Included**: Everything in ₹999 Plan + **WhatsApp Operations & Interactive Bot** + **Advanced Business Reports & Analytics** + **Excel Report Exports**.
- **Checkout Builder Alignment (`/checkout`)**:
  - Update the checkout builder so studio owners can select and activate one of the three official plans (`Free — ₹0`, `Professional — ₹999/month`, `Complete — ₹1,999/month`) directly for their studio workspace.

### C. Complete Feature Action Items Across Modules 01–06
1. **Module 01 (OMS) & Module 05 (Marketplace)**:
   - **`OMS-001` & `MKT-001` (Marketplace Order Confirmation & Canonical ID/Passkey Unification)**:
     - Update `verifyPaymentAction` to generate canonical Order IDs (`generateOrderIdentifiers` -> `ORD-<STUDIO>-YYMMDD-HHMMSS`), generate a cryptographic 6-digit numeric passkey (`passkeyPin` + salted hash), remove legacy `FOC-...` `trackingPasskey` generation, and automatically upsert the Marketplace customer into the studio’s `customers` collection.
     - Add a `"Record & Verify Advance / Convert to Order"` action in Marketplace inquiries so bookings in `BOOKING_REQUEST` or `AWAITING_PAYMENT` (post-negotiation or offline advance collection) can be confirmed and converted into OMS orders seamlessly.
   - **`OMS-002` (Google Drive Photo Selection & Client Review)**:
     - Enhance `GoogleDriveDeliverablesSection` so customers on `/track/[orderId]` can submit structured photo selections (selected photo numbers/filenames + notes) alongside approval/revision status, and gate Google Drive deliverables creation in OMS to `PROFESSIONAL` (`₹999/month`) and `COMPLETE` (`₹1,999/month`).
   - **`MKT-002` (Configurable Service Packages Edit Modal)**:
     - Add an **Edit Package** modal in Marketplace Settings & Services pages wired to `updateStudioPackageAction` (editing package name, price, description, included services, and `isNegotiable`).
2. **Module 02 (CRM)**:
   - **`CRM-001` (Customer Profile Edit, Soft-Delete & Restore)**:
     - Wire up **Edit Profile**, **Delete Customer**, and **Deleted Customers Recovery (14-day window)** in the CRM detail drawer (`updateCustomerAction`, `deleteCustomerAction`, `restoreCustomerAction`).
   - **`CRM-002` (Detailed Booking, Payment & Inquiry History)**:
     - Expand each customer’s order history in CRM to display `calculateOrderPaymentBreakdown` metrics (Confirmed Price, Advance Paid, Installments, Balance Due, Payment Status badge), direct links to open the order in OMS or view Invoices/Receipts, and any Marketplace booking inquiries (`BookingRequest` records) from that customer.
   - **`CRM-003` (Studio-Wide Customer Overview & Sorting)**:
     - Add studio-wide CRM summary KPI cards (Total Customers, Repeat Customers, Studio-Wide Customer LTV, Total Pending Receivables) and sort filters (Highest LTV, Repeat Bookings, Pending Balance Due, Recent).
   - **`CRM-004` (Automated Follow-ups & Anniversary Reminders)**:
     - Integrate `calculateCustomerMilestones` into the CRM page to display upcoming wedding/event anniversaries and milestones, with one-click Email and WhatsApp follow-up actions to drive repeat bookings.
3. **Module 03 (ERP)**:
   - **`ERP-001` (Crew Profile Edit, Skills & Deactivation)**:
     - Add **Edit Member** (name, phone, skills, active/inactive status) and **Remove / Restore Member** controls in the ERP crew detail drawer (`updateMemberAction`, `deleteMemberAction`, `restoreMemberAction`).
   - **`ERP-002` (Studio-Wide Crew Workload & Date Availability Overview)**:
     - Load studio production `tasks` alongside `orders` in ERP; display per-member upcoming shoot counts, pending production task counts, and overload badges; add a studio-wide workload summary bar and an **Event Date Availability Filter** to find free crew for any target shoot date.
   - **`ERP-003` (Automated Workflow & Crew Assignment Rules)**:
     - Add studio workflow automation configuration (auto-assign shoots and post-event tasks on order confirmation using `generateResourceSuggestions` / `performPreflightCheck` skill + least-workload matching, with manual assignment fallback) in both `createOrderCore` and `verifyPaymentAction`.
   - **`ERP-004` (Centralized Invoices & Receipts Directory in ERP)**:
     - Add an **Invoices & Receipts** tab in the ERP dashboard listing all studio invoices (`INV-<Order#>`) and payment receipts (`RCP-<Order#>-...`) across confirmed orders with search, filter, and one-click `MinimalBillingModal` preview/PDF download.
4. **Module 04 (WhatsApp Operations & Interactive Bot)**:
   - **`WA-001` (Automated Outbound WhatsApp Notification Triggers)**:
     - Create `dispatchStudioWhatsAppNotification` checking `studio.whatsappConfig` flags and invoke it across order confirmation, crew assignment, task transitions, Google Drive gallery publishing, client review completion, and payment reminders.
   - **`WA-002` (Meta Webhook HMAC Security & Multi-Role Phone Lookup)**:
     - Verify `X-Hub-Signature-256` in `POST /api/whatsapp/webhook` (when `WHATSAPP_APP_SECRET` is configured) and resolve sender phone numbers against both Studio Owners and active Studio Crew Members (`members` collection).
   - **`WA-003` (WhatsApp-Based Workflow Action Commands)**:
     - Support authenticated WhatsApp workflow commands (`START <Order#> <Task>`, `DONE <Order#> <Task>`, `REVIEW <Order#> <Task>`) with role and task-assignment permission checks, event-date locks, sequential dependency validation, and `order.auditLog` synchronization.
   - **`WA-004` (Crew Call Times & Scheduled Reminders)**:
     - Add `callTime` support on shoot assignments/orders, send WhatsApp assignment alerts with call times when crew are assigned, and provide a scheduled reminder endpoint (`/api/cron/whatsapp-reminders`) for upcoming shoots and anniversaries.
5. **Module 06 (Business Reports & Analytics)**:
   - **`REP-001` (Monthly & Yearly Revenue Reports & Category Accuracy)**:
     - Filter out `CANCELLED` orders across `monthlyRevenueData` and `categoryStats` using `calculateOrderPaymentBreakdown(o).confirmedPrice`, and add a **Monthly (6M / 12M) vs. Yearly Revenue Comparison** toggle and growth metrics.
   - **`REP-002` (On-Time Delivery & Production Performance Analytics)**:
     - Add the **On-Time Delivery & Production Performance** section to `BusinessReportsView` (Completed vs. Delayed/Overdue orders, On-Time Delivery `%`, Average Turnaround Time in days, and Studio vs. Customer stage bottleneck breakdown) and include a `Production & SLA Performance` worksheet in the Excel export.

---

## 4. Technical Architecture & Component Flow

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                   THREE-TIER ENTITLEMENT & ROUTING LAYER                          │
│  ┌─────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────┐  │
│  │ Free Plan (₹0)      │   │ Professional (₹999/mo)  │   │ Complete (₹1,999/mo)│  │
│  │ • Basic OMS         │   │ • Free Tier +           │   │ • ₹999 Tier +       │  │
│  │ • Studio Marketplace│   │ • Advanced OMS (Drive)  │   │ • WhatsApp & Bot    │  │
│  │ • Lands on /oms     │   │ • CRM + ERP             │   │ • Advanced Reports  │  │
│  │                     │   │ • Basic Business Dash   │   │ • Excel Exports     │  │
│  └──────────┬──────────┘   └────────────┬────────────┘   └──────────┬──────────┘  │
└─────────────┼───────────────────────────┼───────────────────────────┼─────────────┘
              ▼                           ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        STUDIO WORKSPACE & MODULE FLOWS                            │
│                                                                                   │
│  [Value-Added Services] ──(Common WhatsApp Inquiry -> 8072333075)──────────────┐  │
│   • 01 Branding & Website / 02 Data Migration                                  │  │
│   • Logs inquiry to Firestore (`vas_inquiries`) -> Shown in Dev Portal         │  │
│                                                                                ▼  │
│  [05. Studio Marketplace] ──(MKT-001 / OMS-001: Verify Advance Payment)────────┐  │
│   • Public Profile & Packages (MKT-002: Edit Package + Negotiation Toggle)     │  │
│   • Post-Negotiation / Offline Advance Confirmation                            │  │
│                                                                                ▼  │
│  [01. OMS — Order Management] <────────────────────────────────────────────────┘  │
│   • Canonical Order ID (ORD-<STUDIO>-YYMMDD-HHMMSS) + Salted 6-Digit Passkey      │
│   • Auto-Upsert Customer into CRM + Auto-Assign Crew via ERP Rules (ERP-003)      │
│   • Advanced OMS: Google Drive Preview, Photo Selection & Approval (OMS-002)      │
│                                                                                   │
│  [02. CRM — Customer Relations]          [03. ERP — Studio Operations]            │
│   • Studio-Wide KPI Cards & Sort (CRM-003)• Crew Workload & Date Filter (ERP-002) │
│   • Edit/Delete/Restore Profile (CRM-001) • Edit/Remove/Restore Crew (ERP-001)    │
│   • Order Payment & Inquiry Ledger(CRM-002)• Workflow Auto-Assignment (ERP-003)   │
│   • Anniversary Milestones & Send (CRM-004)• Centralized Invoices/Receipts(ERP-004)│
│                                                                                   │
│  [04. WhatsApp Operations & Bot]         [06. Business Reports & Analytics]       │
│   • Outbound Event Triggers (WA-001)      • Monthly (12M) & Yearly Trends(REP-001)│
│   • Webhook HMAC + Crew Lookup (WA-002)   • Cancelled-Order Safe Category(REP-001)│
│   • Bot Task/Status Mutations (WA-003)    • On-Time Delivery & TAT SLA (REP-002)  │
│   • Crew Call Times & Cron (WA-004)       • 5-Sheet Excel Report Export           │
└───────────────────────────────────────────────────────────────────────────────────┘
```
