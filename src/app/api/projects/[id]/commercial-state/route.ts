import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/commercial-state — legacy/backend/index.ts:2879-2969.
type Line = { name?: string; role?: string; qty?: number; hours?: number; costRate?: number; sellRate?: number };
type Body = { estimateLines?: Line[]; actualRevenue?: number; actualCost?: number; actualHours?: number; clientRequest?: string };

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);

  const b = (await req.json().catch(() => ({}))) as Body;
  const lines = (Array.isArray(b.estimateLines) ? b.estimateLines : []).slice(0, 100).map((v) => ({
    name: String(v.name || "Untitled item").slice(0, 180),
    role: String(v.role || "").slice(0, 120),
    qty: Math.max(0, Number(v.qty || 1)),
    hours: Math.max(0, Number(v.hours || 0)),
    costRate: Math.max(0, Number(v.costRate || 0)),
    sellRate: Math.max(0, Number(v.sellRate || 0)),
  }));
  const estimatedHours = Math.round(lines.reduce((s, v) => s + v.qty * v.hours, 0) * 100) / 100;
  const estimatedCost = Math.round(lines.reduce((s, v) => s + v.qty * v.hours * v.costRate, 0) * 100) / 100;
  const estimatedPrice = Math.round(lines.reduce((s, v) => s + v.qty * v.hours * v.sellRate, 0) * 100) / 100;
  const estimatedMarginPct = estimatedPrice ? Math.round(((estimatedPrice - estimatedCost) / estimatedPrice) * 1000) / 10 : 0;
  const actualRevenue = b.actualRevenue !== undefined ? Math.max(0, Number(b.actualRevenue)) : (d.actualRevenue || 0);
  const actualCost = b.actualCost !== undefined ? Math.max(0, Number(b.actualCost)) : (d.actualCost || 0);
  const actualHours = b.actualHours !== undefined ? Math.max(0, Number(b.actualHours)) : (d.actualHours || 0);
  const actualMarginPct = actualRevenue ? Math.round(((actualRevenue - actualCost) / actualRevenue) * 1000) / 10 : 0;

  await prisma.commercialAudit.create({
    data: { workspaceId: ctx.workspaceId, projectId: p.id, performedByUserId: ctx.userId, action: "commercial_state", payload: { detail: `Estimate updated · ${estimatedHours}h · ${estimatedMarginPct}% modeled margin${actualHours ? ` · ${actualHours} actual hours` : ""}.` } },
  });

  const updated = await prisma.project.update({
    where: { id: p.id },
    data: {
      commercialStale: true,
      data: {
        ...d,
        estimateLines: lines,
        estimateSummary: { estimatedHours, estimatedCost, estimatedPrice, estimatedMarginPct },
        actualRevenue,
        actualCost,
        actualHours,
        actualMarginPct,
        clientRequestInbox: String(b.clientRequest || d.clientRequestInbox || "").slice(0, 10000),
        nextBestAction: "Recalculate Opportunity Lab so scope, pricing, feasibility and negotiation reflect the latest estimate.",
      } as object,
    },
  });
  return json({ project: updated });
});
