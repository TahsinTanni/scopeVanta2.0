import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, parseModelJson } from "@/lib/ai";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/refine — legacy/backend/index.ts:2494-2683.
type ProposalOptions = { mode?: string; sections?: string[]; includeSellerLogo?: boolean; includeClientLogo?: boolean; includeVisuals?: boolean };
type Body = { answers?: string[]; proposalOptions?: ProposalOptions };
type GroundingItem = { claim: string; kind: string; sourceRecordIds: string[]; sourceFiles: string[]; confidence: string };

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id: projectId } = await params;
  if (!projectId) return error("Project is required.", 400);
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId } });
  if (!project) return error("Proposal not found.", 404);
  const d = projectData(project.data);

  const b = (await req.json().catch(() => ({}))) as Body;
  const questions = Array.isArray(project.clarificationQuestions) ? (project.clarificationQuestions as string[]).map(String).slice(0, 8) : [];
  const answers = (b.answers || []).map((v) => String(v || "").trim().slice(0, 2500));
  if (!questions.length) return error("This proposal has no clarification questions to resolve.", 400);
  if (!answers.some(Boolean)) return error("Answer at least one clarification question before refining.", 400);

  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);
  const requested = b.proposalOptions || (project.proposalOptions as ProposalOptions) || {};
  const resolved = questions.map((q, i) => `${i + 1}. ${q}\nAnswer: ${answers[i] || "Not answered — keep To be confirmed"}`).join("\n\n");

  try {
    const r = await aiGenerate({
      track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "refine" },
      system:
        "You are ScopeVanta, an elite B2B proposal director and scope architect. Refine an existing proposal using seller-supplied clarification answers. Treat answers as authoritative only for the question they address. Never invent facts, quantities, prices, credentials, dates or guarantees. Preserve unresolved items as To be confirmed. Improve buyer clarity and margin protection without adding unsupported claims.",
      prompt: `SELLER: ${profile.businessName}\nCLIENT: ${String(project.clientLabel || "Not provided")}\nORIGINAL BRIEF: ${String(project.brief || "")}\nBUDGET: ${String(project.budget || "Not provided")}\nTIMELINE: ${String(project.timeline || "Not provided")}\n\nCLARIFICATIONS:\n${resolved}\n\nPROPOSAL CUSTOMIZATION: ${JSON.stringify(requested)}\nKeep only the selected proposal sections, preserve the requested Concise/Detailed/Premium style, and include chart suggestions only when includeVisuals is true and supported by real numeric facts.\n\nCURRENT PROPOSAL:\n${String(project.proposal || "")}\n\nReturn ONLY JSON with summary (2 sentences), risks (array of 3-7 remaining material risks), proposal (complete revised client-ready proposal), grounding (array of material claims), visuals (array of at most 3 objects with type, title, labels and numeric values; empty when not requested or unsupported). Each grounding item must contain claim and kind. kind must be seller_fact, client_fact, assumption, or strategy. Preserve existing seller_fact sourceRecordIds only when the revised claim is still directly supported by the same persisted knowledge record; client_fact includes facts from the original brief, budget, timeline or clarification answers; assumption is an explicit assumption or To be confirmed item; strategy is ScopeVanta recommendation rather than fact. Reconcile the clarification answers throughout scope, deliverables, acceptance criteria, phases, timeline, client responsibilities, investment, assumptions, exclusions and change control. Remove resolved ambiguity, but do not silently resolve unanswered questions. Keep the proposal persuasive, specific and concise enough to be usable.`,
      maxTokens: 7600,
      temperature: 0.15,
    });
    const out = parseModelJson(r.text) as { summary: string; risks: string[]; proposal: string; grounding?: Array<{ claim: string; kind: string }>; visuals?: Array<{ type: string; title: string; labels: string[]; values: number[] }> };
    if (!out.summary || !Array.isArray(out.risks) || !out.proposal) return error("Incomplete refinement. Please retry.", 502);

    const previousGrounding = Array.isArray(project.evidence) ? (project.evidence as unknown as GroundingItem[]) : [];
    const grounding: GroundingItem[] = (Array.isArray(out.grounding) ? out.grounding : [])
      .slice(0, 30)
      .map((item) => {
        const kind = ["seller_fact", "client_fact", "assumption", "strategy"].includes(String(item.kind)) ? String(item.kind) : "strategy";
        const claim = String(item.claim || "").trim().slice(0, 2000);
        if (kind === "seller_fact") {
          const prior = previousGrounding.find((v) => v.kind === "seller_fact" && v.claim.toLowerCase() === claim.toLowerCase() && v.sourceRecordIds?.length);
          return prior ? { ...prior, claim } : null;
        }
        const confidence = kind === "client_fact" ? "client_supplied" : kind === "assumption" ? "assumption" : "recommendation";
        return { claim, kind, sourceRecordIds: [], sourceFiles: [], confidence };
      })
      .filter((item): item is GroundingItem => Boolean(item?.claim));

    const groundingSummary = {
      grounded: grounding.filter((v) => v.kind === "seller_fact").length,
      clientSupplied: grounding.filter((v) => v.kind === "client_fact").length,
      assumptions: grounding.filter((v) => v.kind === "assumption").length,
      recommendations: grounding.filter((v) => v.kind === "strategy").length,
    };

    const version = project.currentVersion + 1;
    await prisma.proposalVersion.create({
      data: {
        projectId,
        workspaceId: ctx.workspaceId,
        versionNumber: project.currentVersion,
        createdByUserId: ctx.userId,
        reason: "pre_refinement",
        snapshot: {
          proposal: String(project.proposal || ""),
          summary: String(project.summary || ""),
          risks: project.risks || [],
          grounding: project.evidence || [],
          groundingSummary: project.groundingSummary || {},
          visuals: project.visuals || [],
          proposalOptions: project.proposalOptions || {},
          clarificationAnswers: d.clarificationAnswers || [],
          savedAt: (project.updatedAt || project.createdAt).toISOString(),
          status: project.status || "Draft",
        },
      },
    });

    await prisma.commercialAudit.create({
      data: { workspaceId: ctx.workspaceId, projectId, performedByUserId: ctx.userId, action: "proposal_refined", payload: { detail: `Proposal advanced to version ${version}; downstream commercial guidance marked stale.` } },
    });

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        summary: out.summary,
        risks: out.risks.slice(0, 7),
        proposal: out.proposal,
        evidence: grounding as object,
        groundingSummary,
        visuals: Array.isArray(out.visuals) ? out.visuals.slice(0, 3) : [],
        proposalOptions: requested as object,
        commercialStale: true,
        evidenceStatus: "current",
        currentVersion: version,
        status: "Refined draft",
        data: { ...d, clarificationAnswers: answers, winPlan: undefined, winPlanUpdatedAt: "", closeCoach: undefined, nextBestAction: "Rebuild Opportunity Lab after proposal changes." } as object,
      },
    });

    return json({ ...updated, projectId });
  } catch (e) {
    console.error("ScopeVanta proposal refinement failed", e);
    return error("Proposal refinement is temporarily unavailable.", 502);
  }
});
