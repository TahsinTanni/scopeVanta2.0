# ScopeVanta — Complete Developer Handoff

## 1. Executive Summary

ScopeVanta is a private multi-tenant B2B commercial intelligence SaaS for service businesses. Its operating workflow is:

**Analyze → Clarify → Scope → Price → Propose → Win → Protect**

The current production implementation is a React/Vite single-page application with an AppDeploy-native backend, database, storage, authentication and AI layer. Square is used for subscription checkout and lifecycle verification. The production application must remain intact while a Vercel-compatible copy is developed and verified.

**Production fallback:** `https://dealforge-t4lzpn.v2.appdeploy.ai/`  
**AppDeploy app ID:** `dealforge-t4lzpn`  
**Inspected source version:** `1789545776525`

## 2. Product Requirements / Non-Negotiables

1. Preserve black/gold/dark premium ScopeVanta design and existing UX.
2. Preserve strict workspace/user isolation for every persisted record and file.
3. Never fabricate seller facts, client facts, pricing, quantities, credentials, ROI, guarantees, buyer intent or historical outcomes.
4. Missing information must be represented as **To be confirmed**.
5. AI-generated proposal evidence must distinguish:
   - seller facts grounded to persisted knowledge records;
   - client-supplied facts;
   - assumptions;
   - strategy/recommendations.
6. Manual proposal edits invalidate stale grounding and downstream commercial/win intelligence.
7. Scope/economics changes must mark downstream commercial intelligence stale.
8. Client-facing proposal sharing must be blocked when evidence needs review or commercial intelligence is stale.
9. Square entitlement must gate paid proposal generation.
10. Production AppDeploy remains the fallback until the replacement passes end-to-end verification.

## 3. Frontend Architecture

### Stack
- React 18
- TypeScript
- Vite
- Tailwind/PostCSS toolchain
- Lucide React icons
- `@appdeploy/client` for auth, API transport and client-side image preparation

### Main SPA
`src/App.tsx` currently contains the majority of UI/state logic in one large component.

Primary navigation:
- Dashboard
- New Proposal
- Proposals
- Clients
- Knowledge
- Company Profile
- Plan & Billing

Public states:
- Landing/pricing
- Authentication
- Onboarding
- Public proposal review/share

### Major UI modules
- Business Command Center
- Quick Start / activation flow
- Client 360
- Knowledge Base / Knowledge Inspector
- Proposal builder
- Clarification/refinement workflow
- Proposal Evidence
- Guided Commercial Workspace
- Opportunity Lab
- Deal-to-Profit OS
- Scope Graph
- Scope & Economics Engine
- Commercial Autopilot
- Proposal Studio 3.0
- Win the Business strategy
- Closing Command Center
- Scope baseline/change-order protection
- Public proposal decision flow
- Plan & Billing entitlement audit
- AI support chat

## 4. Backend Architecture

`backend/index.ts` uses:
- `router`, `json`, `error`
- `requireAuth`
- `db`
- `storage`
- `secrets`
- `ai`

from `@appdeploy/sdk`.

### Tenant model
Most tables are dynamically namespaced by authenticated `userId`, for example:
- `profiles:{userId}`
- `projects:{userId}`
- `clients:{userId}`
- `files:{userId}`
- `knowledge:{userId}`
- `analytics:{userId}`
- `rates:{userId}`
- `proposal-versions:{userId}:{projectId}`
- `scope-baselines:{userId}:{projectId}`
- `change-orders:{userId}:{projectId}`

Public share data uses high-entropy tokens and separate share tables.

### Core persisted entities
- Profile/workspace
- Client
- Project/opportunity
- Knowledge source file
- Knowledge fact
- Proposal revision
- Commercial rate
- Scope baseline
- Change order
- Analytics event
- Proposal share
- Discovery share
- Billing owner/email bindings
- Square webhook event/idempotency record
- Billing configuration

## 5. API Surface

### Health / billing
- `GET /api/_healthcheck`
- `POST /api/square/webhook`
- `GET /api/billing/integration-status`
- `GET /api/billing/status`
- `POST /api/billing/checkout-started`
- `POST /api/billing/sync`

### Profile
- `GET /api/profile`
- `PUT /api/profile`

### Files / Knowledge
- `POST /api/upload`
- `GET /api/files`
- `POST /api/files/:id/reprocess`
- `DELETE /api/files/:id`
- `GET /api/knowledge`
- `GET /api/knowledge/health`
- `PUT /api/knowledge/:id`

