import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// GET /api/projects/:id/commercial-history — legacy/backend/index.ts:3502-3532.
export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);

  const [baselines, changeOrders] = await Promise.all([
    prisma.scopeBaseline.findMany({ where: { projectId: id, workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.changeOrder.findMany({ where: { projectId: id, workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  return json({ baselines, changeOrders });
});
