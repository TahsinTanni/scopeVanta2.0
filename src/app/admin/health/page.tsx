import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { daysAgo, fmtAgo, fmtDateTime, fmtNum, fmtPct } from "@/lib/admin/format";
import { AdminHeader, Section, StatCard, Table, Td } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
  await requireStaffPage("health.view");
  const d1 = daysAgo(1);

  const [ai24, aiLatency, failures, failedPayments, staleActive, lastWebhook] = await Promise.all([
    prisma.aiUsageEvent.groupBy({ by: ["success"], where: { createdAt: { gte: d1 } }, _count: { _all: true } }),
    prisma.aiUsageEvent.aggregate({ where: { createdAt: { gte: d1 }, success: true }, _avg: { durationMs: true } }),
    prisma.aiUsageEvent.findMany({
      where: { success: false },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { workspace: { select: { name: true } } },
    }),
    prisma.billingSubscription.findMany({
      where: { status: "payment_failed", compPlan: false },
      include: { workspace: { select: { name: true } } },
      take: 50,
    }),
    // Active subscriptions nobody has re-verified with Square for 7+ days.
    prisma.billingSubscription.count({ where: { status: "verified_active", compPlan: false, verifiedAt: { lt: daysAgo(7) } } }),
    prisma.billingEvent.findFirst({ orderBy: { processedAt: "desc" }, select: { processedAt: true } }),
  ]);

  const calls = ai24.reduce((n, r) => n + r._count._all, 0);
  const failed = ai24.find((r) => !r.success)?._count._all ?? 0;
  const failRate = calls ? failed / calls : null;

  return (
    <div className="space-y-6">
      <AdminHeader title="Health" description="Errors and billing problems that need a look." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="AI calls (24h)" value={fmtNum(calls)} />
        <StatCard label="AI failure rate (24h)" value={fmtPct(failRate)} tone={failRate && failRate > 0.05 ? "danger" : undefined} />
        <StatCard
          label="Avg AI response (24h)"
          value={aiLatency._avg.durationMs ? `${(aiLatency._avg.durationMs / 1000).toFixed(1)}s` : "—"}
        />
        <StatCard label="Last Square webhook" value={fmtAgo(lastWebhook?.processedAt)} hint={`${staleActive} active subs unverified for 7+ days`} />
      </div>

      <Section title="Failed payments" description="Customers whose Square payment failed. They can't generate proposals until it's fixed.">
        <Table head={["Workspace", "Plan", "Paid through"]} empty="No failed payments.">
          {failedPayments.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link href={`/admin/workspaces/${s.workspaceId}`} className="text-ink-primary hover:text-accent">{s.workspace.name}</Link>
              </Td>
              <Td>{s.plan}</Td>
              <Td>{fmtDateTime(s.chargedThroughDate)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Recent AI failures">
        <Table head={["When", "Workspace", "Feature", "Error"]} empty="No AI failures recorded.">
          {failures.map((f) => (
            <tr key={f.id}>
              <Td>{fmtDateTime(f.createdAt)}</Td>
              <Td>
                {f.workspaceId ? (
                  <Link href={`/admin/workspaces/${f.workspaceId}`} className="hover:text-accent">{f.workspace?.name ?? f.workspaceId}</Link>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="font-mono">{f.feature}</Td>
              <Td className="max-w-md break-words text-xs">{f.errorMessage || "—"}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