### Clients
- `GET /api/clients`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`

### Projects / proposals
- `GET /api/projects`
- `POST /api/analyze`
- `POST /api/projects/:id/refine`
- `PUT /api/projects/:id/proposal`
- `GET /api/projects/:id/versions`

### Analytics/dashboard
- `POST /api/analytics/event`
- `GET /api/analytics/summary`
- `GET /api/dashboard/intelligence`

### Commercial system
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

### Sales/proposal intelligence
- `POST /api/projects/:id/proposal-studio`
- `POST /api/projects/:id/win-plan`
- `PUT /api/projects/:id/deal`
- `POST /api/projects/:id/close-coach`
- `POST /api/support`

### Client sharing/discovery
- `POST /api/projects/:id/discovery-share`
- `GET /api/discovery-share/:token`
- `POST /api/discovery-share/:token`
- `POST /api/projects/:id/share`
- `POST /api/projects/:id/share/revoke`
- `GET /api/proposal-share/:token`
- `POST /api/proposal-share/:token/scenario`
- `POST /api/proposal-share/:token/decision`
- `GET /api/projects/:id/share-analytics`

## 6. Authentication & Workspace Isolation

Current authentication is AppDeploy Auth:
- frontend: `auth.isSignedIn`, `auth.signIn`, `auth.getUser`, `auth.signOut`
- backend: `requireAuth()`
- authenticated identity key: `ctx.user!.userId`

Migration requirement:
- choose a replacement auth provider;
- preserve stable user/workspace identity mapping;
- do not migrate records until old → new identity mapping is explicit;
- every server query must be scoped to authenticated workspace/user;
- public share endpoints must never expose private workspace data beyond the intended share payload.

## 7. Square Billing Architecture

Plans:
- Freelancer: CAD $19/month, 10 proposals/month
- Pro: CAD $49/month, 40 proposals/month
- Agency: CAD $99/month, 150 proposals/month
- introductory first month configured at $0 in the Square subscription plan variation.

Current backend:
- reads `SQUARE_ACCESS_TOKEN` from backend secrets;
- creates/reuses Square catalog subscription plan configuration;
- creates Square hosted checkout links;
- searches customers by account email;
- searches subscriptions and maps plan variation → ScopeVanta plan;
- binds subscription IDs to internal owners;
- maintains lifecycle state in profile;
- verifies entitlement before proposal generation;
- re-verifies stale entitlement (15-minute threshold);
- processes signed Square webhooks;
- deduplicates webhook event IDs;
- uses timing-safe HMAC comparison;
- recognizes active/canceled/paused/payment-failure conditions;
- preserves payment-failure lock until charged-through date advances;
- blocks duplicate checkout when an active subscription is already linked.

Important migration work:
- replace AppDeploy secrets with Vercel environment variables;
- change checkout redirect URL;
- change Square webhook notification URL;
- configure the new URL in Square;
- keep signature verification exact;
- retain webhook idempotency;
- add/verify stale/out-of-order webhook ordering protection before launch;
- perform real sandbox/production lifecycle testing before claiming parity.

## 8. File Intelligence

Accepted source types:
- TXT / MD
- PDF
- DOC / DOCX
- images

Max client-side/server-side intent: ~5 MB.

Processing:
1. Original stored privately.
2. Text extracted:
   - TXT/MD decode;
   - PDF via AI transcription;
   - Word via AI text recovery;
   - images via OCR.
3. Extracted text capped before downstream structuring.
4. `ai.extract` creates structured knowledge:
   - services
   - differentiators
   - deliverables
   - pricing evidence
   - timelines
   - processes
   - constraints
   - exclusions
   - proof points
   - client facts
5. Facts persist individually and can be paused/activated.
6. Proposal retrieval ranks active facts against opportunity context.
7. Retrieval boosts commercial categories and caps per-source dominance.
8. Knowledge health checks orphan facts, duplicates, failed files and missing originals.
9. Reprocessing is designed to preserve old usable facts unless the replacement set commits successfully.
10. Client logos are separate from knowledge ingestion.

## 9. Proposal Grounding & Integrity

Proposal generation stores:
- risk score
- summary
- risks
- clarification questions
- proposal
- evidence/grounding
- grounding summary
- visuals
- proposal options
- budget/timeline
- client linkage
- version

Grounding types:
- `seller_fact`
- `client_fact`
- `assumption`
- `strategy`

Manual edits:
- create a pre-edit revision snapshot;
- increment proposal version only when text actually changes;
- settings-only save does not create a phantom revision;
- clear old grounding;
- set evidence status to `needs_review`;
- clear stale win plan/close coach;
- mark commercial lab stale;
- invalidate proposal studio;
- mark an already-shared version stale.

Clarification refinement:
- saves pre-refinement snapshot;
- integrates answered questions;
- unresolved questions remain To be confirmed;
- regenerates evidence;
- only preserves seller attribution when revised claim still directly matches previously grounded claim.

## 10. Commercial Intelligence Architecture

### Opportunity Lab
Produces:
- pricing model
- structured phases/deliverables/tasks/acceptance criteria
- assumptions/dependencies/client responsibilities/exclusions
- scope-change classification
- deal simulator
- descriptive historical signals
- RFP/brief intake intelligence
- requirement traceability
- feasibility
- negotiation guidance
- commercial memory

### Scope & Economics Engine
Editable estimate lines:
- deliverable
- role
- quantity
- hours
- cost rate
- sell rate
- acceptance criteria

Calculates:
- estimated hours
- base cost
- risk-adjusted cost
- floor price
- recommended price
- modeled margin
- Lean / Recommended / Premium scenarios

### Deal-to-Profit OS
Actions include:
- Discovery Agent
- Scope Compiler
- Margin Firewall
- Buyer Choices
- Negotiation Simulator
- Scope Creep Firewall
- Meeting Delta
- Client Responsibilities
- Pre-Mortem
- Red-Team Proposal
- Personalize
- Handoff Pack
- Profitability Autopsy
- Commercial Copilot

### Proposal Studio 3.0
- quality audit
- requirement coverage
- modular proposal sections
- proposal approaches
- meeting delta
- objection workspace
- stage-aware follow-up
- activity timeline

### Protect layer
- scope baseline
- durable baseline history
- change detection
- change-order draft
- approved change-order history
- rebaseline workflow

## 11. Client / CRM Layer

Client 360 stores:
- contact/company
- email/phone/website
- industry
- lifecycle status
- notes
- goals
- preferences
- decision makers
- pain points
- buying criteria
- known objections
- next step
- follow-up date
- persistent logo

Enrichment:
- linked proposal count
- average recorded risk
- last opportunity date

Client deletion is blocked when proposals are linked.

## 12. Dashboard / Analytics

First-party events currently allow-listed:
- workspace_loaded
- checkout_started
- billing_verified
- client_created
- knowledge_ready
- proposal_generated
- proposal_refined
- proposal_edited
- proposal_printed

Privacy controls:
- only allow-listed event names;
- small allow-listed primitive context;
- no arbitrary brief/proposal/client text in analytics.

Dashboard includes:
- proposal activity
- average scope risk
- client coverage
- evidence counts
- six-month activity
- risk distribution
- commercial performance
- pipeline value by recorded stage
- recorded win/loss metrics
- proposal acceptance and decision-time metrics

These are descriptive records, not predictive claims.

## 13. Client Deal Room / Sharing

Seller can create a high-entropy proposal link.

Shared payload may include:
- client/seller
- proposal/version
- deal value
- scope summary
- scenarios/packages
- timeline
- proposal audit score
- responsibilities
- handoff context

Client can:
- view proposal
- select a package
- accept
- request changes
- leave identifying name/email and note

Seller can:
- inspect views
- inspect package selection
- revoke link

Sharing is blocked when:
- proposal evidence requires review;
- commercial intelligence is stale.

## 14. AI Usage / Prompt Guardrails

Current AppDeploy AI capabilities used:
- `ai.generate`
- `ai.extract`
- `ai.ocr`
- `ai.scrape`

Common guardrails:
- evidence only;
- no invented capabilities/results/pricing/ROI;
- unknown = To be confirmed;
- recommendations separated from facts;
- historical records are descriptive, not predictions;
- no chain-of-thought exposure;
- numeric charts only from supplied numeric facts;
- acceptance criteria should be observable;
- change control must protect out-of-scope work.

## 15. Plugins / External Dependencies

### AppDeploy platform
- `@appdeploy/client`
  - auth
  - API client
  - image resizing/preparation
- `@appdeploy/sdk`
  - API router
  - auth middleware
  - database
  - storage
  - secrets
  - AI

### UI/runtime packages
- React
- React DOM
- Lucide React
- Vite
- TypeScript
- Tailwind CSS
- PostCSS
- Autoprefixer

### External service
- Square production API
  - Customers
  - Subscriptions
  - Catalog subscription plans/variations
  - Online Checkout payment links
  - Locations
  - Webhooks

No Square secret value is included in this handoff.

## 16. Vercel Migration Target Architecture

Recommended target:

**Frontend**
- Vercel-hosted React/Vite SPA initially, preserving current UI.
- Longer-term component refactor can happen after parity.

**API**
- Vercel Functions / framework API routes.
- Keep route contracts compatible with current frontend during migration.

**Auth**
- Auth provider with server-verifiable sessions/JWT.
- Stable `workspace_id` separate from provider-specific user ID.

**Database**
- PostgreSQL (recommended) with explicit relational schema and RLS/application tenant enforcement.

Suggested tables:
- users
- workspaces
- workspace_members
- profiles
- clients
- projects
- proposal_versions
- knowledge_files
- knowledge_records
- rates
- scope_baselines
- change_orders
- analytics_events
- proposal_shares
- discovery_shares
- billing_subscriptions
- billing_events
- commercial_audit

**Storage**
- private object storage;
- metadata in DB;
- signed URLs;
- tenant-prefixed keys;
- delete/reprocess transaction semantics.

**AI**
- provider abstraction replacing AppDeploy AI calls;
- structured-output validation;
- prompt versioning;
- token/input caps;
- retry/timeouts;
- provenance preserved in DB.

**Billing**
- Square remains source of truth;
- webhook route on Vercel;
- idempotency table;
- lifecycle ordering timestamps;
- entitlement service called by proposal-generation route.

## 17. Migration Sequence

Phase A — freeze/inspect
1. Keep AppDeploy production live.
2. Export source snapshot.
3. Export schema/data inventory.
4. Inventory storage objects.
5. Inventory secret names only.

Phase B — foundation
1. Create Vercel staging project.
2. Create target DB/storage.
3. Implement auth/workspace bootstrap.
4. Implement tenant middleware.
5. Implement API compatibility layer.

Phase C — data
1. profiles/workspaces
2. clients
3. projects
4. proposal versions
5. knowledge metadata/facts
6. stored source files/logos
7. rates
8. baselines/change orders
9. analytics
10. share/discovery records
11. billing bindings/events

Phase D — features
1. dashboard
2. clients
3. knowledge/file intelligence
4. analyze
5. clarify/refine
6. proposal edit/versioning
7. commercial lab/economics
8. Deal OS
9. Proposal Studio
10. win/close
11. sharing
12. protect
13. billing

Phase E — verification
- auth isolation
- cross-workspace negative tests
- file upload/reprocess/delete
- AI provenance
- manual-edit invalidation
- revision correctness
- baseline/change-order durability
- public share/revoke/decision
- mobile/accessibility
- Square checkout
- webhook signature
- duplicate webhook
- cancellation
- pause/resume
- payment failure/recovery
- subscription switch safety
- runtime logs/errors

Phase F — cutover
Only after staging parity:
1. backup/export AppDeploy data;
2. final delta migration;
3. switch Square webhook;
4. switch domain;
5. smoke/E2E;
6. retain AppDeploy rollback window.

## 18. Known Hardening Items / Developer Attention

1. **Scope baseline transaction:** current code writes baseline history before updating project. If project update fails, history rollback should delete the new baseline record.
2. **Approved change-order transaction:** same pattern; rollback new history record if project update fails.
3. **Webhook ordering:** event-ID dedupe exists, but add explicit stale/out-of-order event timestamp/version protection.
4. **Large App component:** split after migration parity, not before, to reduce behavioral regression.
5. **AI Word extraction:** current AppDeploy implementation uses AI over base64 bytes. Replace with deterministic DOCX parsing where possible.
6. **Data export:** current connected AppDeploy source tools expose code, but a full database/storage export must be obtained separately before final cutover.
7. **Real Square lifecycle testing:** do not claim complete until actual lifecycle scenarios have been executed.
8. **Owner test bypass:** current backend contains an owner-test email bypass. Replace with an explicit non-production/admin entitlement mechanism; do not carry email-based bypass into general production architecture.

## 19. Definition of Migration Complete

Migration is complete only when:
- all current workflows operate on Vercel staging;
- existing required data is migrated and reconciled;
- private files are available and isolated;
- auth/workspace isolation negative tests pass;
- proposal evidence/provenance behaves equivalently;
- revision/baseline/change-order history is correct;
- Square real lifecycle is tested;
- public shares work;
- build/runtime logs are clean enough for launch;
- mobile and core accessibility flows are verified;
- production cutover has a rollback plan.

## 20. Handoff Caveat

This package is based on direct inspection of the applied AppDeploy source snapshot. It intentionally contains **no secret values**. AppDeploy database rows and private storage objects are not embedded in this package. They require an explicit export/migration process.
