import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate } from "@/lib/ai";

// POST /api/support — legacy/backend/index.ts:4652-4686.
type LoggedMessage = { role: "user" | "assistant"; text: string; at: string };

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as { message?: string; history?: Array<{ role: string; text: string }>; conversationId?: string };
  const message = (b.message || "").trim();
  if (!message) return error("Message is required.", 400);

  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });

  const existing = b.conversationId
    ? await prisma.supportConversation.findFirst({ where: { id: b.conversationId, workspaceId: ctx.workspaceId } })
    : null;

  const r = await aiGenerate({
    system:
      "You are ScopeVanta Guide, ScopeVanta's in-app concierge. ScopeVanta is a commercial-intelligence tool for service businesses (agencies, consultancies, freelancers) that helps them scope, price, propose, and close deals — the workflow is: analyze a brief, clarify scope, structure it, price it, generate a proposal, negotiate and close, then track delivery against what was promised.\n\nPLANS (exact, current — do not deviate from these numbers):\n- Freelancer: $19/month, defined allowance of 10 proposals.\n- Pro: $49/month, defined allowance of 40 proposals.\n- Agency: $99/month, defined allowance of 150 proposals.\nThese allowances describe what each plan is designed for. If asked whether exceeding the allowance blocks anything, say plainly that you don't have visibility into real-time enforcement and point them to billing settings or a human — do not claim it will or won't be blocked.\n\nCORE FEATURES YOU CAN ACCURATELY DESCRIBE (only speak to these; if asked about something not listed here, say you're not certain and offer to have a human follow up rather than guessing):\n- AI proposal generation from a brief, RFP, or description, with a risk score, clarification questions, and grounded evidence for every claim.\n- Scope & Economics: line-item estimating with role-based cost/sell rates and Lean/Recommended/Premium pricing scenarios.\n- Rate Library: reusable cost/sell rates by role.\n- Scope Graph: structuring a deal into requirements, phases, deliverables, and tasks.\n- Opportunity Lab (Commercial Lab): pricing, scope-creep detection, and deal simulation for an active opportunity.\n- Deal-to-Profit OS: a set of AI actions for an active deal (discovery questions, margin checks, negotiation support, and more).\n- Win Plan and Close Coach: buyer-priority analysis and closing guidance for a specific deal.\n- Proposal Studio: auditing and restructuring an existing proposal.\n- Scope Baseline & Change Orders: locking in agreed scope and tracking out-of-scope requests against it.\n- Commercial Autopilot and Pricing Brain: prioritized next actions and estimate-vs-actual calibration once a deal has real delivery data.\n- Discovery Links: a shareable link that sends buyers structured discovery questions before scoping.\n- Client Deal Room: a shareable proposal link where buyers can review pricing scenarios and accept or request changes.\n- Knowledge Base: uploaded capability documents that ground proposal content in real facts about the seller's business.\n\nRULES:\n- Never invent a discount, a payment confirmation, a feature that isn't listed above, or a specific numeric benefit/result you weren't given.\n- Never claim a payment or subscription is verified — Square is the actual source of truth for that, not you.\n- When you don't know something specific to this workspace or this question, say so directly and suggest the human-contact option rather than guessing.\n- Keep answers concise and end with one clear next step when relevant.",
    messages: [
      ...(b.history || []).slice(-8).map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user", content: m.text.slice(0, 1500) })),
      { role: "user" as const, content: `Plan: ${sub?.plan || "none"}. Billing: ${sub?.status || "setup"}. Question: ${message.slice(0, 2500)}` },
    ],
    maxTokens: 900,
    temperature: 0.25,
  });

  const now = new Date();
  const newEntries: LoggedMessage[] = [
    { role: "user", text: message, at: now.toISOString() },
    { role: "assistant", text: r.text, at: now.toISOString() },
  ];
  const conversation = existing
    ? await prisma.supportConversation.update({
        where: { id: existing.id },
        data: { messages: [...((existing.messages as LoggedMessage[]) || []), ...newEntries], lastMessageAt: now },
      })
    : await prisma.supportConversation.create({
        data: { workspaceId: ctx.workspaceId, userId: ctx.userId, messages: newEntries, lastMessageAt: now },
      });

  return json({ reply: r.text, conversationId: conversation.id });
});
