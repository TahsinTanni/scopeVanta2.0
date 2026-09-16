import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/scope-baseline — legacy/backend/index.ts:3235-3292.
// Baseline history now uses the dedicated ScopeBaseline table (durable,
// queryable) instead of legacy's `scope-baselines:{userId}:{projectId}` KV
// table — same append-only semantics, better storage.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  if (!d.commercialLab?.scope) return error("Build the Opportunity Lab before establishing a scope baseline.", 400);

  const priorCount = await prisma.scopeBaseline.count({ where: { projectId: id } });
  const baseline = {
    version: priorCount + 1,
    proposalVersion: p.currentVersion,
    scope: d.commercialLab.scope,
    traceability: d.commercialLab.traceability || [],
    pricing: d.commercialLab.pricing || {},
    feasibility: d.commercialLab.feasibility || {},
    estimateLines: d.estimateLines || [],
    estimateSummary: d.estimateSummary || {},
    scopeGraph: d.scopeGraph || [],
    proposal: String(p.proposal || ""),
  };

  // Real transaction (hardening item from the docs: legacy wrote baseline
  // history then the project record as two separate calls with a manual
  // compensating-delete on failure; here it's atomic).
  const finalProject = await prisma.$transaction(async (tx) => {
    const created = await tx.scopeBaseline.create({ data: { projectId: id, workspaceId: ctx.workspaceId, createdByUserId: ctx.userId, snapshot: baseline as object } });
    await tx.commercialAudit.create({ data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "scope_baseline", payload: { detail: `Baseline ${baseline.version} established from proposal version ${baseline.proposalVersion}.` } } });
    return tx.project.update({
      where: { id },
      data: {
        data: {
          ...d,
          scopeBaseline: { ...baseline, id: created.id, createdAt: created.createdAt.toISOString() },
          changeOrderDraft: "",
          changeOrderStatus: "",
          nextBestAction: "Monitor new client requests against the approved scope baseline.",
        } as object,
      },
    });
  });
  return json({ project: finalProject });
});
