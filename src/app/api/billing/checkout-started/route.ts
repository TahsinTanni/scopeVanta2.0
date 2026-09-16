import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing } from "@/lib/billing";
import { createCheckout } from "@/lib/square";

// POST /api/billing/checkout-started — legacy/backend/index.ts:925-962.
// Owner-only per CLAUDE.md ("Billing (Square)": only the Owner role can
// view billing status or change plan/checkout) — legacy had no role model.
export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER"]);
  const companyProfile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!companyProfile) return error("Complete profile first.", 400);
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });

  const b = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = (["Freelancer", "Pro", "Agency"].includes(String(b.plan)) ? String(b.plan) : sub?.plan || "Freelancer") as
    | "Freelancer"
    | "Pro"
    | "Agency";

  if (sub?.status === "verified_active" && sub.squareSubscriptionId) {
    return error(
      "An active Square subscription is already linked to this workspace. To avoid duplicate billing, change or cancel that subscription in Square before starting a new plan checkout.",
      409,
    );
  }

  try {
    const checkout = await createCheckout(ctx.workspaceId, ctx.email, plan);
    const updated = await prisma.billingSubscription.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, plan, checkoutStartedAt: new Date(), status: "awaiting_square_confirmation" },
      update: { plan, checkoutStartedAt: new Date(), status: "awaiting_square_confirmation" },
    });
    return json({ billing: billing(updated), checkoutUrl: checkout.url });
  } catch (e) {
    console.error("Square checkout setup failed", e);
    return error("Square checkout could not be prepared. Please try again.", 502);
  }
});
