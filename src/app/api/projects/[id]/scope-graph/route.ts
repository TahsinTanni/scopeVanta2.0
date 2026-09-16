import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/scope-graph — legacy/backend/index.ts:3533-3619.
type Node = { id?: string; type?: string; label?: string; parentId?: string; hours?: number; cost?: number; price?: number; acceptance?: string; dependency?: string };
const ALLOWED_TYPES = new Set(["requirement", "phase", "deliverable", "task", "economics", "acceptance"]);

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const b = (await req.json().catch(() => ({}))) as { nodes?: Node[] };

  const nodes = (Array.isArray(b.nodes) ? b.nodes : [])
    .slice(0, 180)
    .map((v, i) => ({
      id: (String(v.id || `node-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)) || `node-${i + 1}`,
      type: ALLOWED_TYPES.has(String(v.type)) ? String(v.type) : "deliverable",
      label: String(v.label || "").trim().slice(0, 300),
      parentId: String(v.parentId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80),
      hours: Math.max(0, Number(v.hours || 0)),
      cost: Math.max(0, Number(v.cost || 0)),
      price: Math.max(0, Number(v.price || 0)),
      acceptance: String(v.acceptance || "").slice(0, 700),
      dependency: String(v.dependency || "").slice(0, 700),
    }))
    .filter((v) => v.label);
  if (!nodes.length) return error("Add at least one scope graph node.", 400);
  const ids = new Set(nodes.map((v) => v.id));
  if (nodes.some((v) => v.parentId && !ids.has(v.parentId))) {
    return error("Every parent relationship must reference a node in this scope graph.", 400);
  }

  await prisma.commercialAudit.create({
    data: { workspaceId: ctx.workspaceId, projectId: id, performedByUserId: ctx.userId, action: "scope_graph_saved", payload: { detail: `Editable scope graph saved · ${nodes.length} nodes.` } },
  });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      commercialStale: true,
      evidenceStatus: "needs_review",
      data: { ...d, scopeGraph: nodes, scopeGraphUpdatedAt: new Date().toISOString(), winPlan: undefined, closeCoach: undefined, nextBestAction: "Recompile pricing and proposal guidance after scope graph edits." } as object,
    },
  });
  return json({ project: updated, nodes });
});
