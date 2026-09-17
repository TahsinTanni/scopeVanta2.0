"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader, Button, Badge } from "@/components/ui";
import { BentoCard, BentoCardGrid, GlobalSpotlight } from "@/components/MagicBento";

type BillingStatus = {
  billing: { status: string; daysLeft: number; limit: number; requiresAction?: boolean; action?: string };
  plan: string; lifecycle: string; chargedThroughDate: string; trialEndsAt: string;
};

const PLANS = [
  {
    name: "Freelancer",
    price: "$19",
    cadence: "/month",
    description: "For solo operators & consultants managing focused high-stakes bids.",
    features: ["Up to 10 active proposals", "Core AI Discovery & Risk analysis", "Client sharing links", "Export to PDF"],
    popular: false
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "/month",
    description: "For boutique studios & fast-moving agencies closing weekly pipeline.",
    features: ["Up to 40 active proposals", "Deep Contract Red-Teaming", "Commercial Margin Guard", "Knowledge base grounding", "Priority support"],
    popular: true
  },
  {
    name: "Agency",
    price: "$99",
    cadence: "/month",
    description: "For multi-seat commercial teams demanding enterprise-grade deal control.",
    features: ["Up to 150 active proposals", "Unlimited team workspace seats", "Custom rate cards & templates", "Dedicated Square reconciliation", "Full audit history"],
    popular: false
  }
] as const;

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  function load() {
    fetch("/api/billing/status").then((r) => (r.ok ? r.json() : null)).then(setStatus);
  }
  useEffect(load, []);

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
      if (body.checkoutUrl) window.open(body.checkoutUrl, "_blank", "noopener,noreferrer");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      await fetch("/api/billing/sync", { method: "POST" });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="text-sm font-mono text-ink-muted">Loading…</p>;
  const active = status.billing.status === "verified_active";

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
        <BentoCard className="max-w-3xl p-6" glowColor="78, 135, 112">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
            {PLANS.map((tier) => {
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
