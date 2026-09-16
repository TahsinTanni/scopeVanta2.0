import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// GET /api/projects — legacy/backend/index.ts:1847-1858.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const projects = await prisma.project.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json({ projects });
});
