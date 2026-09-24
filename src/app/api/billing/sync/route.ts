import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing } from "@/lib/billing";
import { syncSquareSubscription } from "@/lib/square-sync";

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
    const result = await syncSquareSubscription(ctx.workspaceId, sub);
    if (!result) return json({ verified: false, billing: billing(sub) });
    return json({
      verified: result.active && !result.paymentFailureLocked,
      status: result.status,
      plan: result.plan,
      billing: billing(result.updated),
    });
  } catch (e) {
    console.error("Square subscription sync failed", e);
    return error("Square subscription verification is temporarily unavailable.", 502);
  }
});
