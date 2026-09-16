import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// GET/POST /api/commercial/rates — legacy/backend/index.ts:2684-2717.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const rates = await prisma.rate.findMany({ where: { workspaceId: ctx.workspaceId }, take: 100 });
  return json({ rates });
});

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as { name?: string; costRate?: number; sellRate?: number; overheadPct?: number };
  const name = String(b.name || "").trim();
  if (name.length < 2) return error("Role or service name is required.", 400);
  const rate = await prisma.rate.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdByUserId: ctx.userId,
      role: name,
      costRate: Math.max(0, Number(b.costRate || 0)),
      sellRate: Math.max(0, Number(b.sellRate || 0)),
      overheadPct: Math.min(100, Math.max(0, Number(b.overheadPct || 0))),
    },
  });
  return json({ rate }, 201);
});
