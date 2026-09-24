import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { estimateCostUsd, formatUsd } from "@/lib/admin/ai-pricing";
import { PLAN_PRICES_CENTS, PLAN_CURRENCY } from "@/lib/plans";
import { daysAgo, fmtNum, fmtPct } from "@/lib/admin/format";
import { AdminHeader, Section, StatCard, Table, Td } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireStaffPage("overview.view");
  const now = new Date();
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);

  const [workspaces, users, newWs7, newWs30, newUsers7, newUsers30, subs, suspended, aiByWorkspace, aiTotals, openSupport] = await Promise.all([
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.workspace.count({ where: { createdAt: { gte: d7 } } }),
    prisma.workspace.count({ where: { createdAt: { gte: d30 } } }),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.billingSubscription.findMany({
      select: { plan: true, status: true, compPlan: true, trialEndsAt: true, checkoutStartedAt: true },
    }),
    prisma.workspace.count({ where: { suspendedAt: { not: null } } }),
    prisma.aiUsageEvent.groupBy({
      by: ["workspaceId", "model"],
      where: { createdAt: { gte: d30 } },
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ["success"],
      where: { createdAt: { gte: d30 } },
      _count: { _all: true },
    }),
    prisma.supportConversation.count({ where: { status: "open" } }),
  ]);

  // Billing picture. "In trial" = Square subscription active but still in
  // its free first month; "paying" = active and past the trial.
  const active = subs.filter((s) => !s.compPlan && s.status === "verified_active");
  const inTrial = active.filter((s) => s.trialEndsAt && s.trialEndsAt > now);
  const paying = active.filter((s) => !s.trialEndsAt || s.trialEndsAt <= now);
  const mrrCents = paying.reduce((sum, s) => sum + PLAN_PRICES_CENTS[s.plan], 0);
  const failed = subs.filter((s) => s.status === "payment_failed").length;
  const comp = subs.filter((s) => s.compPlan).length;
  const trialsEnded = subs.filter((s) => !s.compPlan && s.trialEndsAt && s.trialEndsAt <= now);
  const conversion = trialsEnded.length ? trialsEnded.filter((s) => s.status === "verified_active").length / trialsEnded.length : null;
  const setupOnly = subs.filter((s) => !s.compPlan && !s.checkoutStartedAt).length + (workspaces - subs.length);

  // AI usage and estimated spend over 30 days.
  const costByWorkspace = new Map<string, { cost: number; calls: number }>();
  let totalCost = 0;
  for (const row of aiByWorkspace) {
    const cost =
      estimateCostUsd(row.model, {
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        cacheReadTokens: row._sum.cacheReadTokens ?? 0,
        cacheWriteTokens: row._sum.cacheWriteTokens ?? 0,
      }) ?? 0;
    totalCost += cost;
    const key = row.workspaceId ?? "(deleted)";
    const prev = costByWorkspace.get(key) ?? { cost: 0, calls: 0 };
    costByWorkspace.set(key, { cost: prev.cost + cost, calls: prev.calls + row._count._all });
  }
  const aiCalls = aiTotals.reduce((n, r) => n + r._count._all, 0);
  const aiFailed = aiTotals.find((r) => !r.success)?._count._all ?? 0;
  const top = [...costByWorkspace.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, 8);
  const topNames = await prisma.workspace.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true } });
  const nameOf = new Map(topNames.map((w) => [w.id, w.name]));

  return (
    <div className="space-y-6">
      <AdminHeader title="Overview" description="Platform health at a glance. Revenue figures are estimates from local billing records." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Workspaces" value={fmtNum(workspaces)} hint={`+${newWs7} this week · +${newWs30} in 30 days`} />
        <StatCard label="Users" value={fmtNum(users)} hint={`+${newUsers7} this week · +${newUsers30} in 30 days`} />
        <StatCard
          label={`Est. MRR (${PLAN_CURRENCY})`}
          value={`$${(mrrCents / 100).toLocaleString("en-CA")}`}
          hint={`${paying.length} paying workspace${paying.length === 1 ? "" : "s"}`}
        />
        <StatCard label="Trial → paid" value={fmtPct(conversion)} hint={`${trialsEnded.length} trials ended so far`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In free trial" value={fmtNum(inTrial.length)} />
        <StatCard label="Not set up billing" value={fmtNum(setupOnly)} hint="Never started Square checkout" />
        <StatCard label="Payment failed" value={fmtNum(failed)} tone={failed ? "danger" : undefined} />
        <StatCard label="Free plans / suspended" value={`${comp} / ${suspended}`} tone={suspended ? "warning" : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="AI calls (30d)" value={fmtNum(aiCalls)} />
        <StatCard label="AI failure rate (30d)" value={fmtPct(aiCalls ? aiFailed / aiCalls : null)} tone={aiCalls && aiFailed / aiCalls > 0.05 ? "danger" : undefined} />
        <StatCard label="Est. AI cost (30d, USD)" value={formatUsd(totalCost)} />
        <StatCard
          label="Open support chats"
          value={<Link href="/admin/support" className="hover:text-accent">{fmtNum(openSupport)}</Link>}
        />
      </div>

      <Section title="Top workspaces by AI cost" description="Last 30 days. Useful for spotting abuse or unprofitable accounts.">
        <Table head={["Workspace", "AI calls", "Est. cost (USD)"]} empty="No AI usage recorded yet.">
          {top.map(([id, v]) => (
            <tr key={id}>
              <Td>
                {id === "(deleted)" ? (
                  <span className="text-ink-muted">Deleted workspace</span>
                ) : (
                  <Link href={`/admin/workspaces/${id}`} className="text-ink-primary hover:text-accent">
                    {nameOf.get(id) ?? id}
                  </Link>
                )}
              </Td>
              <Td className="font-mono tabular-nums">{fmtNum(v.calls)}</Td>
              <Td className="font-mono tabular-nums">{formatUsd(v.cost)}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
