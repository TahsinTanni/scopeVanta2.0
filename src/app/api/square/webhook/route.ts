import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { square, billingConfig, billingDateAdvanced, workspaceFromSubscription, SquareApiError } from "@/lib/square";
import { isUniqueConstraintError } from "@/lib/auth";
import { trialEndFrom } from "@/lib/plans";

// POST /api/square/webhook — legacy/backend/index.ts:594-767.
//
// The signature verification (timing-safe HMAC comparison) and event-ID
// dedupe are preserved logically per instructions. What changed: the
// customer/subscription-ownership model is now per-workspace (via
// workspaceFromSubscription, which reads Square's Customer.reference_id)
// instead of legacy's per-user-email `billing-owner:`/`billing-email:` KV
// lookups — see CLAUDE.md "Billing (Square)" and lib/square.ts.
//
// Delivery contract: Square treats any non-2xx response as a failed delivery
// and retries with exponential backoff for up to 24 hours (docs: "Webhooks
// overview" → retries). So a handling failure returns 500 WITHOUT saving the
// billing_events row, letting the retry run the handler again; the row is
// saved only once handling succeeded (or the event needed no action), and
// that row is what the dedupe check below skips on later deliveries.
function retryLater(stage: string, e: unknown) {
  console.error(`Square webhook ${stage} failed; returning 500 so Square retries`, e);
  return error("Webhook handling failed; Square will retry.", 500);
}

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
      // 404: Square has no such subscription, so there's nothing fresher to
      // read; carry on with the payload. Anything else is an outage: retry.
      if (!(e instanceof SquareApiError && e.status === 404)) return retryLater("subscription retrieval", e);
    }
  }
  subscriptionId = String(subscription.id || subscriptionId);
  const status = String(subscription.status || "").toUpperCase();
  // Square's only failed-charge signal for subscription billing is
  // invoice.scheduled_charge_failed ("Published when an automatic scheduled
  // payment for an Invoice has failed"), with data.object.invoice left UNPAID
  // and carrying subscription_id ("present only on subscription billing
  // invoices"). FAILED means Square canceled the invoice for suspicious
  // activity, not a declined charge. See developer.squareup.com/reference/
  // square/invoices-api/webhooks/invoice.scheduled_charge_failed.
  //
  // The invoice's status is re-read from Square rather than trusted from the
  // payload: a retried delivery can be up to 24h old, and a failure event that
  // arrives after the customer already paid must not lock them out. The same
  // re-read turns invoice.payment_made into the recovery signal.
  const eventType = String(event.type || "").toLowerCase();
  const invoiceId = String(invoice.id || "");
  let invoiceStatusNow = "";
  if (invoiceId && (eventType === "invoice.scheduled_charge_failed" || eventType === "invoice.payment_made")) {
    try {
      const fresh = await square(`/v2/invoices/${encodeURIComponent(invoiceId)}`);
      invoiceStatusNow = String((fresh.invoice as { status?: string } | undefined)?.status || "").toUpperCase();
    } catch (e) {
      // 404: the invoice is gone, so there's nothing owed to act on.
      if (!(e instanceof SquareApiError && e.status === 404)) return retryLater("invoice retrieval", e);
    }
  }
  const chargeFailed = eventType === "invoice.scheduled_charge_failed" && ["UNPAID", "PARTIALLY_PAID"].includes(invoiceStatusNow);
  const invoicePaid = eventType === "invoice.payment_made" && invoiceStatusNow === "PAID";
  let entitlementUpdated = false;
  let ownerResolved = false;
  let resolvedWorkspaceId: string | null = null;

  // A charge failure is still applied when the follow-up subscription read
  // found nothing (no status): the workspace is found from invoice.subscription_id.
  if (subscriptionId && (status || chargeFailed)) {
    try {
      const workspaceId = await workspaceFromSubscription({ ...subscription, id: subscriptionId });
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
          const paymentFailure = chargeFailed;
          const chargedThroughDateStr = String(subscription.charged_through_date || current.chargedThroughDate?.toISOString() || "");
          const chargedThroughDate = chargedThroughDateStr ? new Date(chargedThroughDateStr) : null;
          const paymentRecovered =
            current.status === "payment_failed" &&
            (invoicePaid || (active && billingDateAdvanced(current.chargedThroughDate, chargedThroughDateStr)));
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
          const trialEnd = current.trialEndsAt || (trialStart ? trialEndFrom(trialStart) : null);

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
      // A 404 here is workspaceFromSubscription finding no such Square
      // customer — nothing of ours to update, so acknowledge it below.
      if (!(e instanceof SquareApiError && e.status === 404)) return retryLater("entitlement synchronization", e);
    }
  }

  // Reached on success AND on "nothing to do" (no subscription on the event,
  // unknown workspace, no billing row) — both are acknowledged with 200.
  try {
    await prisma.billingEvent.create({
      data: {
        workspaceId: resolvedWorkspaceId,
        squareEventId: event.event_id,
        eventType: String(event.type || ""),
        payload: { subscriptionId, status, ownerResolved, entitlementUpdated } as object,
      },
    });
  } catch (e) {
    // A concurrent delivery of the same event finished first and saved the
    // row; our update was the same idempotent write, so this is a duplicate.
    if (isUniqueConstraintError(e)) return json({ received: true, duplicate: true });
    return retryLater("event recording", e);
  }
  return json({ received: true, entitlementUpdated });
}
