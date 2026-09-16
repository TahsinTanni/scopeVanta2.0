import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, stripJsonFence } from "@/lib/ai";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/commercial-autopilot — legacy/backend/index.ts:2970-3045.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);

  const historyRows = await prisma.project.findMany({ where: { workspaceId: ctx.workspaceId, id: { not: id } }, take: 80 });
  const comparable = historyRows
    .map((v) => {
      const vd = projectData(v.data);
      return {
        id: v.id,
        client: v.clientLabel,
        stage: v.dealStage || "Draft",
        score: Number(v.riskScore || 0),
        estimatedHours: Number(vd.estimateSummary?.estimatedHours || (vd.commercialLab?.pricing as Record<string, unknown> | undefined)?.estimatedHours || 0),
        actualHours: Number(vd.actualHours || 0),
        estimatedCost: Number(vd.estimateSummary?.estimatedCost || 0),
        actualCost: Number(vd.actualCost || 0),
        value: Number(v.dealValue || 0),
      };
    })
    .filter((v) => v.actualHours || v.actualCost)
    .slice(0, 8);

  try {
    const r = await aiGenerate({
      system:
        "You are ScopeVanta Commercial Autopilot. Recommend actions from supplied evidence only. Never invent client intent, capacity, costs, results or contractual status. Similar projects are descriptive references, not predictions.",
      prompt: `CURRENT OPPORTUNITY: ${JSON.stringify({ client: p.clientLabel, brief: p.brief, score: p.riskScore, risks: p.risks, questions: p.clarificationQuestions, dealStage: p.dealStage, dealValue: p.dealValue, commercialLab: d.commercialLab, estimateSummary: d.estimateSummary, actualHours: d.actualHours, actualCost: d.actualCost, scopeBaseline: d.scopeBaseline, lastClientRequest: d.clientRequestInbox || d.lastChangeRequest, proposalVersion: p.currentVersion, shareStatus: d.shareStatus }).slice(0, 30000)}\nCOMPARABLE COMPLETED RECORDS: ${JSON.stringify(comparable).slice(0, 10000)}\nReturn ONLY JSON: autopilot {actions:Array<{priority:number,action:string,why:string,evidence:string,module:string}>,blockers:string[]}; calibration {estimatedVsActualSignals:string[],suggestedAdjustment:string}; redline {baseline:string[],requested:string[],commercialImpact:string[]}; negotiationScenarios:Array<{name:string,price:number,scopeTrade:string,marginImpact:string}>; handoff {status:string,agreedScope:string[],commercialTerms:string[],openItems:string[]}; similarity Array<{label:string,reason:string,estimatedVsActual:string}>; profitability {quotedValue:number,estimatedCost:number,actualCost:number,forecastCost:number,estimatedMarginPct:number,actualMarginPct:number,scopeAdded:string[],changeOrders:string[]}. Cap actions 6, similarities 5, negotiation scenarios 4. If data is absent say To be confirmed or return empty arrays.`,
      maxTokens: 5200,
      temperature: 0.15,
    });
    const intelligence = JSON.parse(stripJsonFence(r.text));

    await prisma.commercialAudit.create({
      data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "commercial_autopilot", payload: { detail: "Autopilot, calibration, redline, similarity and profitability intelligence refreshed." } },
    });

    const updated = await prisma.project.update({
      where: { id },
      data: { data: { ...d, commercialAutopilot: intelligence, commercialAutopilotAt: new Date().toISOString() } as object },
    });
    return json({ project: updated, intelligence });
  } catch (e) {
    console.error("Commercial Autopilot failed", e);
    return error("Commercial Autopilot is temporarily unavailable.", 502);
  }
});
