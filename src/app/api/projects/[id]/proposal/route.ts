import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// PUT /api/projects/:id/proposal — legacy/backend/index.ts:4494-4600. Manual
// edit path: creates a revision snapshot only when text changed, matching
// the settings-only-save-doesn't-create-a-phantom-revision rule.
type ProposalOptions = Record<string, unknown>;
type Body = { proposal?: string; proposalOptions?: ProposalOptions };

export const PUT = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id: projectId } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!projectId) return error("Project is required.", 400);
  const proposal = String(b.proposal || "").trim();
  if (proposal.length < 80) return error("Proposal is too short to save.", 400);
  if (proposal.length > 80000) return error("Proposal is too long to save.", 400);

  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId } });
  if (!project) return error("Proposal not found.", 404);
  const d = projectData(project.data);

  const proposalChanged = proposal !== String(project.proposal || "").trim();
  const options = b.proposalOptions || project.proposalOptions || {};
  const optionsChanged = JSON.stringify(options) !== JSON.stringify(project.proposalOptions || {});
  if (!proposalChanged && !optionsChanged) return json({ ...project, projectId, unchanged: true });

  const savedAt = new Date();
  if (!proposalChanged) {
    const updated = await prisma.project.update({ where: { id: projectId }, data: { proposalOptions: options as object, updatedAt: savedAt } });
    return json({ ...updated, projectId, unchanged: true });
  }

  const version = project.currentVersion + 1;
  await prisma.proposalVersion.create({
    data: {
      projectId,
      workspaceId: ctx.workspaceId,
      versionNumber: project.currentVersion,
      createdByUserId: ctx.userId,
      reason: "pre_manual_edit",
      snapshot: {
        proposal: String(project.proposal || ""),
        summary: String(project.summary || ""),
        risks: project.risks || [],
        grounding: project.evidence || [],
        groundingSummary: project.groundingSummary || {},
        visuals: project.visuals || [],
        proposalOptions: project.proposalOptions || {},
        savedAt: (project.updatedAt || project.createdAt).toISOString(),
        status: project.status || "Draft",
      },
    },
  });

  await prisma.commercialAudit.create({
    data: { workspaceId: ctx.workspaceId, projectId, performedByUserId: ctx.userId, action: "proposal_edited", payload: { detail: `Proposal advanced to version ${version}; commercial analysis and closing guidance marked stale.` } },
  });

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      proposal,
      proposalOptions: options as object,
      evidence: [],
      groundingSummary: { grounded: 0, clientSupplied: 0, assumptions: 0, recommendations: 0 },
      commercialStale: true,
      evidenceStatus: "needs_review",
      currentVersion: version,
      status: "Edited draft · evidence review required",
      data: {
        ...d,
        winPlan: undefined,
        winPlanUpdatedAt: "",
        closeCoach: undefined,
        nextBestAction: "Rebuild Opportunity Lab and rerun Proposal Studio after proposal changes.",
        proposalStudio: undefined,
        proposalStudioAt: "",
        shareStatus: d.shareStatus === "shared" ? "stale_shared_version" : d.shareStatus,
      } as object,
    },
  });
  return json({ ...updated, projectId });
});
