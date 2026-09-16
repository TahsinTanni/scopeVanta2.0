# Project rules for Claude Code

Treat SCOPEVANTA_COMPLETE_HANDOFF.md and 
ScopeVanta_Architecture_Features_Plugins.md as a first draft written by a 
non-developer describing what an AI-built app was supposed to do — not a 
verified spec. Before implementing any prompt: (1) restate the rule in 
your own words, (2) flag anything ambiguous, contradictory, insecure, or 
that you'd implement differently for correctness, and (3) implement the 
better version, explaining what you changed and why. Never silently copy 
a flawed pattern just because the docs describe it that way.

Confirmed decision: this app uses real multi-user workspaces — a workspace 
can have multiple members with roles, invited by email, and billing is 
per-seat via Square subscription quantity. This overrides any part of the 
docs that implies 1 user = 1 tenant.

## Confirmed architecture decisions (supersede the docs wherever they conflict)

### Auth & workspace identity
- Auth provider is **Clerk**, using **Clerk Organizations** as the workspace
  model. `organization.id` from Clerk is the stable `workspace_id` used as
  the tenant key everywhere in the schema — it is separate from Clerk's
  `user.id` and from any per-record `created_by_user_id` attribution field.
- All tenant-owned tables are scoped by `workspace_id`, not by user ID. The
  route handler reads the active organization from the authenticated
  session/token — never from a client-supplied URL param or body field — to
  prevent workspace_id tampering.
- Clerk's native organization invitation system (pending invite by email,
  role, expiry, resolution on signup or sign-in) is the invite flow. Do not
  hand-roll a separate pending-invitation table/flow.

### Roles & authorization
- Exactly three roles: **Owner** (exactly one per workspace at a time,
  transferable via an explicit ownership-transfer action; full access
  including billing and workspace deletion), **Admin** (full product access
  plus member management; no billing access, cannot delete the workspace),
  **Member** (full product access; no member management, no billing).
- No read-only/viewer role unless a real need for one shows up — do not
  add one speculatively.
- Members ARE allowed to perform destructive core actions (delete a client,
  delete a file, revoke a share, approve a change order). This is an
  internal sales tool, not one that needs junior staff walled off from
  deletions. Billing, plan changes, and workspace/member management remain
  Owner/Admin-only.
- Authorization is enforced through one shared, centrally-defined check
  (route class → required role) that every route calls — not 50 independent
  inline role checks.

### Billing (Square)
- Square remains the billing/payment source of truth and system of record
  for all money — Clerk has no role in payments.
- The **workspace**, not an individual member, is the Square customer of
  record. Exactly one Square Customer is created per workspace at
  workspace-creation time; its ID is stored as `square_customer_id` on the
  workspace/billing record. Billing lookups always use this stored ID —
  never re-search Square customers by email.
- Only the Owner role can view billing status or change plan/checkout.
- Subscription **quantity** tracks active membership count and changes only
  on real membership events: increment on invite **acceptance** (not on
  invite-send), decrement on member removal or voluntary departure.
  Membership changes must not block on Square being reachable — queue the
  sync and reconcile if the live call fails.
- A periodic reconciliation job compares Square's live subscription
  quantity against `count(workspace_members)` and alerts on drift.
- An owner cannot remove themselves from a workspace without first
  transferring ownership, to avoid an orphaned billing entity.

### Profile split
- The old conflated "Profile/workspace" concept is split into two entities:
  - `company_profile` — one row per workspace (business name, branding,
    default rates, proposal defaults, billing binding). Owner/Admin write
    access only.
  - `user_settings` — one row per (workspace_id, user_id) membership
    (personal display/notification/UI preferences). Scoped per membership,
    not globally per user, since a person may belong to more than one
    workspace.