import { prisma } from "@/lib/prisma";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/proposal-share/:token/decision — legacy/backend/index.ts:4272-4350. Public.
type ShareData = { decision?: string; version: number; engagement: Array<{ type: string; at: string }> };
type Body = { decision?: "accepted" | "changes_requested"; name?: string; email?: string; note?: string };

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const s = await prisma.proposalShare.findUnique({ where: { token } });
  if (!s || s.token !== token || s.status === "revoked" || (s.expiresAt && s.expiresAt.getTime() < Date.now())) return error("This proposal link is unavailable.", 404);
  const d = s.data as ShareData;
  if (d.decision) return error("A decision has already been recorded for this proposal.", 409);
  if (b.decision !== "accepted" && b.decision !== "changes_requested") return error("Choose accept or request changes.", 400);

  const name = String(b.name || "").trim().slice(0, 200);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 320);
  const note = String(b.note || "").trim().slice(0, 4000);
  if (name.length < 2) return error("Your name is required.", 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return error("A valid email is required.", 400);
  if (b.decision === "changes_requested" && !note) return error("Tell the seller what should change.", 400);

  const decidedAt = new Date().toISOString();
  await prisma.proposalShare.update({
    where: { id: s.id },
    data: {
      status: b.decision,
      data: {
        ...d,
        decision: b.decision,
        decidedAt,
        decisionName: name,
        decisionEmail: email,
        decisionNote: note,
        engagement: [...(Array.isArray(d.engagement) ? d.engagement : []).slice(-49), { type: b.decision, at: decidedAt }],
      },
    },
  });

  if (s.projectId) {
    const p = await prisma.project.findUnique({ where: { id: s.projectId } });
    if (p) {
      const accepted = b.decision === "accepted";
      await prisma.project.update({
        where: { id: s.projectId },
        data: {
          dealStage: accepted ? "Won" : "Negotiation",
          data: {
            ...projectData(p.data),
            shareStatus: b.decision,
            clientDecision: b.decision,
            clientDecisionAt: decidedAt,
            clientDecisionName: name,
            clientDecisionEmail: email,
            clientDecisionNote: note,
            outcomeReason: accepted ? `Client accepted proposal version ${d.version}. ${note}`.trim() : projectData(p.data).outcomeReason || "",
            outcomeAt: accepted ? decidedAt : projectData(p.data).outcomeAt || "",
            nextBestAction: accepted ? "Confirm kickoff, contract and delivery start." : "Review requested changes before revising scope or price.",
          } as object,
        },
      });
    }
  }
  return json({ recorded: true, decision: b.decision, decidedAt });
});
