import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { parseRateInput, rateNameTaken, type RateInput } from "@/lib/rates";

const PAGE_SIZE = 20;

// GET/POST /api/commercial/rates — legacy/backend/index.ts:2684-2717.
export const GET = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const page = Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get("page"))) || 1);
  const where = { workspaceId: ctx.workspaceId };
  const [rates, total] = await Promise.all([
    prisma.rate.findMany({
      where,
      orderBy: [{ role: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.rate.count({ where }),
  ]);
  return json({ rates, total, page, pageSize: PAGE_SIZE });
});

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as RateInput;
  const { name, costRate, sellRate, overheadPct } = parseRateInput(b);
  if (name.length < 2) return error("Role or service name is required.", 400);
  if (await rateNameTaken(ctx.workspaceId, name)) return error(`A rate named "${name}" already exists.`, 409);
  const rate = await prisma.rate.create({
    data: { workspaceId: ctx.workspaceId, createdByUserId: ctx.userId, role: name, costRate, sellRate, overheadPct },
  });
  return json({ rate }, 201);
});
