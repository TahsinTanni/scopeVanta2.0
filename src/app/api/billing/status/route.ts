import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing } from "@/lib/billing";
import { hasDevEntitlementBypass } from "@/lib/square";

// GET /api/billing/status — legacy/backend/index.ts:837-861.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const companyProfile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!companyProfile) return error("Complete profile first.", 400);
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  const devBypass = hasDevEntitlementBypass();
  const state = billing(sub, devBypass);
  return json({
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
