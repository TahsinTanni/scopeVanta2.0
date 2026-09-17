"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Textarea, Select, Label, Badge, EmptyState } from "@/components/ui";

type Client = {
  id: string; name: string; company?: string | null; email?: string | null; phone?: string | null; website?: string | null;
  industry?: string | null; lifecycleStatus?: string | null; notes?: string | null; goals?: string | null; nextStep?: string | null;
  proposalCount?: number; averageRisk?: number | null;
};

const STATUSES = ["Prospect", "Active", "Won", "Dormant", "Lost"];
const EMPTY = { name: "", company: "", email: "", phone: "", website: "", industry: "", status: "Prospect", notes: "", goals: "", nextStep: "" };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
  }
  useEffect(load, []);

  async function save() {
    if (!draft) return;
    setError("");
    const url = editingId ? `/api/clients/${editingId}` : "/api/clients";
    const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not save client.");
      return;
    }
    setDraft(null);
    setEditingId(null);
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not delete client.");
      return;
    }
    load();
  }

  const filtered = clients.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Buyer directory, relationship stages, and risk profiles."
        actions={
          <Button
            onClick={() => { setDraft({ ...EMPTY }); setEditingId(null); }}
            className="flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            New Client
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-[18px]">
          search
        </span>
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-[4px] border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger font-mono">
          {error}
        </div>
      )}

      {draft && (
        <Card className="border-border-hairline bg-surface-1 p-6">
          <h2 className="mb-4 text-base font-semibold text-ink-primary">
            {editingId ? "Edit Client" : "New Client"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Company</Label><Input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
            <div><Label>Website</Label><Input value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></div>
            <div><Label>Industry</Label><Input value={draft.industry} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div><Label>Next step</Label><Input value={draft.nextStep} onChange={(e) => setDraft({ ...draft, nextStep: e.target.value })} /></div>
            <div className="col-span-2"><Label>Goals</Label><Textarea rows={2} value={draft.goals} onChange={(e) => setDraft({ ...draft, goals: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={save}>Save Client</Button>
            <Button variant="ghost" onClick={() => { setDraft(null); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {!filtered.length ? (
        <EmptyState title="No clients yet" description="Add a client to start connecting proposals to buyer context." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="border-border-hairline bg-surface-1 hover:bg-surface-2 transition-colors p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink-primary text-base">{c.name}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{c.company || "Independent Buyer"}</p>
                </div>
                <Badge tone={c.lifecycleStatus === "Won" || c.lifecycleStatus === "Active" ? "success" : "neutral"}>
                  {c.lifecycleStatus || "Prospect"}
                </Badge>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-ink-muted font-mono tabular-nums border-t border-border-hairline/60 pt-3">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  {c.proposalCount ?? 0} proposals
                </span>
                {c.averageRisk != null && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    Avg risk {c.averageRisk}
                  </span>
                )}
              </div>
              <div className="mt-4 flex gap-2 border-t border-border-hairline/40 pt-3">
                <Button variant="secondary" className="text-xs py-1.5 px-3" onClick={() => { setEditingId(c.id); setDraft({ ...EMPTY, ...c, status: c.lifecycleStatus || "Prospect" } as typeof EMPTY); }}>
                  Edit
                </Button>
                <Button variant="danger" className="text-xs py-1.5 px-3" onClick={() => remove(c.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
