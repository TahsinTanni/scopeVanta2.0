import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// GET /api/dashboard/intelligence — legacy/backend/index.ts:1914-2128.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({ where: { workspaceId: ctx.workspaceId }, take: 160 }),
    prisma.client.findMany({ where: { workspaceId: ctx.workspaceId }, take: 100 }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const current = projects.filter((p) => p.createdAt.getTime() >= monthStart);
  const previous = projects.filter((p) => p.createdAt.getTime() >= previousStart && p.createdAt.getTime() < monthStart);

  const avg = (rows: typeof projects) =>
    rows.length ? Math.round(rows.reduce((sum, p) => sum + Number(p.riskScore || 0), 0) / rows.length) : null;

  const highRisk = projects.filter((p) => Number(p.riskScore || 0) >= 70);
  const controlled = projects.filter((p) => Number(p.riskScore || 0) < 40);
  const statusCounts: Record<string, number> = {};
  for (const c of clients) {
    const key = c.lifecycleStatus || "Prospect";
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  const linkedClients = new Set(projects.map((p) => p.clientId).filter(Boolean));
  const todayStr = now.toISOString().slice(0, 10);
  const dueFollowUps = clients.filter(
    (c) => c.followUpDate && c.followUpDate.toISOString().slice(0, 10) <= todayStr && !["Won", "Lost"].includes(c.lifecycleStatus || ""),
  ).length;

  const groundedClaims = projects.reduce((sum, p) => sum + Number((p.groundingSummary as Record<string, unknown> | null)?.grounded || 0), 0);
  const assumptions = projects.reduce((sum, p) => sum + Number((p.groundingSummary as Record<string, unknown> | null)?.assumptions || 0), 0);

  const trend = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const rows = projects.filter((p) => p.createdAt.getTime() >= start.getTime() && p.createdAt.getTime() < end.getTime());
    return { label: start.toLocaleString("en-US", { month: "short" }), proposals: rows.length, averageRisk: avg(rows) };
  });

  const riskDistribution = {
    high: highRisk.length,
    medium: projects.filter((p) => Number(p.riskScore || 0) >= 40 && Number(p.riskScore || 0) < 70).length,
    low: controlled.length,
  };

  const topRisk = [...projects]
    .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      client: p.clientLabel || "Untitled opportunity",
      score: Number(p.riskScore || 0),
      summary: typeof p.summary === "string" ? p.summary : "",
      createdAt: p.createdAt.toISOString(),
    }));

  const won = projects.filter((p) => p.dealStage === "Won");
  const lost = projects.filter((p) => p.dealStage === "Lost");
  const closed = [...won, ...lost];
  const openStages = ["Draft", "Proposal Ready", "Sent", "Follow-up", "Negotiation"];
  const pipelineByStage = openStages.map((stage) => {
    const rows = projects.filter((p) => (p.dealStage || "Draft") === stage);
    return { stage, count: rows.length, value: Math.round(rows.reduce((sum, p) => sum + Math.max(0, Number(p.dealValue || 0)), 0) * 100) / 100 };
  });
  const wonValue = Math.round(won.reduce((sum, p) => sum + Math.max(0, Number(p.dealValue || 0)), 0) * 100) / 100;
  const lostValue = Math.round(lost.reduce((sum, p) => sum + Math.max(0, Number(p.dealValue || 0)), 0) * 100) / 100;
  const openPipelineValue = Math.round(pipelineByStage.reduce((sum, row) => sum + row.value, 0) * 100) / 100;

  const withData = projects.map((p) => ({ p, d: projectData(p.data) }));
  const accepted = withData.filter(({ d }) => d.shareStatus === "accepted");
  const changesRequested = withData.filter(({ d }) => d.shareStatus === "changes_requested");
  const shared = withData.filter(({ p, d }) => Boolean(d.shareCreatedAt || p.shareToken));
  const decisionHours = withData
    .map(({ d }) => {
      const start = d.shareCreatedAt ? new Date(d.shareCreatedAt).getTime() : NaN;
      const end = d.clientDecisionAt ? new Date(d.clientDecisionAt).getTime() : NaN;
      return start > 0 && end >= start ? (end - start) / 3_600_000 : null;
    })
    .filter((v): v is number => v !== null);

  const commercialPerformance = {
    closedDeals: closed.length,
    wonDeals: won.length,
    lostDeals: lost.length,
    winRate: closed.length ? Math.round((won.length / closed.length) * 1000) / 10 : null,
    wonValue,
    lostValue,
    averageWonDealSize: won.length ? Math.round((wonValue / won.length) * 100) / 100 : null,
    openPipelineValue,
    pipelineByStage,
    proposalDecisions: {
      shared: shared.length,
      accepted: accepted.length,
      changesRequested: changesRequested.length,
      acceptanceRate: shared.length ? Math.round((accepted.length / shared.length) * 1000) / 10 : null,
      averageDecisionHours: decisionHours.length ? Math.round((decisionHours.reduce((a, b) => a + b, 0) / decisionHours.length) * 10) / 10 : null,
    },
  };

  return json({
    generatedAt: now.toISOString(),
    totals: {
      proposals: projects.length,
      clients: clients.length,
      linkedClients: linkedClients.size,
      averageRisk: avg(projects),
      highRisk: highRisk.length,
      controlled: controlled.length,
      dueFollowUps,
      groundedClaims,
      assumptions,
    },
    month: { proposals: current.length, previousProposals: previous.length, averageRisk: avg(current), previousAverageRisk: avg(previous) },
    riskDistribution,
    statusCounts,
    trend,
    topRisk,
    commercialPerformance,
  });
});
