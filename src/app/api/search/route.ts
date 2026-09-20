import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// GET /api/search?q= — small, capped, multi-source lookup for the command palette.
export const GET = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return json({ clients: [], proposals: [], knowledge: [] });

  const contains = { contains: q, mode: "insensitive" as const };
  const workspaceId = ctx.workspaceId;
  const [clients, proposals, knowledge] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId, OR: [{ name: contains }, { company: contains }] },
      select: { id: true, name: true, company: true },
      orderBy: { name: "asc" },
      take: 5,
    }),
    prisma.project.findMany({
      where: { workspaceId, clientLabel: contains },
      select: { id: true, clientLabel: true, dealStage: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.knowledgeFile.findMany({
      where: { workspaceId, fileName: contains },
      select: { id: true, fileName: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return json({
    clients,
    proposals,
    knowledge: knowledge.map((f) => ({ id: f.id, name: f.fileName })),
  });
});
