"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";
import { trackEvent } from "@/lib/track";
import { formatCurrency } from "@/lib/currency";

type Intelligence = {
  totals: { proposals: number; clients: number; linkedClients: number; averageRisk: number | null; highRisk: number; controlled: number; dueFollowUps: number; groundedClaims: number; assumptions: number };
  month: { proposals: number; previousProposals: number; averageRisk: number | null; previousAverageRisk: number | null };
  riskDistribution: { high: number; medium: number; low: number };
  statusCounts: Record<string, number>;
  currency: string;
  activation: { companyProfile: boolean; knowledgeSource: boolean; clientContext: boolean; firstProposal: boolean; subscription: boolean };
  trend: Array<{ label: string; proposals: number; averageRisk: number | null }>;
  topRisk: Array<{ id: string; client: string; score: number; summary: string; createdAt: string }>;
  commercialPerformance: {
    closedDeals: number; wonDeals: number; lostDeals: number; winRate: number | null; wonValue: number; openPipelineValue: number;
    pipelineByStage: Array<{ stage: string; count: number; value: number }>;
    proposalDecisions: { shared: number; accepted: number; changesRequested: number; acceptanceRate: number | null };
  };
};

type PricingBrain = {
  sampleSize: number;
  averageHoursVariancePct: number | null;
  averageCostVariancePct: number | null;
  averageActualMarginPct: number | null;
  records: Array<{
    projectId: string;
    client: string;
    stage: string;
    estimatedHours: number;
    actualHours: number;
    hoursVariance: number | null;
    estimatedCost: number;
    actualCost: number;
    costVariance: number | null;
    quotedPrice: number;
    actualRevenue: number;
    actualMarginPct: number | null;
  }>;
  guidance: string;
};

const STATUS_ORDER = ["Prospect", "Active", "Won", "Dormant", "Lost"];

type Activity = { counts: Record<string, number>; lastEventAt: string; eventsTracked: number };

