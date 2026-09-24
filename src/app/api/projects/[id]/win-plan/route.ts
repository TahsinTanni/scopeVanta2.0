import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, parseModelJson } from "@/lib/ai";
import { projectData, formatConfirmedFacts } from "@/lib/project-data";

// POST /api/projects/:id/win-plan — legacy/backend/index.ts:3415-3500.
type WinPlan = {
  buyerPriorities: string[]; decisionFriction: string[]; decisionMakers: string[]; dealSignals: string[];
  objections: Array<{ objection: string; response: string }>; differentiators: string[]; nextActions: string[]; followUp: string;
};

export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id: projectId } = await params;
  if (!projectId) return error("Project is required.", 400);
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId } });
  if (!project) return error("Proposal not found.", 404);
  const d = projectData(project.data);
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);

  let clientContext = "";
  if (project.clientId) {
    const c = await prisma.client.findFirst({ where: { id: project.clientId, workspaceId: ctx.workspaceId } });
    if (c) {
      clientContext = [
        `Goals: ${c.goals || ""}`,
        `Preferences: ${c.preferences || ""}`,
        `Decision makers: ${c.decisionMakers || ""}`,
        `Pain points: ${c.painPoints || ""}`,
        `Buying criteria: ${c.buyingCriteria || ""}`,
        `Known objections: ${c.knownObjections || ""}`,
        `Notes: ${c.notes || ""}`,
        `Next step: ${c.nextStep || ""}`,
      ]
        .filter((v) => !v.endsWith(": "))
        .join("\n");
    }
  }

  try {
    const r = await aiGenerate({
      track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "win-plan" },
      system:
        "You are a B2B deal coach helping a service business improve its chance of winning a specific opportunity without discounting blindly, fabricating evidence or accepting dangerous scope. Use only supplied facts. Separate observed buyer signals from recommended sales strategy. Do not claim to know buyer motives. Objection responses must be credible, concise and grounded in the proposal or seller context.",
      prompt: `SELLER: ${profile.businessName}\nSELLER EXPERTISE: ${profile.expertise}\nCLIENT: ${String(project.clientLabel || "")}\nCLIENT CONTEXT: ${clientContext || "No saved buyer context"}\nBRIEF: ${String(project.brief || "")}\nBUDGET: ${String(project.budget || "Not provided")}\nTIMELINE: ${String(project.timeline || "Not provided")}\nSCOPE RISKS: ${((project.risks as string[]) || []).join(" | ")}\nPROPOSAL:\n${String(project.proposal || "").slice(0, 30000)}\n${formatConfirmedFacts(project, d)}\n\nCreate a practical win plan for the seller. Return ONLY JSON with buyerPriorities (3-5 priorities supported by the supplied material), decisionFriction (2-5 unresolved issues that could delay or weaken a decision), decisionMakers (1-5 known decision participants or 'To be confirmed' discovery items; never invent names or roles), dealSignals (2-5 observed positive/negative/unknown signals grounded in supplied material), objections (2-5 objects with objection and response; response must not invent proof or promise discounts), differentiators (2-5 seller/proposal strengths actually supported by supplied material), nextActions (3-5 concrete seller actions ordered from highest leverage to lowest), followUp (a concise client follow-up email, maximum 180 words, focused on buyer outcomes, resolved concerns and one clear next step). Sign the follow-up using exactly this name: ${profile.businessName} — never invent, guess, or substitute a different name or persona. Use saved pain points, buying criteria and known objections when present. Do not fabricate decision makers, competitors, ROI, urgency, testimonials, results or buyer intent. When information is missing, frame it as a question or recommended discovery action rather than a fact.`,
      maxTokens: 2600,
      temperature: 0.2,
    });
    const out = parseModelJson(r.text) as WinPlan;
    if (
      !Array.isArray(out.buyerPriorities) || !Array.isArray(out.decisionFriction) || !Array.isArray(out.decisionMakers) ||
      !Array.isArray(out.dealSignals) || !Array.isArray(out.objections) || !Array.isArray(out.nextActions) || !out.followUp
    ) {
      return error("Incomplete win plan. Please retry.", 502);
    }
    const winPlan: WinPlan = {
      buyerPriorities: out.buyerPriorities.map(String).slice(0, 5),
      decisionFriction: out.decisionFriction.map(String).slice(0, 5),
      decisionMakers: out.decisionMakers.map(String).slice(0, 5),
      dealSignals: out.dealSignals.map(String).slice(0, 5),
      objections: out.objections.slice(0, 5).map((v) => ({ objection: String(v.objection || ""), response: String(v.response || "") })).filter((v) => v.objection && v.response),
      differentiators: (out.differentiators || []).map(String).slice(0, 5),
      nextActions: out.nextActions.map(String).slice(0, 5),
      followUp: String(out.followUp).slice(0, 5000),
    };
    await prisma.project.update({ where: { id: projectId }, data: { data: { ...d, winPlan, winPlanUpdatedAt: new Date().toISOString() } as object } });
    return json({ winPlan });
  } catch (e) {
    console.error("ScopeVanta win plan failed", e);
    return error("Win strategy is temporarily unavailable.", 502);
  }
});
