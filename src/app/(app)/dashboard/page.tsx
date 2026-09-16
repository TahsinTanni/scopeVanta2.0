"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Badge } from "@/components/ui";

// Replaces legacy App.tsx's dashboard view (lines 2244-2634). Data shape
// matches GET /api/dashboard/intelligence exactly (see that route for the
// aggregation logic, translated verbatim from legacy).
type Intelligence = {
  totals: { proposals: number; clients: number; linkedClients: number; averageRisk: number | null; highRisk: number; controlled: number; dueFollowUps: number; groundedClaims: number; assumptions: number };
  month: { proposals: number; previousProposals: number; averageRisk: number | null; previousAverageRisk: number | null };
  riskDistribution: { high: number; medium: number; low: number };
  trend: Array<{ label: string; proposals: number; averageRisk: number | null }>;
  topRisk: Array<{ id: string; client: string; score: number; summary: string; createdAt: string }>;
  commercialPerformance: {
    closedDeals: number; wonDeals: number; lostDeals: number; winRate: number | null; wonValue: number; openPipelineValue: number;
    pipelineByStage: Array<{ stage: string; count: number; value: number }>;
    proposalDecisions: { shared: number; accepted: number; changesRequested: number; acceptanceRate: number | null };
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<Intelligence | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/intelligence")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-sm text-foreground-muted">Loading…</p>;

  return (
    <div>
      <PageHeader title="Dashboard" description="Business Command Center" actions={<Link href="/proposals/new" className="text-sm font-medium text-foreground underline underline-offset-4">New Proposal</Link>} />

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Proposals" value={data.totals.proposals} sub={`${data.month.proposals} this month`} />
        <Stat label="Clients" value={data.totals.clients} sub={`${data.totals.linkedClients} linked to proposals`} />
        <Stat label="Average risk" value={data.totals.averageRisk ?? "—"} sub={`${data.totals.highRisk} high-risk`} />
        <Stat label="Due follow-ups" value={data.totals.dueFollowUps} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Risk distribution</h2>
          <div className="mt-3 space-y-2 text-sm">
            <RiskBar label="High" value={data.riskDistribution.high} tone="danger" />
            <RiskBar label="Medium" value={data.riskDistribution.medium} tone="warning" />
            <RiskBar label="Low" value={data.riskDistribution.low} tone="success" />
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Commercial performance</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Win rate" value={data.commercialPerformance.winRate !== null ? `${data.commercialPerformance.winRate}%` : "—"} />
            <Row label="Won value" value={`$${data.commercialPerformance.wonValue.toLocaleString()}`} />
            <Row label="Open pipeline" value={`$${data.commercialPerformance.openPipelineValue.toLocaleString()}`} />
            <Row label="Acceptance rate" value={data.commercialPerformance.proposalDecisions.acceptanceRate !== null ? `${data.commercialPerformance.proposalDecisions.acceptanceRate}%` : "—"} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-foreground">6-month trend</h2>
          <div className="mt-3 flex items-end gap-2" style={{ height: 80 }}>
            {data.trend.map((t) => (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded bg-surface-raised" style={{ height: Math.max(4, t.proposals * 10) }} />
                <span className="text-[10px] text-foreground-subtle">{t.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-foreground">Pipeline by stage</h2>
        <div className="mt-3 space-y-2">
          {data.commercialPerformance.pipelineByStage.map((s) => (
            <div key={s.stage} className="flex items-center justify-between text-sm">
              <span className="text-foreground-muted">{s.stage}</span>
              <span className="text-foreground">{s.count} · ${s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-foreground">Highest-risk opportunities</h2>
        <div className="mt-3 divide-y divide-border">
          {data.topRisk.map((p) => (
            <Link key={p.id} href={`/proposals/${p.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-foreground">
              <span className="text-foreground-muted">{p.client}</span>
              <Badge tone={p.score >= 70 ? "danger" : p.score >= 40 ? "warning" : "success"}>{p.score}</Badge>
            </Link>
          ))}
          {!data.topRisk.length && <p className="py-4 text-sm text-foreground-subtle">No opportunities yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs text-foreground-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-foreground-subtle">{sub}</p>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function RiskBar({ label, value, tone }: { label: string; value: number; tone: "danger" | "warning" | "success" }) {
  const colors = { danger: "bg-danger", warning: "bg-warning", success: "bg-success" };
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-foreground-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <div className={`h-full ${colors[tone]}`} style={{ width: `${Math.min(100, value * 8)}%` }} />
      </div>
      <span className="w-6 text-right text-foreground">{value}</span>
    </div>
  );
}
