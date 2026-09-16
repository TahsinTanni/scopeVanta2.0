import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/projects/:id/discovery-share — legacy/backend/index.ts:3691-3734.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!p) return error("Opportunity not found.", 404);
  const d = projectData(p.data);
  const discovery = (d.dealOS?.discovery as { discovery?: { questions?: unknown[] }; questions?: unknown[] } | undefined);
  const questions = ((discovery?.discovery?.questions || discovery?.questions || []) as unknown[]).slice(0, 12);
  if (!questions.length) return error("Run Discovery Agent before creating a client discovery link.", 400);

  const token = `d${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await prisma.discoveryShare.create({
    data: {
      workspaceId: ctx.workspaceId,
      projectId: id,
      token,
      status: "open",
      createdByUserId: ctx.userId,
      data: { client: p.clientLabel || "Client", questions, answers: [] } as object,
    },
  });
  const updated = await prisma.project.update({ where: { id }, data: { discoveryShareToken: token, data: { ...d, discoveryShareStatus: "open" } as object } });
  return json({ token, project: updated });
});
