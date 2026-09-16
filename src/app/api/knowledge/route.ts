import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// GET /api/knowledge — legacy/backend/index.ts:1560-1580.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const items = await prisma.knowledgeRecord.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const counts: Record<string, number> = {};
  for (const v of items) {
    if (v.isActive) counts[v.category] = (counts[v.category] || 0) + 1;
  }
  return json({ records: items, counts });
});
