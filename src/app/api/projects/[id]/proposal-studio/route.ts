import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, stripJsonFence } from "@/lib/ai";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/proposal-studio — legacy/backend/index.ts:3359-3414.
export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const b = (await req.json().catch(() => ({}))) as { action?: string; input?: string };
  const action = String(b.action || "audit").slice(0, 40);
  const input = String(b.input || "").slice(0, 12000);
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);

  try {
    const r = await aiGenerate({
      system:
        "You are ScopeVanta Proposal Studio. Help a service seller create a clear, persuasive, commercially safe proposal and move the deal forward. Use supplied evidence only. Never invent requirements, buyer intent, ROI, proof, urgency, competitors, pricing or acceptance. Missing information must be To be confirmed. Distinguish observed facts from recommendations.",
      prompt: `ACTION: ${action}\nSELLER: ${profile.businessName}\nEXPERTISE: ${profile.expertise}\nCLIENT: ${p.clientLabel}\nBRIEF: ${String(p.brief || "").slice(0, 16000)}\nPROPOSAL: ${String(p.proposal || "").slice(0, 30000)}\nCOMMERCIAL MODEL: ${JSON.stringify({ estimate: d.estimateSummary, scenarios: d.dealScenarios, baseline: d.scopeBaseline, traceability: d.commercialLab?.traceability, scope: d.commercialLab?.scope }).slice(0, 18000)}\nBUYER INTELLIGENCE: ${JSON.stringify(d.winPlan || {}).slice(0, 10000)}\nUSER INPUT / MEETING / OBJECTION: ${input || "Not provided"}\nReturn ONLY JSON: audit {score:number,ready:boolean,issues:Array<{severity:'High'|'Medium'|'Low',type:string,issue:string,fix:string}>,strengths:string[]}; coverage {covered:number,ambiguous:number,unanswered:number,items:Array<{requirement:string,status:'Covered'|'Ambiguous'|'Unanswered',section:string,gap:string}>}; sections Array<{title:string,purpose:string,content:string}>; approaches Array<{name:string,positioning:string,bestWhen:string}>; meeting {newRequirements:string[],changedRequirements:string[],buyerSignals:string[],objections:string[],openQuestions:string[],recommendedUpdates:string[]}; objection {objection:string,diagnosis:string,protect:string[],options:Array<{approach:string,commercialTradeoff:string,response:string}>}; followUp {stage:string,subject:string,body:string,nextStep:string}. Keep sections modular and grounded. Audit must check unanswered requirements, vague deliverables, acceptance criteria, unsupported claims, exclusions, commercial inconsistencies, jargon and buyer-priority coverage. If input is absent, meeting/objection arrays can be empty.`,
      maxTokens: 7200,
      temperature: 0.15,
    });
    const studio = JSON.parse(stripJsonFence(r.text));

    await prisma.commercialAudit.create({
      data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: `proposal_studio_${action}`, payload: { detail: `Proposal Studio ${action} refreshed for proposal version ${p.currentVersion}.` } },
    });
    const updated = await prisma.project.update({ where: { id }, data: { data: { ...d, proposalStudio: studio, proposalStudioAt: new Date().toISOString() } as object } });
    return json({ studio, project: updated });
  } catch (e) {
    console.error("Proposal Studio failed", e);
    return error("Proposal Studio is temporarily unavailable.", 502);
  }
});
