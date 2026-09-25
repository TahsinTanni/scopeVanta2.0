"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader, Button, Badge } from "@/components/ui";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";
import { trackEvent } from "@/lib/track";
import { PLANS, ALL_PLAN_FEATURES, PLAN_CURRENCY, PLAN_PRICES_CENTS, TRIAL_DAYS, type PlanName } from "@/lib/plans";
import { SquareCardForm } from "@/components/SquareCardForm";
import { Dialog } from "@/components/Dialog";

type BillingStatus = {
  billing: { status: string; daysLeft: number; limit: number; requiresAction?: boolean; action?: string };
  plan: string; lifecycle: string; chargedThroughDate: string; trialEndsAt: string;
  subscriptionId: string; verifiedAt: string; lastBillingEvent: string;
  isOwner: boolean;
  // Owner-only, read live from Square; null when not the owner or unavailable.
  live: {
    cancelsOn: string;
    card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
    overdueInvoiceUrl: string;
  } | null;
};

const fmtDate = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** POSTs JSON; resolves to the server's error message, or null on success. */
async function post(url: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error || "Something went wrong. Please try again.";
}

// Shared with the landing page; every feature is on every plan, so each card
// lists its proposal limit followed by the common feature set.
const PLAN_CARDS = PLANS.map((p) => ({ ...p, features: [p.limit, ...ALL_PLAN_FEATURES] }));

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Plan whose card form is open (chosen here, or passed from onboarding as ?plan=).
  const [checkoutPlan, setCheckoutPlan] = useState<PlanName | null>(null);
  const [updatingCard, setUpdatingCard] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/billing/status");
    const data = res.ok ? await res.json() : null;
    setStatus(data);
    return data as BillingStatus | null;
  }
  useEffect(() => {
    load().then((data) => {
      const requested = new URLSearchParams(window.location.search).get("plan");
      const isActive = data?.billing.status === "verified_active" || data?.billing.status === "complimentary";
      if (!isActive && PLANS.some((p) => p.name === requested)) setCheckoutPlan(requested as PlanName);
    });
  }, []);

  function choosePlan(plan: PlanName) {
    setError("");
    if (!status?.isOwner) {
      setError("Only the workspace owner can manage billing.");
      return;
    }
    if (active) {
      setError("Your subscription is active. Plan changes aren't available in the app yet — contact support to switch plans.");
      return;
    }
    trackEvent("checkout_started", { plan });
    setCheckoutPlan(plan);
  }

  async function subscribed() {
    setCheckoutPlan(null);
    const data = await load();
    if (data?.billing.status === "verified_active") trackEvent("billing_verified");
  }

  async function cardUpdated() {
    setUpdatingCard(false);
    setNotice("Card updated. Future charges will use the new card.");
    await load();
  }

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const failure = await post("/api/billing/cancel");
      setConfirmCancel(false);
      if (failure) setError(failure);
      else setNotice("Subscription canceled. You keep access until the end of the current billing period.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    const previousStatus = status?.billing.status;
    try {
      await fetch("/api/billing/sync", { method: "POST" });
      const newStatus = await load();
      if (newStatus?.billing.status === "verified_active" && previousStatus !== "verified_active") {
        trackEvent("billing_verified");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="text-sm font-mono text-ink-muted">Loading…</p>;
  // "complimentary" = a free plan granted by ScopeVanta staff (admin panel).
  const active = status.billing.status === "verified_active" || status.billing.status === "complimentary";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan & Billing"
        description="Subscription tier, entitlements, and Square payment status."
      />

      <GlobalSpotlight
        gridRef={gridRef}
        glowColor="78, 135, 112"
        spotlightRadius={320}
      />

      <BentoCardGrid gridRef={gridRef} className="space-y-6">
        {/* Status card */}
        <BentoCard className="sidebar-expandable max-w-5xl p-6" glowColor="78, 135, 112">
          <div className="flex items-center justify-between border-b border-border-hairline pb-4">
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-mono">Current Workspace Plan</p>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="font-display text-2xl font-medium text-ink-primary tracking-tight">
                  {status.plan || "No active tier"}
                </h2>
                <Badge tone={active ? "success" : status.billing.status === "payment_failed" ? "danger" : "warning"}>
                  {status.lifecycle}
                </Badge>
              </div>
            </div>
            <Button variant="secondary" disabled={busy} onClick={sync} className="flex items-center gap-1.5 text-xs">
              <span className="material-symbols-outlined text-[16px]">sync</span>
              Sync with Square
            </Button>
          </div>

          {status.chargedThroughDate && (
            <p className="mt-4 text-xs text-ink-muted font-mono tabular-nums">
              Next renewal: {new Date(status.chargedThroughDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          )}

          {status.subscriptionId && (
            <p className="mt-2 text-xs text-ink-muted font-mono tabular-nums">Subscription: {status.subscriptionId}</p>
          )}

          {status.verifiedAt && (
            <p className="mt-2 text-xs text-ink-muted font-mono tabular-nums">
              Last verified: {new Date(status.verifiedAt).toLocaleString()}
            </p>
          )}

          {status.lastBillingEvent && (
            <p className="mt-2 text-xs text-ink-muted font-mono tabular-nums">Last billing event: {status.lastBillingEvent}</p>
          )}

          {status.billing.status === "payment_failed" ? (
            <div className="mt-3 rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-3 text-xs text-danger">
              <p className="font-semibold">Your last payment didn&apos;t go through, so AI features are paused.</p>
              {status.isOwner ? (
                <>
                  <p className="mt-1">
                    Pay the overdue invoice on Square&apos;s secure page — access comes back automatically once it&apos;s paid.
                    Then update your card so future charges succeed.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {status.live?.overdueInvoiceUrl ? (
                      <Button onClick={() => window.open(status.live!.overdueInvoiceUrl, "_blank", "noopener,noreferrer")}>
                        Pay overdue invoice
                      </Button>
                    ) : (
                      <span className="self-center">Square also emailed the invoice with a payment link.</span>
                    )}
                    <Button variant="secondary" onClick={() => setUpdatingCard(true)}>
                      Update card
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-1">Ask the workspace owner to update the payment method.</p>
              )}
            </div>
          ) : (
            status.billing.action && (
              <div className="mt-3 rounded-[4px] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning font-mono">
                Action needed: {status.billing.action.replaceAll("_", " ")}
              </div>
            )
          )}

          {notice && (
            <div className="mt-3 rounded-[4px] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success font-mono">{notice}</div>
          )}

          {error && (
            <div className="mt-3 rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">
              {error}
            </div>
          )}

          {active && (
            <p className="mt-5 text-xs text-ink-muted border-t border-border-subtle pt-4">
              Your subscription is active and verified by Square.
            </p>
          )}

          {status.isOwner && status.live && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 text-xs">
              <div className="space-y-1 font-mono text-ink-muted tabular-nums">
                {status.live.card && (
                  <p>
                    Card on file: {status.live.card.brand} •••• {status.live.card.last4} · exp {String(status.live.card.expMonth).padStart(2, "0")}/
                    {String(status.live.card.expYear).slice(-2)}
                  </p>
                )}
                {status.live.cancelsOn && (
                  <p className="text-warning">Canceled — access ends {fmtDate(status.live.cancelsOn)}.</p>
                )}
              </div>
              <div className="flex gap-2">
                {status.billing.status !== "payment_failed" && (
                  <Button variant="secondary" onClick={() => setUpdatingCard(true)} disabled={busy}>
                    Update card
                  </Button>
                )}
                {!status.live.cancelsOn && status.billing.status !== "square_canceled" && (
                  <Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={busy}>
                    Cancel subscription
                  </Button>
                )}
              </div>
            </div>
          )}
        </BentoCard>

        {updatingCard && (
          <BentoCard className="sidebar-expandable max-w-5xl p-6" glowColor="78, 135, 112">
            <SquareCardForm
              intro="Enter the new card. It replaces the current one for all future charges."
              submitLabel="Save new card"
              busyLabel="Saving card…"
              onToken={(token) => post("/api/billing/update-card", { sourceId: token })}
              onDone={cardUpdated}
              onCancel={() => setUpdatingCard(false)}
            />
          </BentoCard>
        )}

        {checkoutPlan && (
          <BentoCard className="sidebar-expandable max-w-5xl p-6" glowColor="78, 135, 112">
            <SquareCardForm
              key={checkoutPlan}
              intro={
                <>
                  Subscribe to <span className="font-semibold">{checkoutPlan}</span>: the first {TRIAL_DAYS} days are free, then {PLAN_CURRENCY} $
                  {PLAN_PRICES_CENTS[checkoutPlan] / 100}/month. Nothing is charged today.
                </>
              }
              submitLabel={`Start ${TRIAL_DAYS}-day free trial`}
              busyLabel="Starting subscription…"
              onToken={(token) => post("/api/billing/subscribe", { plan: checkoutPlan, sourceId: token })}
              onDone={subscribed}
              onCancel={() => setCheckoutPlan(null)}
            />
          </BentoCard>
        )}

        {/* Plan tiers selection */}
        <div>
          <div className="mb-4">
            <h3 className="font-display text-xl font-medium text-ink-primary tracking-tight">
              {active ? "Available Workspace Tiers" : "Select Subscription Tier"}
            </h3>
            <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mt-0.5">
              Secure commercial checkout via Square
            </p>
          </div>

          <div className="sidebar-expandable grid grid-cols-1 gap-4 max-w-5xl md:grid-cols-3">
            {PLAN_CARDS.map((tier) => {
              // Only a paid/verified plan is "current". A plan saved by an
              // unfinished checkout must stay selectable so checkout can resume.
              const isCurrent = active && status.plan === tier.name;
              return (
                <BentoCard
                  key={tier.name}
                  className={`p-6 flex flex-col justify-between ${tier.popular ? 'border-accent/40 bg-surface-2' : ''}`}
                  glowColor="78, 135, 112"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xl font-medium text-ink-primary">{tier.name}</span>
                      {tier.popular && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent-hover border border-accent/30 font-medium">
                          Popular
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-3 text-ink-primary border border-border-hairline font-medium">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-semibold text-ink-primary tracking-tight">{tier.price}</span>
                      <span className="text-xs font-mono text-ink-muted">{tier.cadence}</span>
                    </div>

                    <p className="mt-2 text-xs text-ink-muted font-body leading-relaxed">{tier.description}</p>

                    <div className="mt-5 space-y-2 border-t border-border-subtle pt-4">
                      {tier.features.map((feat) => (
                        <div key={feat} className="flex items-center gap-2 text-xs text-ink-secondary">
                          <span className="material-symbols-outlined text-accent text-[16px]">check_circle</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant={tier.popular ? "primary" : "secondary"}
                    disabled={busy || isCurrent}
                    onClick={() => choosePlan(tier.name)}
                    className="mt-6 text-xs py-2 w-full"
                  >
                    {isCurrent ? "Current Plan" : `Choose ${tier.name}`}
                  </Button>
                </BentoCard>
              );
            })}
          </div>
        </div>
      </BentoCardGrid>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel subscription">
        <div className="space-y-4 p-6">
          <h3 className="font-display text-base font-semibold text-ink-primary">Cancel your subscription?</h3>
          <p className="text-sm text-ink-secondary">
            Square stops billing at the end of the current billing period, and AI features stay available until then. You can subscribe
            again at any time.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmCancel(false)} disabled={busy}>
              Keep subscription
            </Button>
            <Button variant="danger" onClick={cancel} disabled={busy} loading={busy}>
              Cancel subscription
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
