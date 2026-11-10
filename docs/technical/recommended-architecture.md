# FOCOMAN Recommended Architecture Specification

**Document Type:** Technical Architecture Specification  
**Status:** Active Target Specification  
**Project:** Focoman  
**Supersedes:** Legacy Dual-Service (Java Backend + Next.js Frontend) Architecture  

---

## 1. Overview & Architecture Philosophy

Focoman uses an **Integrated Modular Monolith** built entirely in **TypeScript** using **Next.js 15 (App Router)** deployed to **Google Cloud Run**, with **Firebase Authentication** and **Google Cloud Firestore**.

Rather than splitting the project into a complex multi-runtime deployment, Focoman combines client UI rendering and trusted server-side business logic within one integrated, unified full-stack TypeScript monorepo.

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

## 2. Monorepo Repository Structure (`pnpm-workspace.yaml`)

```text
focoman/
├── apps/
│   └── web/                        # Main Next.js 15 integrated web application
│       ├── app/                    # App Router pages & Server Actions
│       ├── components/             # React UI components
│       ├── hooks/                  # Client-side hooks
│       ├── lib/                    # Web utilities & Firebase client SDK
│       └── package.json
│
├── packages/
│   ├── types/                      # Shared TypeScript domain contracts
│   ├── validation/                 # Shared Zod validation schemas
│   ├── domain/                     # Pure domain logic & workflow engines
│   ├── db/                         # SERVER-ONLY Firestore Admin SDK wrapper
│   ├── auth/                       # Firebase Auth session & permission helpers
│   └── config/                     # Shared environment & system constants
│
├── docs/                           # Documentation & Index.md
├── Agents.md                       # Master Agent Operating Specification
└── AGENTS.md                       # Workspace Rule Entry Point
```

---

## 3. Server Execution Boundary & Security Principles

1. **No Generic Client CRUD:** Generic database CRUD operations are **NOT** exposed directly to the browser.
2. **Server Actions for Business Mutations:** Privileged operations (order registration, resource assignment, payment confirmation, WhatsApp triggers) run through trusted Next.js Server Actions or API Route Handlers.
3. **Server-Only Database Access:** `packages/db` uses `"server-only"` imports to prevent Firebase Admin SDK credentials from ever leaking into client browser bundles.
4. **Firebase Authentication (Google Sign-In) & Multi-Studio Memberships:** Single personal identity per person via Firebase UID. Studio entities and memberships are decoupled from user authentication, allowing multi-studio ownership and crew memberships with dynamic workspace switching without separate logins. Customer order tracking uses isolated guest passkeys.

---

## 4. Production Deployment Model

```text
GitHub Repository
       ↓
GitHub Actions CI/CD Pipeline
       ↓
Docker Build (Next.js Standalone Image)
       ↓
Google Cloud Run Deployment
       ↓
Firebase Services (Firestore & Firebase Auth)
```

Cloud Run handles zero-downtime deployment, traffic management, and auto-scaling automatically.

---

## 5. Architectural Modernization Notes

- **Unified Full-Stack TypeScript**: All application logic, APIs, and workflows execute in pure TypeScript via Next.js Server Actions and `packages/domain`.
- **Cloud Persistence**: Managed Google Cloud Firestore document database provides native auto-scaling, real-time capabilities, and zero-maintenance persistence.
- **Modern Identity**: Google Authentication with single-use invitation tokens and unified workspace switching replaces legacy custom passwords and siloed studio portals.
- **Single-Container Deployment**: Containerized Next.js standalone application running on Google Cloud Run with zero-downtime scaling.
