import type { BillingSubscription } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { PLAN_LIMITS, verifyEntitlement, billingDateAdvanced, hasDevEntitlementBypass } from "@/lib/square";
import { TRIAL_DAYS, trialEndFrom } from "@/lib/plans";

// Square error codes that mean "this card was refused", shown to the owner as
// a card problem rather than an outage.
export const CARD_ERRORS = new Set([
  "CARD_DECLINED", "CVV_FAILURE", "ADDRESS_VERIFICATION_FAILURE", "INVALID_EXPIRATION", "INVALID_CARD",
  "CARD_EXPIRED", "GENERIC_DECLINE", "INSUFFICIENT_FUNDS", "INVALID_POSTAL_CODE", "CARD_NOT_SUPPORTED",
  "INVALID_CARD_DATA", "VERIFY_CVV_FAILURE", "VERIFY_AVS_FAILURE", "CARD_DECLINED_VERIFICATION_REQUIRED",
]);

/** Monthly proposal limit for a free (comp) plan with no explicit override. */
export const COMP_PLAN_LIMIT = 1_000_000;

// Translated from legacy `billing()` (legacy/backend/index.ts:551-591).
// Operates on the workspace's BillingSubscription row instead of a
// per-user Profile, and `devBypass` replaces the OWNER_TEST_EMAIL bypass
// (see lib/square.ts hasDevEntitlementBypass).
export function billing(sub: BillingSubscription | null, devBypass = false) {
  if (devBypass) {
    return {
      status: "dev_bypass",
      daysLeft: 9999,
      limit: 1_000_000,
      checkoutStarted: true,
      verifiedAt: "",
      devBypass: true,
      requiresAction: false,
      action: "",
    };
  }
  if (!sub) {
    return { status: "setup", daysLeft: TRIAL_DAYS, limit: 0, requiresAction: true, action: "complete_setup" };
  }
  const end = sub.trialEndsAt ?? null;
  const start = sub.trialStartedAt ?? null;
  const derivedEnd = end || (start ? trialEndFrom(start) : null);
  const days = derivedEnd ? Math.max(0, Math.ceil((derivedEnd.getTime() - Date.now()) / 86_400_000)) : TRIAL_DAYS;
  const status = sub.status || "trial_setup";
  // Staff-granted free plan (admin panel): no Square checks, no action needed.
  if (sub.compPlan) {
    return {
      status: "complimentary",
      daysLeft: 9999,
      limit: sub.limitOverride ?? COMP_PLAN_LIMIT,
      checkoutStarted: true,
      verifiedAt: sub.verifiedAt?.toISOString() || "",
      devBypass: false,
      requiresAction: false,
      action: "",
      chargedThroughDate: "",
      trialEndsAt: "",
    };
  }
  return {
    status,
    daysLeft: days,
    limit: sub.limitOverride ?? (PLAN_LIMITS[(sub.plan as "Freelancer" | "Pro" | "Agency") || "Freelancer"] || 10),
    checkoutStarted: Boolean(sub.checkoutStartedAt),
    verifiedAt: sub.verifiedAt?.toISOString() || "",
    devBypass: false,
    requiresAction: status !== "verified_active",
    action: sub.billingAction || "",
    chargedThroughDate: sub.chargedThroughDate?.toISOString() || "",
    trialEndsAt: derivedEnd?.toISOString() || "",
  };
}

// Slack after the trial ends before it counts as lapsed: absorbs Square's
// date-only charged_through_date, webhook delay, and subscriptions created
// before the 7-day change whose Square trial is one calendar month.
const TRIAL_EXPIRY_GRACE_MS = 2 * 86_400_000;

/**
 * True when the trial window (plus grace) is over and Square hasn't charged
 * past the end of it — the free phase ran out with no paid period recorded.
 * Later-period lapses are left to Square's status / the payment-failed lock.
 */
function trialLapsed(sub: BillingSubscription): boolean {
  const end = sub.trialEndsAt ?? (sub.trialStartedAt ? trialEndFrom(sub.trialStartedAt) : null);
  if (!end || Date.now() <= end.getTime() + TRIAL_EXPIRY_GRACE_MS) return false;
  return !sub.chargedThroughDate || sub.chargedThroughDate.getTime() <= end.getTime();
}

export type Entitlement = { sub: BillingSubscription | null; devBypass: boolean; comp: boolean };

