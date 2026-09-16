import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// DELETE /api/commercial/rates/:id — legacy/backend/index.ts:2718-2726.
export const DELETE = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const deleted = await prisma.rate.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
  return deleted.count ? json({ deleted: true }) : error("Rate not found.", 404);
});
