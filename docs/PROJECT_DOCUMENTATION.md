# ScopeVanta — Project Documentation

Multi-tenant B2B commercial intelligence SaaS for service businesses.
Operating loop: **Analyze → Clarify → Scope → Price → Propose → Win → Protect**.

This is a from-scratch Next.js rebuild of a legacy AppDeploy-native app
(source preserved at `legacy/` for reference). The rebuild translates every
legacy route's business logic 1:1 while replacing the architecture per the
decisions in `CLAUDE.md`. Read `CLAUDE.md` first — it's the source of truth
for every architectural choice referenced below and overrides anything in
`docs/SCOPEVANTA_COMPLETE_HANDOFF.md` / `docs/ScopeVanta_Architecture_Features_Plugins.md`
where they conflict.

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 — dark, neutral/monochrome design system (`src/app/globals.css`) |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth & workspaces | Clerk (`@clerk/nextjs`), Clerk Organizations = workspace |
| AI | Anthropic API (`@anthropic-ai/sdk`), model `claude-sonnet-5` |
| File storage | Vercel Blob |
| Billing | Square (subscriptions, webhooks) |

## 2. Tenant model

Every persisted record belongs to a **workspace** (`workspace_id`), which is
a Clerk Organization — never a user ID. `Workspace.id` and `User.id` in
`prisma/schema.prisma` are literally Clerk's `organization.id` / `user.id`;
there's no separate identity-mapping table.

Three roles, enforced via `requireRole()` in `src/lib/auth.ts`:

- **Owner** — exactly one per workspace; full access including billing and workspace deletion
- **Admin** — full product access + member management; no billing
- **Member** — full product access, including destructive actions (delete a client, revoke a share, approve a change order); no member/billing management

`requireWorkspaceAuth()` (`src/lib/auth.ts`) resolves `{ userId, workspaceId, role }`
from Clerk's session on every request and auto-provisions the local
`User`/`Workspace`/`WorkspaceMember` rows on first sight (lazy provisioning —
see the note in that file about why a Clerk-webhook-driven version would be
better for production).

## 3. Data model

Full schema: `prisma/schema.prisma`. Key entities:

