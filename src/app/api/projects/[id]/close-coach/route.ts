import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { requireEntitlement } from "@/lib/billing";
import { aiGenerate, parseModelJson } from "@/lib/ai";
import { projectData, formatConfirmedFacts } from "@/lib/project-data";

// POST /api/projects/:id/close-coach — legacy/backend/index.ts:4425-4493.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);
  await requireEntitlement(ctx.workspaceId, "using Close Coach");

  const items = await prisma.project.findMany({ where: { workspaceId: ctx.workspaceId }, take: 80 });
  const outcomes = items
    .filter((v) => v.id !== id && (v.dealStage === "Won" || v.dealStage === "Lost") && projectData(v.data).outcomeReason)
    .slice(0, 12);
  const history = outcomes.map((v) => `${v.dealStage}: ${String(projectData(v.data).outcomeReason).slice(0, 500)}`).join("\n");

  try {
    const r = await aiGenerate({
      track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "close-coach" },
      system:
        "You are a B2B deal-closing coach. Help a service seller move a real opportunity forward without inventing buyer intent, urgency, proof, ROI, competitors or decision makers. Never recommend blind discounting. Missing facts become discovery questions. Historical win/loss patterns are hints, not guarantees.",
      prompt: `SELLER: ${profile.businessName}\nCLIENT: ${String(p.clientLabel || "")}\nDEAL STAGE: ${String(p.dealStage || "Draft")}\nDEAL VALUE: ${Number(p.dealValue || 0) || "Not recorded"}\nBRIEF: ${String(p.brief || "")}\nRISKS: ${((p.risks as string[]) || []).join(" | ")}\nWIN PLAN: ${JSON.stringify(d.winPlan || {})}\nPROPOSAL: ${String(p.proposal || "").slice(0, 22000)}\n${formatConfirmedFacts(p, d)}\nPAST OUTCOMES:\n${history || "No recorded win/loss learning yet."}\nReturn ONLY JSON: {nextBestAction:string,why:string,followUp:string,discoveryQuestions:string[],risk:string}. Give one concrete highest-leverage next action for the current stage. Follow-up must be client-ready and under 170 words. Sign the follow-up using exactly this name: ${profile.businessName} — never invent, guess, or substitute a different name or persona. For Draft or Proposal Ready, recommend discovery when needed rather than pretending the proposal was sent. In Negotiation, address known friction without automatic concessions.`,
      maxTokens: 1800,
      temperature: 0.2,
    });
    const out = parseModelJson(r.text);
    if (!out.nextBestAction || !out.followUp) return error("Closing guidance was incomplete. Please retry.", 502);

    const closeCoach = {
      nextBestAction: String(out.nextBestAction).slice(0, 1200),
      why: String(out.why || "").slice(0, 1800),
      followUp: String(out.followUp).slice(0, 5000),
      discoveryQuestions: Array.isArray(out.discoveryQuestions) ? out.discoveryQuestions.map(String).slice(0, 4) : [],
      risk: String(out.risk || "").slice(0, 1800),
      generatedAt: new Date().toISOString(),
    };
    await prisma.project.update({ where: { id }, data: { data: { ...d, closeCoach, nextBestAction: closeCoach.nextBestAction } as object } });
    return json({ closeCoach });
  } catch (e) {
    console.error("ScopeVanta close coach failed", e);
    return error("Closing guidance is temporarily unavailable.", 502);
  }
});
