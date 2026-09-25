import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { saveCardOnFile, setSubscriptionCard, SquareApiError } from "@/lib/square";
import { CARD_ERRORS } from "@/lib/billing";

// POST /api/billing/update-card — Owner-only. Body: { sourceId } (a Web
// Payments SDK card token). Saves the card on the workspace's Square customer
// and points the subscription's future charges at it. It does NOT pay an
// already-failed invoice — Square's APIs can't; the owner pays that on
// Square's hosted invoice page (see liveSubscriptionDetails).
export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER"]);
  const b = (await req.json().catch(() => ({}))) as { sourceId?: string };
  const sourceId = String(b.sourceId || "");
  if (!sourceId || sourceId.length > 512) return error("Card details are missing. Please re-enter your card.", 400);

  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!sub?.squareSubscriptionId || !sub.squareCustomerId) return error("This workspace has no Square subscription yet.", 400);

  try {
    const cardId = await saveCardOnFile(sub.squareCustomerId, sourceId);
    await setSubscriptionCard(sub.squareSubscriptionId, cardId);
    return json({ updated: true });
  } catch (e) {
    if (e instanceof SquareApiError && e.codes.some((c) => CARD_ERRORS.has(c))) {
      return error("Square couldn't accept this card. Check the details or try a different card.", 402);
    }
    console.error("Square card update failed", e);
    return error("Square couldn't update the card. Please try again.", 502);
  }
});
