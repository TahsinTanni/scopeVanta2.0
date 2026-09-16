import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";
import type { KnowledgeIntelligence } from "@/lib/knowledge";

// GET /api/files — legacy/backend/index.ts:1271-1317.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const items = await prisma.knowledgeFile.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return json({
    files: items.map((f) => {
      const intelligence = f.intelligence as KnowledgeIntelligence | null;
      return {
        id: f.id,
        name: f.fileName,
        type: f.mimeType,
        createdAt: f.createdAt.toISOString(),
        status: f.status.toLowerCase(),
        extractedChars: (f.extractedText || "").length,
        error: f.extractionError || "",
        intelligenceStatus: f.intelligenceStatus,
        intelligenceError: f.intelligenceError || "",
        documentType: intelligence?.documentType || "",
        summary: intelligence?.summary || "",
        knowledgeCounts: intelligence
          ? {
              services: intelligence.services.length,
              differentiators: intelligence.differentiators.length,
              deliverables: intelligence.deliverables.length,
              pricing: intelligence.pricingEvidence.length,
              proof: intelligence.proofPoints.length,
              constraints: intelligence.constraints.length,
            }
          : undefined,
      };
    }),
  });
});
