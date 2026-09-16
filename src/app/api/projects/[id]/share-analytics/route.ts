import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// GET /api/projects/:id/share-analytics — legacy/backend/index.ts:4242-4271.
type ShareData = { views?: number; lastViewedAt?: string; selectedScenario?: string; decision?: string; engagement?: unknown[] };

export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  if (!p.shareToken) return json({ views: 0, lastViewedAt: "", selectedScenario: "", events: [] });

  const s = await prisma.proposalShare.findUnique({ where: { token: p.shareToken } });
  const d = (s?.data as ShareData) || {};
  return json({
    views: Number(d.views || 0),
    lastViewedAt: String(d.lastViewedAt || ""),
    selectedScenario: String(d.selectedScenario || ""),
    decision: String(d.decision || ""),
    events: Array.isArray(d.engagement) ? d.engagement : [],
  });
});
