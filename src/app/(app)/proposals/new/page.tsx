"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, Button, Input, Textarea, Label, Select } from "@/components/ui";

// Replaces the brief-intake portion of legacy App.tsx's "new" view (start
// of the 2634-5387 block) — generation triggers POST /api/analyze, then
// hands off to the opportunity workspace at /proposals/[id].
type ClientOption = { id: string; name: string };

export default function NewProposalPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
  }, []);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, budget, timeline, client: clientName, clientId: clientId || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Analysis failed.");
        return;
      }
      router.push(`/proposals/${body.projectId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Proposal" description="Analyze → Clarify → Scope → Price → Propose" />
      <Card className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <Label>Saved client (optional)</Label>
            <Select value={clientId} onChange={(e) => { setClientId(e.target.value); const c = clients.find((x) => x.id === e.target.value); if (c) setClientName(c.name); }}>
              <option value="">None — new client name below</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Client / opportunity name</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp — website redesign" />
          </div>
          <div>
            <Label>Client brief</Label>
            <Textarea rows={8} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Paste the client's brief, RFP, or a detailed description of what they need." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Budget (optional)</Label><Input value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            <div><Label>Timeline (optional)</Label><Input value={timeline} onChange={(e) => setTimeline(e.target.value)} /></div>
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button className="mt-6" disabled={busy || brief.trim().length < 40} onClick={generate}>
          {busy ? "Analyzing…" : "Generate proposal"}
        </Button>
        {brief.trim().length > 0 && brief.trim().length < 40 && <p className="mt-2 text-xs text-foreground-subtle">Add more detail to the brief (at least 40 characters).</p>}
      </Card>
    </div>
  );
}
