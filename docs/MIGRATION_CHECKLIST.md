# ScopeVanta Migration Checklist

## Source & inventory
- [ ] Export byte-for-byte `src/App.tsx`
- [ ] Export byte-for-byte `backend/index.ts`
- [ ] Export remaining source/config/assets
- [ ] Record AppDeploy source version `1789545776525`
- [ ] Export DB inventory/counts by workspace
- [ ] Export storage inventory
- [ ] Record configured secret names (not values in tickets/docs)

## Foundation
- [ ] Vercel staging project
- [ ] Target PostgreSQL
- [ ] Private object storage
- [ ] Auth provider
- [ ] Stable workspace IDs
- [ ] Tenant isolation middleware/RLS
- [ ] API compatibility layer

## Parity
- [ ] onboarding
- [ ] dashboard
- [ ] clients
- [ ] knowledge
- [ ] analyze
- [ ] clarify/refine
- [ ] proposal edit/version
- [ ] commercial lab
- [ ] economics
- [ ] Deal OS
- [ ] Proposal Studio
- [ ] win plan
- [ ] close coach
- [ ] sharing/decisions
- [ ] baselines/change orders
- [ ] analytics
- [ ] billing

## Square
- [ ] checkout
- [ ] webhook signature
- [ ] idempotency
- [ ] ordering protection
- [ ] active
- [ ] canceled
- [ ] paused/resumed
- [ ] payment failed
- [ ] payment recovery
- [ ] duplicate checkout guard

## Launch
- [ ] data reconciliation
- [ ] E2E
- [ ] runtime logs
- [ ] mobile
- [ ] accessibility
- [ ] security review
- [ ] final delta migration
- [ ] webhook cutover
- [ ] domain cutover
- [ ] rollback plan
