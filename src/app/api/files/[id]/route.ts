import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { storageDelete } from "@/lib/storage";

// DELETE /api/files/:id — legacy/backend/index.ts:1512-1559.
export const DELETE = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id: fileId } = await params;
  if (!fileId) return error("Knowledge file is required.", 400);

  const file = await prisma.knowledgeFile.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!file) return error("Knowledge file not found.", 404);

  const storageDeleted = await storageDelete(file.storageKey);
  if (!storageDeleted) return error("The stored original could not be deleted, so no knowledge records were removed.", 500);

  const sourceRecords = await prisma.knowledgeRecord.findMany({ where: { workspaceId: ctx.workspaceId, knowledgeFileId: fileId } });
  if (sourceRecords.length) {
    await prisma.knowledgeRecord.deleteMany({ where: { id: { in: sourceRecords.map((r) => r.id) } } });
  }
  await prisma.knowledgeFile.delete({ where: { id: fileId } });

  return json({ deleted: true, fileId, removedFacts: sourceRecords.length, preservedProposalHistory: true });
});
