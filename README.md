# ScopeVanta

Multi-tenant B2B commercial intelligence SaaS for service businesses. See
`docs/` for the original AppDeploy → Vercel migration handoff, and
`CLAUDE.md` for the confirmed architecture decisions that supersede it
(Clerk Organizations as the workspace model, roles, Square billing, the
company-profile/user-settings split).

**Status:** Phase A scaffold — Next.js app, database schema, and auth wiring
only. No feature routes yet.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma 7 (`@prisma/adapter-pg`) against PostgreSQL
- Clerk (`@clerk/nextjs`) for auth + organizations

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and Clerk keys
npx prisma migrate dev # once DATABASE_URL points at a real Postgres instance
npm run dev
```

## Layout

- `prisma/schema.prisma` — full data model (see CLAUDE.md for the tenant
  model it implements)
- `src/proxy.ts` — Clerk auth gate (Next.js 16 renamed `middleware` to
  `proxy`)
- `src/lib/prisma.ts` — Prisma Client singleton
- `src/app/sign-in`, `src/app/sign-up` — Clerk auth pages
