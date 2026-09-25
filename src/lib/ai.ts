import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { assertFeatureEnabled } from "@/lib/flags";
import { safeFetchText } from "@/lib/safe-fetch";
import { HttpError } from "@/lib/http";

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

/**
 * Who a call is for. Required on every call so usage is attributable per
 * workspace in the admin panel, and so the "ai" feature switch (global or
 * per-workspace) is enforced in this one place rather than in each route.
 */
export type AiTrack = { workspaceId: string; userId?: string | null; feature: string };

async function recordUsage(track: AiTrack, startedAt: number, usage: Anthropic.Messages.Usage | null, err?: unknown) {
  try {
    await prisma.aiUsageEvent.create({
      data: {
        workspaceId: track.workspaceId,
        userId: track.userId ?? null,
        feature: track.feature,
        model: MODEL,
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
        cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
        success: !err,
        errorMessage: err ? String(err instanceof Error ? err.message : err).slice(0, 500) : null,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (e) {
    // Usage logging must never break the customer's request.
    console.error("AI usage logging failed", e);
  }
}

// Abuse/cost ceilings, counted from ai_usage_events (so no extra infra).
// Generous for real use; they exist so one workspace, or one free signup
// hammering support, can't run up an unbounded Anthropic bill.
const AI_DAILY_CALL_LIMIT = Number(process.env.AI_DAILY_CALL_LIMIT) || 300;
const AI_SUPPORT_HOURLY_LIMIT = Number(process.env.AI_SUPPORT_HOURLY_LIMIT) || 30;

/**
 * Throws 429 once a workspace has made AI_DAILY_CALL_LIMIT calls in the last
 * 24 hours, or a user has sent AI_SUPPORT_HOURLY_LIMIT support messages in the
 * last hour. Routes call it before their AI work so the owner sees this
 * message (their catch blocks would otherwise turn it into a generic error);
 * trackedCall re-checks every call as a backstop.
 */
export async function assertAiQuota(track: { workspaceId: string; userId?: string | null; feature?: string }) {
  const lastDay = await prisma.aiUsageEvent.count({
    where: { workspaceId: track.workspaceId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (lastDay >= AI_DAILY_CALL_LIMIT) {
    throw new HttpError("This workspace has reached its daily AI limit. It frees up gradually over the next 24 hours — contact support if you need more.", 429);
  }
  if (track.feature === "support" && track.userId) {
    const lastHour = await prisma.aiUsageEvent.count({
      where: { workspaceId: track.workspaceId, userId: track.userId, feature: "support", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (lastHour >= AI_SUPPORT_HOURLY_LIMIT) {
      throw new HttpError("You've sent a lot of support messages in the last hour. Please wait a little, or email support.", 429);
    }
  }
}

/** Runs one Anthropic call behind the "ai" feature switch and usage limits, and logs its token usage. */
async function trackedCall(track: AiTrack, call: () => Promise<Anthropic.Messages.Message>) {
  await assertFeatureEnabled("ai", track.workspaceId);
  await assertAiQuota(track);
  const startedAt = Date.now();
  try {
    const response = await call();
    await recordUsage(track, startedAt, response.usage);
    return response;
  } catch (e) {
    await recordUsage(track, startedAt, null, e);
    throw e;
  }
}

type GenerateArgs = {
  system: string;
  prompt?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  images?: ImageInput[];
  maxTokens: number;
  temperature: number;
  maxRetries?: number;
  track: AiTrack;
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
    const response = await trackedCall(args.track, () =>
      anthropic().messages.create({
        model: MODEL,
        system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
        messages,
        max_tokens: Math.max(args.maxTokens || 4096, 16000),
        thinking: { type: "disabled" },
      }),
    );
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
  track: AiTrack;
};

/** Equivalent of legacy `ai.extract` — forces structured output via tool-use against the given JSON schema. */
export async function aiExtract<T>(args: ExtractArgs): Promise<{ data: T }> {
  return withRetries(async () => {
    const response = await trackedCall(args.track, () =>
      anthropic().messages.create({
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
      }),
    );
    const toolUse = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) throw new Error("Extraction did not return structured data.");
    return { data: toolUse.input as T };
  }, args.maxRetries ?? 0);
}

/**
 * Equivalent of legacy `ai.scrape` — HTTP fetch + tag-stripped text, no model
 * call. Goes through safeFetchText because the URL is customer-supplied:
 * public addresses only, capped size and redirects (see lib/safe-fetch.ts).
 */
export async function aiScrape(args: { url: string }): Promise<{ status: number; text: string }> {
  const { status, text: html } = await safeFetchText(args.url, {
    userAgent: "Mozilla/5.0 (compatible; ScopeVantaBot/1.0)",
    timeoutMs: 10_000,
  });
  if (status >= 400) return { status, text: "" };
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

/**
 * Escapes raw control characters (line breaks, tabs, …) that appear inside
 * JSON string literals. Models sometimes emit a literal newline inside a long
 * string value, which is invalid JSON ("Bad control character in string
 * literal") even though the content is otherwise fine.
 */
function escapeControlCharsInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      escaped = false;
      out += ch;
    } else if (ch === "\\") {
      escaped = true;
      out += ch;
    } else if (ch === '"') {
      inString = false;
      out += ch;
    } else if (ch < " ") {
      out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Parses a model's JSON reply: strips code fences, and repairs raw control characters inside strings if needed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same contract as JSON.parse, which these callers used before
export function parseModelJson<T = any>(text: string): T {
  const cleaned = stripJsonFence(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return JSON.parse(escapeControlCharsInStrings(cleaned)) as T;
  }
}

