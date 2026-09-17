"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, Button, Input, Textarea, Label, Select } from "@/components/ui";

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
    <div className="space-y-6">
      <PageHeader title="New Proposal" description="Analyze → Clarify → Scope → Price → Propose" />
      <Card className="max-w-2xl border-border-hairline bg-surface-1 p-6">
        <div className="space-y-4">
          <div>
            <Label>Saved client (optional)</Label>
            <Select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const c = clients.find((x) => x.id === e.target.value);
                if (c) setClientName(c.name);
              }}
            >
              <option value="">None — new client name below</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Client / opportunity name</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Acme Corp — website redesign"
            />
          </div>
          <div>
            <Label>Client brief</Label>
            <Textarea
              rows={8}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Paste the client's brief, RFP, or a detailed description of what they need."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Budget (optional)</Label>
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. $15,000 - $25,000"
              />
            </div>
            <div>
              <Label>Timeline (optional)</Label>
              <Input
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g. 6-8 weeks"
              />
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-[4px] border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger font-mono">
            {error}
          </div>
        )}
        <div className="mt-6 flex items-center justify-between">
          <Button
            disabled={busy || brief.trim().length < 40}
            onClick={generate}
            className="flex items-center gap-2"
          >
            {busy ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Analyzing Scope…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                Generate proposal
              </>
            )}
          </Button>
          {brief.trim().length > 0 && brief.trim().length < 40 && (
            <p className="text-xs text-ink-muted">Add at least {40 - brief.trim().length} more characters to brief.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
