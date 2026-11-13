> [!IMPORTANT]
> **DOCUMENT STATUS: SUPERSEDED / REALIGNED**
> This document (`srs-mvp.md`) represents the legacy Product Specification.
> It has been realigned and superseded by the authoritative **[Focoman Product Discovery Document](product-discovery-document.md)**.
> 
> **Key Architecture & Workflow Alignments:**
> - **Modular Evolution:** The core is OMS-First. CRM, ERP, and WhatsApp are optional modules that scale with studio maturity (See Product Discovery Amendment vNext).
> - **Confirmed Order as Starting Point (OMS-First):** Phase 1 begins strictly upon a Confirmed Order with deposit received.
> - **Pre-Event Leads & Quotations Excluded:** CRM lead prospecting, quotation drafting, and sales negotiations are out of scope for Phase 1 unless explicitly introduced as a future separate module.
> - **Three Macro Stages:** `Awaiting Event` → `Post-Event In Progress` → `Completed`.
> - **Authentication & Identity:** Single personal Google Identity (Firebase UID). Decoupled studio memberships (`StudioOwner` vs. `CrewMember`). Zero passwords, zero customer accounts (guest tracking via cryptographic passkeys).
> - **Pure JavaScript / TypeScript Stack:** 100% full-stack TypeScript with Next.js 15 App Router, React 19, Tailwind CSS, Firebase Auth & Firestore. All legacy Java, Spring Boot, and relational SQL artifacts are completely decommissioned.

# ThreadSafe Project FOCOMAN: Product Requirements Specification

## 1. Introduction

### 1.1 Purpose

This document defines the functional and non-functional requirements for the Focoman platform.
Focoman is an **OMS-First Business Operating System** designed specifically for photography and cinematography studios. It enables studio owners to manage confirmed orders, post-event production workflows, crew allocations, payments, customer order tracking, and delivery from a single centralized web application.

## 2. Product Overview

Focoman simplifies the complete photography business workflow by replacing manual processes involving WhatsApp groups, physical notebooks, disconnected spreadsheets, and phone calls with one centralized platform.
The system focuses on:

- **Confirmed Order Management**: Structured order recording starting upon confirmed booking and advance payment.
- **Resource Allocation & Availability**: Assigning lead photographers, candid shooters, cinematographers, and editors to events.
- **Dynamic Post-Event Workflow Tracking**: Automated milestone checklists for RAW ingest, photo selection, editing, album proofing, and lab printing.
- **Crew Management**: Lightweight crew member assignments with workspace switching and zero access to studio financials.
- **Customer Guest Order Tracking**: Frictionless passkey-based order status tracking for brides and event hosts without account creation.
- **WhatsApp Operational Notifications**: Real-time milestone alerts and passkey links delivered directly via WhatsApp.
- **Business Operations**: High-level tracking of advance deposits, event-day installments, and final delivery settlements.

## 3. Objectives

The primary objectives are:

- Eliminate post-event production delays and missed delivery deadlines.
- Replace unstructured notes with a transparent milestone checklist.
- Automate customer communication and reduce repetitive "where are my photos?" inquiries.
- Provide clear operational visibility across upcoming shoots and in-progress edits.
- Ensure crew members know their call times, venue locations, and deliverables.
- Deliver a fast, modern, mobile-responsive studio management experience.

## 4. Target Users & Personas

- **Studio Owner**: Full operational control over studio profile, pricing, confirmed orders, team memberships, and business metrics.
- **Crew Member / Freelancer**: Photographers, videographers, editors, and album designers who view assigned shoots and update post-event tasks.
- **Guest Customer**: Event hosts who track their project via a secure passkey link without needing an account or password.

## 5. Core Modules

### 5.1 Order Management System (OMS): Core Module

The Order Management System (OMS) is the core operational system of Focoman used to track and manage confirmed orders and their status across every milestone, from RAW photo selection and editing through to final album delivery and client payments. Phase 1 starts strictly with a **Confirmed Order**:
Functions include:

