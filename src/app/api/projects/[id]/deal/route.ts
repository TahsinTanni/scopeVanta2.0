import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// PUT /api/projects/:id/deal — legacy/backend/index.ts:4351-4424.
type DealStage = "Draft" | "Proposal Ready" | "Sent" | "Follow-up" | "Negotiation" | "Won" | "Lost";
const STAGES = new Set<DealStage>(["Draft", "Proposal Ready", "Sent", "Follow-up", "Negotiation", "Won", "Lost"]);

export const PUT = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { dealStage?: DealStage; dealValue?: number; outcomeReason?: string };
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);

  const dealStage = (b.dealStage || p.dealStage || "Draft") as DealStage;
  if (!STAGES.has(dealStage)) return error("Invalid deal stage.", 400);
  const dealValue = Number.isFinite(Number(b.dealValue)) && Number(b.dealValue) >= 0 ? Math.round(Number(b.dealValue) * 100) / 100 : Number(p.dealValue || 0);
  const outcomeReason = String(b.outcomeReason ?? d.outcomeReason ?? "").trim().slice(0, 3000);
  if ((dealStage === "Won" || dealStage === "Lost") && !outcomeReason) {
    return error("Record why the deal was won or lost so ScopeVanta can learn from the outcome.", 400);
  }

  const now = new Date().toISOString();
  await prisma.commercialAudit.create({
    data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "deal_stage", payload: { detail: `Deal moved to ${dealStage}${outcomeReason ? ` · ${outcomeReason}` : ""}.` } },
  });

  const outcomeLearning =
    dealStage === "Won" || dealStage === "Lost"
      ? {
          stage: dealStage,
          reason: outcomeReason,
          finalValue: dealValue,
          proposalVersion: p.currentVersion,
          estimatedHours: Number(d.estimateSummary?.estimatedHours || 0),
          actualHours: Number(d.actualHours || 0),
          estimatedCost: Number(d.estimateSummary?.estimatedCost || 0),
          actualCost: Number(d.actualCost || 0),
          recordedAt: now,
        }
      : d.outcomeLearning;

  const updated = await prisma.project.update({
    where: { id },
    data: {
      dealStage,
      dealValue,
      data: { ...d, outcomeReason, outcomeLearning, dealStageUpdatedAt: now, outcomeAt: dealStage === "Won" || dealStage === "Lost" ? now : "", nextBestAction: "" } as object,
    },
  });
  return json({ project: updated });
});