/**
 * Shared "may this workspace use paid features at all" gate, moved from
 * api/analyze. Throws a 402 HttpError (withErrors renders it as the usual
 * `{ error }` body) when it may not. Usage limits are NOT checked here —
 * callers that have one (analyze's monthly project count) check it after.
 *
 * `context` is what the caller is gating, as a gerund phrase that completes
 * "…required before ___" (e.g. "generating proposals", "uploading documents").
 */
export async function requireEntitlement(workspaceId: string, context: string): Promise<Entitlement> {
  const devBypass = hasDevEntitlementBypass();
  let sub = await prisma.billingSubscription.findUnique({ where: { workspaceId } });
  // Staff-granted free plans (admin panel) skip Square entitlement entirely.
  const comp = sub?.compPlan === true;
  if (devBypass || comp) return { sub, devBypass, comp };
  if (!sub?.checkoutStartedAt) throw new HttpError("Start your Square subscription checkout to activate the trial.", 402);

  // Cancelled during the free trial: Square has ended (or is about to end) the
  // subscription, so nothing will be charged, but the owner keeps access until
  // the trial they signed up for ends. Returning subscribers get no trial
  // (their trialEndsAt is day one), so this can't be repeated.
  const inTrial = Boolean(sub.trialEndsAt && sub.trialEndsAt.getTime() > Date.now());
  if (inTrial && sub.status === "square_canceled") return { sub, devBypass, comp };

  try {
    const lastVerified = sub?.verifiedAt ? sub.verifiedAt.getTime() : 0;
    const verificationStale = Date.now() - lastVerified > 15 * 60 * 1000;
    // A lapsed-looking trial also forces a fresh Square read, so a first
    // payment Square took in the last 15 minutes isn't refused on cached data.
    if (sub?.status !== "verified_active" || verificationStale || trialLapsed(sub)) {
      const verified = await verifyEntitlement(workspaceId);
      const chargedThroughDateStr = String(verified?.charged_through_date || sub?.chargedThroughDate?.toISOString() || "");
      const paymentRecovery = sub?.status === "payment_failed" && billingDateAdvanced(sub?.chargedThroughDate, chargedThroughDateStr);
      if (!verified || verified.status !== "ACTIVE" || (sub?.status === "payment_failed" && !paymentRecovery)) {
        if (inTrial && verified?.status === "CANCELED") {
          sub = await prisma.billingSubscription.update({ where: { workspaceId }, data: { status: "square_canceled", verifiedAt: new Date() } });
          return { sub, devBypass, comp };
        }
        if (sub?.status === "verified_active") {
          await prisma.billingSubscription.update({
            where: { workspaceId },
            data: { status: verified ? `square_${verified.status.toLowerCase()}` : "square_not_found", verifiedAt: new Date() },
          });
        }
        throw new HttpError(`An active Square subscription is required before ${context}. Open Plan & billing to verify your subscription.`, 402);
      }
      const trialStart = sub?.trialStartedAt || (verified.start_date ? new Date(`${verified.start_date}T00:00:00.000Z`) : new Date());
      sub = await prisma.billingSubscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          plan: verified.plan as "Freelancer" | "Pro" | "Agency",
          status: "verified_active",
          trialStartedAt: trialStart,
          trialEndsAt: sub?.trialEndsAt || trialEndFrom(trialStart),
          squareSubscriptionId: verified.id,
          verifiedAt: new Date(),
          chargedThroughDate: chargedThroughDateStr ? new Date(chargedThroughDateStr) : null,
          billingAction: "",
        },
        update: {
          plan: verified.plan as "Freelancer" | "Pro" | "Agency",
          status: "verified_active",
          trialStartedAt: trialStart,
          trialEndsAt: sub?.trialEndsAt || trialEndFrom(trialStart),
          squareSubscriptionId: verified.id,
          verifiedAt: new Date(),
          chargedThroughDate: chargedThroughDateStr ? new Date(chargedThroughDateStr) : null,
          billingAction: "",
        },
      });
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError("Your Square subscription could not be verified. Use Plan & billing to sync it.", 402);
  }

  if (trialLapsed(sub)) {
    throw new HttpError(
      `Your free trial has ended and Square hasn't recorded a payment yet, which is required before ${context}. Open Plan & billing to update your payment method or sync your subscription.`,
      402,
    );
  }
  return { sub, devBypass, comp };
}
