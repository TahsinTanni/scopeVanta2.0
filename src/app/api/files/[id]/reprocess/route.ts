import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { storageRead } from "@/lib/storage";
import { aiGenerate, aiOcr } from "@/lib/ai";
import { structureKnowledge, knowledgeCategories, type KnowledgeRecordContent } from "@/lib/knowledge";

// POST /api/files/:id/reprocess — legacy/backend/index.ts:1318-1511.
// Preserves the "commit new facts before deleting the old ones" ordering so
// a failure partway through leaves existing knowledge untouched.
export const POST = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id: fileId } = await params;
  if (!fileId) return error("Knowledge file is required.", 400);

  const file = await prisma.knowledgeFile.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!file) return error("Knowledge file not found.", 404);

  const stored = await storageRead(file.storageKey);
  if (!stored?.content) return error("The original file is no longer available for reprocessing.", 410);

  let extractedText = "";
  let extractionMethod = "";
  let extractionError = "";
  try {
    if (/\.(txt|md)$/i.test(file.fileName)) {
      extractedText = Buffer.from(stored.content, "base64").toString("utf8").slice(0, 30000);
      if (!extractedText.trim() && file.extractedText) extractedText = file.extractedText.slice(0, 30000);
      extractionMethod = "text";
    } else if (/\.pdf$/i.test(file.fileName) || file.mimeType === "application/pdf") {
      const pdf = await aiGenerate({
        system:
          "You are a document transcription engine. Extract only text actually present in the supplied PDF. Preserve headings, lists, numbers and important table content. Do not summarize or infer facts.",
        prompt: "Transcribe the readable text in this PDF. Return plain text only.",
        images: [{ data: stored.content, mimeType: "application/pdf" }],
        maxTokens: 7600,
        temperature: 0,
      });
      extractedText = pdf.text.trim().slice(0, 30000);
      extractionMethod = "pdf-ai";
    } else if (
      /\.docx?$/i.test(file.fileName) ||
      file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimeType === "application/msword"
    ) {
      const word = await aiGenerate({
        system:
          "You are a document transcription engine. Extract only text actually present in the supplied Word document bytes. Preserve headings, lists, numbers and table content. Ignore archive metadata and binary noise. Return empty text if reliable document text cannot be recovered.",
        prompt: `Recover readable business-document text from ${file.fileName}. Base64 original bytes follow. Return plain text only.\n\n${stored.content}`,
        maxTokens: 7600,
        temperature: 0,
      });
      extractedText = word.text.trim().slice(0, 30000);
      if (!extractedText || extractedText.length < 20 || /^[A-Za-z0-9+/=\s]{100,}$/.test(extractedText)) extractedText = "";
      extractionMethod = file.fileName.toLowerCase().endsWith(".docx") ? "docx-ai" : "doc-ai";
    } else if (file.mimeType.startsWith("image/")) {
      const imageText = await aiOcr({
        system:
          "Transcribe only business-relevant text actually visible in the image. Preserve headings, labels, numbers and table-like content. Do not infer facts.",
        prompt: "Transcribe readable text for the private business knowledge base. Return plain text only.",
        images: [{ data: stored.content, mimeType: file.mimeType }],
        maxRetries: 2,
        maxTokens: 6000,
        temperature: 0,
      });
      extractedText = imageText.text.trim().slice(0, 30000);
      extractionMethod = "image-ocr";
    } else {
      return error("This stored file format cannot be reprocessed.", 400);
    }
  } catch (e) {
    console.warn("Knowledge reprocessing extraction failed", e);
    extractionError = "Reprocessing could not extract readable text from the original file.";
  }

  if (!extractedText.trim()) return error(extractionError || "No reliable readable text was found during reprocessing.", 422);

  let intelligence;
  try {
    intelligence = await structureKnowledge(extractedText, file.fileName);
  } catch (e) {
    console.warn("Knowledge reprocessing structuring failed", e);
    return error("Text was extracted, but structured knowledge could not be rebuilt. Existing knowledge was left unchanged.", 502);
  }

  const oldForFile = await prisma.knowledgeRecord.findMany({ where: { workspaceId: ctx.workspaceId, knowledgeFileId: fileId } });
  const activeByFact = new Map(
    oldForFile.map((v) => [`${v.category}\n${(v.content as KnowledgeRecordContent).fact}`.toLowerCase(), v.isActive]),
  );

  const records: { category: string; content: KnowledgeRecordContent; isActive: boolean }[] = [];
  for (const [key, label] of knowledgeCategories) {
    const values = intelligence[key];
    if (Array.isArray(values)) {
      for (const value of values.slice(0, 40)) {
        const fact = String(value || "").trim();
        if (fact) {
          const isActive = activeByFact.get(`${label}\n${fact}`.toLowerCase()) ?? true;
          records.push({ category: label, content: { fact: fact.slice(0, 3000), sourceFileName: file.fileName, documentType: intelligence.documentType }, isActive });
        }
      }
    }
  }

  const created = records.length
    ? await prisma.knowledgeRecord.createManyAndReturn({
        data: records.map((r) => ({ workspaceId: ctx.workspaceId, knowledgeFileId: fileId, category: r.category, content: r.content, isActive: r.isActive })),
      })
    : [];

  try {
    await prisma.knowledgeFile.update({
      where: { id: fileId },
      data: {
        status: "READY",
        extractedText,
        extractionMethod,
        extractionError: "",
        intelligence: intelligence as object,
        intelligenceStatus: "ready",
        intelligenceError: "",
      },
    });
  } catch (e) {
    if (created.length) await prisma.knowledgeRecord.deleteMany({ where: { id: { in: created.map((r) => r.id) } } });
    console.error("Reprocessing commit failed", e);
    return error("The reprocessed file could not be committed. Existing knowledge was left unchanged.", 500);
  }

  if (oldForFile.length) {
    await prisma.knowledgeRecord.deleteMany({ where: { id: { in: oldForFile.map((v) => v.id) } } });
  }

  return json({
    reprocessed: true,
    fileId,
    facts: records.length,
    extractedChars: extractedText.length,
    documentType: intelligence.documentType,
    cleanupPending: false,
  });
});
