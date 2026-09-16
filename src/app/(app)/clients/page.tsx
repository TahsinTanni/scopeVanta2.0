"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Textarea, Select, Label, Badge, EmptyState } from "@/components/ui";

// Replaces legacy App.tsx's clients view (lines 5420-5923).
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
    <div>
      <PageHeader title="Clients" description="Client 360" actions={<Button onClick={() => { setDraft({ ...EMPTY }); setEditingId(null); }}>New client</Button>} />

      <Input placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {draft && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">{editingId ? "Edit client" : "New client"}</h2>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="mt-4 flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="ghost" onClick={() => { setDraft(null); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {!filtered.length ? (
        <EmptyState title="No clients yet" description="Add a client to start connecting proposals to buyer context." />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{c.name}</p>
                  <p className="text-sm text-foreground-subtle">{c.company}</p>
                </div>
                <Badge>{c.lifecycleStatus || "Prospect"}</Badge>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-foreground-subtle">
                <span>{c.proposalCount ?? 0} proposals</span>
                {c.averageRisk != null && <span>Avg risk {c.averageRisk}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => { setEditingId(c.id); setDraft({ ...EMPTY, ...c, status: c.lifecycleStatus || "Prospect" } as typeof EMPTY); }}>Edit</Button>
                <Button variant="danger" onClick={() => remove(c.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
