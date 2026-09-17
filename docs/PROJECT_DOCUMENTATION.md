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

**Health / billing**: `_healthcheck`, `square/webhook`, `billing/integration-status`, `billing/status`, `billing/checkout-started`, `billing/sync`

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
