import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// GET /api/projects/:id — net new (not in the legacy 55 routes). Legacy's
// SPA never needed this because every action route returns the full
// project inline and the list view keeps everything in client memory; a
// server-rendered/route-based frontend needs a direct single-project fetch
// on page load instead.
export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!project) return error("Opportunity not found.", 404);
  return json(project);
});
