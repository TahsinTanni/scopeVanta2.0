import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// PUT /api/projects/:id/deal — legacy/backend/index.ts:4351-4424.
type DealStage = "Draft" | "Proposal Ready" | "Sent" | "Follow-up" | "Negotiation" | "Won" | "Lost";
const STAGES = new Set<DealStage>(["Draft", "Proposal Ready", "Sent", "Follow-up", "Negotiation", "Won", "Lost"]);
const CONTRACT_STATUSES = ["Signed", "Verbal agreement — pending signature", "Purchase order received"];

export const PUT = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as {
    dealStage?: DealStage; dealValue?: number; outcomeReason?: string;
    contractStatus?: string; finalPackage?: string; finalPrice?: number; depositRequired?: boolean; depositReceived?: boolean;
    kickoffDate?: string; kickoffAuthorized?: boolean;
  };
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);

  const dealStage = (b.dealStage || p.dealStage || "Draft") as DealStage;
  if (!STAGES.has(dealStage)) return error("Invalid deal stage.", 400);
  const closingWon = dealStage === "Won" && p.dealStage !== "Won"; // transition into Won only; Lost is unaffected
  let dealValue = Number.isFinite(Number(b.dealValue)) && Number(b.dealValue) >= 0 ? Math.round(Number(b.dealValue) * 100) / 100 : Number(p.dealValue || 0);
  const outcomeReason = String(b.outcomeReason ?? d.outcomeReason ?? "").trim().slice(0, 3000);
  if ((dealStage === "Won" || dealStage === "Lost") && !outcomeReason) {
    return error("Record why the deal was won or lost so ScopeVanta can learn from the outcome.", 400);
  }

  let closureDetails: NonNullable<ReturnType<typeof projectData>["closureDetails"]> | undefined;
  if (closingWon) {
    if (!CONTRACT_STATUSES.includes(String(b.contractStatus))) {
      return error(`Choose a contract status: ${CONTRACT_STATUSES.join(", ")}.`, 400);
    }
    if (typeof b.finalPrice !== "number" || !Number.isFinite(b.finalPrice) || b.finalPrice < 0) {
      return error("Enter the final price (a number, 0 or more).", 400);
    }
    const kickoffDate = String(b.kickoffDate ?? "").trim();
    if (!kickoffDate) return error("Enter the kickoff date.", 400);
    if (b.kickoffAuthorized !== true) return error("Confirm kickoff is authorized before marking this deal Won.", 400);
    const finalPrice = Math.round(b.finalPrice * 100) / 100;
    dealValue = finalPrice; // the closed deal's value is the final agreed price
    closureDetails = {
      contractStatus: String(b.contractStatus),
      finalPackage: String(b.finalPackage ?? "").trim().slice(0, 200),
      finalPrice,
      depositRequired: b.depositRequired === true,
      depositReceived: b.depositReceived === true,
      kickoffDate: kickoffDate.slice(0, 40),
      kickoffAuthorized: true,
      recordedAt: new Date().toISOString(),
    };
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
      data: { ...d, ...(closureDetails ? { closureDetails } : {}), outcomeReason, outcomeLearning, dealStageUpdatedAt: now, outcomeAt: dealStage === "Won" || dealStage === "Lost" ? now : "", nextBestAction: "" } as object,
    },
  });
  return json({ project: updated });
});
