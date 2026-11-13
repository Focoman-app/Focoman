# FOCOMAN — APPROVED PRICING MODEL & FEATURE ENTITLEMENT ARCHITECTURE

**Amendment:** CHG-027  
**Status:** APPROVED — September 21, 2026  
**Supersedes:** CHG-026 (Fixed 4-Plan Pricing Model)

---

## 1. CAPABILITY-BASED PRICING MODEL OVERVIEW

Focoman uses a **flexible capability-based pricing model**. Rigid fixed plans (Starter, Professional, Complete) are replaced with a **Free Core + Optional Paid Capabilities** architecture.

### Pricing Philosophy
- **Free Core (Basic Order Management):** Always ₹0/month forever. No order count caps, event caps, or storage retention fees.
- **Modular Add-On Capabilities:** Studios selectively pay only for the exact capabilities they need.
- **No Per-Message or Volume Fees:** Capabilities are charged at flat monthly rates. No per-message WhatsApp billing, no per-order commission, and no raw media storage fees.
- **Studio-Scoped Ownership:** Capabilities belong to individual studio workspaces (`studios/{studioSlug}/planInfo`). Multi-studio operators can configure different capabilities per workspace.

---

## 2. CAPABILITY CATALOG & PRICING

| Capability ID | Capability Name | Price | Dependency / Included In | Description & Features |
|--------------|-----------------|-------|--------------------------|------------------------|
| `OMS_BASIC` | **Basic Order Management (Free Core)** | **₹0/mo** | Included for every studio | Create, view, edit, cancel orders; status workflow tracking; passkey tracking link; basic operational dashboard. |
| `CUSTOMER_BASIC` | **Customer Management Basic** | **₹199/mo** | Standalone | Searchable customer directory, profiles, and order & payment history. |
| `CUSTOMER_ADVANCED` | **Customer Management Advanced** | **₹299/mo** | Includes `CUSTOMER_BASIC` | Anniversary reminders, customer milestone alerts, repeat booking re-engagement outreach. |
| `CREW_BASIC` | **Crew Management Basic** | **₹199/mo** | Standalone | Crew profiles, roles, skills database, manual assignment to events, basic availability calendar. |
| `CREW_ADVANCED` | **Crew Management Advanced** | **₹299/mo** | Includes `CREW_BASIC` | Workload tracking, double-booking conflict detection, workload-aware resource suggestions. |
| `DRIVE_CLIENT_REVIEW` | **Google Drive + Client Review** | **₹299/mo** | Standalone | In-app Google Drive photo previews, client photo selection comments, review status tracking in production. |
| `WHATSAPP_NOTIFICATIONS` | **WhatsApp Notifications** | **₹199/mo** | Standalone | Fixed operational event alerts (order confirmation, crew dispatch, gallery ready, milestone updates, delivery alerts). |
| `WHATSAPP_OPERATIONS` | **WhatsApp Operations** | **₹499/mo** | Includes `WHATSAPP_NOTIFICATIONS` | Studio Owner interactive WhatsApp Operations Bot (order queries, event status, crew call-time lookup; 499 msgs/mo limit). |

---

## 3. PRICING CALCULATIONS & DEPENDENCY RULES

1. **No Double Charging:** When a studio selects an Advanced capability (e.g. `CUSTOMER_ADVANCED` at ₹299), the system automatically grants the corresponding Basic capability (`CUSTOMER_BASIC`) without additional charge.
2. **Category Max Rule:**
   - Customer Management: ₹0, ₹199 (Basic), or ₹299 (Advanced).
   - Crew Management: ₹0, ₹199 (Basic), or ₹299 (Advanced).
   - Google Drive + Client Review: ₹0 or ₹299.
   - WhatsApp: ₹0, ₹199 (Notifications), or ₹499 (Operations Bot).
3. **Combined Monthly Rate Formula:**
   $$\text{Total Price} = \text{Cost}(\text{Customer}) + \text{Cost}(\text{Crew}) + \text{Cost}(\text{Drive}) + \text{Cost}(\text{WhatsApp})$$

---

## 4. WHATSAPP OPERATIONS BOT ACCESS & LIMITS

- **Target User:** Restricted strictly to **Studio Owners** (`STUDIO_OWNER`). General crew members and clients cannot use the bot.
- **Capabilities:** Check active orders, upcoming event schedules, pending production tasks, and crew call times via chat.
- **Operational Safeguard Limit:** 499 bot messages/interactions per studio per month.
- **Limit Exceeded Behavior:** Returns a friendly operational message informing the owner that the monthly limit has been reached until the next billing cycle. No hidden overage charges or automatic credit card deductions.

---

## 5. TECHNICAL ARCHITECTURE & ENTITLEMENTS

### Firestore Schema
Stored on the studio document:
```json
{
  "planInfo": {
    "selectedCapabilities": ["CUSTOMER_BASIC", "WHATSAPP_NOTIFICATIONS"],
    "isTrial": false,
    "updatedAt": "2026-09-21T12:00:00Z"
  }
}
```

### Entitlement Helper (`@focoman/entitlements`)
```typescript
import { getEffectiveCapabilities } from '@focoman/config';

export function hasCapability(capability: CapabilityId, studioPlan?: StudioPlan): boolean {
  if (!studioPlan) return capability === 'OMS_BASIC' || capability === 'OMS_CORE';
  if (isTrialActive(studioPlan)) return true;
  
  const effectiveCaps = getEffectiveCapabilities(studioPlan.selectedCapabilities || []);
  return effectiveCaps.includes(capability);
}
```

---

## 6. DEFERRED FEATURES

The following features are **explicitly deferred** to future releases and are not part of the current capability model:
- Business Analytics & Financial Reports
- Crew Payroll & Automated Compensation Disbursal

---

## 7. MIGRATION & BACKWARD COMPATIBILITY

Existing studio records with legacy `plan` values (`FREE`, `STARTER`, `PROFESSIONAL`, `COMPLETE`) are seamlessly mapped via `PLAN_CAPABILITIES` to their corresponding capability sets, ensuring zero disruption for existing users.
