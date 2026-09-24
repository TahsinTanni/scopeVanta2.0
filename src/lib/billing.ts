import type { BillingSubscription } from "@/generated/prisma/client";
import { PLAN_LIMITS } from "@/lib/square";

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
    return { status: "setup", daysLeft: 30, limit: 0, requiresAction: true, action: "complete_setup" };
  }
  const end = sub.trialEndsAt ?? null;
  const start = sub.trialStartedAt ?? null;
  const derivedEnd = end || (start ? new Date(start.getTime() + 30 * 86_400_000) : null);
  const days = derivedEnd ? Math.max(0, Math.ceil((derivedEnd.getTime() - Date.now()) / 86_400_000)) : 30;
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