- `Workspace`, `WorkspaceMember`, `WorkspaceInvite` — identity/tenancy
- `CompanyProfile` (one per workspace) / `UserSettings` (one per membership) — the profile split from CLAUDE.md, replacing legacy's single per-user `Profile`
- `Client` — CRM record
- `Project` — an opportunity/proposal. Core queryable fields (risk score, deal stage/value, evidence status, commercial-stale flag) are real columns; the AI-intelligence sub-objects (`commercialLab`, `dealOS`, `proposalStudio`, `winPlan`, `closeCoach`, `estimateLines`, `scopeGraph`, etc.) live in a single `data: Json` catch-all column — see the comment on `Project.data` for why
- `ProposalVersion`, `ScopeBaseline`, `ChangeOrder` — append-only history tables (real tables, not embedded arrays — an intentional improvement over legacy's array-in-JSON pattern)
- `KnowledgeFile` / `KnowledgeRecord` — uploaded documents and the facts extracted from them
- `ProposalShare` / `DiscoveryShare` — public, token-gated buyer-facing records
- `BillingSubscription` (one per workspace) / `BillingEvent` / `SquareBillingConfig` — Square integration state
- `CommercialAudit` — append-only audit log (replaces legacy's per-project embedded, truncated audit array)

## 4. API surface

All routes live under `src/app/api/`, one Next.js route file per legacy
endpoint, each with a comment citing the exact legacy line range it was
translated from. Grouped:

**Health / billing**: `healthcheck`, `square/webhook`, `billing/integration-status`, `billing/status`, `billing/checkout-config`, `billing/subscribe`, `billing/update-card`, `billing/cancel`, `billing/sync`

**Profile** (split per CLAUDE.md): `workspace/profile` (company, Owner/Admin write), `user/settings` (personal, net new)

**Files / knowledge**: `upload`, `files`, `files/[id]`, `files/[id]/reprocess`, `knowledge`, `knowledge/[id]`, `knowledge/health`

**Clients**: `clients`, `clients/[id]`

**Projects / proposals**: `projects`, `projects/[id]` (net new — see below), `analyze`, `projects/[id]/refine`, `projects/[id]/proposal`, `projects/[id]/versions`

**Analytics / dashboard**: `analytics/event`, `analytics/summary`, `dashboard/intelligence`

**Commercial system**: `commercial/rates`, `commercial/rates/[id]`, `projects/[id]/scope-economics`, `projects/[id]/commercial-state`, `projects/[id]/commercial-autopilot`, `projects/[id]/commercial-lab`, `projects/[id]/scope-baseline`, `projects/[id]/change-order/approve`, `projects/[id]/commercial-history`, `projects/[id]/scope-graph`, `pricing-brain`, `projects/[id]/deal-os`, `projects/[id]/readiness`

**Sales / proposal intelligence**: `projects/[id]/proposal-studio`, `projects/[id]/win-plan`, `projects/[id]/deal`, `projects/[id]/close-coach`, `support`

**Sharing** (public, token-gated, no auth): `projects/[id]/discovery-share` (create), `discovery-share/[token]` (buyer GET/POST), `projects/[id]/share`, `projects/[id]/share/revoke`, `proposal-share/[token]` (buyer GET), `proposal-share/[token]/scenario`, `proposal-share/[token]/decision`, `projects/[id]/share-analytics`

`GET /api/projects/[id]` is the one net-new route (legacy never needed it —
its SPA kept the whole project object in memory from the list fetch).

## 5. Frontend pages

- `(app)/layout.tsx` — authenticated shell (sidebar nav, org switcher, onboarding gate)
- `(app)/dashboard` — business command center
- `(app)/proposals`, `(app)/proposals/new`, `(app)/proposals/[id]` — proposal list, brief intake, and the **opportunity workspace** (proposal editing, clarification/refine, scope & economics, Opportunity Lab, Deal-to-Profit OS, sharing, revision history all on one page — legacy's single largest screen)
- `(app)/clients` — Client 360
- `(app)/knowledge` — file upload, extracted facts, health check
- `(app)/settings/company`, `(app)/settings/billing`
- `onboarding/workspace`, `onboarding` — first-run flow (Clerk org creation, then company profile + plan)
- `share/[token]`, `discovery/[token]` — public buyer-facing pages (real URLs; legacy used unindexable `#share=`/`#discovery=` hash fragments — a deliberate improvement)

**Known scope gap**: on the opportunity workspace page, Deal-to-Profit OS,
Proposal Studio, and Commercial Autopilot render their AI result as
formatted JSON rather than bespoke per-action UI (14 Deal OS actions each
having a custom layout was out of scope for this pass); the scope-graph API
route has no dedicated node-graph editor UI (only the scope & economics
line-item editor got one). All underlying API routes are complete and
functional regardless.

## 6. Environment variables

See `.env.example` for the full list with comments. Required to run
anything: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`. Required for the actual product to work:
`ANTHROPIC_API_KEY` (every AI feature). Required before leaving dev mode:
`SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY` (billing gate is
otherwise bypassable only via `SCOPEVANTA_DEV_UNLIMITED_ENTITLEMENT=true`,
which is inert whenever `NODE_ENV === "production"`).

## 7. Local setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, Clerk keys, ANTHROPIC_API_KEY
npx prisma migrate dev      # creates tables (or `npx prisma dev` first for a zero-install local Postgres)
npm run dev
```

Then: sign up → create a Clerk organization → complete the company-profile
onboarding form → land on `/dashboard`.

## 8. Deployment (Vercel)

1. Add a Postgres database (Vercel Storage tab → Neon/Supabase) → set `DATABASE_URL`
2. Set all env vars from `.env.example` in Vercel project settings (Production + Preview)
3. `postinstall` already runs `prisma generate` automatically on Vercel builds
4. Run `npx prisma migrate deploy` once against the production `DATABASE_URL` (migrations don't run automatically on deploy)
5. Configure Clerk's allowed domains and Square's webhook URL (`https://<domain>/api/square/webhook`) to point at the deployed domain

## 9. Notable architecture decisions vs. the legacy source

(Full detail lives in conversation history / commit messages, but the load-bearing ones:)

- **Billing ownership**: legacy resolved Square webhook events via email-keyed KV lookups tied to an individual user. Rebuilt so the **workspace** is the Square customer of record — a Square Customer is created with `reference_id = workspaceId`, and `BillingSubscription.squareCustomerId`/`squareSubscriptionId` are looked up directly, never re-searched by email.
- **`commercialLabStale` bug fix**: legacy never clears this flag anywhere, which would permanently block sharing (`POST /api/projects/:id/share` 409s while it's `true`) after the very first scope edit. The `commercial-lab` route now clears it after a successful recalculation.
- **Transactional writes**: scope-baseline and change-order-approval writes use real `prisma.$transaction`, not legacy's manual write-then-compensating-delete.
- **OWNER_TEST_EMAIL removed**: legacy had a hardcoded email bypass for unlimited entitlement. Replaced with `SCOPEVANTA_DEV_UNLIMITED_ENTITLEMENT`, an environment-gated flag inert in production, tied to no person.
- **AI transport**: `src/lib/ai.ts` wraps Anthropic instead of AppDeploy's `ai.*` calls. Two things learned empirically (not documented anywhere beforehand): `claude-sonnet-5` rejects the `temperature` parameter outright (400 error, not a clamp), and every system prompt is sent with `cache_control: ephemeral` for real, verified cost savings on repeated calls.

## 10. Features in detail

### 10.1 Workspace & team

A workspace is a Clerk Organization. Signing up with no organization sends
you to `/onboarding/workspace` (Clerk's `OrganizationList`, which prompts
for a real name on creation — never a generic default). Every later request
resolves `{ userId, workspaceId, role }` from the Clerk session
(`requireWorkspaceAuth()`); nothing is ever scoped by a client-supplied
workspace ID, only the authenticated session's active organization.

Three roles: **Owner** (one per workspace, full access including billing),
**Admin** (full product access + member management, no billing), **Member**
(full product access including destructive actions — delete a client,
revoke a share, approve a change order — since this is treated as an
internal sales tool, not one needing junior staff walled off from
deletions). Role checks are centralized in `requireRole()`, called per route
rather than duplicated as inline logic.

### 10.2 Company Profile

`/settings/company` — one shared record per workspace (`CompanyProfile`),
not per user. Fields: contact name/email, business address, company name,
website, and a free-text "expertise & services" field. This record is what
every AI generation call below actually reads as "who the seller is" — it's
the single source of truth for how the AI is told to represent your
business in every proposal, refinement, and coaching call. Write access is
Owner/Admin only. The `onboarded` flag on this record is what gates whether
a workspace can reach the rest of the app at all (`(app)/layout.tsx`
redirects to `/onboarding` until this is filled in).

### 10.3 Client 360 (`/clients`)

Full CRM record per client: contact/company info, industry, lifecycle
status (Prospect/Active/Won/Dormant/Lost), free-text notes/goals/
preferences/decision-makers/pain-points/buying-criteria/known-objections,
next step, follow-up date, logo. The list view enriches each client with
`proposalCount` and `averageRisk` computed live from linked projects — not
stored, always current. **Deletion is blocked** (enforced both in the route
and at the database level via a `Restrict` foreign key) whenever the client
has any linked proposal, so proposal history never loses its client
context. Client email is validated server-side on every create/update.

### 10.4 Knowledge Base (`/knowledge`)

Upload capability decks, service sheets, or reference documents (PDF, DOCX,
DOC, TXT/MD, images). Each upload goes through format-specific extraction:
plain decode for text files, AI-driven transcription for PDF/DOCX (Claude
reading the document directly), OCR for images. Extracted text is then
structured into discrete categorized facts via a forced tool-call schema
extraction (`structureKnowledge`) — categories: Service, Differentiator,
Deliverable, Pricing evidence, Timeline, Process, Constraint, Exclusion,
Proof point, Client fact. Each fact can be individually paused/activated
without deleting it. A **health check** (`/api/knowledge/health`) flags
orphaned facts (source file deleted), duplicate facts, failed extractions,
and files whose original blob is no longer retrievable — with a one-line
recommendation. **Reprocessing** a file re-extracts and re-structures it,
but only commits the replacement fact set (and deletes the old one) after
the new set is fully written — a partial/failed reprocess leaves the
existing knowledge untouched.

### 10.5 Proposal generation (Analyze) — `/proposals/new`

The entry point of the whole product. You provide a client brief (min 40
characters), optional saved client link, budget, and timeline. Before
generating, the route: confirms the company profile is onboarded, verifies
Square entitlement (re-verifying if the last check is >15 min stale or the
workspace isn't already `verified_active`; bypassable only via the
dev-only `SCOPEVANTA_DEV_UNLIMITED_ENTITLEMENT` flag), and enforces the
plan's monthly proposal limit (Freelancer 10 / Pro 40 / Agency 150,
counted from the 1st of the current month).

It then builds context: scrapes the company website if one's set (7000
chars, best-effort), pulls saved-client context if a client is linked, and
retrieves the most relevant active knowledge facts via a scored-ranking
retrieval (`rankKnowledge` — term overlap + category priority weighting,
capped at 60 facts spread across sources so no single document dominates).
All of that plus the brief goes to Claude with a single, very explicit
system prompt whose guardrails are the product's actual selling point:
never fabricate facts/credentials/pricing/ROI/guarantees; every claim in
the output must be tagged as `seller_fact` (must cite a real knowledge
record ID), `client_fact` (from the brief/budget/timeline), `assumption`,
or `strategy` (Claude's own recommendation, not a fact); unknowns become
"To be confirmed" instead of being guessed. The result — score, summary,
risks, clarification questions, the proposal text itself, and the tagged
grounding list — becomes a new `Project`.

### 10.6 Clarification & refinement

Every generated proposal comes with 5-8 clarification questions. Answering
them and hitting Refine (`/api/projects/:id/refine`) sends the Q&A back to
Claude, which reconciles the answers throughout the proposal — but treats
each answer as authoritative *only* for the question it addresses, and
explicitly does not silently resolve unanswered ones. A full snapshot of
the pre-refinement proposal is saved to `ProposalVersion` first. Existing
`seller_fact` grounding is preserved across the refine **only** if the
revised claim still matches the original claim text and still has a real
knowledge-record citation — otherwise it's dropped rather than kept
un-verified.

### 10.7 Manual proposal editing & revision history (`/proposals/[id]`)

The proposal text is directly editable. Saving with **no actual text
change** (e.g. just changing proposal options) does not create a phantom
revision. A real text change: snapshots the previous version to
`ProposalVersion`, advances the version number, clears all grounding (a
manually-edited proposal's claims are no longer verified against knowledge
records — evidence status flips to `needs_review`), and marks commercial
intelligence stale. `GET /api/projects/:id/versions` returns the full
revision list, current version included, newest first.

### 10.8 Scope & Economics Engine

An editable table of deliverable lines (qty, hours, cost rate, sell rate,
acceptance criteria). The pricing formula (exact, not AI-estimated):

```
hours            = Σ(qty × hours)
baseCost         = Σ(qty × hours × costRate)
riskAdjustedCost = baseCost × (1 + contingencyPct/100)
floorPrice       = riskAdjustedCost / (1 − floorMargin/100)
recommendedPrice = riskAdjustedCost / (1 − targetMargin/100)
price            = max(recommendedPrice, modeledSellPrice)
```

Three scenarios are always produced: **Lean** (floor price, protect the
margin floor), **Recommended** (current engineered scope at target
economics), **Premium** (price × 1.2 at hours × 1.1). Saving can
optionally sync a commercial summary block into the proposal text itself.

### 10.9 Opportunity Lab (Commercial Lab)

The deepest AI pass on an opportunity: engineers a phased scope (phases →
deliverables → tasks → acceptance criteria), assumptions/dependencies/
client-responsibilities/exclusions, a full requirement traceability matrix
(each stated requirement marked Covered/Ambiguous/Unanswered against the
actual proposal text), feasibility vs. stated team capacity, negotiation
guidance, and — if a change request is supplied — an explicit
Included/Ambiguous/Out-of-Scope classification with a draft change order.
Pricing math (`estimatedCost`, `minimumSafePrice`, margins) is computed
deterministically in code from the AI's estimated hours and your supplied
internal rate/target margin, not left to the model to arithmetic. Running
this successfully **clears** the commercial-stale flag (a real bug fixed
from the legacy app — see §9).

### 10.10 Deal-to-Profit OS

A single route (`/api/projects/:id/deal-os`) with 14 selectable actions,
each producing a different structured intelligence artifact from the same
underlying opportunity context: Discovery Agent (client-facing question
set), Scope Compiler, Margin Firewall (risk/unpriced-work scan), Buyer
Choices (packaged pricing tiers), Negotiation Simulator, Scope Creep
Firewall (change classification), Profitability Autopsy (estimate-vs-actual
learning), Pre-Mortem, Red-Team Proposal (adversarial review), Personalize,
Meeting Delta (extract new/changed requirements from meeting notes),
Client Responsibilities, Handoff Pack, and a free-form Commercial Copilot
Q&A. Results accumulate per-action on the project (`data.dealOS.<action>`)
rather than overwriting each other. Currently rendered as formatted JSON in
the UI rather than 14 bespoke layouts (see §5 known gap) — every action's
API logic is complete and independently callable.

### 10.11 Proposal Studio

Proposal-quality tooling: an audit (score, ready/not-ready, issues by
severity, strengths), requirement coverage, modular section rewriting,
alternative positioning approaches, meeting-delta extraction, an objection
workspace (diagnosis + response options), and stage-aware follow-up email
drafting. Same one-route/action-parameter pattern as Deal OS.

### 10.12 Win Plan & Close Coach

**Win Plan**: buyer priorities, decision friction, known/needed decision
makers, deal signals, objections with grounded (non-invented) responses,
differentiators, and a ready-to-send follow-up email — all built from the
proposal, saved client context (pain points, buying criteria, known
objections), and nothing else; missing facts become discovery questions,
never guesses.

**Close Coach**: one concrete next-best-action for the deal's current
stage, with rationale, a client-ready follow-up draft, and discovery
questions — informed by the workspace's own recorded win/loss history
(`outcomeReason` on past Won/Lost deals) as descriptive pattern hints, not
predictions.

### 10.13 Protect layer — scope baselines & change orders

Once Opportunity Lab has produced a scope, you can **establish a
baseline** — a durable, versioned snapshot (scope, pricing, feasibility,
estimate lines, proposal text at that moment) written via a real database
transaction alongside the baseline-established audit entry (legacy did
this as two separate writes with manual rollback; here it's atomic). Any
later change request classified "Out of Scope" by the Lab produces a draft
change order; **approving** it is also transactional, links to the
baseline it was assessed against, and records who approved it and when.
`GET /api/projects/:id/commercial-history` returns the full baseline and
change-order history for the opportunity.

### 10.14 Client Deal Room / Sharing (`/share/[token]`)

Sharing is **blocked** if evidence needs review or commercial intelligence
is stale — you can't send a buyer a proposal whose backing claims or
pricing haven't been reconciled with the latest edits. Once shared, the
buyer gets a real, indexable URL (not the legacy app's `#share=` hash
fragment) showing the proposal text, scope summary, and — if produced —
selectable pricing packages. Every view increments a counter and logs an
engagement event; package selection and the final accept/request-changes
decision are tracked as **separate** events (selecting a package isn't a
decision). Revoking a share invalidates the link immediately.

### 10.15 Discovery links (`/discovery/[token]`)

A lighter-weight public link: send a buyer a set of AI-generated discovery
questions (produced by Deal OS's Discovery Agent action) without exposing
the proposal itself. Submitted answers are stored on the opportunity and
surfaced back to the seller as "review before refining" evidence.

### 10.16 Deal pipeline & outcomes

Every project has a deal stage (Draft → Proposal Ready → Sent → Follow-up
→ Negotiation → Won/Lost) and a deal value, updatable independently of
proposal content (`PUT /api/projects/:id/deal`). Moving to Won or Lost
**requires** an outcome reason — this is what feeds Close Coach's
historical pattern matching and the Pricing Brain calibration below.

### 10.17 Dashboard (`/dashboard`)

Aggregated, computed-live (not cached) view of: proposal/client totals,
average risk score, month-over-month proposal volume, risk distribution
(high/medium/low), a 6-month trend, top-5 highest-risk open opportunities,
and commercial performance — win rate, won/lost value, average won deal
size, open pipeline by stage, and proposal-decision metrics (shared /
accepted / changes-requested / average time-to-decision). All descriptive
history, never framed as a prediction.

### 10.18 Pricing Brain (`/api/pricing-brain`)

Cross-project calibration: for every Won/Lost deal with recorded actuals,
computes estimated-vs-actual hours variance, cost variance, and actual
margin, then averages across the workspace's history. Explicitly refuses
to treat small sample sizes (<3 completed records) as reliable guidance —
returns a guidance string saying so instead of presenting thin data as a
pattern.

### 10.19 AI Support Chat (`/api/support`)

A lightweight in-app concierge — helps with plan selection and activation
questions, aware of the workspace's current plan/billing status, explicitly
instructed never to claim a payment is verified or invent a discount
(Square is the only source of truth for actual billing state).

### 10.20 Plan & Billing (`/settings/billing`)

Owner-only. Shows current plan, lifecycle status (trial_setup →
awaiting_square_confirmation → verified_active, or a payment-failed/
canceled/paused state with distinct recovery guidance), charged-through
date, and any required action. "Sync with Square" force-reconciles state.
Switching plans is blocked while a workspace already has a verified active
Square subscription, specifically to prevent duplicate billing — you'd
change plans in Square directly instead.
