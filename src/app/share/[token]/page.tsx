"use client";

import { use, useEffect, useState } from "react";
import { Card, Button, Input, Textarea, Label, Badge } from "@/components/ui";

// Replaces legacy App.tsx's `#share=TOKEN` hash-fragment buyer view (lines
// 1659-1845) with a real, shareable, indexable URL — a deliberate
// improvement flagged in the Step 5 report, not a literal translation.
type ShareView = {
  client: string; seller: string; proposal: string; version: number; dealValue: number; status: string; decision: string;
  selectedScenario: string; scopeSummary: Array<{ name: string; qty: number; hours: number; acceptance: string }>;
  scenarios: Array<{ name: string; price: number; hours: number; marginPct: number }>; timeline: string; views: number;
};

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [share, setShare] = useState<ShareView | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/proposal-share/${token}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setShare(d.share)));
  }, [token]);

  async function selectScenario(scenarioName: string) {
    await fetch(`/api/proposal-share/${token}/scenario`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: scenarioName }) });
    setShare((s) => (s ? { ...s, selectedScenario: scenarioName } : s));
  }

  async function decide(decision: "accepted" | "changes_requested") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/proposal-share/${token}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, name, email, note }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not record your decision.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (error && !share) return <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-foreground-muted">{error}</div>;
  if (!share) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-foreground-muted">Loading…</div>;

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs text-foreground-subtle">Proposal from {share.seller}</p>
          <h1 className="text-xl font-semibold text-foreground">{share.client}</h1>
        </div>

        <Card>
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground-muted">{share.proposal}</pre>
        </Card>

        {!!share.scenarios.length && (
          <Card>
            <h2 className="text-sm font-semibold text-foreground">Choose a package</h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {share.scenarios.map((s) => (
                <button
                  key={s.name}
                  onClick={() => selectScenario(s.name)}
                  className={`rounded-lg border p-3 text-left text-sm ${share.selectedScenario === s.name ? "border-foreground bg-surface-raised" : "border-border"}`}
                >
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="mt-1 text-foreground-muted">${s.price.toLocaleString()}</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {share.decision ? (
          <Card>
            <p className="text-sm text-foreground">Decision recorded: <Badge tone={share.decision === "accepted" ? "success" : "warning"}>{share.decision.replaceAll("_", " ")}</Badge></p>
          </Card>
        ) : done ? (
          <Card><p className="text-sm text-success">Thank you — your response has been sent to {share.seller}.</p></Card>
        ) : (
          <Card>
            <h2 className="text-sm font-semibold text-foreground">Your decision</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Your email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="mt-3"><Label>Note (required if requesting changes)</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button disabled={busy} onClick={() => decide("accepted")}>Accept proposal</Button>
              <Button variant="secondary" disabled={busy} onClick={() => decide("changes_requested")}>Request changes</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
