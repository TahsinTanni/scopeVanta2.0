import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// GET /api/analytics/summary — legacy/backend/index.ts:1895-1913.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const items = await prisma.analyticsEvent.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { eventName: true, createdAt: true },
  });
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.eventName] = (counts[item.eventName] || 0) + 1;
  const lastEventAt = items[0]?.createdAt.toISOString() || "";
  return json({ counts, lastEventAt, eventsTracked: items.length });
});
