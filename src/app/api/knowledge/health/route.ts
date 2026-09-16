import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";
import { storageRead } from "@/lib/storage";
import type { KnowledgeRecordContent } from "@/lib/knowledge";

// GET /api/knowledge/health — legacy/backend/index.ts:1581-1635.
// Orphan detection is structurally simpler here than in legacy: the FK
// (knowledgeFileId, onDelete: SetNull) means a record whose source file was
// deleted already has knowledgeFileId = null, rather than needing to
// cross-reference an id that no longer exists in a separate files list.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const [files, knowledge] = await Promise.all([
    prisma.knowledgeFile.findMany({ where: { workspaceId: ctx.workspaceId }, take: 30 }),
    prisma.knowledgeRecord.findMany({ where: { workspaceId: ctx.workspaceId }, take: 200 }),
  ]);

  const orphanFacts = knowledge.filter((v) => !v.knowledgeFileId);
  const duplicateKeys = new Map<string, number>();
  for (const fact of knowledge) {
    const content = fact.content as KnowledgeRecordContent;
    const key = `${fact.knowledgeFileId}\n${fact.category}\n${content.fact}`.toLowerCase();
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
  }
  const duplicateFacts = Array.from(duplicateKeys.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const failedFiles = files.filter((v) => v.status === "FAILED" || v.intelligenceStatus === "failed");

  const missingOriginals: string[] = [];
  for (const file of files) {
    const read = await storageRead(file.storageKey);
    if (!read?.content) missingOriginals.push(file.fileName);
  }

  const issues = orphanFacts.length + duplicateFacts + failedFiles.length + missingOriginals.length;
  return json({
    healthy: issues === 0,
    checkedAt: new Date().toISOString(),
    files: files.length,
    facts: knowledge.length,
    activeFacts: knowledge.filter((v) => v.isActive).length,
    issues: {
      orphanFacts: orphanFacts.length,
      duplicateFacts,
      failedFiles: failedFiles.length,
      missingOriginals: missingOriginals.length,
    },
    missingOriginalFiles: missingOriginals.slice(0, 10),
    recommendation:
      issues === 0
        ? "Knowledge integrity checks passed."
        : "Review failed files, reprocess recoverable sources, and delete sources whose originals are missing.",
  });
});
