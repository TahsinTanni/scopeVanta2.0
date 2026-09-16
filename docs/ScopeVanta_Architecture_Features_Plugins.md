# ScopeVanta — Complete Architecture, Features, Requirements & Developer Handoff

**AppDeploy production snapshot → professional developer / Vercel migration**

Source snapshot: `dealforge-t4lzpn` · version `1789545776525`

## 1. Product Overview

ScopeVanta is a multi-tenant B2B commercial intelligence SaaS for service businesses. The core operating loop is **Analyze → Clarify → Scope → Price → Propose → Win → Protect**. The current production system combines a React/Vite SPA with AppDeploy-native authentication, API routing, database, storage, secrets and AI, plus Square subscription billing.

## 2. Core Requirements

- Preserve the current dark premium ScopeVanta design and all production behavior.
- Maintain strict workspace isolation.
- Unknown information must remain **"To be confirmed."**
- Seller facts require provenance; client facts, assumptions and strategy must remain distinguishable.
- Manual proposal edits invalidate stale evidence and dependent intelligence.
- Paid proposal generation requires verified entitlement.

## 3. Frontend

React 18 + TypeScript + Vite. The current SPA is concentrated in `src/App.tsx`. Primary areas: Dashboard, New Proposal, Proposals, Clients, Knowledge, Company Profile, Plan & Billing, onboarding, public proposal review, guided commercial workspace, and AI support.

## 4. Backend

AppDeploy router-based backend in `backend/index.ts`. Authenticated data is namespaced by user ID. Major domains: profiles, clients, projects, knowledge files/facts, proposal versions, rates, baselines, change orders, analytics, public shares, discovery shares, billing bindings, and webhook idempotency.

## 5. File Intelligence

Private file storage with TXT/MD, PDF, Word, and image ingestion. Text is extracted/transcribed, structured into factual categories, persisted as reusable facts, ranked at proposal time, and attributed through proposal evidence. Knowledge can be activated/paused, reprocessed, and integrity-checked.

## 6. Proposal System

AI analysis produces scope risk, clarification questions, proposal, grounding, and optional evidence-based visuals. Clarification refinement creates a prior-version snapshot and regenerates evidence. Manual edits create revision history only when text changes, clear stale grounding, mark evidence review required, and invalidate dependent commercial/win intelligence.

## 7. Commercial OS

Opportunity Lab, editable Scope Graph, Scope & Economics Engine, rate library, Commercial Autopilot, Deal-to-Profit OS, Proposal Studio 3.0, Win Plan, Close Coach, scope baselines, change orders, pricing brain, and profitability learning.

## 8. Client & Deal Room

Client 360 persists buyer context and logos. Proposal sharing uses high-entropy tokens and supports package selection, accept/request-changes decisions, engagement tracking, and revocation. Sharing is blocked when evidence or commercial intelligence is stale.

## 9. Billing

Square is the billing source of truth.

| Plan | Price | Proposals/month |
|---|---|---|
| Freelancer | CAD $19 | 10 |
| Pro | CAD $49 | 40 |
| Agency | CAD $99 | 150 |

All plans include an introductory $0 first month. Backend supports checkout, customer/subscription search, owner binding, entitlement verification, signed webhooks, duplicate-event protection, cancellation/pause/payment-failure states, and payment-recovery evidence.

## 10. Migration Architecture

Recommended target: Vercel-hosted frontend/API, PostgreSQL with stable workspace IDs and explicit tenant isolation, private object storage, server-verifiable auth, AI provider abstraction with structured-output validation, and a Square webhook/entitlement service. Keep API contracts compatible until parity is proven.

## 11. Critical Hardening

- Add transactional rollback to scope-baseline and approved change-order history writes.
- Add explicit stale/out-of-order Square webhook protection.
- Replace the email-based owner-test bypass with a controlled admin/non-production entitlement.
- Prefer deterministic DOCX parsing over AI-based extraction.
- Perform real Square lifecycle tests before production cutover.

## 12. Handoff Boundaries

No secret values, private customer data, or storage objects are embedded in this package. The professional developer must export the two large AppDeploy-native source files (`src/App.tsx`, `backend/index.ts`) byte-for-byte from the referenced source snapshot, and separately migrate database/storage data before final cutover.

## Appendix A — API Route Inventory

**Health / billing**
- `GET /api/_healthcheck`
- `POST /api/square/webhook`
- `GET /api/billing/integration-status`
- `GET /api/billing/status`
- `POST /api/billing/checkout-started`
- `POST /api/billing/sync`

**Profile**
- `GET /api/profile`
- `PUT /api/profile`

**Files / Knowledge**
- `POST /api/upload`
- `GET /api/files`
- `POST /api/files/:id/reprocess`
- `DELETE /api/files/:id`
- `GET /api/knowledge`
- `GET /api/knowledge/health`
- `PUT /api/knowledge/:id`

**Clients**
- `GET /api/clients`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`

**Projects / proposals**
- `GET /api/projects`
- `POST /api/analyze`
- `POST /api/projects/:id/refine`
- `PUT /api/projects/:id/proposal`
- `GET /api/projects/:id/versions`

**Analytics / dashboard**
- `POST /api/analytics/event`
- `GET /api/analytics/summary`
- `GET /api/dashboard/intelligence`

**Commercial system**
- `GET /api/commercial/rates`
- `POST /api/commercial/rates`
- `DELETE /api/commercial/rates/:id`
- `POST /api/projects/:id/scope-economics`
- `POST /api/projects/:id/commercial-state`
- `POST /api/projects/:id/commercial-autopilot`
- `POST /api/projects/:id/commercial-lab`
- `POST /api/projects/:id/scope-baseline`
- `POST /api/projects/:id/change-order/approve`
- `GET /api/projects/:id/commercial-history`
- `POST /api/projects/:id/scope-graph`
- `GET /api/pricing-brain`
- `POST /api/projects/:id/deal-os`
- `GET /api/projects/:id/readiness`

**Sales / proposal intelligence**
- `POST /api/projects/:id/proposal-studio`
- `POST /api/projects/:id/win-plan`
- `PUT /api/projects/:id/deal`
- `POST /api/projects/:id/close-coach`
- `POST /api/support`

**Client sharing / discovery**
- `POST /api/projects/:id/discovery-share`
- `GET /api/discovery-share/:token`
- `POST /api/discovery-share/:token`
- `POST /api/projects/:id/share`
- `POST /api/projects/:id/share/revoke`
- `GET /api/proposal-share/:token`
- `POST /api/proposal-share/:token/scenario`
- `POST /api/proposal-share/:token/decision`
- `GET /api/projects/:id/share-analytics`

## Appendix B — Plugin / Dependency Inventory

- `@appdeploy/client` — frontend auth/API/image utilities
- `@appdeploy/sdk` — backend router/auth/database/storage/secrets/AI
- React / React DOM
- Vite
- TypeScript
- Lucide React
- Tailwind CSS
- PostCSS
- Autoprefixer
- Square APIs — Locations, Customers, Subscriptions, Catalog, Online Checkout, Webhooks
