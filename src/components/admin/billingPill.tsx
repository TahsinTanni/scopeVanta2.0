import type { BillingSubscription } from "@/generated/prisma/client";
import { Pill } from "@/components/admin/AdminUI";

/** One status pill summarising a workspace's billing state for admin tables. */
export function billingPill(sub: Pick<BillingSubscription, "status" | "compPlan" | "trialEndsAt" | "checkoutStartedAt"> | null) {
  if (!sub) return <Pill>no billing</Pill>;
  if (sub.compPlan) return <Pill tone="info">free plan</Pill>;
  if (sub.status === "payment_failed") return <Pill tone="danger">payment failed</Pill>;
  if (sub.status === "verified_active") {
    return sub.trialEndsAt && sub.trialEndsAt > new Date() ? <Pill tone="success">trial</Pill> : <Pill tone="success">paying</Pill>;
  }
  if (!sub.checkoutStartedAt) return <Pill>setup</Pill>;
  return <Pill tone="warning">{sub.status.replace(/_/g, " ")}</Pill>;
}
