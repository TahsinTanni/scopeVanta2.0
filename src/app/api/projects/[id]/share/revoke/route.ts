import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/share/revoke — legacy/backend/index.ts:4020-4063.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  if (!p.shareToken) return error("No active proposal share exists.", 400);
  const d = projectData(p.data);

  await prisma.proposalShare.updateMany({ where: { token: p.shareToken }, data: { status: "revoked", revokedAt: new Date() } });

  await prisma.commercialAudit.create({
    data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "proposal_share_revoked", payload: { detail: `Client review for proposal version ${p.currentVersion} revoked.` } },
  });
  const updated = await prisma.project.update({ where: { id }, data: { data: { ...d, shareStatus: "revoked" } as object } });
  return json({ project: updated });
});