- Create Confirmed Order (Customer details, event schedule, package deliverables, advance payment)
- Allocate Crew Resources (Assign photographers, videographers, drone operators, editors)
- Track Post-Event Production Pipeline (RAW ingest, client selection, editing, album design, print lab)
- Google Drive Folder Linking & In-App Preview (View RAW photos, proofing galleries, and deliverables directly inside Focoman without tab switching)
- Update Milestone Status & Checklist Items
- Add Internal Production Notes & Proof URLs
- Track Payment Milestones (Advance, Event Day, Final Delivery)
- Trigger WhatsApp Milestone Alerts
- Guest Passkey Order Tracking Portal (with embedded media previews)
- Filter & Search Orders by Event Date, Stage, and Status

### 5.2 Customer Management (Studio CRM)

Stores structured customer relationship details and long-term client history:

- **Customer Profiles & Directory**: Centralized client details (name, phone number, email, address).
- **Communication Channels**: Mobile phone, WhatsApp for notifications, and email address.
- **Complete Order & Event History**: Past photoshoot bookings, packages selected, deliverables provided, and historical order values.
- **Client Preferences & Shoot Notes**: Record specific client styling preferences, favorite deliverables, and custom shoot notes for returning clients.
- **Anniversary & Milestone Reminders**: Automated date tracking for 1st wedding anniversaries, birthdays, and upcoming family milestones to facilitate repeat studio bookings.
- *Excluded (Over-Engineering)*: Complex genealogy trees, multi-contact hierarchies, moodboard scrapers, and generic B2B pipeline bloat.

### 5.3 Studio Operations & Crew Coordination (Studio ERP)

Supports comprehensive studio operational execution, crew logistics, and basic studio accounting:

- **Visual Calendar Availability & Scheduling**: Calendar scheduling assistant with two-way Google Calendar synchronization, displaying crew blocked time and availability before assignments to eliminate double booking.
- **Crew Task Assignment & Milestone Ownership**: Assigning photographers, videographers, and editors to specific event dates and post-production deliverables with clear task ownership.
- **Asset & Equipment Tracking**: Check-out and return tracking of studio gear (cameras, lenses, gimbals, microphones, memory cards) linked to specific shoots.
- **Crew Payroll & Compensation Engine**:
  - Per-event, daily, or task-based crew wages and standard tax withholdings/allowances.
  - **Travel & Incidental Claims**: Submission and approval of crew travel, fuel, meals, and out-of-station expenses.
  - Payout lifecycle tracking (Draft → Approved → Paid).
- **Auditing, Financial Accounts & Tax Readiness**:
  - Structured records of studio revenue, completed crew payouts, and verified travel expenses.
  - Transparent audit trail of studio profitability and exportable financial summaries for annual tax returns.
- *Excluded*: Complex enterprise HR statutory compliance (statutory provident funds, corporate union frameworks). Keep focused on studio contractor payouts, basic tax tracking, and expense management.

### 5.4 Native Integrations (Google Workspace & WhatsApp)

Embedded native connectivity layers that operate within core modules without forcing users to juggle external tools:

- **Google Drive Integration (OMS)**: Link photoshoot folders, RAW selection galleries, and client deliverables with embedded in-app preview inside order details and client tracking views.
- **Google Calendar Synchronization (ERP)**: Push shoot schedules, call times, and crew assignments directly to crew Google Calendars with in-app calendar preview.
- **WhatsApp Messaging Layer**: Automated milestone alerts, client passkey delivery, and crew task assignments.

## 6. Pre-Event Lead Scope Notice

In accordance with the **Focoman Product Discovery Document**, **pre-event lead management (inquiries, price negotiations, quotation drafts) is OUT OF SCOPE for Phase 1**.
Focoman begins exclusively when a customer has agreed to terms, paid their advance deposit, and the order is officially booked.

## 7. Order Workflow

### Macro Stages

```text
┌───────────────────────┐
│    AWAITING EVENT     │  Booking confirmed with deposit. Date locked.
└───────────┬───────────┘  Crew allocated and shoot schedule prepared.
            │
            ▼  Event Date occurs & shoot wraps
┌───────────────────────┐
│ POST-EVENT IN PROGRESS│  Dynamic post-event tasks generated and executed:
└───────────┬───────────┘  RAW Backup → Selection → Editing → Album → Print.
            │
            ▼  Final balance cleared & physical deliverables handed over
┌───────────────────────┐
│       COMPLETED       │  Order archived and marked fulfilled.
└───────────────────────┘
```

