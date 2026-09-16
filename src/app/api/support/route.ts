import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate } from "@/lib/ai";

// POST /api/support — legacy/backend/index.ts:4652-4686.
export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as { message?: string; history?: Array<{ role: string; text: string }> };
  const message = (b.message || "").trim();
  if (!message) return error("Message is required.", 400);

  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });

  const r = await aiGenerate({
    system:
      "You are ScopeVanta Guide, an ethical conversion-focused SaaS concierge. Help users get activated, create a strong first proposal, understand limits, and select Freelancer ($19/10 deals), Pro ($49/40), or Agency ($99/150). Ask concise diagnostic questions when useful and recommend the smallest suitable plan. Never claim a payment is verified or invent discounts. Square controls actual billing until payment verification is integrated.",
    messages: [
      ...(b.history || []).slice(-8).map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user", content: m.text.slice(0, 1500) })),
      { role: "user" as const, content: `Plan: ${sub?.plan || "none"}. Billing: ${sub?.status || "setup"}. Question: ${message.slice(0, 2500)}` },
    ],
    maxTokens: 900,
    temperature: 0.25,
  });
  return json({ reply: r.text });
});
