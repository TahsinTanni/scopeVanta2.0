import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

const PAGE_SIZE = 20;

const SORTS: Record<string, Prisma.ProjectOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  client_az: [{ clientLabel: "asc" }, { id: "asc" }],
  client_za: [{ clientLabel: "desc" }, { id: "asc" }],
  risk_desc: [{ riskScore: { sort: "desc", nulls: "last" } }, { id: "asc" }],
};

// GET /api/projects — legacy/backend/index.ts:1847-1858.
// Optional params: q (clientLabel substring), stage, sort, page.
export const GET = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") || "").trim();
  const stage = params.get("stage") || "all";
  const sort = params.get("sort") || "newest";
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);

  // Every condition is a sibling key, so they combine with AND.
  const where: Prisma.ProjectWhereInput = {
    workspaceId: ctx.workspaceId,
    ...(q ? { clientLabel: { contains: q, mode: "insensitive" } } : {}),
    ...(stage !== "all" ? { dealStage: stage } : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: SORTS[sort] ?? SORTS.newest,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where }),
  ]);
  return json({ projects, total, page, pageSize: PAGE_SIZE });
});
