import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// Prisma needs an explicit null marker for nullable Json columns.
const j = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

// POST /api/projects/:id/duplicate — clones a project into a fresh draft.
// Read-only on the source. Relational children (versions, baselines, change
// orders, shares, discovery shares, audits) are intentionally not copied.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const src = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!src) return error("Opportunity not found.", 404);

  // Build `data` explicitly from the allowed keys only — never spread
  // the source data, so keys added to Project.data later can't leak across.
  const sd = projectData(src.data);
  const data: Record<string, unknown> = {};
  if (sd.estimateLines !== undefined) data.estimateLines = sd.estimateLines;
  if (sd.estimateSummary !== undefined) data.estimateSummary = sd.estimateSummary;
  if (sd.scopeGraph !== undefined) data.scopeGraph = sd.scopeGraph;
  if (sd.dealScenarios !== undefined) data.dealScenarios = sd.dealScenarios;

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        // ownership
        workspaceId: ctx.workspaceId,
        createdByUserId: ctx.userId,
        // cloned as-is
        name: `${src.name} (Copy)`,
        clientLabel: src.clientLabel,
        clientId: src.clientId,
        brief: src.brief,
        status: src.status,
        riskScore: src.riskScore,
        summary: j(src.summary),
        risks: j(src.risks),
        clarificationQuestions: j(src.clarificationQuestions),
        proposal: j(src.proposal),
        evidence: j(src.evidence),
        groundingSummary: j(src.groundingSummary),
        visuals: j(src.visuals),
        proposalOptions: j(src.proposalOptions),
        budget: j(src.budget),
        timeline: j(src.timeline),
        // reset
        dealStage: "Draft",
        dealValue: null,
        currentVersion: 1,
        evidenceStatus: "needs_review",
        commercialStale: false,
        shareToken: null,
        discoveryShareToken: null,
        data: data as Prisma.InputJsonObject,
      },
    });
    await tx.commercialAudit.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: created.id,
        performedByUserId: ctx.userId,
        action: "duplicated_from",
        payload: { sourceProjectId: src.id },
      },
    });
    return created;
  });

  return json({ project }, 201);
});
