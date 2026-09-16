import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { storageWrite, storageDelete } from "@/lib/storage";
import { aiGenerate, aiOcr } from "@/lib/ai";
import { structureKnowledge, knowledgeCategories } from "@/lib/knowledge";

// POST /api/upload — legacy/backend/index.ts:1034-1270. File-extraction
// logic (txt/md decode, PDF/Word via AI transcription, image OCR, knowledge
// structuring) preserved verbatim; storage.write/url replaced with Vercel
// Blob (lib/storage.ts), and the per-user `files:{userId}` /
// `knowledge:{userId}` tables replaced with workspace-scoped Prisma tables.

type UploadBody = { name?: string; type?: string; content?: string; kind?: "logo" | "reference" | "client_logo"; clientId?: string };

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as UploadBody;
  if (!b.content || !b.name || !b.kind) return error("Missing file.", 400);
  if (b.kind === "client_logo" && !b.clientId) return error("Choose a saved client before uploading a client logo.", 400);
  if (b.content.length > 7_200_000) return error("File is too large.", 400);
  if (b.kind === "logo") requireRole(ctx, ["OWNER", "ADMIN"]);

  const safe = b.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const path = `workspaces/${ctx.workspaceId}/${b.kind}/${Date.now()}-${safe}`;
  const contentType = b.type || "application/octet-stream";
  const url = await storageWrite(path, b.content, contentType);

  let fileId: string | undefined;
  let status: "ready" | "stored" | "failed" = "stored";
  let extractedText = "";
  let extractionMethod = "";
  let extractionError = "";
  let intelligence: Awaited<ReturnType<typeof structureKnowledge>> | undefined;
  let intelligenceStatus: "ready" | "failed" | undefined;
  let intelligenceError = "";

  if (b.kind === "logo") {
    await prisma.companyProfile.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, logoPath: url },
      update: { logoPath: url },
    });
  } else if (b.kind === "client_logo") {
    const client = await prisma.client.findFirst({ where: { id: String(b.clientId), workspaceId: ctx.workspaceId } });
    if (!client) {
      await storageDelete(url);
      return error("Saved client not found.", 404);
    }
    const previousUrl = client.logoUrl;
    await prisma.client.update({ where: { id: client.id }, data: { logoUrl: url } });
    if (previousUrl && previousUrl !== url) await storageDelete(previousUrl);
  } else {
    if (/\.(txt|md)$/i.test(safe)) {
      try {
        extractedText = Buffer.from(b.content, "base64").toString("utf8").slice(0, 30000);
        status = extractedText.trim() ? "ready" : "failed";
        extractionMethod = "text";
        if (status === "failed") extractionError = "No readable text was found.";
      } catch {
        status = "failed";
        extractionError = "Text extraction failed.";
      }
    } else if (/\.pdf$/i.test(safe) || contentType === "application/pdf") {
      try {
        const pdf = await aiGenerate({
          system:
            "You are a document transcription engine. Extract only text that is actually present in the supplied PDF. Preserve headings, lists, numbers and important table content. Do not summarize, infer, correct, embellish or add facts. If text is unreadable, omit it.",
          prompt: "Transcribe the readable text in this PDF for a private business knowledge base. Return plain text only.",
          images: [{ data: b.content, mimeType: "application/pdf" }],
          maxTokens: 7600,
          temperature: 0,
        });
        extractedText = pdf.text.trim().slice(0, 30000);
        status = extractedText ? "ready" : "failed";
        extractionMethod = "pdf-ai";
        if (status === "failed") extractionError = "No readable PDF text was found.";
      } catch (e) {
        console.warn("PDF extraction unavailable", e);
        status = "failed";
        extractionMethod = "pdf-ai";
        extractionError = "PDF text extraction failed. The original file is still stored.";
      }
    } else if (
      /\.docx?$/i.test(safe) ||
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/msword"
    ) {
      try {
        const word = await aiGenerate({
          system:
            "You are a document transcription engine. Extract only text that is actually present in the supplied Word document bytes. Preserve headings, lists, numbers and important table content. Do not summarize, infer, correct, embellish or add facts. Ignore archive metadata and binary noise. If meaningful document text cannot be recovered, return an empty response.",
          prompt: `Recover the readable business-document text from this ${safe.toLowerCase().endsWith(".docx") ? "DOCX" : "DOC"} file. The following is a base64 representation of the original file bytes. Return plain document text only.\n\n${b.content}`,
          maxTokens: 7600,
          temperature: 0,
        });
        extractedText = word.text.trim().slice(0, 30000);
        const suspicious = !extractedText || extractedText.length < 20 || /^[A-Za-z0-9+/=\s]{100,}$/.test(extractedText);
        status = suspicious ? "failed" : "ready";
        extractionMethod = safe.toLowerCase().endsWith(".docx") ? "docx-ai" : "doc-ai";
        if (status === "failed") {
          extractedText = "";
          extractionError = "No reliable readable Word document text was recovered.";
        }
      } catch (e) {
        console.warn("Word extraction unavailable", e);
        status = "failed";
        extractionMethod = safe.toLowerCase().endsWith(".docx") ? "docx-ai" : "doc-ai";
        extractionError = "Word document text extraction failed. The original file is still stored.";
      }
    } else if (contentType.startsWith("image/")) {
      try {
        const imageText = await aiOcr({
          system:
            "You are a document transcription engine. Transcribe only business-relevant text that is actually visible in the supplied image. Preserve headings, labels, numbers and table-like content. Do not summarize, infer, correct, embellish or add facts.",
          prompt: "Transcribe the readable text in this image for a private business knowledge base. Return plain text only.",
          images: [{ data: b.content, mimeType: contentType }],
          maxRetries: 2,
          maxTokens: 6000,
          temperature: 0,
        });
        extractedText = imageText.text.trim().slice(0, 30000);
        status = extractedText ? "ready" : "failed";
        extractionMethod = "image-ocr";
        if (status === "failed") extractionError = "No readable text was found in the image.";
      } catch (e) {
        console.warn("Image OCR unavailable", e);
        status = "failed";
        extractionMethod = "image-ocr";
        extractionError = "Image text extraction failed. The original file is still stored.";
      }
    }

    if (status === "ready" && extractedText.trim()) {
      try {
        intelligence = await structureKnowledge(extractedText, safe);
        intelligenceStatus = "ready";
      } catch (e) {
        console.warn("Knowledge structuring unavailable", e);
        intelligenceStatus = "failed";
        intelligenceError = "The file text is ready, but structured knowledge could not be created.";
      }
    }

    const created = await prisma.knowledgeFile.create({
      data: {
        workspaceId: ctx.workspaceId,
        uploadedByUserId: ctx.userId,
        fileName: safe,
        storageKey: url,
        mimeType: contentType,
        sizeBytes: Math.round((b.content.length * 3) / 4),
        status: status === "ready" ? "READY" : status === "failed" ? "FAILED" : "STORED",
        extractedText,
        extractionMethod,
        extractionError,
        intelligence: intelligence as object | undefined,
        intelligenceStatus,
        intelligenceError,
      },
    });
    fileId = created.id;

    if (fileId && intelligenceStatus === "ready" && intelligence) {
      const records: { category: string; content: object }[] = [];
      for (const [key, label] of knowledgeCategories) {
        const values = intelligence[key];
        if (Array.isArray(values)) {
          for (const value of values.slice(0, 40)) {
            const fact = String(value || "").trim();
            if (fact) records.push({ category: label, content: { fact: fact.slice(0, 3000), sourceFileName: safe, documentType: intelligence.documentType } });
          }
        }
      }
      if (records.length) {
        await prisma.knowledgeRecord.createMany({
          data: records.map((r) => ({ workspaceId: ctx.workspaceId, knowledgeFileId: fileId!, category: r.category, content: r.content })),
        });
      }
    }
  }

  return json({
    url,
    name: safe,
    id: fileId,
    status,
    extractedChars: extractedText.length,
    error: extractionError,
    intelligenceStatus,
    intelligenceSummary: intelligence?.summary || "",
    documentType: intelligence?.documentType || "",
  });
});
