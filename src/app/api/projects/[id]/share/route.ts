import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/share — legacy/backend/index.ts:4064-4147.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  if (!String(p.proposal || "").trim()) return error("Generate a proposal before sharing.", 400);
  if (p.evidenceStatus === "needs_review") {
    return error("This proposal changed after its evidence was verified. Review or regenerate the proposal before sharing.", 409);
  }
  if (p.commercialStale === true) {
    return error("Commercial guidance is stale after recent scope or proposal changes. Recalculate Opportunity Lab before sharing.", 409);
  }
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile) return error("Complete profile first.", 400);

  const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const scenarios = Array.isArray((d.dealOS?.choices as Record<string, unknown> | undefined)?.buyerChoices)
    ? ((d.dealOS!.choices as { buyerChoices: unknown[] }).buyerChoices as unknown[]).slice(0, 3)
    : Array.isArray(d.dealScenarios)
      ? d.dealScenarios.slice(0, 3)
      : [];

  const now = new Date().toISOString();
  await prisma.proposalShare.create({
    data: {
      projectId: id,
      workspaceId: ctx.workspaceId,
      token,
      status: "shared",
      createdByUserId: ctx.userId,
      data: {
        client: p.clientLabel || "Client",
        seller: profile.businessName || profile.contactName || "Seller",
        proposal: String(p.proposal).slice(0, 80000),
        version: p.currentVersion,
        dealValue: Number(p.dealValue || 0),
        decision: "",
        decidedAt: "",
        selectedScenario: "",
        scopeSummary: (d.estimateLines || []).slice(0, 60).map((v) => ({ name: v.name, qty: v.qty, hours: v.hours, acceptance: v.acceptance || "" })),
        scenarios,
        timeline: String(p.timeline || ""),
        proposalAuditScore: Number((d.proposalStudio?.audit as Record<string, unknown> | undefined)?.score || 0),
        responsibilities: (d.dealOS?.responsibilities as { responsibilities?: unknown[] } | undefined)?.responsibilities || [],
        handoff: (d.dealOS?.handoff as { handoff?: unknown } | undefined)?.handoff || {},
        views: 0,
        lastViewedAt: "",
        engagement: [],
      } as object,
    },
  });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      shareToken: token,
      dealStage: p.dealStage === "Draft" || !p.dealStage ? "Sent" : p.dealStage,
      data: { ...d, shareStatus: "shared", shareCreatedAt: now } as object,
    },
  });
  return json({ token, status: "shared", project: updated });
});
