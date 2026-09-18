"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Label, Badge, EmptyState } from "@/components/ui";

type Rate = { id: string; role: string; costRate: number | string; sellRate: number | string; overheadPct: number | string };

export default function RatesPage() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [name, setName] = useState("");
  const [costRate, setCostRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [overheadPct, setOverheadPct] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/commercial/rates")
      .then((r) => r.json())
      .then((d) => setRates((d.rates || []).slice().sort((a: Rate, b: Rate) => a.role.localeCompare(b.role))));
  }
  useEffect(load, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Role or service name is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/commercial/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          costRate: Number(costRate || 0),
          sellRate: Number(sellRate || 0),
          overheadPct: Number(overheadPct || 0),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Failed to add rate.");
        return;
      }
      setName("");
      setCostRate("");
      setSellRate("");
      setOverheadPct("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/commercial/rates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate & Cost Library"
        description="Role-based cost and sell rates used across Scope & Economics."
      />

      {error && (
        <div className="rounded-[4px] border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger font-mono">
          {error}
        </div>
      )}

      <Card className="border-border-hairline bg-surface-1 p-5">
        <form onSubmit={onSubmit} className="grid grid-cols-4 gap-4 items-end">
          <div>
            <Label>Role / service name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div>
            <Label>Cost / hour</Label>
            <Input type="number" min={0} step="0.01" value={costRate} onChange={(e) => setCostRate(e.target.value)} />
          </div>
          <div>
            <Label>Sell / hour</Label>
            <Input type="number" min={0} step="0.01" value={sellRate} onChange={(e) => setSellRate(e.target.value)} />
          </div>
          <div>
            <Label>Overhead %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={overheadPct}
              onChange={(e) => setOverheadPct(e.target.value)}
              className="text-ink-muted"
            />
          </div>
          <div className="col-span-4">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add Rate"}
            </Button>
          </div>
        </form>
      </Card>

      {!rates.length ? (
        <EmptyState
          title="No rates yet"
          description="Add a role and its cost/sell rate to start populating Scope & Economics estimate lines automatically."
        />
      ) : (
        <div className="space-y-2">
          {rates.map((r) => {
            const cost = Number(r.costRate);
            const sell = Number(r.sellRate);
            const overhead = Number(r.overheadPct);
            const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;
            return (
              <Card key={r.id} className="flex items-center justify-between border-border-hairline bg-surface-1 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink-primary">{r.role}</p>
                  <p className="text-xs text-ink-muted font-mono tabular-nums">
                    ${cost.toFixed(2)}/h cost · ${sell.toFixed(2)}/h sell
                  </p>
                  {overhead > 0 && (
                    <p className="text-xs text-ink-muted">{overhead}% overhead</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={margin >= 30 ? "success" : margin >= 15 ? "warning" : "danger"}>
                    {margin}% margin
                  </Badge>
                  <Button variant="danger" className="text-xs py-1 px-2.5" onClick={() => remove(r.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
