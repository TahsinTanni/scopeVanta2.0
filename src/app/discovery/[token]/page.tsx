"use client";

import { use, useEffect, useState } from "react";
import { Card, Button, Input, Textarea, Label } from "@/components/ui";

// Replaces legacy App.tsx's `#discovery=TOKEN` hash-fragment buyer view
// with a real URL (same rationale as /share/[token]).
export default function DiscoveryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [discovery, setDiscovery] = useState<{ client: string; questions: string[]; status: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/discovery-share/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setDiscovery(d.discovery);
          setAnswers(d.discovery.questions.map(() => ""));
        }
      });
  }, [token]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/discovery-share/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, answers }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not submit your answers.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (error && !discovery) return <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-foreground-muted">{error}</div>;
  if (!discovery) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-foreground-muted">Loading…</div>;
  if (done) return <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-success">Thanks — your answers were sent to {discovery.client}.</div>;

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <Card className="mx-auto max-w-lg">
        <h1 className="text-lg font-semibold text-foreground">A few quick questions from {discovery.client}</h1>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Your email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="mt-4 space-y-3">
          {discovery.questions.map((q, i) => (
            <div key={i}>
              <Label>{q}</Label>
              <Textarea rows={2} value={answers[i] || ""} onChange={(e) => setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))} />
            </div>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button className="mt-4" disabled={busy} onClick={submit}>Submit answers</Button>
      </Card>
    </div>
  );
}
