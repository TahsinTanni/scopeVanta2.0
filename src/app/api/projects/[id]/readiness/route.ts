import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// GET /api/projects/:id/readiness — legacy/backend/index.ts:3942-4019.
export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);

  const checks = [
    { key: "brief", label: "Client brief analyzed", pass: Boolean(String(p.brief || "").trim()) },
    { key: "scope", label: "Scope engineered", pass: Boolean(d.commercialLab?.scope) },
    { key: "economics", label: "Economics modeled", pass: Boolean(d.estimateSummary?.estimatedPrice) },
    { key: "proposal", label: "Proposal generated", pass: Boolean(String(p.proposal || "").trim()) },
    { key: "audit", label: "Proposal audited", pass: Boolean(d.proposalStudio?.audit) },
    { key: "evidence", label: "Evidence current", pass: p.evidenceStatus !== "needs_review" },
    { key: "commercial", label: "Commercial intelligence current", pass: !p.commercialStale },
    { key: "win", label: "Win strategy prepared", pass: Boolean(d.winPlan || d.closeCoach) },
    { key: "share", label: "Client review created", pass: Boolean(p.shareToken && d.shareStatus !== "revoked") },
    { key: "baseline", label: "Scope baseline established", pass: Boolean(d.scopeBaseline) },
  ];
  const passed = checks.filter((v) => v.pass).length;
  return json({
    checks,
    passed,
    total: checks.length,
    readyToShare: checks.filter((v) => ["proposal", "audit", "evidence", "commercial"].includes(v.key)).every((v) => v.pass),
    readyToProtect: Boolean(d.scopeBaseline),
    next: checks.find((v) => !v.pass)?.label || "Run a real client decision/change cycle",
  });
});