### Dynamic Post-Event Production Pipeline

```text
Shoot Completed
↓
1. RAW Backup & Ingest (Dual storage verification)
↓
2. Selection Gallery Dispatched (Passkey link sent via WhatsApp)
↓
3. Client Selection Completed (Favorites locked for album & retouching)
↓
4. Photo & Video Editing (Color grading, skin retouch, audio master)
↓
5. Album Design & Client Proofing (Digital spread review & signoff)
↓
6. Print Lab & Packaging (Physical printing, binding, custom box packaging)
↓
7. Delivery Handover & Final Settlement (Balance payment cleared)
↓
Order Completed
```

## 8. Customer Portal

Every confirmed order generates a secure customer tracking link.
Customers can:

- Track Order Status
- View Workflow Timeline
- View Payment Status
- Download Invoice
- Access Gallery Links
- Raise Queries
- Request Callback

The customer portal is accessible using a secure link or OTP without requiring a permanent account.

## 9. WhatsApp Integration

WhatsApp is the primary communication channel.

Customer Notifications

- Booking Confirmed
- Payment Confirmation
- Shoot Reminder
- Editing Started
- Album Ready
- Printing Started
- Ready for Delivery
- Payment Reminder

Studio Notifications

- New Lead Received
- Tomorrow's Shoot
- Today's Schedule
- Customer Query Received
- Pending Payment Reminder
- Order Delay Alert

## 10. Google Calendar Integration

Upon booking confirmation:

- Create Calendar Event
- Add Event Details
- Set Reminders
- Notify Studio Owner

## 11. Team Management

Studio Owner can:

- Add Employees
- Edit Employee Details
- Assign Roles
- Assign Orders
- View Assigned Tasks
- Track Employee Workload

Typical roles include:

- Photographer
- Videographer
- Editor
- Album Designer
- Receptionist

## 12. Partner Services

Optional services offered alongside the platform:

- Website Creation
- Website Integration
- Logo Design
- Data Migration

Migration supports:

- Excel
- Existing Customer Lists
- Existing Order Records

## 13. Dashboard

The dashboard provides a business overview.
Displays:

- Total Orders
- Active Orders
- Completed Orders
- Upcoming Shoots
- Pending Payments
- Milestone Delays
- Recent Activities
- Team Workload

## 14. User Roles

Studio Owner

- Full system access.

Crew Member

- Scoped access to assigned shoots and workflow tasks.

Customer

- Isolated access to their own order tracking portal via guest passkey.

## 15. Non-Functional Requirements

Performance

- Fast page loading
- Responsive user interface

Security

- Secure authentication
- Role-based authorization
- Encrypted communication

Usability

- Simple navigation
- Mobile-friendly interface
- Minimal learning curve

Scalability

- Support multiple studios
- Support thousands of orders
- Modular architecture

Reliability

- High system availability
- Automatic backups
- Error logging

## 16. Platform Strategy

Phase 1

- Responsive Web Application (Next.js 15, React 19, TypeScript)
- Studio Dashboard
- Customer Passkey Tracking Portal

Phase 2

- Android Application

Future phases may include iOS and additional platform integrations.

## 17. Out of Scope (MVP)

The following features are intentionally excluded from the MVP:

- Pre-event sales leads, enquiries, quotations, and negotiations
- Review & Rating System
- Native Gallery Platform
- Payroll Management
- Inventory Management
- Accounting System
- AI-powered Business Analytics
- Advanced Reporting
- Social Media Integrations (Instagram/Facebook)

## 18. Success Criteria

The MVP will be considered successful if it enables a photography studio to:

- Register confirmed orders with clear deliverable milestones.
- Track every confirmed order from booking deposit to final handover.
- Keep customers informed through the passkey tracking portal.
- Reduce manual follow-ups using WhatsApp milestone alerts.
- Manage crew members and task assignments effectively.
- Operate daily business activities from a single platform.

## 19. Document Status

- Version: 1.0
- Status: Draft
- Prepared For: Focoman Development Team

Next Documents:

- High Level Design (HLD)
- UI/UX Wireframes
- Low Level Design (LLD)
- Database Design
- API Specification
- Technical Architecture
