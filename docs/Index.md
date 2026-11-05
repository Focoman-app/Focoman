# Focoman Project Documentation Index & Source-of-Truth Map

**Document Type:** Project Reference Entry Point  
**Project:** Focoman  
**Purpose:** Provide a centralized navigation map for active project specifications, target technical architecture blueprints, database schemas, setup guides, and governance instructions.

---

## 1. Overview

This document is the primary entry point for AI agents and human developers to discover authoritative project knowledge. 

Before making project decisions, agents **MUST** consult `Index.md` to identify and read the relevant current source specifications.

---

## 2. Source-of-Truth Hierarchy

When evaluating specifications and implementation guidelines:

1. **Latest Commercial & Landing Page Amendment:** **[Commercial Packaging & Landing Page Amendment](product/major-design-amendment-final-packaging-and-landing-page.md)** (30-Day Trial, Lifecycle WhatsApp Tiering, Studio Marketplace Separation, Final Landing Page).
2. **Product Lifecycle Amendment:** **[Marketplace & Booking Amendment](product/major-design-amendment-marketplace-booking.md)** (Marketplace → Booking Request → Optional Negotiation → Payment & Verification → Confirmed Order → Pre-flight Check → OMS Lifecycle).
3. **Primary Product Source of Truth:** **[Focoman Product Discovery Document](product/product-discovery-document.md)** (OMS-First, Confirmed Order Model).
3. **Target Technical Architecture Specifications:** `technical/tech-stack.md`, `technical/identity-and-auth-architecture.md`, `technical/recommended-architecture.md`, `technical/technical-design-mvp.md`, `technical/deployment-guide.md`.
3. **Agent Governance & Workflow Specification:** `../Agents.md`.
4. **Operational & Setup Guides:** `QUICK_SETUP_GUIDE.md`, `ISSUE_ANALYSIS.md`.
5. **Realigned Specifications:** `product/srs-mvp.md` (Realigned product requirements).

*Rule:* If a newer authoritative document conflicts with an older document, the newer active document takes precedence. Old documents must not override current specifications.

---

## 3. Governance & Agent Instruction System

- **[Agents.md](../Agents.md)** — Master Agent Operating Specification (Workflow, 4-Phase Protocol, AI Trust Contract, Engineering Rules, Definitions of Done).
- **[CHANGELOG.md](../CHANGELOG.md)** — Record of all meaningful engineering changes, traceable to tasks, specs, and test results.

---

## 4. Primary Active Product Specifications

- **[Focoman Product Discovery Document](product/product-discovery-document.md)** — **Primary Product Source of Truth.** Defines OMS-first scope starting from Confirmed Order (*Awaiting Event* → *Post-Event In Progress* → *Completed*), Studio Owner/Member/Customer roles, resource availability confirmation, dynamic workflows, and WhatsApp operational layer.
- **[Authentication & Multi-Studio Identity Architecture](technical/identity-and-auth-architecture.md)** — **Active Identity Specification.** Defines single personal Google identity, Firebase UID decoupling, multi-studio memberships, owner registration, invitation acceptance, and workspace switching.
- **[Product Requirements Specification (Realigned SRS)](product/srs-mvp.md)** — Realigned product requirements focusing on OMS-First and confirmed order starting point.

---

## 5. Active Target Technical Architecture Specifications

- **[Tech Stack Specification](technical/tech-stack.md)** — **Active Target Stack.** Defines Next.js 15, TypeScript Monorepo, Firebase Auth (Google Sign-In), Firestore, and Google Cloud Run.
- **[Authentication & Multi-Studio Identity Architecture](technical/identity-and-auth-architecture.md)** — **Active Identity & Auth Blueprint.** Full technical and data architecture for Google Sign-in, Firebase UID, multi-studio memberships, and server-side studio uniqueness.
- **[Recommended Architecture](technical/recommended-architecture.md)** — **Active Target Architecture.** Integrated Next.js App monorepo layout (`apps/web`, `packages/*`), Server Actions execution boundary, and Cloud Run deployment model.
- **[Technical Design Specification](technical/technical-design-mvp.md)** — **Active Technical Design.** Server-side security boundaries, role permissions, and Firestore collection strategy.
- **[Deployment Guide](technical/deployment-guide.md)** — **Active Deployment Guide.** Container build, Google Cloud Run, and Firebase App Hosting deployment configuration.
- **[Developer Portal Setup](technical/dev-portal-setup.md)** — Internal aggregate-only portal setup, security prerequisites, and integration limitations.
- **[Vercel Hosting Strategy (Secondary)](technical/vercel-hosting-strategy.md)** — Legacy secondary hosting reference.

---

## 6. Design System

- **[Brand Design System](design/brand-design-system.md)** — Design tokens, brand identity, color palettes, typography, and UI component styling rules.
- **[Social Video Framework](../social/README.md)** — Lightweight reusable framework for 2–3-minute landscape videos, 32–45-second portrait Shorts, thumbnails, narration, subtitles and publishing/SEO copy. Includes [app-derived brand assets](../social/brand/README.md); episode content and media stay device-only.

---

## 7. Setup & Operational Guides

- **[Quick Setup Guide](QUICK_SETUP_GUIDE.md)** — Local environment initialization and startup instructions.
- **[Issue Analysis Document](ISSUE_ANALYSIS.md)** — Diagnostic records for past platform issues.
- **[Email, Domain & WhatsApp Integration Action Items](tasks/email-domain-whatsapp-action-items.md)** — Planned provider setup, sender-domain configuration, mailbox decision, and WhatsApp Cloud API workstreams.

---

## 8. Brand Assets

- **Brand Assets Directory:** `assets/brand/`

## 9. Active Delivery Plans

- **[Minimal billing, Excel exports and Drive previews](plan/analysis/minimal-billing-exports-drive.md)** — Approved on 2026-11-05; plain invoice/receipt PDF and print, complete authorized business-data Excel exports, and Google-hosted preview feasibility. See [task map](plan/README.md).
