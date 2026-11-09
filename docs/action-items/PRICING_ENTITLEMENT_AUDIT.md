# FocoMan — Three-Tier Pricing, Value-Added Services & Subscription Entitlement Audit

**Last Updated:** 2026-11-09  
**Scope:** Three-Tier Subscription Model (`Free — ₹0`, `₹999/month`, `₹1,999/month`) + Value-Added Services (`8072333075`) — Routing & Entitlement Enforcement Status  

---

## 1. Approved Three-Tier Subscription Structure

| Plan Tier | Monthly Price | Included Capabilities |
| :--- | :--- | :--- |
| **Free Plan** | `₹0` | • Basic OMS (Order Management System)<br>• Studio Marketplace<br>*(Note: Business Dashboard is NOT included in the Free plan; Free users are automatically directed to OMS.)* |
| **Professional Plan** | `₹999/month` | **Everything in Free Plan, plus:**<br>• Advanced OMS (Google Drive Photo Preview & Selection, including supported customer review functionality)<br>• CRM (Customer Relationship Management)<br>• ERP (Studio Operations)<br>• Basic Business Dashboard (Order counts, Revenue overview, Pending payment overview) |
| **Complete Plan** | `₹1,999/month` | **Everything in ₹999/month Plan, plus:**<br>• WhatsApp Operations & Interactive Bot<br>• Advanced Business Reports & Analytics<br>• Excel Report Exports |

---

## 2. Value-Added Services (Custom-Quoted Onboarding & Creative Add-ons)

| # | Service Title | Scope | Inquiry Channel & Logging |
| :--- | :--- | :--- | :--- |
| **01** | **Branding and Website** | • Logo creation<br>• Website / portfolio creation | Common WhatsApp Inquiry Button (`+91 8072333075`) on `/` and `/pricing`. Every click logs to Firestore `vas_inquiries` via `POST /api/vas-inquiry` and is surfaced in `/dev-portal` (Overview & WhatsApp tabs). |
| **02** | **Data Migration** | • Migrate existing studio data into Focoman | Common WhatsApp Inquiry Button (`+91 8072333075`) on `/` and `/pricing`. Logged in `/dev-portal`. |

---

## 3. Entitlement & Routing Enforcement Status (All Resolved)

| # | Requirement | Enforcement Status | Implementation Evidence |
| :--- | :--- | :--- | :--- |
| 1 | **Free users landing directly on OMS instead of the Business Dashboard** | `IMPLEMENTED` | `apps/web/src/app/[studioSlug]/dashboard/page.tsx` checks `getEffectiveStudioTier(studio)` and calls `redirect(\`/\${studioSlug}/dashboard/oms\`)` when the studio is on the `FREE` plan. |
| 2 | **Business Dashboard access restricted to paid plans (Basic Business Dashboard from ₹999)** | `IMPLEMENTED` | • `DashboardSidebar.tsx` hides the `"Dashboard"` link for `FREE` tier studios.<br>• `DashboardHomeView.tsx` scopes `PROFESSIONAL` (`₹999/month`) studios to Basic Business Dashboard metrics (Order counts, Revenue overview, Pending payment overview) and unlocks advanced trend/comparison panels for `COMPLETE` (`₹1,999/month`). |
| 3 | **Google Drive photo preview and selection available from ₹999 (Advanced OMS)** | `IMPLEMENTED` | • `GoogleDriveDeliverablesSection.tsx` supports structured photo selection (`selectedPhotos`) and client review.<br>• `updateOrderDriveDeliverablesCore` and `submitCustomerDeliverableReviewCore` enforce `PROFESSIONAL` (`₹999/month`) or `COMPLETE` (`₹1,999/month`) entitlement. |
| 4 | **CRM and ERP available from ₹999** | `IMPLEMENTED` | `getEffectiveStudioFeatures` in `apps/web/src/lib/proEntitlements.ts` and `PLAN_CAPABILITIES` in `@focoman/config` enable `crm`, `erp`, `driveReview`, and `basicDashboard` from `PROFESSIONAL` (`₹999/month`) upward. |
| 5 | **WhatsApp and Advanced Business Reports (+ Excel Exports) available only from ₹1,999** | `IMPLEMENTED` | • `getEffectiveStudioFeatures` restricts `whatsapp`, `reports`, and `excelExport` to `COMPLETE` (`₹1,999/month`).<br>• `/[studioSlug]/dashboard/reports` (`BusinessReportsView.tsx`), `/[studioSlug]/dashboard/crm`, and `/[studioSlug]/dashboard/erp` gate Excel Report Exports and Advanced Analytics behind `COMPLETE` (`₹1,999/month`). |
| 6 | **Checkout Page (`/checkout`) Three-Tier Selector** | `IMPLEMENTED` | `apps/web/src/components/public/CheckoutBuilder.tsx` provides quick 3-tier plan selection (`Free — ₹0`, `₹999/month`, `₹1,999/month`) mapped to canonical capabilities. |
