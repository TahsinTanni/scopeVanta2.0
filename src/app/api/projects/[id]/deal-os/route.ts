import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, stripJsonFence } from "@/lib/ai";
import { projectData, formatConfirmedFacts } from "@/lib/project-data";

// POST /api/projects/:id/deal-os — legacy/backend/index.ts:3836-3941.
const ALLOWED_ACTIONS = new Set([
  "discovery", "compile", "margin", "choices", "negotiation", "change", "autopsy",
  "premortem", "redteam", "personalize", "meeting", "responsibilities", "handoff", "copilot",
]);

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const b = (await req.json().catch(() => ({}))) as { action?: string; input?: string; targetPrice?: number; targetMargin?: number };
  const action = String(b.action || "copilot").slice(0, 40);
  const input = String(b.input || "").slice(0, 16000);
  const targetPrice = Math.max(0, Number(b.targetPrice || 0));
  const targetMargin = Math.min(90, Math.max(0, Number(b.targetMargin ?? d.estimateSummary?.targetMargin ?? 35)));
  if (!ALLOWED_ACTIONS.has(action)) return error("Unknown Deal OS action.", 400);
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);

  const historyRows = await prisma.project.findMany({ where: { workspaceId: ctx.workspaceId, id: { not: id } }, take: 80 });
  const history = historyRows
    .map((v) => ({ v, d: projectData(v.data) }))
    .filter(({ d: vd }) => vd.actualHours || vd.actualCost || vd.outcomeLearning)
    .slice(0, 12)
    .map(({ v, d: vd }) => ({ stage: v.dealStage, value: v.dealValue, estimate: vd.estimateSummary, actualHours: vd.actualHours, actualCost: vd.actualCost, outcome: vd.outcomeLearning, scope: vd.estimateLines }));

  try {
    const r = await aiGenerate({
      system:
        "You are ScopeVanta Deal-to-Profit OS. Operate as a rigorous commercial architect for service businesses. Use supplied evidence only. Never invent buyer motives, urgency, ROI, competitors, delivery capacity, costs, historical results or contractual acceptance. Recommendations are not predictions. Missing facts must be To be confirmed. Protect scope and economics while helping the seller make the offer easier to understand and buy.",
      prompt: `ACTION: ${action}\nSELLER: ${profile.businessName}\nEXPERTISE: ${profile.expertise}\nCLIENT: ${p.clientLabel}\nBRIEF/DEAL INBOX: ${String(p.brief || "").slice(0, 18000)}\nPROPOSAL: ${String(p.proposal || "").slice(0, 24000)}\n${formatConfirmedFacts(p, d)}\nSCOPE GRAPH INPUT: ${JSON.stringify({ lines: d.estimateLines, scope: d.commercialLab?.scope, traceability: d.commercialLab?.traceability, baseline: d.scopeBaseline }).slice(0, 18000)}\nECONOMICS: ${JSON.stringify({ estimate: d.estimateSummary, scenarios: d.dealScenarios, actualRevenue: d.actualRevenue, actualHours: d.actualHours, actualCost: d.actualCost }).slice(0, 10000)}\nBUYER/DEAL: ${JSON.stringify({ stage: p.dealStage, win: d.winPlan, studio: d.proposalStudio, request: d.clientRequestInbox || d.lastChangeRequest }).slice(0, 14000)}\nRECORDED HISTORY: ${JSON.stringify(history).slice(0, 12000)}\nUSER INPUT: ${input || "Not provided"}\nTARGET PRICE: ${targetPrice || "Not provided"}\nTARGET MARGIN: ${targetMargin}%\nReturn ONLY JSON with these keys. Populate the requested action deeply and keep other keys concise/empty when not relevant: discovery {questions:Array<{question:string,why:string,answerType:string}>}; graph {nodes:Array<{id:string,type:string,label:string,parentId:string,hours:number,cost:number,price:number,acceptance:string,dependency:string}>}; compiler {targetPrice:number,targetMargin:number,changes:string[],removedOrDeferred:string[],warnings:string[]}; marginFirewall {status:'Safe'|'Review'|'Unsafe'|'Unknown',risks:Array<{issue:string,impact:string,fix:string}>,unpricedWork:string[],summary:string}; buyerChoices Array<{name:string,price:number,hours:number,marginPct:number,included:string[],excluded:string[],bestFor:string}>; negotiation {position:string,options:Array<{approach:string,price:number,scopeChange:string,marginImpact:string,response:string}>}; changeFirewall {classification:'Included'|'Ambiguous'|'Out of Scope'|'Not assessed',baselineEvidence:string,request:string,addedWork:string[],estimatedExtraHours:number,commercialImpact:string,recommendedAction:string}; autopsy {estimateVsActual:string[],varianceDrivers:string[],lessons:string[],pricingBrainUpdates:string[]}; premortem Array<{failureMode:string,evidence:string,prevention:string}>; redteam Array<{persona:string,challenge:string,fix:string}>; personalization {recommendedModules:string[],buyerSpecificEdits:string[],unsupportedClaimsToRemove:string[]}; meetingDelta {newRequirements:string[],changedRequirements:string[],removedRequirements:string[],objections:string[],promises:string[],stakeholdersMentioned:string[],deadlines:string[],approveBeforeApplying:string[]}; responsibilities Array<{owner:'Client'|'Seller'|'Shared'|'To be confirmed',item:string,due:string,dependency:string,delayImpact:string}>; handoff {finalScope:string[],milestones:string[],acceptance:string[],clientResponsibilities:string[],commercialTerms:string[],openItems:string[],changeControl:string}; copilot {answer:string,evidence:string[],recommendedActions:string[]}. For graph, preserve requirement→deliverable→task→economics→acceptance relationships where evidence permits. For buyerChoices and compiler never claim a target can be met if arithmetic or evidence does not support it.`,
      maxTokens: 7600,
      temperature: 0.12,
    });
    const intelligence = JSON.parse(stripJsonFence(r.text));

    await prisma.commercialAudit.create({
      data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: `deal_os_${action}`, payload: { detail: `Deal-to-Profit OS ${action} refreshed from current opportunity evidence.` } },
    });
    const priorDealOS = d.dealOS || {};
    const dealOS = { ...priorDealOS, [action]: intelligence, updatedAt: new Date().toISOString(), lastAction: action };
    const updated = await prisma.project.update({ where: { id }, data: { data: { ...d, dealOS } as object } });
    return json({ intelligence, project: updated });
  } catch (e) {
    console.error("Deal OS failed", e);
    return error("Deal OS intelligence is temporarily unavailable.", 502);
  }
});
