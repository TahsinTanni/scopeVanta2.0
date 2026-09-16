import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/change-order/approve — legacy/backend/index.ts:3293-3358.
// Transactional per the hardening notes (same pattern as scope-baseline).
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const classification = (d.commercialLab?.changeDetection as Record<string, unknown> | undefined)?.classification;
  if (!String(d.changeOrderDraft || "").trim() || classification !== "Out of Scope") {
    return error("There is no out-of-scope change order ready to approve.", 400);
  }

  const now = new Date();
  const latestBaseline = await prisma.scopeBaseline.findFirst({ where: { projectId: id }, orderBy: { createdAt: "desc" } });

  const updated = await prisma.$transaction(async (tx) => {
    const changeOrder = await tx.changeOrder.create({
      data: {
        projectId: id,
        workspaceId: ctx.workspaceId,
        scopeBaselineId: latestBaseline?.id,
        createdByUserId: ctx.userId,
        approvedByUserId: ctx.userId,
        approvedAt: now,
        status: "APPROVED",
        description: {
          request: d.lastChangeRequest || "",
          draft: d.changeOrderDraft || "",
          classification,
          estimatedExtraHours: Number((d.commercialLab?.changeDetection as Record<string, unknown> | undefined)?.estimatedExtraHours || 0),
          baselineVersion: (d.scopeBaseline as { version?: number } | undefined)?.version || 0,
          proposalVersion: p.currentVersion,
        },
      },
    });
    await tx.commercialAudit.create({
      data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "change_order_approved", payload: { detail: String(d.lastChangeRequest || "Approved scope change").slice(0, 700) } },
    });
    return tx.project.update({
      where: { id },
      data: { data: { ...d, changeOrderStatus: "approved", changeOrderApprovedAt: now.toISOString(), lastChangeOrderId: changeOrder.id, nextBestAction: "Rebuild the Opportunity Lab to incorporate the approved change into a new scope baseline." } as object },
    });
  });

  return json({ project: updated });
});
