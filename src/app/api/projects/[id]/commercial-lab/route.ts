import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, parseModelJson } from "@/lib/ai";
import { projectData, formatConfirmedFacts } from "@/lib/project-data";

// POST /api/projects/:id/commercial-lab — legacy/backend/index.ts:3046-3234.
// Post-processing arithmetic (estimatedCost, minimumSafePrice, margins)
// preserved exactly.
type Body = {
  internalRate?: number; targetMargin?: number; teamCapacityHours?: number; actualHours?: number; actualCost?: number;
  changeRequest?: string; negotiationMessage?: string; scenarioPrice?: number; scenarioHours?: number;
};

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);

  const internalRate = Math.max(0, Number(b.internalRate || 0));
  const targetMargin = Math.min(90, Math.max(0, Number(b.targetMargin || 35)));
  const teamCapacityHours = Math.max(0, Number(b.teamCapacityHours || 0));

  const historyRows = await prisma.project.findMany({ where: { workspaceId: ctx.workspaceId, id: { not: id } }, take: 80 });
  const history = historyRows.slice(0, 40).map((v) => {
    const vd = projectData(v.data);
    return {
      stage: v.dealStage || "Draft",
      value: Number(v.dealValue || 0),
      reason: vd.outcomeReason || "",
      score: Number(v.riskScore || 0),
      actualHours: Number(vd.actualHours || 0),
      actualCost: Number(vd.actualCost || 0),
      estimatedHours: Number((vd.commercialLab?.pricing as Record<string, unknown> | undefined)?.estimatedHours || 0),
    };
  });

  try {
    const r = await aiGenerate({
      track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "commercial-lab" },
      system:
        "You are ScopeVanta Commercial Intelligence. Engineer profitable, winnable service scopes from supplied facts. Never invent client requirements, team capacity, historical performance, rates, ROI or acceptance. Mark missing facts To be confirmed. Historical patterns are descriptive hints only. Distinguish included, ambiguous and out-of-scope work. Negotiation advice must protect value and scope rather than defaulting to discounting.",
      prompt: `SELLER: ${profile.businessName}\nEXPERTISE: ${profile.expertise}\nCLIENT: ${p.clientLabel}\nBRIEF: ${p.brief}\nPROPOSAL: ${String(p.proposal || "").slice(0, 26000)}\n${formatConfirmedFacts(p, d)}\nRISKS: ${((p.risks as string[]) || []).join(" | ")}\nQUESTIONS: ${((p.clarificationQuestions as string[]) || []).join(" | ")}\nBUDGET: ${p.budget || "Not provided"}\nTIMELINE: ${p.timeline || "Not provided"}\nINTERNAL COST/RATE PER HOUR: ${internalRate || "Not provided"}\nTARGET GROSS MARGIN %: ${targetMargin}\nAVAILABLE DELIVERY HOURS: ${teamCapacityHours || "Not provided"}\nACTUAL HOURS IF COMPLETED: ${Number(b.actualHours || 0) || "Not provided"}\nACTUAL COST IF COMPLETED: ${Number(b.actualCost || 0) || "Not provided"}\nNEW CLIENT REQUEST TO CHECK: ${String(b.changeRequest || "Not provided").slice(0, 5000)}\nNEGOTIATION MESSAGE: ${String(b.negotiationMessage || "Not provided").slice(0, 5000)}\nSCENARIO PRICE: ${Number(b.scenarioPrice || 0) || "Not provided"}\nSCENARIO HOURS: ${Number(b.scenarioHours || 0) || "Not provided"}\nHISTORICAL OUTCOMES: ${JSON.stringify(history).slice(0, 12000)}\nReturn ONLY JSON with: pricing {estimatedHours:number,estimatedCost:number,recommendedPrice:number,minimumSafePrice:number,expectedMarginPct:number,contingencyPct:number,basis:string[]}; scope {phases:Array<{name:string,deliverables:string[],tasks:string[],acceptanceCriteria:string[]}>,assumptions:string[],dependencies:string[],clientResponsibilities:string[],exclusions:string[]}; changeDetection {classification:'Included'|'Ambiguous'|'Out of Scope'|'Not assessed',reason:string,estimatedExtraHours:number,changeOrderRecommendation:string}; simulator {scenarioPrice:number,scenarioHours:number,marginPct:number,riskImpact:string,tradeoffs:string[]}; historical {signals:string[],sampleSize:number}; intake {requirements:string[],contradictions:string[],deadlines:string[],openQuestions:string[]}; traceability Array<{requirement:string,coverage:'Covered'|'Ambiguous'|'Unanswered',proposalSection:string,evidence:string,acceptanceCriterion:string}>; feasibility {status:'Feasible'|'At Risk'|'Unknown',estimatedHours:number,capacityHours:number,bottlenecks:string[]}; negotiation {recommendedApproach:string,protect:string[],giveGetTrades:string[],responseDraft:string}; memory {estimatedVsActual:string,lessons:string[],futurePricingAdjustment:string}. Calculations must be internally consistent. If internal rate is absent, do not invent cost or safe price: use 0 and explain the missing basis. If actuals are absent, say no completed-project learning yet. If no new request or negotiation message is supplied, return Not assessed/empty guidance rather than inventing one. Trace every material stated client requirement, capped at 25.`,
      maxTokens: 7600,
      temperature: 0.15,
    });
    const lab = parseModelJson(r.text);
    if (!lab.scope || !lab.pricing || !Array.isArray(lab.traceability)) return error("Commercial intelligence was incomplete. Please retry.", 502);

    const estimatedHours = Math.max(0, Number(lab.pricing?.estimatedHours || lab.feasibility?.estimatedHours || 0));
    const estimatedCost = internalRate && estimatedHours ? Math.round(internalRate * estimatedHours * 100) / 100 : 0;
    const minimumSafePrice = estimatedCost && targetMargin < 100 ? Math.round((estimatedCost / (1 - targetMargin / 100)) * 100) / 100 : 0;
    const recommendedPrice = Math.max(minimumSafePrice, Number(lab.pricing?.recommendedPrice || 0));
    const expectedMarginPct = recommendedPrice && estimatedCost ? Math.round(((recommendedPrice - estimatedCost) / recommendedPrice) * 1000) / 10 : 0;
    const scenarioPrice = Math.max(0, Number(b.scenarioPrice || 0));
    const scenarioHours = Math.max(0, Number(b.scenarioHours || estimatedHours));
    const scenarioCost = internalRate && scenarioHours ? Math.round(internalRate * scenarioHours * 100) / 100 : 0;
    const scenarioMarginPct = scenarioPrice && scenarioCost ? Math.round(((scenarioPrice - scenarioCost) / scenarioPrice) * 1000) / 10 : 0;

    lab.pricing = { ...lab.pricing, estimatedHours, estimatedCost, recommendedPrice, minimumSafePrice, expectedMarginPct };
    lab.simulator = { ...lab.simulator, scenarioPrice, scenarioHours, marginPct: scenarioMarginPct };
    lab.feasibility = { ...lab.feasibility, estimatedHours, capacityHours: teamCapacityHours };

    const traceability = lab.traceability as Array<{ coverage: string }>;
    const coverage = {
      covered: traceability.filter((v) => v.coverage === "Covered").length,
      ambiguous: traceability.filter((v) => v.coverage === "Ambiguous").length,
      unanswered: traceability.filter((v) => v.coverage === "Unanswered").length,
    };

    const changeOrderDraft =
      String(b.changeRequest || "").trim() && lab.changeDetection?.classification === "Out of Scope"
        ? `CHANGE ORDER — ${String(p.clientLabel || "Client")}\n\nRequested change\n${String(b.changeRequest).trim()}\n\nScope assessment\n${String(lab.changeDetection.reason || "")}\n\nEstimated additional effort\n${Number(lab.changeDetection.estimatedExtraHours || 0) || "To be confirmed"} hours\n\nCommercial recommendation\n${String(lab.changeDetection.changeOrderRecommendation || "Price and approval to be confirmed before work begins.")}\n\nApproval\nThis change is not added to the delivery baseline until scope, price and timeline impact are approved.`
        : "";

    await prisma.commercialAudit.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: id,
        performedByUserId: ctx.userId,
        action: "commercial_recalculation",
        payload: { detail: `Pricing/scope recalculated${String(b.changeRequest || "").trim() ? ` · change classified ${String(lab.changeDetection?.classification || "Not assessed")}` : ""}${String(b.negotiationMessage || "").trim() ? " · negotiation assessed" : ""}.` },
      },
    });

    const baselineExists = Boolean(d.scopeBaseline);
    const updated = await prisma.project.update({
      where: { id },
      data: {
        commercialStale: false,
        data: {
          ...d,
          commercialLab: { ...lab, coverage },
          commercialInputs: { internalRate, targetMargin, teamCapacityHours, scenarioPrice, scenarioHours },
          actualHours: Number(b.actualHours || d.actualHours || 0),
          actualCost: Number(b.actualCost || d.actualCost || 0),
          lastChangeRequest: String(b.changeRequest || ""),
          lastNegotiationMessage: String(b.negotiationMessage || ""),
          changeOrderDraft,
          changeOrderStatus: changeOrderDraft ? "draft" : d.changeOrderStatus || "",
          winPlan: undefined,
          winPlanUpdatedAt: "",
          closeCoach: undefined,
          nextBestAction:
            baselineExists && String(b.changeRequest || "").trim()
              ? "Review the scope-change assessment and commercial impact before responding to the client."
              : "Review the recalculated scope, price and delivery feasibility before advancing the deal.",
        } as object,
      },
    });
    return json({ commercialLab: lab, project: updated });
  } catch (e) {
    console.error("Commercial lab failed", e);
    return error("Commercial intelligence is temporarily unavailable.", 502);
  }
});
