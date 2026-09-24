"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader, Button, Badge } from "@/components/ui";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";
import { trackEvent } from "@/lib/track";
import { PLANS, ALL_PLAN_FEATURES } from "@/lib/plans";

type BillingStatus = {
  billing: { status: string; daysLeft: number; limit: number; requiresAction?: boolean; action?: string };
  plan: string; lifecycle: string; chargedThroughDate: string; trialEndsAt: string;
  subscriptionId: string; verifiedAt: string; lastBillingEvent: string;
};

// Shared with the landing page; every feature is on every plan, so each card
// lists its proposal limit followed by the common feature set.
const PLAN_CARDS = PLANS.map((p) => ({ ...p, features: [p.limit, ...ALL_PLAN_FEATURES] }));

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/billing/status");
    const data = res.ok ? await res.json() : null;
    setStatus(data);
    return data as BillingStatus | null;
  }
  useEffect(() => {
    load();
  }, []);

  async function switchPlan(plan: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout-started", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not start checkout.");
        return;
      }
      if (body.checkoutUrl) {
        trackEvent("checkout_started", { plan });
        window.open(body.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      load();
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

          {status.billing.action && (
            <div className="mt-3 rounded-[4px] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning font-mono">
              Action needed: {status.billing.action.replaceAll("_", " ")}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">
              {error}
            </div>
          )}

          {active && (
            <p className="mt-5 text-xs text-ink-muted border-t border-border-subtle pt-4">
              Your subscription is active and verified by Square. Team seats are managed dynamically based on your workspace member count.
            </p>
          )}
        </BentoCard>

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
              const isCurrent = status.plan === tier.name;
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
                    onClick={() => switchPlan(tier.name)}
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
    </div>
  );
}