export default function DashboardPage() {
  const [data, setData] = useState<Intelligence | null>(null);
  const [pricing, setPricing] = useState<PricingBrain | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/dashboard/intelligence")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
    fetch("/api/pricing-brain")
      .then((r) => r.json())
      .then(setPricing)
      .catch(() => {});
    fetch("/api/analytics/summary")
      .then((r) => r.json())
      .then(setActivity)
      .catch(() => {});
    trackEvent("workspace_loaded");
  }, []);

  if (!data) return <p className="text-xs uppercase font-mono tracking-wider text-ink-muted">Loading…</p>;

  // Known statuses in a fixed order, then any unrecognised status so it never vanishes.
  const statusCounts = data.statusCounts ?? {};
  const clientStatuses = [
    ...STATUS_ORDER,
    ...Object.keys(statusCounts).filter((k) => !STATUS_ORDER.includes(k)).sort(),
  ]
    .map((status) => ({ status, count: statusCounts[status] || 0 }))
    .filter((s) => s.count > 0);

  const milestones = [
    { label: "Company Profile", done: data.activation?.companyProfile },
    { label: "Knowledge Source", done: data.activation?.knowledgeSource },
    { label: "Client Context", done: data.activation?.clientContext },
    { label: "First Proposal", done: data.activation?.firstProposal },
    { label: "Subscription", done: data.activation?.subscription },
  ];
  const showActivation = !!data.activation && milestones.some((m) => !m.done);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Executive Commercial Overview"
        actions={
          <Link
            href="/proposals/new"
            className="inline-flex items-center gap-1.5 rounded-[4px] bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#002116] hover:bg-accent-hover active:bg-accent-pressed transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Proposal</span>
          </Link>
        }
      />

      <GlobalSpotlight
        gridRef={gridRef}
        glowColor="78, 135, 112"
        spotlightRadius={340}
      />

      <BentoCardGrid gridRef={gridRef} className="space-y-5">
        {/* Activation milestones — hidden once everything is complete */}
        {showActivation && (
          <div className="grid grid-cols-1 gap-4">
            <BentoCard className="p-5" glowColor="78, 135, 112">
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Get Set Up</h2>
                <span className="text-[11px] font-mono text-ink-muted">
                  {milestones.filter((m) => m.done).length} of {milestones.length} complete
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs font-mono">
                {milestones.map((m) => (
                  <div key={m.label} className="flex items-center gap-2">
                    <span className={m.done ? "text-success font-bold" : "text-ink-muted"}>{m.done ? "✓" : "○"}</span>
                    <span className="text-ink-secondary">{m.label}</span>
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>
        )}

        {/* KPI metric strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Stat label="Total Proposals" value={data.totals.proposals} sub={`${data.month.proposals} this month`} icon="description" />
          <Stat label="Total Clients" value={data.totals.clients} sub={`${data.totals.linkedClients} active pipeline`} icon="group" />
          <Stat label="Average Risk Score" value={data.totals.averageRisk ?? "—"} sub={`${data.totals.highRisk} flagged critical`} icon="warning" />
          <Stat label="Due Follow-ups" value={data.totals.dueFollowUps} sub="Commercial interventions" icon="schedule" />
        </div>

        {/* Analytics & breakdown row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BentoCard className="p-5 flex flex-col justify-between" glowColor="78, 135, 112">
            <div>
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Risk Distribution</h2>
                <span className="text-[11px] font-mono text-ink-muted">Exposure breakdown</span>
              </div>
              <div className="mt-4 space-y-3">
                <RiskBar label="High" value={data.riskDistribution.high} tone="danger" />
                <RiskBar label="Medium" value={data.riskDistribution.medium} tone="warning" />
                <RiskBar label="Low" value={data.riskDistribution.low} tone="success" />
              </div>
            </div>
            <p className="mt-4 text-[11px] font-mono text-ink-muted border-t border-border-subtle pt-2.5">
              Higher score denotes unpriced scope & commercial friction
            </p>
          </BentoCard>

          <BentoCard className="p-5 flex flex-col justify-between" glowColor="78, 135, 112">
            <div>
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Commercial Economics</h2>
                <span className="text-[11px] font-mono text-ink-muted">Pipeline Health</span>
              </div>
              <dl className="mt-3.5 space-y-2.5 text-xs">
                <Row label="Historical Win Rate" value={data.commercialPerformance.winRate !== null ? `${data.commercialPerformance.winRate}%` : "—"} />
                <Row label="Contracted Value Won" value={formatCurrency(data.commercialPerformance.wonValue, data.currency)} isMono />
                <Row label="Open Pipeline Value" value={formatCurrency(data.commercialPerformance.openPipelineValue, data.currency)} isMono />
                <Row label="Client Acceptance Rate" value={data.commercialPerformance.proposalDecisions.acceptanceRate !== null ? `${data.commercialPerformance.proposalDecisions.acceptanceRate}%` : "—"} />
              </dl>
            </div>
          </BentoCard>

          <BentoCard className="p-5 flex flex-col justify-between" glowColor="78, 135, 112">
            <div>
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">6-Month Trend</h2>
                <span className="text-[11px] font-mono text-ink-muted">Volume Velocity</span>
              </div>
              <div className="mt-5 flex items-end gap-2.5" style={{ height: 85 }}>
                {data.trend.map((t) => (
                  <div key={t.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-[2px] bg-accent/35 hover:bg-accent transition-colors"
                      style={{ height: Math.max(6, t.proposals * 12) }}
                      title={`${t.proposals} proposals`}
                    />
                    <span className="text-[10px] font-mono text-ink-muted">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[11px] font-mono text-ink-muted border-t border-border-subtle pt-2.5">
              Closed proposals across current rolling periods
            </p>
          </BentoCard>
        </div>

        {/* Detailed pipelines and risk lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BentoCard className="p-5" glowColor="78, 135, 112">
            <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
              <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Pipeline by Stage</h2>
              <span className="text-[11px] font-mono text-ink-muted">Stage Ledgers</span>
            </div>
            <div className="mt-3 space-y-1.5 divide-y divide-border-subtle">
              {data.commercialPerformance.pipelineByStage.map((s) => (
                <div key={s.stage} className="flex items-center justify-between pt-2.5 text-xs">
                  <span className="text-ink-secondary">{s.stage}</span>
                  <span className="font-mono text-ink-primary">
                    {s.count} deals · <strong className="text-accent-hover">{formatCurrency(s.value, data.currency)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard className="p-5" glowColor="78, 135, 112">
            <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
              <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Highest-Risk Ledgers</h2>
              <span className="text-[11px] font-mono text-ink-muted">Require Attention</span>
            </div>
            <div className="mt-3 divide-y divide-border-subtle">
              {data.topRisk.map((p) => (
                <Link
                  key={p.id}
                  href={`/proposals/${p.id}`}
                  className="flex items-center justify-between py-2 text-xs hover:bg-surface-3 px-2 rounded-[4px] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-ink-muted">analytics</span>
                    <span className="text-ink-primary font-medium">{p.client}</span>
                  </div>
                  <Badge tone={p.score >= 70 ? "danger" : p.score >= 40 ? "warning" : "success"}>
                    Risk {p.score}
                  </Badge>
                </Link>
              ))}
              {!data.topRisk.length && <p className="py-4 text-xs font-mono text-ink-muted">No high-risk opportunities recorded.</p>}
            </div>
          </BentoCard>
        </div>

        {/* Client Pipeline */}
        {clientStatuses.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            <BentoCard className="p-5" glowColor="78, 135, 112">
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Client Pipeline</h2>
                <span className="text-[11px] font-mono text-ink-muted">By lifecycle status</span>
              </div>
              <div className="mt-3 space-y-1.5 divide-y divide-border-subtle">
                {clientStatuses.map((s) => (
                  <div key={s.status} className="flex items-center justify-between pt-2.5 text-xs">
                    <span className="text-ink-secondary">{s.status}</span>
                    <span className="font-mono tabular-nums text-ink-primary">{s.count}</span>
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>
        )}

        {/* Pricing Brain */}
        {pricing && pricing.sampleSize > 0 && (
          <div className="grid grid-cols-1 gap-4">
            <BentoCard className="p-5" glowColor="78, 135, 112">
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Pricing Brain</h2>
                <span className="text-[11px] font-mono text-ink-muted">Estimate vs. Actual Calibration</span>
              </div>

              <dl className="mt-3.5 space-y-2.5 text-xs">
                <Row label="Avg. Hours Variance" value={pricing.averageHoursVariancePct !== null ? `${pricing.averageHoursVariancePct}%` : "—"} isMono />
                <Row label="Avg. Cost Variance" value={pricing.averageCostVariancePct !== null ? `${pricing.averageCostVariancePct}%` : "—"} isMono />
                <Row label="Avg. Actual Margin" value={pricing.averageActualMarginPct !== null ? `${pricing.averageActualMarginPct}%` : "—"} isMono />
              </dl>

              <p className="mt-4 text-[11px] font-mono text-ink-muted border-t border-border-subtle pt-2.5">
                {pricing.guidance}
              </p>

              <p className="mt-4 text-[11px] font-mono text-ink-muted">
                Based on {pricing.sampleSize} closed deal(s) with recorded actuals.
              </p>

              <div className={`mt-2 divide-y divide-border-subtle ${pricing.records.length > 8 ? "max-h-80 overflow-y-auto" : ""}`}>
                {pricing.records.map((r) => (
                  <Link
                    key={r.projectId}
                    href={`/proposals/${r.projectId}`}
                    className="flex items-center justify-between gap-3 py-2 text-xs hover:bg-surface-3 px-2 rounded-[4px] transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-ink-primary font-medium">{r.client}</span>
                      <span className="text-[11px] text-ink-muted">{r.stage}</span>
                    </div>
                    <span className="font-mono tabular-nums text-ink-secondary">
                      {r.estimatedHours} → {r.actualHours}h
                    </span>
                    <span className="font-mono tabular-nums text-ink-secondary">
                      {formatCurrency(r.estimatedCost, data.currency)} → {formatCurrency(r.actualCost, data.currency)}
                    </span>
                    {r.actualMarginPct !== null && (
                      <Badge tone={r.actualMarginPct >= 20 ? "success" : r.actualMarginPct >= 0 ? "warning" : "danger"}>
                        {r.actualMarginPct}%
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            </BentoCard>
          </div>
        )}

        {/* Activity */}
        {activity && activity.eventsTracked > 0 && (
          <div className="grid grid-cols-1 gap-4">
            <BentoCard className="p-5" glowColor="78, 135, 112">
              <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
                <h2 className="font-display text-lg font-medium text-ink-primary tracking-tight">Activity</h2>
                <span className="text-[11px] font-mono text-ink-muted">
                  {activity.eventsTracked} events tracked · last {new Date(activity.lastEventAt).toLocaleString()}
                </span>
              </div>
              <dl className="mt-3.5 space-y-2.5 text-xs">
                {Object.entries(activity.counts).map(([name, count]) => (
                  <Row key={name} label={name.replaceAll("_", " ")} value={String(count)} isMono />
                ))}
              </dl>
            </BentoCard>
          </div>
        )}
      </BentoCardGrid>
    </div>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: number | string; sub?: string; icon?: string }) {
  return (
    <BentoCard className="p-4 flex flex-col justify-between" glowColor="78, 135, 112">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">{label}</p>
        {icon && <span className="material-symbols-outlined text-ink-disabled text-[18px]">{icon}</span>}
      </div>
      <div className="mt-3">
        <p className="font-mono text-2xl font-semibold tracking-tight text-ink-primary">{value}</p>
        {sub && <p className="mt-1 text-[11px] font-mono text-ink-disabled">{sub}</p>}
      </div>
    </BentoCard>
  );
}

function Row({ label, value, isMono }: { label: string; value: string; isMono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border-subtle/50 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`text-ink-primary ${isMono ? "font-mono font-medium" : "font-body font-medium"}`}>{value}</dd>
    </div>
  );
}

function RiskBar({ label, value, tone }: { label: string; value: number; tone: "danger" | "warning" | "success" }) {
  const colors = { danger: "bg-danger", warning: "bg-warning", success: "bg-accent" };
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="w-16 text-ink-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-1">
        <div className={`h-full ${colors[tone]}`} style={{ width: `${Math.min(100, value * 10)}%` }} />
      </div>
      <span className="w-6 text-right text-ink-primary">{value}</span>
    </div>
  );
}
