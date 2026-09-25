import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { cancelSubscription } from "@/lib/square";

// POST /api/billing/cancel — Owner-only. Schedules cancellation in Square;
// Square keeps the subscription ACTIVE until canceled_date (end of the current
// billing cycle), then flips it to CANCELED, which the webhook / periodic
// re-verification pick up and requireEntitlement then refuses.
export const POST = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER"]);
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!sub?.squareSubscriptionId) return error("This workspace has no Square subscription to cancel.", 400);
  if (sub.status === "square_canceled") return error("This subscription is already canceled.", 409);

  try {
    const subscription = await cancelSubscription(sub.squareSubscriptionId);
    return json({ canceled: true, cancelsOn: subscription?.canceled_date || "" });
  } catch (e) {
    console.error("Square subscription cancel failed", e);
    return error("Square couldn't cancel the subscription. Please try again.", 502);
  }
});
