"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Label, Badge, EmptyState, StatusBanner } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { formatCurrency } from "@/lib/currency";

type Rate = { id: string; role: string; costRate: number | string; sellRate: number | string; overheadPct: number | string };

// Shared by the create and edit flows: a rate is "underwater" when a real cost
// is set and the sell rate is below it (0/0 is just an unfilled rate).
function isUnderwater(costRate: string, sellRate: string) {
  const cost = Number(costRate || 0);
  const sell = Number(sellRate || 0);
  return { underwater: cost > 0 && sell < cost, cost, sell };
}

export default function RatesPage() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [name, setName] = useState("");
  const [costRate, setCostRate] = useState("");
  const [sellRate, setSellRate] = useState("");
  const [overheadPct, setOverheadPct] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [underwater, setUnderwater] = useState<{ source: "create" | "edit"; cost: number; sell: number } | null>(null);
  const [page, setPage] = useState(1);
  const [currency, setCurrency] = useState("USD");
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editSell, setEditSell] = useState("");
  const [editOverhead, setEditOverhead] = useState("");

  function load() {
    fetch(`/api/commercial/rates?page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.total || 0;
        const ps = d.pageSize || 20;
        const last = Math.max(1, Math.ceil(t / ps));
        if (page > last) {
          setPage(last); // e.g. deleted the only rate on the last page
          return;
        }
        setRates(d.rates || []);
        setTotal(t);
        setPageSize(ps);
      });
  }
  useEffect(load, [page]);

  useEffect(() => {
    fetch("/api/workspace/profile")
      .then((r) => r.json())
      .then((d) => setCurrency(d.profile?.currency || "USD"))
      .catch(() => {});
  }, []);

  async function submitRate() {
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Role or service name is required.");
      return;
    }
    const check = isUnderwater(costRate, sellRate);
    if (check.underwater) {
      setUnderwater({ source: "create", cost: check.cost, sell: check.sell });
      return;
    }
    submitRate();
  }

  function startEdit(r: Rate) {
    setEditingId(r.id);
    setEditName(r.role);
    setEditCost(String(Number(r.costRate)));
    setEditSell(String(Number(r.sellRate)));
    setEditOverhead(String(Number(r.overheadPct)));
    setError("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/commercial/rates/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          costRate: Number(editCost || 0),
          sellRate: Number(editSell || 0),
          overheadPct: Number(editOverhead || 0),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Failed to update rate.");
        return;
      }
      setEditingId(null);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  function onSave() {
    if (editName.trim().length < 2) {
      setError("Role or service name is required.");
      return;
    }
    const check = isUnderwater(editCost, editSell);
    if (check.underwater) {
      setUnderwater({ source: "edit", cost: check.cost, sell: check.sell });
      return;
    }
    saveEdit();
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

      {error && <StatusBanner tone="danger">{error}</StatusBanner>}

      <Card className="border-border-hairline bg-surface-1 p-5">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
            if (r.id === editingId) {
              return (
                <Card key={r.id} className="border-border-hairline bg-surface-1 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                    <div>
                      <Label>Role / service name</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Cost / hour</Label>
                      <Input type="number" min={0} step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} />
                    </div>
                    <div>
                      <Label>Sell / hour</Label>
                      <Input type="number" min={0} step="0.01" value={editSell} onChange={(e) => setEditSell(e.target.value)} />
                    </div>
                    <div>
                      <Label>Overhead %</Label>
                      <Input type="number" min={0} max={100} step="0.1" value={editOverhead} onChange={(e) => setEditOverhead(e.target.value)} className="text-ink-muted" />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="primary" className="text-xs py-1 px-2.5" disabled={submitting} onClick={onSave}>
                      {submitting ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              );
            }
            const cost = Number(r.costRate);
            const sell = Number(r.sellRate);
            const overhead = Number(r.overheadPct);
            const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;
            return (
              <Card key={r.id} className="flex items-center justify-between border-border-hairline bg-surface-1 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink-primary">{r.role}</p>
                  <p className="text-xs text-ink-muted font-mono tabular-nums">
                    {formatCurrency(cost, currency)}/h cost · {formatCurrency(sell, currency)}/h sell
                  </p>
                  {overhead > 0 && (
                    <p className="text-xs text-ink-muted">{overhead}% overhead</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={margin >= 30 ? "success" : margin >= 15 ? "warning" : "danger"}>
                    {margin}% margin
                  </Badge>
                  <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  <Button variant="danger" className="text-xs py-1 px-2.5" onClick={() => remove(r.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" className="text-xs py-1 px-2.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-ink-muted font-mono tabular-nums">
              Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <Button
              variant="secondary"
              className="text-xs py-1 px-2.5"
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={underwater !== null} onClose={() => setUnderwater(null)} title="Sell rate below cost">
        <div className="space-y-4 p-6">
          <h3 className="font-display text-base font-semibold text-ink-primary">Sell rate below cost</h3>
          <p className="text-sm text-ink-secondary">
            Selling at {formatCurrency(underwater?.sell ?? 0, currency)}/hr while it costs {formatCurrency(underwater?.cost ?? 0, currency)}/hr means every hour worked on
            this rate loses {formatCurrency((underwater?.cost ?? 0) - (underwater?.sell ?? 0), currency)}. {underwater?.source === "edit" ? "Save it anyway?" : "Add it anyway?"}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUnderwater(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (underwater?.source === "edit") saveEdit();
                else submitRate();
                setUnderwater(null);
              }}
            >
              {underwater?.source === "edit" ? "Save Anyway" : "Add Anyway"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
