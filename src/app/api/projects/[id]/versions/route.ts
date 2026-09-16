import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// GET /api/projects/:id/versions — legacy/backend/index.ts:4601-4650.
type Snapshot = { proposal: string; summary: string; risks: unknown[]; grounding: unknown[]; groundingSummary: object; visuals: unknown[]; proposalOptions: object; clarificationAnswers?: string[]; savedAt: string; status: string };

export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id: projectId } = await params;
  if (!projectId) return error("Project is required.", 400);
  const current = await prisma.project.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId } });
  if (!current) return error("Proposal not found.", 404);
  const d = projectData(current.data);

  const items = await prisma.proposalVersion.findMany({ where: { projectId, workspaceId: ctx.workspaceId }, take: 30 });
  const versions = [
    ...items.map((v) => {
      const snap = v.snapshot as Snapshot;
      return {
        version: v.versionNumber,
        proposal: snap.proposal || "",
        summary: snap.summary || "",
        risks: snap.risks || [],
        grounding: snap.grounding || [],
        groundingSummary: snap.groundingSummary || {},
        visuals: snap.visuals || [],
        proposalOptions: snap.proposalOptions || {},
        clarificationAnswers: snap.clarificationAnswers || [],
        savedAt: snap.savedAt || "",
        status: snap.status || "Saved revision",
        revisionSource: v.reason,
      };
    }),
    {
      version: current.currentVersion,
      proposal: String(current.proposal || ""),
      summary: String(current.summary || ""),
      risks: current.risks || [],
      grounding: current.evidence || [],
      groundingSummary: current.groundingSummary || {},
      visuals: current.visuals || [],
      proposalOptions: current.proposalOptions || {},
      clarificationAnswers: d.clarificationAnswers || [],
      savedAt: (current.updatedAt || current.createdAt).toISOString(),
      status: current.status || "Current",
      revisionSource: "current",
    },
  ].sort((a, b) => b.version - a.version);

  return json({ versions });
});
