import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing, CARD_ERRORS } from "@/lib/billing";
import { subscribeWorkspace, SquareApiError } from "@/lib/square";
import { trialEndFrom } from "@/lib/plans";

// POST /api/billing/subscribe — replaces the hosted payment-link checkout.
// Body: { plan, sourceId } where sourceId is a Web Payments SDK card token.
// Owner-only. The card is saved on the workspace's own Square customer and the
// subscription created for it, so the subscription ID is known immediately —
// no lookup by the buyer's email or phone afterwards.
export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER"]);
  const companyProfile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!companyProfile) return error("Complete profile first.", 400);

  const b = (await req.json().catch(() => ({}))) as { plan?: string; sourceId?: string };
  if (!["Freelancer", "Pro", "Agency"].includes(String(b.plan))) return error("Choose a plan.", 400);
  const plan = b.plan as "Freelancer" | "Pro" | "Agency";
  const sourceId = String(b.sourceId || "");
  if (!sourceId || sourceId.length > 512) return error("Card details are missing. Please re-enter your card.", 400);

  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (sub?.status === "verified_active" && sub.squareSubscriptionId) {
    return error("This workspace already has an active subscription. Plan changes aren't available in the app yet.", 409);
  }

  // One subscribe at a time per workspace, so a double submit (two tabs, a
  // double click) can't create two Square subscriptions. The claim is an
  // atomic status flip; a claim older than 2 minutes counts as abandoned.
  const previousStatus = sub?.status || "trial_setup";
  await prisma.billingSubscription.upsert({ where: { workspaceId: ctx.workspaceId }, create: { workspaceId: ctx.workspaceId }, update: {} });
  const claim = await prisma.billingSubscription.updateMany({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [
        { status: { notIn: ["subscribing", "verified_active"] } },
        { status: "subscribing", updatedAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
    },
    data: { status: "subscribing" },
  });
  if (claim.count === 0) return error("A subscription is already being started for this workspace. Refresh the page in a moment.", 409);
  const releaseClaim = () =>
    prisma.billingSubscription.update({ where: { workspaceId: ctx.workspaceId }, data: { status: previousStatus } });

  let subscription;
  try {
    subscription = await subscribeWorkspace(ctx.workspaceId, ctx.email, plan, sourceId);
  } catch (e) {
    await releaseClaim();
    if (e instanceof SquareApiError && e.codes.some((c) => CARD_ERRORS.has(c))) {
      return error("Square couldn't accept this card. Check the details or try a different card.", 402);
    }
    console.error("Square subscription creation failed", e);
    return error("Square couldn't start the subscription. Nothing was charged — please try again.", 502);
  }

  const status = String(subscription.status || "").toUpperCase();
  const trialStart = sub?.trialStartedAt || (subscription.start_date ? new Date(`${subscription.start_date}T00:00:00.000Z`) : new Date());
  const data = {
    plan,
    squareSubscriptionId: subscription.id,
    status: status === "ACTIVE" ? "verified_active" : `square_${status.toLowerCase() || "pending"}`,
    checkoutStartedAt: new Date(),
    trialStartedAt: trialStart,
    trialEndsAt: sub?.trialEndsAt || trialEndFrom(trialStart),
    verifiedAt: new Date(),
    chargedThroughDate: subscription.charged_through_date ? new Date(subscription.charged_through_date) : null,
    billingAction: "",
  };
  const updated = await prisma.billingSubscription.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, ...data },
    update: data,
  });
  return json({ billing: billing(updated), status });
});
