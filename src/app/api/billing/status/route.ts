import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing } from "@/lib/billing";
import { hasDevEntitlementBypass, liveSubscriptionDetails, type LiveSubscriptionDetails } from "@/lib/square";

// GET /api/billing/status — legacy/backend/index.ts:837-861.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const companyProfile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!companyProfile) return error("Complete profile first.", 400);
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  const devBypass = hasDevEntitlementBypass();
  const state = billing(sub, devBypass);

  // Owner-only live Square details (card on file, scheduled cancellation, the
  // overdue invoice's payment page). Best-effort: the page still loads, minus
  // these, if Square is unreachable.
  const isOwner = ctx.role === "OWNER";
  let live: LiveSubscriptionDetails | null = null;
  if (isOwner && sub?.squareSubscriptionId && !sub.compPlan) {
    try {
      live = await liveSubscriptionDetails(sub.squareSubscriptionId, { withOverdueInvoice: sub.status === "payment_failed" });
    } catch (e) {
      console.warn("Square live subscription details unavailable", e);
    }
  }

  // Cancelled during the trial: access runs to the trial's end (see
  // requireEntitlement), which is later than Square's own cancel date.
  const inTrial = Boolean(sub?.trialEndsAt && sub.trialEndsAt.getTime() > Date.now());
  if (live?.cancelsOn && inTrial && sub?.trialEndsAt) live = { ...live, cancelsOn: sub.trialEndsAt.toISOString().slice(0, 10) };

  return json({
    isOwner,
    live,
    // Only a workspace that has never subscribed gets the free trial.
    trialEligible: !(sub?.squareSubscriptionId || sub?.trialStartedAt),
    billing: state,
    plan: sub?.plan || "",
    subscriptionId: sub?.squareSubscriptionId ? `${sub.squareSubscriptionId.slice(0, 6)}…${sub.squareSubscriptionId.slice(-4)}` : "",
    verifiedAt: sub?.verifiedAt?.toISOString() || "",
    checkoutStartedAt: sub?.checkoutStartedAt?.toISOString() || "",
    trialStartedAt: sub?.trialStartedAt?.toISOString() || "",
    trialEndsAt: sub?.trialEndsAt?.toISOString() || state.trialEndsAt || "",
    chargedThroughDate: sub?.chargedThroughDate?.toISOString() || "",
    requiresAction: !devBypass && !sub?.compPlan && sub?.status !== "verified_active",
    action: devBypass || sub?.compPlan ? "" : sub?.billingAction || "",
    lastBillingEvent: sub?.lastBillingEvent || "",
    lifecycle: sub?.compPlan ? "complimentary" : sub?.status || "trial_setup",
  });
});
