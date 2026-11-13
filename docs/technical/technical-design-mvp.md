# FOCOMAN Technical Design Specification

**Document Type:** Technical Architecture Specification  
**Status:** Active Target Specification  
**Project:** Focoman  
**Architecture:** 100% Full-Stack JavaScript / TypeScript Monorepo  

---

## 1. Overview & Architecture Strategy

Focoman is implemented as an **Integrated TypeScript Monorepo** using **Next.js 15 (App Router)**, **Firebase Authentication**, **Google Cloud Firestore**, and **Google Cloud Run**.

The platform combines client UI rendering and server-side application logic into a single cohesive codebase, eliminating the operational complexity of managing disparate frontend and backend runtimes.

```text
                               FOCOMAN INTEGRATED APPLICATION
                                              │
                                              ▼
                                Next.js 15 App Router (TypeScript)
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       │                                             │
                       ▼                                             ▼
                 Client Layer                               Server Layer
          (React Server Components + UI)              (Server Actions + Route Handlers)
                       │                                             │
                       │                                             ▼
                       │                                   Domain & Business Logic
                       │                                    (packages/domain)
                       │                                             │
                       ▼                                             ▼
           Firebase Auth (Client SDK)                    Firestore (Admin SDK)
```

---

## 2. Target Technology Stack

- **Application Monorepo:** `pnpm` / `npm` workspace (`apps/web`, `packages/types`, `packages/validation`, `packages/domain`, `packages/db`, `packages/auth`, `packages/config`).
- **Frontend & App Framework:** Next.js 15 App Router, React 18, TypeScript 5, Tailwind CSS 3.
- **Server Execution Layer:** Next.js Server Actions and Route Handlers.
- **Authentication:** Firebase Authentication with Google Sign-in as sole personal identity provider. Studio ownership and memberships decoupled from Firebase UID. Order tracking via guest passkeys.
- **Database:** Google Cloud Firestore (Document Database) with normalized `users`, `studios`, `memberships`, `invitations`, `customers`, `orders`, `tasks` collections.
- **Hosting & Compute:** Google Cloud Run (Containerized Next.js Standalone Build).
- **Integrations:** WhatsApp Business API for operational notifications and status checks.
- **CI/CD:** GitHub Actions.

---

## 3. Server Execution & Security Boundary

1. **Privileged Business Mutations:** All state-changing operations (Studio Registration, Member Invitation, Order Registration, Resource Assignment, Availability Confirmation, Payment Verification, Task Status transitions) run on the server via trusted Server Actions using the Firebase Admin SDK (`packages/db`).
2. **Server-Only DB Access:** Direct database CRUD operations are **NOT** exposed to client browsers. `packages/db` uses `"server-only"` imports.
3. **Identity & Multi-Studio Role Security:**
   - **Authentication:** Person is authenticated via Google; identified by Firebase UID.
   - **Studio Membership Check:** Access to a studio workspace (`/luminary/dashboard/*`) requires an active document in `/memberships/{studioId}_{uid}`.
   - **Studio Owner:** Full studio-wide scope for their owned studio.
   - **Studio Member:** Access scoped strictly to assigned orders and workflow tasks.
   - **Customer:** Isolated access to single order tracking via guest passkeys. No Firebase user account is generated for customers.
4. **Studio Uniqueness Protection:** Studio name and slug availability are validated against real Firestore data, enforced server-side inside Firestore Transactions to prevent race conditions.

---

## 4. Hosting & Cloud Infrastructure

```text
Internet
   ↓
Google Cloud Load Balancer / Cloud Run Ingress
   ↓
Google Cloud Run (Single Next.js Container Instance)
   ↓
Firebase Services (Firestore & Firebase Authentication)
```

---

## 5. Architectural Modernization Notes

- **Full-Stack JavaScript / TypeScript**: Unified codebase running on Next.js 15 App Router with zero secondary runtimes.
- **Server-Side Security**: All privileged operations use Server Actions with Firebase Admin SDK verification.
- **Document Model**: Firestore provides dynamic schema flexibility for confirmed orders and workflow tasks.
- **Modern Authentication**: Single Google identity and decoupled studio memberships replace custom user credentials.

---

## 6. Modular Feature Flags (CRM, ERP, WhatsApp)
* **Configuration Gating**: The core OMS is mandatory. Advanced CRM, ERP (crew allocation), and WhatsApp capabilities will be gated via server-side feature enablement flags attached to the Studio document or a dedicated configuration collection.
* **UI Adaptation**: The frontend Next.js application will dynamically render or hide sidebar navigation and workflow sections based on the studio's enabled modules, preventing overwhelming UX for basic users.
