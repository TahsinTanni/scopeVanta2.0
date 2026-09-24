import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { assertFeatureEnabled } from "@/lib/flags";
import { createHash } from "node:crypto";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/share — legacy/backend/index.ts:4064-4147.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  await assertFeatureEnabled("sharing", ctx.workspaceId);
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
  const nowDate = new Date(now);

  // Buyer Release: the exact values shared with the buyer, hashed from an explicit
  // fixed-key-order snapshot (not the loosely ordered `data` object). The same
  // consts feed both this snapshot and the stored `data`, so they cannot diverge.
  const client = p.clientLabel || "Client";
  const seller = profile.businessName || profile.contactName || "Seller";
  const proposalText = String(p.proposal).slice(0, 80000);
  const dealValue = Number(p.dealValue || 0);
  const timeline = String(p.timeline || "");
  const releaseId = `rel_${crypto.randomUUID()}`;
  const releaseSnapshot = { client, seller, proposalVersion: p.currentVersion, proposal: proposalText, dealValue, scenarios, timeline };
  const releaseHash = createHash("sha256").update(JSON.stringify(releaseSnapshot)).digest("hex");
  // Supersede earlier live shares (not ones the buyer already decided on), then create the new one, atomically.
  await prisma.$transaction([
    prisma.proposalShare.updateMany({ where: { projectId: id, status: { notIn: ["revoked", "accepted", "changes_requested"] } }, data: { status: "revoked", revokedAt: nowDate } }),
    prisma.proposalShare.create({
    data: {
      projectId: id,
      workspaceId: ctx.workspaceId,
      token,
      status: "shared",
      createdByUserId: ctx.userId,
      expiresAt: new Date(nowDate.getTime() + 60 * 86_400_000),
      releaseId,
      releaseHash,
      releasedAt: nowDate,
      data: {
        client,
        seller,
        proposal: proposalText,
        version: p.currentVersion,
        dealValue,
        decision: "",
        decidedAt: "",
        selectedScenario: "",
        scopeSummary: (d.estimateLines || []).slice(0, 60).map((v) => ({ name: v.name, qty: v.qty, hours: v.hours, acceptance: v.acceptance || "" })),
        scenarios,
        timeline,
        proposalAuditScore: Number((d.proposalStudio?.audit as Record<string, unknown> | undefined)?.score || 0),
        responsibilities: (d.dealOS?.responsibilities as { responsibilities?: unknown[] } | undefined)?.responsibilities || [],
        handoff: (d.dealOS?.handoff as { handoff?: unknown } | undefined)?.handoff || {},
        views: 0,
        lastViewedAt: "",
        engagement: [],
      } as object,
    },
    }),
  ]);

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
