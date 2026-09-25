import { prisma } from "@/lib/prisma";
import type { BillingSubscription } from "@/generated/prisma/client";
import { verifyEntitlement, billingDateAdvanced } from "@/lib/square";
import { trialEndFrom } from "@/lib/plans";

/**
 * Re-reads a workspace's subscription from Square (by its stored Square IDs,
 * never by email) and writes the result to billing_subscriptions. Shared by
 * the owner's "Sync with Square" button (/api/billing/sync) and the admin
 * panel's resync action. Returns null when Square has no matching
 * subscription. Throws if Square can't be reached.
 */
export async function syncSquareSubscription(
  workspaceId: string,
  sub: BillingSubscription | null,
): Promise<{ active: boolean; paymentFailureLocked: boolean; status: string; plan: string; updated: BillingSubscription } | null> {
  const verified = await verifyEntitlement(workspaceId);
  if (!verified) return null;

  const active = verified.status === "ACTIVE";
  const chargedThroughDateStr = String(verified.charged_through_date || sub?.chargedThroughDate?.toISOString() || "");
  const chargedThroughDate = chargedThroughDateStr ? new Date(chargedThroughDateStr) : null;
  const paymentRecovery = sub?.status === "payment_failed" && billingDateAdvanced(sub?.chargedThroughDate, chargedThroughDateStr);
  const paymentFailureLocked = sub?.status === "payment_failed" && !paymentRecovery;
  const trialStart = active
    ? sub?.trialStartedAt || (verified.start_date ? new Date(`${verified.start_date}T00:00:00.000Z`) : new Date())
    : sub?.trialStartedAt || null;

  const updated = await prisma.billingSubscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      plan: verified.plan as "Freelancer" | "Pro" | "Agency",
      trialStartedAt: trialStart,
      trialEndsAt: sub?.trialEndsAt || (trialStart ? trialEndFrom(trialStart) : null),
      status: paymentFailureLocked ? "payment_failed" : active ? "verified_active" : `square_${verified.status.toLowerCase()}`,
      squareSubscriptionId: verified.id,
      verifiedAt: new Date(),
      chargedThroughDate,
      billingAction: paymentFailureLocked
        ? "update_payment"
        : active
          ? ""
          : verified.status === "CANCELED"
            ? "resubscribe"
            : verified.status === "PAUSED"
              ? "resume_subscription"
              : "verify_subscription",
    },
    update: {
      plan: verified.plan as "Freelancer" | "Pro" | "Agency",
      trialStartedAt: trialStart,
      trialEndsAt: sub?.trialEndsAt || (trialStart ? trialEndFrom(trialStart) : null),
      status: paymentFailureLocked ? "payment_failed" : active ? "verified_active" : `square_${verified.status.toLowerCase()}`,
      squareSubscriptionId: verified.id,
      verifiedAt: new Date(),
      chargedThroughDate,
      billingAction: paymentFailureLocked
        ? "update_payment"
        : active
          ? ""
          : verified.status === "CANCELED"
            ? "resubscribe"
            : verified.status === "PAUSED"
              ? "resume_subscription"
              : "verify_subscription",
    },
  });

  return { active, paymentFailureLocked, status: verified.status, plan: verified.plan, updated };
}
