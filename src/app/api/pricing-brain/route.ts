import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// GET /api/pricing-brain — legacy/backend/index.ts:3620-3690.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const projects = await prisma.project.findMany({ where: { workspaceId: ctx.workspaceId }, take: 160 });
  const completed = projects.filter((v) => {
    const d = projectData(v.data);
    return (v.dealStage === "Won" || v.dealStage === "Lost") && (Number(d.actualHours || 0) > 0 || Number(d.actualCost || 0) > 0);
  });
  const rows = completed.map((v) => {
    const d = projectData(v.data);
    const eh = Number(d.estimateSummary?.estimatedHours || 0);
    const ec = Number(d.estimateSummary?.estimatedCost || 0);
    const ep = Number(d.estimateSummary?.estimatedPrice || v.dealValue || 0);
    const ah = Number(d.actualHours || 0);
    const ac = Number(d.actualCost || 0);
    const ar = Number(d.actualRevenue || v.dealValue || 0);
    return {
      projectId: v.id,
      client: v.clientLabel || "Opportunity",
      stage: v.dealStage,
      estimatedHours: eh,
      actualHours: ah,
      hoursVariance: eh && ah ? Math.round((ah - eh) * 100) / 100 : null,
      estimatedCost: ec,
      actualCost: ac,
      costVariance: ec && ac ? Math.round((ac - ec) * 100) / 100 : null,
      quotedPrice: ep,
      actualRevenue: ar,
      actualMarginPct: ar && ac ? Math.round(((ar - ac) / ar) * 1000) / 10 : null,
    };
  });
  const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null);
  const hv = rows.map((v) => (v.estimatedHours && v.actualHours ? ((v.actualHours - v.estimatedHours) / v.estimatedHours) * 100 : null)).filter((v): v is number => v !== null);
  const cv = rows.map((v) => (v.estimatedCost && v.actualCost ? ((v.actualCost - v.estimatedCost) / v.estimatedCost) * 100 : null)).filter((v): v is number => v !== null);
  const margins = rows.map((v) => v.actualMarginPct).filter((v): v is number => v !== null);
  return json({
    sampleSize: rows.length,
    averageHoursVariancePct: avg(hv),
    averageCostVariancePct: avg(cv),
    averageActualMarginPct: avg(margins),
    records: rows.slice(0, 40),
    guidance: rows.length < 3 ? "More completed records are needed before treating patterns as reusable pricing guidance." : "Use these descriptive actual-vs-estimate patterns as calibration evidence, not as a prediction for a new deal.",
  });
});
