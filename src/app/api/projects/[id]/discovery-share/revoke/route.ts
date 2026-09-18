import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/discovery-share/revoke — mirrors /share/revoke for discovery shares.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  if (!p.discoveryShareToken) return error("No active discovery link exists.", 400);
  const d = projectData(p.data);

  await prisma.discoveryShare.updateMany({ where: { token: p.discoveryShareToken }, data: { status: "revoked", revokedAt: new Date() } });

  await prisma.commercialAudit.create({
    data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "discovery_share_revoked", payload: { detail: `Client discovery link for proposal version ${p.currentVersion} revoked.` } },
  });
  const updated = await prisma.project.update({ where: { id }, data: { data: { ...d, discoveryShareStatus: "revoked" } as object } });
  return json({ project: updated });
});
