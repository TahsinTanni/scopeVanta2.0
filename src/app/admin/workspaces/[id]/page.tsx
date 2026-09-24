import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { estimateCostUsd, formatUsd } from "@/lib/admin/ai-pricing";
import { daysAgo, fmtDate, fmtDateTime, fmtNum, startOfMonth } from "@/lib/admin/format";
import { billing } from "@/lib/billing";
import { FEATURE_FLAGS, GLOBAL_SCOPE, type FeatureFlagKey } from "@/lib/flags";
import { AdminHeader, KeyValue, Pill, Section, Table, Td } from "@/components/admin/AdminUI";
import { billingPill } from "@/components/admin/billingPill";
import {
  BillingControls,
  DeleteWorkspace,
  ExportButton,
  FlagOverrides,
  ResyncButton,
  SuspendControl,
} from "@/components/admin/WorkspaceControls";

export const dynamic = "force-dynamic";

export default async function AdminWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("workspaces.view");
  const { id } = await params;

  const ws = await prisma.workspace.findUnique({
    where: { id },
    include: {
      billingSubscription: true,
      companyProfile: { select: { businessName: true, website: true } },
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      _count: { select: { projects: true, clients: true, knowledgeFiles: true, proposalShares: true, supportConversations: true } },
    },
  });
  if (!ws) notFound();

  const [projectsThisMonth, aiRows, flagRows, audit, openSupport] = await Promise.all([
    prisma.project.count({ where: { workspaceId: id, createdAt: { gte: startOfMonth() } } }),
    prisma.aiUsageEvent.groupBy({
      by: ["feature", "model", "success"],
      where: { workspaceId: id, createdAt: { gte: daysAgo(30) } },
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
      _count: { _all: true },
    }),
    prisma.featureFlag.findMany({ where: { scope: { in: [GLOBAL_SCOPE, id] } } }),
    can(ctx.role, "audit.view")
      ? prisma.adminAuditLog.findMany({ where: { workspaceId: id }, orderBy: { createdAt: "desc" }, take: 15 })
      : Promise.resolve([]),
    prisma.supportConversation.count({ where: { workspaceId: id, status: "open" } }),
  ]);

  const sub = ws.billingSubscription;
  const state = billing(sub);

  // AI usage by feature over 30 days.
  const byFeature = new Map<string, { calls: number; failed: number; cost: number }>();
  for (const r of aiRows) {
    const cur = byFeature.get(r.feature) ?? { calls: 0, failed: 0, cost: 0 };
    cur.calls += r._count._all;
    if (!r.success) cur.failed += r._count._all;
    cur.cost +=
      estimateCostUsd(r.model, {
        inputTokens: r._sum.inputTokens ?? 0,
        outputTokens: r._sum.outputTokens ?? 0,
        cacheReadTokens: r._sum.cacheReadTokens ?? 0,
        cacheWriteTokens: r._sum.cacheWriteTokens ?? 0,
      }) ?? 0;
    byFeature.set(r.feature, cur);
  }
  const features = [...byFeature.entries()].sort((a, b) => b[1].cost - a[1].cost);

  const flags = (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => {
    const override = flagRows.find((f) => f.key === key && f.scope === id);
    const global = flagRows.find((f) => f.key === key && f.scope === GLOBAL_SCOPE);
    return { key, label: FEATURE_FLAGS[key].label, override: override ? override.enabled : null, global: global ? global.enabled : true };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/workspaces" className="text-xs font-mono text-ink-muted hover:text-ink-primary">← Workspaces</Link>
        <AdminHeader
          title={ws.name}
          description={ws.id}
          actions={
            <div className="flex flex-wrap gap-1.5">
              {ws.suspendedAt && <Pill tone="danger">suspended</Pill>}
              {billingPill(sub)}
            </div>
          }
        />
      </div>

      <Section title="Summary">
        <KeyValue
          items={[
            ["Created", fmtDate(ws.createdAt)],
            ["Business name", ws.companyProfile?.businessName || "—"],
            ["Website", ws.companyProfile?.website || "—"],
            ["Members", fmtNum(ws.members.length)],
            ["Proposals (total / this month)", `${fmtNum(ws._count.projects)} / ${fmtNum(projectsThisMonth)}`],
            ["Monthly proposal limit", state.limit >= 1_000_000 ? "Unlimited" : fmtNum(state.limit)],
            ["Clients · files · share links", `${ws._count.clients} · ${ws._count.knowledgeFiles} · ${ws._count.proposalShares}`],
            [
              "Support conversations",
              can(ctx.role, "support.view") ? (
                <Link className="hover:text-accent" href={`/admin/support?workspace=${ws.id}`}>
                  {ws._count.supportConversations} total · {openSupport} open
                </Link>
              ) : (
                `${ws._count.supportConversations} total`
              ),
            ],
          ]}
        />
      </Section>

      <Section title="Members">
        <Table head={["User", "Role", "Joined"]}>
          {ws.members.map((m) => (
            <tr key={m.id}>
              <Td>
                <Link href={`/admin/users/${m.userId}`} className="text-ink-primary hover:text-accent">{m.user.email}</Link>
              </Td>
              <Td><Pill>{m.role.toLowerCase()}</Pill></Td>
              <Td>{fmtDate(m.joinedAt)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {can(ctx.role, "billing.view") && (
        <Section title="Billing" actions={can(ctx.role, "billing.manage") ? <ResyncButton workspaceId={ws.id} /> : undefined}>
          <KeyValue
            items={[
              ["Plan", sub?.plan ?? "—"],
              ["Status", sub ? (sub.compPlan ? "Free plan (complimentary)" : sub.status) : "No billing record"],
              ["Free plan note", sub?.compNote || "—"],
              ["Square customer", sub?.squareCustomerId || "—"],
              ["Square subscription", sub?.squareSubscriptionId || "—"],
              ["Trial ends", fmtDate(sub?.trialEndsAt)],
              ["Paid through", fmtDate(sub?.chargedThroughDate)],
              ["Last verified with Square", fmtDateTime(sub?.verifiedAt)],
              ["Seat quantity (Square) vs members", sub ? `${sub.quantity} vs ${ws.members.length}` : "—"],
              ["Last billing event", sub?.lastBillingEvent || "—"],
            ]}
          />
          {can(ctx.role, "billing.manage") && (
            <div className="mt-6 border-t border-border-hairline pt-5">
              <BillingControls
                workspaceId={ws.id}
                compPlan={sub?.compPlan ?? false}
                compNote={sub?.compNote ?? null}
                limitOverride={sub?.limitOverride ?? null}
                plan={sub?.plan ?? "Freelancer"}
                trialEndsAt={sub?.trialEndsAt?.toISOString() ?? null}
              />
            </div>
          )}
        </Section>
      )}

      <Section title="AI usage (30 days)">
        <Table head={["Feature", "Calls", "Failed", "Est. cost (USD)"]} empty="No AI usage in the last 30 days.">
          {features.map(([feature, v]) => (
            <tr key={feature}>
              <Td className="font-mono">{feature}</Td>
              <Td className="font-mono tabular-nums">{fmtNum(v.calls)}</Td>
              <Td className={`font-mono tabular-nums ${v.failed ? "text-danger" : ""}`}>{fmtNum(v.failed)}</Td>
              <Td className="font-mono tabular-nums">{formatUsd(v.cost)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {can(ctx.role, "flags.manage") && (
        <Section title="Feature switches for this workspace" description="Override the global switches for this workspace only.">
          <FlagOverrides workspaceId={ws.id} flags={flags} />
        </Section>
      )}

      {can(ctx.role, "audit.view") && (
        <Section title="Staff activity on this workspace">
          <Table head={["When", "Staff", "Action"]} empty="No staff actions recorded.">
            {audit.map((a) => (
              <tr key={a.id}>
                <Td>{fmtDateTime(a.createdAt)}</Td>
                <Td>{a.actorEmail}</Td>
                <Td className="font-mono">{a.action}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {(can(ctx.role, "workspaces.suspend") || can(ctx.role, "workspaces.export") || can(ctx.role, "workspaces.delete")) && (
        <section className="rounded-[8px] border border-danger/30 bg-surface-1">
          <h2 className="border-b border-danger/30 px-4 py-3 font-display text-lg text-danger">Danger zone</h2>
          <div className="space-y-6 p-4">
            {can(ctx.role, "workspaces.suspend") && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-primary">Suspend</h3>
                <SuspendControl workspaceId={ws.id} suspended={Boolean(ws.suspendedAt)} reason={ws.suspendedReason} />
              </div>
            )}
            {can(ctx.role, "workspaces.export") && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-primary">Data export</h3>
                <p className="mb-2 text-sm text-ink-secondary">Everything stored for this workspace, for a customer data request. The export is logged.</p>
                <ExportButton workspaceId={ws.id} name={ws.name} />
              </div>
            )}
            {can(ctx.role, "workspaces.delete") && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-primary">Delete</h3>
                <DeleteWorkspace workspaceId={ws.id} name={ws.name} suspended={Boolean(ws.suspendedAt)} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
