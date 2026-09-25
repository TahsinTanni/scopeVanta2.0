"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, PageHeader, Button, Input, Textarea, Select, Label, Badge, EmptyState, IconButton } from "@/components/ui";
import { trackEvent } from "@/lib/track";

type Client = {
  id: string; name: string; company?: string | null; email?: string | null; phone?: string | null; website?: string | null;
  industry?: string | null; lifecycleStatus?: string | null; notes?: string | null; goals?: string | null; nextStep?: string | null;
  preferences?: string | null; decisionMakers?: string | null; painPoints?: string | null; buyingCriteria?: string | null;
  knownObjections?: string | null; followUpDate?: string | null; logoUrl?: string | null;
  proposalCount?: number; averageRisk?: number | null;
};

const STATUSES = ["Prospect", "Active", "Won", "Dormant", "Lost"];
const EMPTY = {
  name: "", company: "", email: "", phone: "", website: "", industry: "", status: "Prospect", notes: "", goals: "", nextStep: "",
  preferences: "", decisionMakers: "", painPoints: "", buyingCriteria: "", knownObjections: "", followUpDate: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const router = useRouter();
  const editParam = useSearchParams().get("edit");
  const handledEdit = useRef<string | null>(null);

  function load() {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
  }
  useEffect(load, []);

  // Single source of truth for opening a client's edit form (Edit button + ?edit= deep link).
  function startEdit(c: Client) {
    setEditingId(c.id);
    setDraft({
      ...EMPTY,
      ...c,
      status: c.lifecycleStatus || "Prospect",
      followUpDate: c.followUpDate ? String(c.followUpDate).slice(0, 10) : "",
    } as typeof EMPTY);
  }

  // Deep link from the command palette: /clients?edit=<id>. Silently ignores unknown ids.
  useEffect(() => {
    if (!editParam || handledEdit.current === editParam) return;
    const match = clients.find((c) => c.id === editParam);
    if (!match) return;
    handledEdit.current = editParam;
    startEdit(match);
    router.replace("/clients"); // clear the param so the same link works again later
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, editParam]);
  useEffect(() => {
    if (!editParam) handledEdit.current = null;
  }, [editParam]);

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
    if (!editingId) trackEvent("client_created", { clientId: body.client?.id });
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

  async function uploadLogo(file: File) {
    if (!editingId) return;
    setUploadingLogo(true);
    setError("");
    try {
      const content = await fileToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, content, kind: "client_logo", clientId: editingId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Logo upload failed.");
        return;
      }
      load();
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    if (!editingId) return;
    setError("");
    const res = await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "client_logo", clientId: editingId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Couldn't remove the logo. Please try again.");
      return;
    }
    load();
  }

  const filtered = clients.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase()));
  const editingClient = editingId ? clients.find((c) => c.id === editingId) : undefined;

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
        <div className="rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">
          {error}
        </div>
      )}

      {draft && (
        <Card className="border-border-hairline bg-surface-1 p-6">
          <h2 className="mb-4 text-base font-semibold text-ink-primary">
            {editingId ? "Edit Client" : "New Client"}
          </h2>

          {editingId && (
            <div className="mb-4 flex items-center gap-3">
              {editingClient?.logoUrl && (
                <>
                  <img src={editingClient.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border-hairline" />
                  <IconButton icon="close" label="Remove logo" onClick={removeLogo} disabled={uploadingLogo} />
                </>
              )}
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:bg-accent-hover transition-colors">
                <span className="material-symbols-outlined text-[18px]">
                  {uploadingLogo ? "progress_activity" : "upload_file"}
                </span>
                <span>{uploadingLogo ? "Uploading…" : "Upload Logo"}</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = ""; // so picking the same file again still triggers
                    if (file) uploadLogo(file);
                  }}
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div><Label>Follow-up Date</Label><Input type="date" value={draft.followUpDate} onChange={(e) => setDraft({ ...draft, followUpDate: e.target.value })} /></div>
            <div className="col-span-2"><Label>Goals</Label><Textarea rows={2} value={draft.goals} onChange={(e) => setDraft({ ...draft, goals: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
            <div className="col-span-2"><Label>Preferences</Label><Textarea rows={2} value={draft.preferences} onChange={(e) => setDraft({ ...draft, preferences: e.target.value })} /></div>
            <div className="col-span-2"><Label>Decision Makers</Label><Textarea rows={2} value={draft.decisionMakers} onChange={(e) => setDraft({ ...draft, decisionMakers: e.target.value })} /></div>
            <div className="col-span-2"><Label>Pain Points</Label><Textarea rows={2} value={draft.painPoints} onChange={(e) => setDraft({ ...draft, painPoints: e.target.value })} /></div>
            <div className="col-span-2"><Label>Buying Criteria</Label><Textarea rows={2} value={draft.buyingCriteria} onChange={(e) => setDraft({ ...draft, buyingCriteria: e.target.value })} /></div>
            <div className="col-span-2"><Label>Known Objections</Label><Textarea rows={2} value={draft.knownObjections} onChange={(e) => setDraft({ ...draft, knownObjections: e.target.value })} /></div>
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
                <div className="flex items-center gap-2.5">
                  {c.logoUrl && (
                    <img src={c.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-border-hairline shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-ink-primary text-base">{c.name}</p>
                    <p className="text-xs text-ink-muted mt-0.5">{c.company || "Independent Buyer"}</p>
                  </div>
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
                <Button
                  variant="secondary"
                  className="text-xs py-1.5 px-3"
                  onClick={() => startEdit(c)}
                >
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
