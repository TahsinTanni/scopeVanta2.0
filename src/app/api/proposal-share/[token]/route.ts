import { prisma } from "@/lib/prisma";
import { json, error, withErrors } from "@/lib/http";

// GET /api/proposal-share/:token — legacy/backend/index.ts:4148-4195. Public
// (token-gated), listed in src/proxy.ts's isPublicRoute matcher.
type ShareData = {
  client: string; seller: string; proposal: string; version: number; dealValue: number; decision: string; decidedAt: string;
  selectedScenario?: string; scopeSummary?: unknown[]; scenarios?: unknown[]; timeline?: string; proposalAuditScore?: number;
  responsibilities?: unknown[]; handoff?: unknown; views: number; lastViewedAt: string; engagement: Array<{ type: string; at: string; name?: string }>;
};

export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  if (!token) return error("Share link is invalid.", 400);
  const s = await prisma.proposalShare.findUnique({ where: { token } });
  if (!s || s.token !== token || s.status === "revoked") return error("This proposal link is unavailable.", 404);
  const d = s.data as ShareData;

  const viewedAt = new Date().toISOString();
  const engagement = [...(Array.isArray(d.engagement) ? d.engagement : []).slice(-49), { type: "view", at: viewedAt }];
  const views = Number(d.views || 0) + 1;
  await prisma.proposalShare.update({ where: { id: s.id }, data: { data: { ...d, views, lastViewedAt: viewedAt, engagement } as object } });

  return json({
    share: {
      client: d.client,
      seller: d.seller,
      proposal: d.proposal,
      version: d.version,
      dealValue: d.dealValue,
      status: s.status,
      decision: d.decision,
      decidedAt: d.decidedAt,
      selectedScenario: d.selectedScenario || "",
      scopeSummary: d.scopeSummary || [],
      scenarios: d.scenarios || [],
      timeline: d.timeline || "",
      proposalAuditScore: d.proposalAuditScore || 0,
      responsibilities: d.responsibilities || [],
      handoff: d.handoff || {},
      views,
    },
  });
});
