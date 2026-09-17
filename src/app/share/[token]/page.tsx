"use client";

import { use, useEffect, useState } from "react";
import { Card, Button, Input, Textarea, Label, Badge } from "@/components/ui";
import dynamic from "next/dynamic";

const MoltenMetal = dynamic(() => import("@/components/MoltenMetal"), { ssr: false });

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

  if (error && !share) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4 text-sm text-ink-muted">
        {error}
      </div>
    );
  }

  if (!share) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0 text-sm text-ink-muted">
        Loading commercial proposal…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-surface-0 px-4 py-12 overflow-hidden text-ink-primary font-body">
      {/* Ambient MoltenMetal in background (capped at subtle opacity) */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0">
        <MoltenMetal />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-ink-muted font-mono">
            Commercial Proposal from {share.seller}
          </p>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-ink-primary tracking-tight">
            {share.client}
          </h1>
        </div>

        <Card className="border-border-hairline bg-surface-1/90 backdrop-blur-sm p-6">
          <pre className="whitespace-pre-wrap font-body text-xs sm:text-sm text-ink-secondary leading-relaxed">
            {share.proposal}
          </pre>
        </Card>

        {!!share.scenarios.length && (
          <Card className="border-border-hairline bg-surface-1/90 backdrop-blur-sm p-6">
            <h2 className="text-sm font-semibold text-ink-primary mb-3">Choose Scope & Delivery Package</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {share.scenarios.map((s) => (
                <button
                  key={s.name}
                  onClick={() => selectScenario(s.name)}
                  className={`rounded-[4px] border p-4 text-left transition-colors ${
                    share.selectedScenario === s.name
                      ? "border-accent bg-surface-2 ring-1 ring-accent"
                      : "border-border-hairline bg-surface-1 hover:bg-surface-2"
                  }`}
                >
                  <p className="font-medium text-ink-primary text-sm">{s.name}</p>
                  <p className="mt-2 text-lg font-mono tabular-nums text-accent font-semibold">
                    ${s.price.toLocaleString()}
                  </p>
                  <p className="text-xs text-ink-muted font-mono tabular-nums mt-0.5">{s.hours} hours estimated</p>
                </button>
              ))}
            </div>
          </Card>
        )}

        {share.decision ? (
          <Card className="border-border-hairline bg-surface-1/90 backdrop-blur-sm p-5">
            <p className="text-sm text-ink-primary">
              Decision recorded:{" "}
              <Badge tone={share.decision === "accepted" ? "success" : "warning"}>
                {share.decision.replaceAll("_", " ")}
              </Badge>
            </p>
          </Card>
        ) : done ? (
          <Card className="border-border-hairline bg-surface-1/90 backdrop-blur-sm p-5">
            <p className="text-sm text-status-success font-medium">
              Thank you — your response has been securely transmitted to {share.seller}.
            </p>
          </Card>
        ) : (
          <Card className="border-border-hairline bg-surface-1/90 backdrop-blur-sm p-6">
            <h2 className="text-sm font-semibold text-ink-primary mb-3">Authorize or Request Revisions</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Your email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
            <div className="mt-3">
              <Label>Note (required if requesting adjustments)</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && (
              <div className="mt-3 rounded-[4px] border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger font-mono">
                {error}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Button disabled={busy} onClick={() => decide("accepted")}>Accept proposal</Button>
              <Button variant="secondary" disabled={busy} onClick={() => decide("changes_requested")}>Request changes</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
