import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { square, billingConfig, billingDateAdvanced, workspaceFromSubscription } from "@/lib/square";

// POST /api/square/webhook — legacy/backend/index.ts:594-767.
//
// The signature verification (timing-safe HMAC comparison) and event-ID
// dedupe are preserved logically per instructions. What changed: the
// customer/subscription-ownership model is now per-workspace (via
// workspaceFromSubscription, which reads Square's Customer.reference_id)
// instead of legacy's per-user-email `billing-owner:`/`billing-email:` KV
// lookups — see CLAUDE.md "Billing (Square)" and lib/square.ts.
export async function POST(req: Request) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!signatureKey) return error("Webhook signature verification is not configured.", 503);

  const signature = req.headers.get("x-square-hmacsha256-signature") || "";
  if (!signature) return error("Missing Square signature.", 403);

  const rawBody = await req.text();
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/square/webhook`;
  const expected = createHmac("sha256", signatureKey).update(notificationUrl + rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return error("Invalid Square signature.", 403);

  let event: { event_id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody || "{}");
  } catch {
    return error("Invalid Square event.", 400);
  }
  if (!event.event_id || !event.type) return error("Invalid Square event.", 400);

  const prior = await prisma.billingEvent.findUnique({ where: { squareEventId: event.event_id } });
  if (prior) return json({ received: true, duplicate: true });

  const object = event.data?.object || {};
  const embedded = (object.subscription || {}) as Record<string, unknown>;
  const invoice = (object.invoice || {}) as Record<string, unknown>;
  let subscriptionId = String(embedded.id || invoice.subscription_id || "");
  let subscription = embedded;
  if (subscriptionId) {
    try {
      const canonical = await square(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}`);
      subscription = (canonical.subscription || embedded) as Record<string, unknown>;
    } catch (e) {
      console.warn("Square webhook subscription retrieval failed", e);
    }
  }
  subscriptionId = String(subscription.id || subscriptionId);
  const status = String(subscription.status || "").toUpperCase();
  let entitlementUpdated = false;
  let ownerResolved = false;
  let resolvedWorkspaceId: string | null = null;

  if (subscriptionId && status) {
    try {
      const workspaceId = await workspaceFromSubscription(subscription);
      if (workspaceId) {
        ownerResolved = true;
        resolvedWorkspaceId = workspaceId;
        const current = await prisma.billingSubscription.findUnique({ where: { workspaceId } });
        if (current) {
          const active = status === "ACTIVE";
          const cfg = await billingConfig();
          const plan =
            (Object.entries(cfg.variations).find(([, id]) => id === String(subscription.plan_variation_id || ""))?.[0] as
              | "Freelancer"
              | "Pro"
              | "Agency"
              | undefined) || current.plan;
          const invoiceStatus = String(invoice.status || "").toUpperCase();
          const eventType = String(event.type || "").toLowerCase();
          const paymentFailure =
            invoiceStatus === "FAILED" ||
            invoiceStatus === "PAYMENT_FAILED" ||
            eventType.includes("payment.failed") ||
            eventType.includes("invoice.payment_failed");
          const chargedThroughDateStr = String(subscription.charged_through_date || current.chargedThroughDate?.toISOString() || "");
          const chargedThroughDate = chargedThroughDateStr ? new Date(chargedThroughDateStr) : null;
          const paymentRecovered =
            current.status === "payment_failed" && active && billingDateAdvanced(current.chargedThroughDate, chargedThroughDateStr);
          const paymentFailureLocked = paymentFailure || (current.status === "payment_failed" && !paymentRecovered);
          const action = paymentFailureLocked
            ? "update_payment"
            : active
              ? ""
              : status === "CANCELED"
                ? "resubscribe"
                : status === "PAUSED"
                  ? "resume_subscription"
                  : "verify_subscription";
          const startDate = String(subscription.start_date || "");
          const trialStart =
            current.trialStartedAt || (active && startDate ? new Date(`${startDate}T00:00:00.000Z`) : active ? new Date() : null);
          const trialEnd = current.trialEndsAt || (trialStart ? new Date(trialStart.getTime() + 30 * 86_400_000) : null);

          await prisma.billingSubscription.update({
            where: { workspaceId },
            data: {
              plan,
              status: paymentFailureLocked ? "payment_failed" : active ? "verified_active" : `square_${status.toLowerCase()}`,
              squareSubscriptionId: subscriptionId,
              verifiedAt: new Date(),
              trialStartedAt: trialStart,
              trialEndsAt: trialEnd,
              chargedThroughDate,
              billingAction: action,
              lastBillingEvent: String(event.type || ""),
            },
          });
          entitlementUpdated = true;
        }
      }
    } catch (e) {
      console.warn("Square webhook entitlement synchronization failed", e);
    }
  }

  await prisma.billingEvent.create({
    data: {
      workspaceId: resolvedWorkspaceId,
      squareEventId: event.event_id,
      eventType: String(event.type || ""),
      payload: { subscriptionId, status, ownerResolved, entitlementUpdated } as object,
    },
  });
  return json({ received: true, entitlementUpdated });
}
