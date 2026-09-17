import Anthropic from "@anthropic-ai/sdk";

// Replaces AppDeploy's `ai.generate` / `ai.extract` / `ai.ocr` / `ai.scrape`
// (legacy/backend/index.ts) with equivalent Anthropic API calls. Every
// caller in src/app/api/** preserves the legacy prompt/system text verbatim
// — only the transport changes here.
//
// Legacy `thinkingMode` was AppDeploy's own effort abstraction (NONE|FAST);
// none of the legacy calls used a deep-reasoning tier, so it has no
// equivalent here and is intentionally dropped rather than mapped onto
// Anthropic's `thinking` (extended thinking) parameter, which is for a
// different, heavier use case.
//
// `temperature` is accepted on every call site (~15 routes pass legacy's
// 0/0.12/0.15/0.2/0.25 values) but deliberately NOT forwarded to the API:
// this model rejects the parameter outright (400 invalid_request_error,
// "temperature is deprecated for this model") rather than clamping or
// ignoring it, confirmed by direct reproduction. Keeping the parameter in
// the function signature avoids touching every call site for a value that
// has no effect either way.
//
// System prompts are sent with `cache_control: ephemeral` — every route's
// system text is a large, fixed string (unlike the per-request prompt),
// so repeat calls to the same route within Anthropic's ~5 min cache TTL
// reuse it at roughly 1/10th the input-token cost instead of re-billing
// the full system prompt every time. This matters on metered API spend.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type ImageInput = { data: string; mimeType: string };

type GenerateArgs = {
  system: string;
  prompt?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  images?: ImageInput[];
  maxTokens: number;
  temperature: number;
  maxRetries?: number;
};

function imageBlocks(images?: ImageInput[]) {
  if (!images?.length) return [];
  return images.map((img) => {
    if (img.mimeType === "application/pdf") {
      return {
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: img.data },
      };
    }
    return {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: img.data,
      },
    };
  });
}

async function withRetries<T>(fn: () => Promise<T>, maxRetries = 0): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) continue;
    }
  }
  throw lastError;
}

/** Equivalent of legacy `ai.generate` — returns raw text; callers JSON.parse it themselves, matching legacy behavior. */
export async function aiGenerate(args: GenerateArgs): Promise<{ text: string }> {
  return withRetries(async () => {
    const userBlocks: Anthropic.Messages.ContentBlockParam[] = [
      ...imageBlocks(args.images),
      ...(args.prompt ? [{ type: "text" as const, text: args.prompt }] : []),
    ];
    const messages: Anthropic.Messages.MessageParam[] = args.messages?.length
      ? args.messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: "user", content: userBlocks }];
    const response = await anthropic().messages.create({
      model: MODEL,
      system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
      messages,
      max_tokens: Math.max(args.maxTokens || 4096, 16000),
      thinking: { type: "disabled" },
    });
    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text };
  }, args.maxRetries ?? 0);
}

/** Equivalent of legacy `ai.ocr` — vision transcription, text out. */
export async function aiOcr(args: GenerateArgs): Promise<{ text: string }> {
  return aiGenerate(args);
}

type ExtractArgs = {
  system: string;
  prompt: string;
  content: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  temperature: number;
  maxRetries?: number;
};

/** Equivalent of legacy `ai.extract` — forces structured output via tool-use against the given JSON schema. */
export async function aiExtract<T>(args: ExtractArgs): Promise<{ data: T }> {
  return withRetries(async () => {
    const response = await anthropic().messages.create({
      model: MODEL,
      system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `${args.prompt}\n\nDOCUMENT:\n${args.content}` }],
      max_tokens: Math.max(args.maxTokens || 4096, 16000),
      thinking: { type: "disabled" },
      tools: [
        {
          name: "extract",
          description: "Return the extracted structured knowledge.",
          input_schema: args.schema as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "extract" },
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) throw new Error("Extraction did not return structured data.");
    return { data: toolUse.input as T };
  }, args.maxRetries ?? 0);
}

/** Equivalent of legacy `ai.scrape` — plain HTTP fetch + tag-stripped text, no model call. */
export async function aiScrape(args: { url: string }): Promise<{ status: number; text: string }> {
  const response = await fetch(args.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ScopeVantaBot/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  const status = response.status;
  if (status >= 400) return { status, text: "" };
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return { status, text };
}

/** Strips the ```json fences legacy prompts sometimes elicit, before JSON.parse — mirrors the inline `.replace(...)` every legacy route does. */
export function stripJsonFence(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}
