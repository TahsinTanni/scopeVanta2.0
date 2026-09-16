"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Badge } from "@/components/ui";

// Replaces legacy App.tsx's billing view (lines 6358-6577). Checkout/sync
// are Owner-only per CLAUDE.md; a non-Owner sees status read-only.
type BillingStatus = {
  billing: { status: string; daysLeft: number; limit: number; requiresAction?: boolean; action?: string };
  plan: string; lifecycle: string; chargedThroughDate: string; trialEndsAt: string;
};

const PLANS = ["Freelancer", "Pro", "Agency"] as const;

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  if (!status) return <p className="text-sm text-foreground-muted">Loading…</p>;
  const active = status.billing.status === "verified_active";

  return (
    <div>
      <PageHeader title="Plan & Billing" description="Entitlement audit" />
      <Card className="max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground-muted">Current plan</p>
            <p className="text-lg font-semibold text-foreground">{status.plan || "Not set"}</p>
          </div>
          <Badge tone={active ? "success" : status.billing.status === "payment_failed" ? "danger" : "warning"}>{status.lifecycle}</Badge>
        </div>
        {status.chargedThroughDate && <p className="mt-3 text-xs text-foreground-subtle">Charged through {new Date(status.chargedThroughDate).toLocaleDateString()}</p>}
        {status.billing.action && <p className="mt-2 text-sm text-warning">Action needed: {status.billing.action.replaceAll("_", " ")}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={sync}>Sync with Square</Button>
        </div>

        {!active && (
          <>
            <h2 className="mt-6 mb-3 text-sm font-semibold text-foreground">Switch plan</h2>
            <div className="flex gap-2">
              {PLANS.map((p) => (
                <Button key={p} variant="secondary" disabled={busy} onClick={() => switchPlan(p)}>{p}</Button>
              ))}
            </div>
          </>
        )}
        {active && <p className="mt-4 text-xs text-foreground-subtle">An active subscription is already linked — plan changes go through Square directly to avoid duplicate billing.</p>}
      </Card>
    </div>
  );
}
