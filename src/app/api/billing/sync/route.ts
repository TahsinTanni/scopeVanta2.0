import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing } from "@/lib/billing";
import { verifyEntitlement, billingDateAdvanced } from "@/lib/square";

// POST /api/billing/sync — legacy/backend/index.ts:963-1033. Owner-only per
// CLAUDE.md, and verifyEntitlement now looks up by stored Square IDs, never
// by re-searching customers by email.
export const POST = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER"]);
  const companyProfile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!companyProfile) return error("Complete profile first.", 400);
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });

  try {
    const verified = await verifyEntitlement(ctx.workspaceId);
    if (!verified) return json({ verified: false, billing: billing(sub) });

    const active = verified.status === "ACTIVE";
    const chargedThroughDateStr = String(verified.charged_through_date || sub?.chargedThroughDate?.toISOString() || "");
    const chargedThroughDate = chargedThroughDateStr ? new Date(chargedThroughDateStr) : null;
    const paymentRecovery = sub?.status === "payment_failed" && billingDateAdvanced(sub?.chargedThroughDate, chargedThroughDateStr);
    const paymentFailureLocked = sub?.status === "payment_failed" && !paymentRecovery;
    const trialStart = active
      ? sub?.trialStartedAt || (verified.start_date ? new Date(`${verified.start_date}T00:00:00.000Z`) : new Date())
      : sub?.trialStartedAt || null;

    const updated = await prisma.billingSubscription.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: {
        workspaceId: ctx.workspaceId,
        plan: verified.plan as "Freelancer" | "Pro" | "Agency",
        trialStartedAt: trialStart,
        trialEndsAt: sub?.trialEndsAt || (trialStart ? new Date(trialStart.getTime() + 30 * 86_400_000) : null),
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
        trialEndsAt: sub?.trialEndsAt || (trialStart ? new Date(trialStart.getTime() + 30 * 86_400_000) : null),
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

    return json({ verified: active && !paymentFailureLocked, status: verified.status, plan: verified.plan, billing: billing(updated) });
  } catch (e) {
    console.error("Square subscription sync failed", e);
    return error("Square subscription verification is temporarily unavailable.", 502);
  }
});
