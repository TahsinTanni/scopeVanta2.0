import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { parseRateInput, rateNameTaken, type RateInput } from "@/lib/rates";

// DELETE /api/commercial/rates/:id — legacy/backend/index.ts:2718-2726.
export const DELETE = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const deleted = await prisma.rate.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
  return deleted.count ? json({ deleted: true }) : error("Rate not found.", 404);
});

// PUT /api/commercial/rates/:id — same validation as POST; the rate's own id is
// excluded from the duplicate-name check so an unchanged name is not rejected.
export const PUT = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const existing = await prisma.rate.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return error("Rate not found.", 404);
  const b = (await req.json().catch(() => ({}))) as RateInput;
  const { name, costRate, sellRate, overheadPct } = parseRateInput(b);
  if (name.length < 2) return error("Role or service name is required.", 400);
  if (await rateNameTaken(ctx.workspaceId, name, id)) return error(`A rate named "${name}" already exists.`, 409);
  const rate = await prisma.rate.update({ where: { id }, data: { role: name, costRate, sellRate, overheadPct } });
  return json({ rate });
});
