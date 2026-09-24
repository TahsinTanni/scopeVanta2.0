import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaffPage } from "@/lib/admin/auth";
import { fmtAgo, fmtDate, fmtDateTime, param } from "@/lib/admin/format";
import { AdminHeader, Section, Table, Td } from "@/components/admin/AdminUI";
import { billingPill } from "@/components/admin/billingPill";

export const dynamic = "force-dynamic";

const FILTERS: Array<[string, string, Prisma.BillingSubscriptionWhereInput]> = [
  ["", "All", {}],
  ["failed", "Payment failed", { status: "payment_failed" }],
  ["active", "Active (trial + paying)", { status: "verified_active", compPlan: false }],
  ["comp", "Free plans", { compPlan: true }],
  ["attention", "Needs attention", { compPlan: false, status: { notIn: ["verified_active", "trial_setup"] } }],
];

export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("billing.view");
  const sp = await searchParams;
  const filter = param(sp.filter);
  const where = FILTERS.find(([k]) => k === filter)?.[2] ?? {};

  const [subs, events] = await Promise.all([
    prisma.billingSubscription.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { workspace: { select: { id: true, name: true, _count: { select: { members: true } } } } },
    }),
    prisma.billingEvent.findMany({ orderBy: { processedAt: "desc" }, take: 25, include: { workspace: { select: { name: true } } } }),
  ]);

  // Seat drift: CLAUDE.md requires Square's subscription quantity to track
  // the member count. Listed here so staff can see mismatches at a glance.
  const drift = subs.filter((s) => !s.compPlan && s.squareSubscriptionId && s.quantity !== s.workspace._count.members);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Billing"
        description="ScopeVanta's local copy of each Square subscription. Square is the source of truth — resync a workspace to refresh it."
      />

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter subscriptions">
        {FILTERS.map(([k, label]) => (
          <Link
            key={k}
            href={k ? `/admin/billing?filter=${k}` : "/admin/billing"}
            className={`rounded-full border px-3 py-1 text-xs font-mono ${filter === k ? "border-accent bg-accent/10 text-accent-hover" : "border-border-hairline text-ink-muted hover:text-ink-primary"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Section title="Subscriptions" description={`${subs.length} shown (most recently changed first, up to 200).`}>
        <Table head={["Workspace", "Plan", "Status", "Trial ends", "Paid through", "Last verified", "Action needed"]} empty="No subscriptions match.">
          {subs.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link href={`/admin/workspaces/${s.workspaceId}`} className="text-ink-primary hover:text-accent">{s.workspace.name}</Link>
              </Td>
              <Td>{s.plan}</Td>
              <Td>{billingPill(s)}</Td>
              <Td>{fmtDate(s.trialEndsAt)}</Td>
              <Td>{fmtDate(s.chargedThroughDate)}</Td>
              <Td>{fmtAgo(s.verifiedAt)}</Td>
              <Td className="font-mono text-xs">{s.compPlan ? "—" : s.billingAction || "—"}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        title="Seat count drift"
        description="Square subscription quantity vs. actual members. Per-seat quantity sync isn't built yet, so expect drift on multi-member workspaces until it is."
      >
        <Table head={["Workspace", "Square quantity", "Members"]} empty="No drift among subscriptions shown.">
          {drift.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link href={`/admin/workspaces/${s.workspaceId}`} className="text-ink-primary hover:text-accent">{s.workspace.name}</Link>
              </Td>
              <Td className="font-mono tabular-nums">{s.quantity}</Td>
              <Td className="font-mono tabular-nums">{s.workspace._count.members}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Recent Square webhook events">
        <Table head={["Received", "Event", "Workspace"]} empty="No webhook events received yet.">
          {events.map((e) => (
            <tr key={e.id}>
              <Td>{fmtDateTime(e.processedAt)}</Td>
              <Td className="font-mono text-xs">{e.eventType}</Td>
              <Td>
                {e.workspaceId ? (
                  <Link href={`/admin/workspaces/${e.workspaceId}`} className="hover:text-accent">{e.workspace?.name ?? e.workspaceId}</Link>
                ) : (
                  <span className="text-ink-disabled">unmatched</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
