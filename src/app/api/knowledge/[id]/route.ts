import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// PUT /api/knowledge/:id — legacy/backend/index.ts:1636-1655.
export const PUT = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { active?: boolean };
  if (!id) return error("Knowledge record is required.", 400);
  if (typeof body.active !== "boolean") return error("Active status is required.", 400);

  const current = await prisma.knowledgeRecord.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!current) return error("Knowledge record not found.", 404);

  const updated = await prisma.knowledgeRecord.update({ where: { id }, data: { isActive: body.active } });
  return json({ record: updated });
});
