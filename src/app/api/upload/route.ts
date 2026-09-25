import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors, HttpError } from "@/lib/http";
import { requireEntitlement } from "@/lib/billing";
import { assertFeatureEnabled } from "@/lib/flags";
import { storageWrite, storageDelete } from "@/lib/storage";
import { aiGenerate, aiOcr } from "@/lib/ai";
import { structureKnowledge, knowledgeCategories } from "@/lib/knowledge";

// AI calls can take well over a minute; don't let the platform default cut them off.
export const maxDuration = 300;

// POST /api/upload — legacy/backend/index.ts:1034-1270. File-extraction
// logic (txt/md decode, PDF/Word via AI transcription, image OCR, knowledge
// structuring) preserved verbatim; storage.write/url replaced with Vercel
// Blob (lib/storage.ts), and the per-user `files:{userId}` /
// `knowledge:{userId}` tables replaced with workspace-scoped Prisma tables.

type UploadBody = { name?: string; type?: string; content?: string; kind?: "logo" | "reference" | "client_logo"; clientId?: string };

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  await assertFeatureEnabled("uploads", ctx.workspaceId);
  const b = (await req.json().catch(() => ({}))) as UploadBody;
  if (!b.content || !b.name || !b.kind) return error("Missing file.", 400);
  if (b.kind === "client_logo" && !b.clientId) return error("Choose a saved client before uploading a client logo.", 400);
  if (b.content.length > 7_200_000) return error("File is too large.", 400);
  if (b.kind === "logo") requireRole(ctx, ["OWNER", "ADMIN"]);
  // Logos are stored only; every other kind goes through paid AI extraction.
  // Without entitlement (e.g. onboarding, before checkout) the document is
  // still stored, as STORED with no AI run; /api/files/:id/reprocess — gated
  // by the same check — processes it once the subscription is active.
  let processingDeferred = false;
  if (b.kind !== "logo" && b.kind !== "client_logo") {
    try {
      await requireEntitlement(ctx.workspaceId, "processing uploaded documents");
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 402)) throw e;
      processingDeferred = true;
    }
  }

  const safe = b.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const path = `workspaces/${ctx.workspaceId}/${b.kind}/${Date.now()}-${safe}`;
  const contentType = b.type || "application/octet-stream";
  // Logos are shown on buyer-facing pages, so they're public; every other
  // upload is a knowledge document and goes to private storage.
  const isLogo = b.kind === "logo" || b.kind === "client_logo";
  const url = await storageWrite(path, b.content, contentType, isLogo ? "public" : "private");

  let fileId: string | undefined;
  let status: "ready" | "stored" | "failed" = "stored";
  let extractedText = "";
  let extractionMethod = "";
  let extractionError = "";
  let truncated = false;
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
    if (processingDeferred) {
      extractionError = "Stored, not processed yet: an active subscription is required. Use Reprocess once your subscription is active.";
    } else if (/\.(txt|md)$/i.test(safe)) {
      try {
        const raw = Buffer.from(b.content, "base64").toString("utf8");
        truncated = raw.length > 30000;
        extractedText = raw.slice(0, 30000);
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
          track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "file-upload" },
          system:
            "You are a document transcription engine. Extract only text that is actually present in the supplied PDF. Preserve headings, lists, numbers and important table content. Do not summarize, infer, correct, embellish or add facts. If text is unreadable, omit it.",
          prompt: "Transcribe the readable text in this PDF for a private business knowledge base. Return plain text only.",
          images: [{ data: b.content, mimeType: "application/pdf" }],
          maxTokens: 7600,
          temperature: 0,
        });
        const pdfText = pdf.text.trim();
        truncated = pdfText.length > 30000;
        extractedText = pdfText.slice(0, 30000);
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
          track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "file-upload" },
          system:
            "You are a document transcription engine. Extract only text that is actually present in the supplied Word document bytes. Preserve headings, lists, numbers and important table content. Do not summarize, infer, correct, embellish or add facts. Ignore archive metadata and binary noise. If meaningful document text cannot be recovered, return an empty response.",
          prompt: `Recover the readable business-document text from this ${safe.toLowerCase().endsWith(".docx") ? "DOCX" : "DOC"} file. The following is a base64 representation of the original file bytes. Return plain document text only.\n\n${b.content}`,
          maxTokens: 7600,
          temperature: 0,
        });
        const wordText = word.text.trim();
        truncated = wordText.length > 30000;
        extractedText = wordText.slice(0, 30000);
        const suspicious = !extractedText || extractedText.length < 20 || /^[A-Za-z0-9+/=\s]{100,}$/.test(extractedText);
        status = suspicious ? "failed" : "ready";
        extractionMethod = safe.toLowerCase().endsWith(".docx") ? "docx-ai" : "doc-ai";
        if (status === "failed") {
          extractedText = "";
          truncated = false;
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
          track: { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "file-upload" },
          system:
            "You are a document transcription engine. Transcribe only business-relevant text that is actually visible in the supplied image. Preserve headings, labels, numbers and table-like content. Do not summarize, infer, correct, embellish or add facts.",
          prompt: "Transcribe the readable text in this image for a private business knowledge base. Return plain text only.",
          images: [{ data: b.content, mimeType: contentType }],
          maxRetries: 2,
          maxTokens: 6000,
          temperature: 0,
        });
        const ocrText = imageText.text.trim();
        truncated = ocrText.length > 30000;
        extractedText = ocrText.slice(0, 30000);
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
        intelligence = await structureKnowledge(extractedText, safe, { workspaceId: ctx.workspaceId, userId: ctx.userId, feature: "file-upload.structure" });
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
        truncated,
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
    // Only logos need their URL in the browser; a document's storage URL
    // never leaves the server.
    url: isLogo ? url : undefined,
    name: safe,
    id: fileId,
    status,
    processingDeferred,
    extractedChars: extractedText.length,
    error: extractionError,
    truncated,
    intelligenceStatus,
    intelligenceSummary: intelligence?.summary || "",
    documentType: intelligence?.documentType || "",
  });
});

// DELETE /api/upload — removes a logo. Body: { kind: "logo" } (Owner/Admin,
// same as uploading one) or { kind: "client_logo", clientId }. Knowledge
// documents are removed with DELETE /api/files/:id instead. Logos are always
// read live from the profile/client row (no share page keeps a copy of the
// URL), so the blob is deleted too.
export const DELETE = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as { kind?: string; clientId?: string };

  if (b.kind === "logo") {
    requireRole(ctx, ["OWNER", "ADMIN"]);
    const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
    if (profile?.logoPath) {
      await prisma.companyProfile.update({ where: { workspaceId: ctx.workspaceId }, data: { logoPath: null } });
      await storageDelete(profile.logoPath);
    }
    return json({ removed: true });
  }

  if (b.kind === "client_logo") {
    const client = await prisma.client.findFirst({ where: { id: String(b.clientId || ""), workspaceId: ctx.workspaceId } });
    if (!client) return error("Saved client not found.", 404);
    if (client.logoUrl) {
      await prisma.client.update({ where: { id: client.id }, data: { logoUrl: null } });
      await storageDelete(client.logoUrl);
    }
    return json({ removed: true });
  }

  return error("Choose which logo to remove.", 400);
});
