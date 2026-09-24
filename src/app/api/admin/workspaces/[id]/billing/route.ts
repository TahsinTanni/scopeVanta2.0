import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import type { BillingPlan } from "@/generated/prisma/enums";

const PLANS: BillingPlan[] = ["Freelancer", "Pro", "Agency"];

// POST /api/admin/workspaces/:id/billing
// { compPlan?, compNote?, plan?, limitOverride? (number | null), extendTrialDays? }
// Changes ScopeVanta's own billing record only; Square stays the source of
// truth for real charges (see CLAUDE.md "Billing (Square)").
export const POST = adminRoute<{ id: string }>(
  "billing.manage",
  async (ctx, req, { id }) => {
    const b = (await req.json().catch(() => ({}))) as {
      compPlan?: boolean;
      compNote?: string | null;
      plan?: string;
      limitOverride?: number | null;
      extendTrialDays?: number;
    };
    const ws = await prisma.workspace.findUnique({ where: { id }, include: { billingSubscription: true } });
    if (!ws) return error("Workspace not found.", 404);
    const before = ws.billingSubscription;

    const data: {
      compPlan?: boolean;
      compNote?: string | null;
      plan?: BillingPlan;
      limitOverride?: number | null;
      trialEndsAt?: Date;
    } = {};
    if (b.compPlan !== undefined) {
      if (typeof b.compPlan !== "boolean") return error("compPlan must be true or false.");
      const note = (b.compNote || "").trim().slice(0, 300);
      if (b.compPlan && note.length < 3) return error("Add a short note explaining the free plan.");
      data.compPlan = b.compPlan;
      data.compNote = b.compPlan ? note : null;
    }
    if (b.plan !== undefined) {
      if (!PLANS.includes(b.plan as BillingPlan)) return error("Unknown plan.");
      data.plan = b.plan as BillingPlan;
    }
    if (b.limitOverride !== undefined) {
      if (b.limitOverride !== null && (!Number.isInteger(b.limitOverride) || b.limitOverride < 0 || b.limitOverride > 1_000_000)) {
        return error("Limit override must be a whole number between 0 and 1,000,000, or empty.");
      }
      data.limitOverride = b.limitOverride;
    }
    if (b.extendTrialDays !== undefined) {
      const days = Number(b.extendTrialDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) return error("Extend the trial by 1–365 days.");
      const base = before?.trialEndsAt && before.trialEndsAt > new Date() ? before.trialEndsAt : new Date();
      data.trialEndsAt = new Date(base.getTime() + days * 86_400_000);
    }
    if (!Object.keys(data).length) return error("Nothing to change.");

    const updated = await prisma.billingSubscription.upsert({
      where: { workspaceId: id },
      create: { workspaceId: id, ...data },
      update: data,
    });
    await logAdminAction(ctx, "workspace.billing.update", {
      targetType: "workspace",
      targetId: id,
      workspaceId: id,
      details: {
        changes: JSON.parse(JSON.stringify(data)),
        before: before
          ? { compPlan: before.compPlan, compNote: before.compNote, plan: before.plan, limitOverride: before.limitOverride, trialEndsAt: before.trialEndsAt }
          : null,
      },
    });
    return json({ ok: true, compPlan: updated.compPlan });
  },
  { reverify: true },
);
