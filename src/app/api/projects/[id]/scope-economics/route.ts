import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/scope-economics — legacy/backend/index.ts:2727-2878.
// Pricing formula copied exactly: hours = sum(qty × hours); baseCost =
// sum(qty × hours × costRate); riskAdjustedCost = baseCost × (1 +
// contingencyPct/100); floorPrice = riskAdjustedCost / (1 - floorMargin/100);
// recommendedPrice = riskAdjustedCost / (1 - targetMargin/100); price =
// max(recommendedPrice, modeledSellPrice); Premium = price × 1.2 at
// hours × 1.1.
type Line = { name?: string; role?: string; qty?: number; hours?: number; costRate?: number; sellRate?: number; acceptance?: string };
type Body = { lines?: Line[]; targetMargin?: number; floorMargin?: number; contingencyPct?: number; syncProposal?: boolean };

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);

  const b = (await req.json().catch(() => ({}))) as Body;
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 120).map((v) => ({
    name: String(v.name || "Untitled deliverable").slice(0, 180),
    role: String(v.role || "").slice(0, 120),
    qty: Math.max(0, Number(v.qty || 1)),
    hours: Math.max(0, Number(v.hours || 0)),
    costRate: Math.max(0, Number(v.costRate || 0)),
    sellRate: Math.max(0, Number(v.sellRate || 0)),
    acceptance: String(v.acceptance || "").slice(0, 500),
  }));
  if (!lines.length) return error("Add at least one scope line.", 400);

  const targetMargin = Math.min(90, Math.max(0, Number(b.targetMargin ?? d.estimateSummary?.targetMargin ?? 35)));
  const floorMargin = Math.min(targetMargin, Math.max(0, Number(b.floorMargin ?? 20)));
  const contingencyPct = Math.min(100, Math.max(0, Number(b.contingencyPct ?? 10)));

  const hours = Math.round(lines.reduce((s, v) => s + v.qty * v.hours, 0) * 100) / 100;
  const baseCost = Math.round(lines.reduce((s, v) => s + v.qty * v.hours * v.costRate, 0) * 100) / 100;
  const riskAdjustedCost = Math.round(baseCost * (1 + contingencyPct / 100) * 100) / 100;
  const floorPrice = riskAdjustedCost && floorMargin < 100 ? Math.round((riskAdjustedCost / (1 - floorMargin / 100)) * 100) / 100 : 0;
  const recommendedPrice = riskAdjustedCost && targetMargin < 100 ? Math.round((riskAdjustedCost / (1 - targetMargin / 100)) * 100) / 100 : 0;
  const modeledSell = Math.round(lines.reduce((s, v) => s + v.qty * v.hours * v.sellRate, 0) * 100) / 100;
  const price = Math.max(recommendedPrice, modeledSell);
  const marginPct = price ? Math.round(((price - riskAdjustedCost) / price) * 1000) / 10 : 0;

  const scenarios = [
    {
      name: "Lean",
      price: floorPrice,
      hours,
      marginPct: floorPrice ? Math.round(((floorPrice - riskAdjustedCost) / floorPrice) * 1000) / 10 : 0,
      tradeoff: "Protect the floor margin; remove or defer scope rather than discount below this economics.",
    },
    { name: "Recommended", price, hours, marginPct, tradeoff: "Current engineered scope at target economics." },
    {
      name: "Premium",
      price: Math.round(price * 1.2 * 100) / 100,
      hours: Math.round(hours * 1.1 * 100) / 100,
      marginPct: Math.round(((price * 1.2 - riskAdjustedCost * 1.1) / (price * 1.2)) * 1000) / 10,
      tradeoff: "Use added value, service depth or speed only when explicitly included in scope.",
    },
  ];

  const commercialSummary = `\n\nCOMMERCIAL SCOPE SUMMARY\n${lines.map((v) => `- ${v.name}: ${v.qty} × ${v.hours}h${v.acceptance ? ` · Acceptance: ${v.acceptance}` : ""}`).join("\n")}\nEstimated effort: ${hours} hours\nRisk-adjusted delivery cost: ${riskAdjustedCost.toFixed(2)}\nRecommended investment: ${price.toFixed(2)}\nTarget gross margin: ${targetMargin}%\nContingency: ${contingencyPct}%`;
  const currentProposal = typeof p.proposal === "string" ? p.proposal : "";
  const proposal = b.syncProposal ? currentProposal.replace(/\n\nCOMMERCIAL SCOPE SUMMARY[\s\S]*$/, "") + commercialSummary : currentProposal;

  await prisma.commercialAudit.create({
    data: {
      workspaceId: ctx.workspaceId,
      projectId: p.id,
      performedByUserId: ctx.userId,
      action: "scope_economics",
      payload: { detail: `Editable scope saved · ${lines.length} lines · ${hours}h · ${price.toFixed(0)} recommended · ${marginPct}% modeled margin.` },
    },
  });

  const updated = await prisma.project.update({
    where: { id: p.id },
    data: {
      proposal,
      commercialStale: true,
      data: {
        ...d,
        estimateLines: lines,
        estimateSummary: { estimatedHours: hours, estimatedCost: riskAdjustedCost, estimatedPrice: price, estimatedMarginPct: marginPct, baseCost, floorPrice, targetMargin, floorMargin, contingencyPct },
        dealScenarios: scenarios,
        nextBestAction: "Review the three commercial scenarios, then sync/recalculate downstream intelligence before sharing.",
      } as object,
    },
  });

  return json({ project: updated, scenarios });
});
