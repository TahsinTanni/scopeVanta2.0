import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// POST /api/analytics/event — legacy/backend/index.ts:1859-1893.
const ALLOWED = new Set([
  "workspace_loaded", "checkout_started", "billing_verified", "client_created",
  "knowledge_ready", "proposal_generated", "proposal_refined", "proposal_edited", "proposal_printed",
]);

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as { name?: string; context?: Record<string, unknown> };
  const name = String(b.name || "");
  if (!ALLOWED.has(name)) return error("Unsupported analytics event.", 400);

  const raw = b.context && typeof b.context === "object" ? b.context : {};
  const context: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw).slice(0, 12)) {
    if (typeof value === "string") context[key.slice(0, 60)] = value.slice(0, 160);
    else if (typeof value === "number" && Number.isFinite(value)) context[key.slice(0, 60)] = value;
    else if (typeof value === "boolean") context[key.slice(0, 60)] = value;
  }

  await prisma.analyticsEvent.create({ data: { workspaceId: ctx.workspaceId, userId: ctx.userId, eventName: name, context } });
  return json({ recorded: true });
});
