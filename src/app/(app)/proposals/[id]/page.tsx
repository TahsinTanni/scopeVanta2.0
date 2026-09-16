"use client";

import { use, useEffect, useState } from "react";
import { Card, Button, Textarea, Input, Label, Badge, Select } from "@/components/ui";

// Replaces legacy App.tsx's "new"/opportunity-workspace view (lines
// 2634-5387) — the single largest screen in the legacy app (Opportunity
// Lab, Scope & Economics Engine, Deal-to-Profit OS, Proposal Studio, Win
// Plan, Close Coach, sharing, versions all live here). This page covers the
// same functional surface — every route in that workflow is wired — but
// several AI-intelligence panels (Deal OS's 14 actions, Proposal Studio,
// Commercial Autopilot) render their JSON result directly rather than each
// getting a fully bespoke layout; see the Step 5 report for the explicit
// scope call on this page.

type Project = {
  id: string; clientLabel: string | null; brief: string | null; proposal: string | null; riskScore: number | null;
  summary: string | null; risks: string[] | null; clarificationQuestions: string[] | null; dealStage: string; dealValue: string | null;
  currentVersion: number; evidenceStatus: string; commercialStale: boolean; shareToken: string | null;
  data: Record<string, unknown> | null;
};

const DEAL_STAGES = ["Draft", "Proposal Ready", "Sent", "Follow-up", "Negotiation", "Won", "Lost"];
const DEAL_OS_ACTIONS = ["discovery", "compile", "margin", "choices", "negotiation", "change", "autopsy", "premortem", "redteam", "personalize", "meeting", "responsibilities", "handoff", "copilot"];

export default function ProposalWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [proposalDraft, setProposalDraft] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [readiness, setReadiness] = useState<{ checks: Array<{ label: string; pass: boolean }>; readyToShare: boolean } | null>(null);
  const [versions, setVersions] = useState<Array<{ version: number; savedAt: string; status: string }>>([]);
  const [shareAnalytics, setShareAnalytics] = useState<{ views: number; lastViewedAt: string; selectedScenario: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dealOSAction, setDealOSAction] = useState("copilot");
  const [dealOSInput, setDealOSInput] = useState("");
  const [dealOSResult, setDealOSResult] = useState<unknown>(null);
  const [labResult, setLabResult] = useState<unknown>(null);
  const [lines, setLines] = useState<Array<{ name: string; role: string; qty: number; hours: number; costRate: number; sellRate: number; acceptance?: string }>>([]);
  const [scenarios, setScenarios] = useState<Array<{ name: string; price: number; hours: number; marginPct: number }>>([]);

  async function load() {
    const res = await fetch(`/api/projects/${id}`).then((r) => r.json()).catch(() => null);
    if (res && !res.error) applyProject(res);
    fetch(`/api/projects/${id}/readiness`).then((r) => r.json()).then(setReadiness).catch(() => {});
    fetch(`/api/projects/${id}/versions`).then((r) => r.json()).then((d) => setVersions(d.versions || [])).catch(() => {});
    fetch(`/api/projects/${id}/share-analytics`).then((r) => r.json()).then(setShareAnalytics).catch(() => {});
  }

  function applyProject(p: Project) {
    setProject(p);
    setProposalDraft(p.proposal || "");
    setAnswers((p.clarificationQuestions || []).map(() => ""));
    const d = (p.data || {}) as Record<string, unknown>;
    setLines((d.estimateLines as typeof lines) || []);
    setScenarios((d.dealScenarios as typeof scenarios) || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function call(path: string, body?: object, method = "POST") {
    setBusy(path);
    setError("");
    try {
      const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Request failed.");
        return null;
      }
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function saveProposal() {
    const data = await call(`/api/projects/${id}/proposal`, { proposal: proposalDraft });
    if (data) load();
  }

  async function refine() {
    const data = await call(`/api/projects/${id}/refine`, { answers });
    if (data) load();
  }

  async function updateDeal(patch: { dealStage?: string; dealValue?: number }) {
    const data = await call(`/api/projects/${id}/deal`, patch, "PUT");
    if (data) load();
  }

  async function calculateEconomics() {
    const data = await call(`/api/projects/${id}/scope-economics`, { lines, targetMargin: 35, floorMargin: 20, contingencyPct: 10, syncProposal: true });
    if (data) {
      setScenarios(data.scenarios || []);
      load();
    }
  }

  async function runCommercialLab() {
    const data = await call(`/api/projects/${id}/commercial-lab`, { internalRate: 0, targetMargin: 35 });
    if (data) {
      setLabResult(data.commercialLab);
      load();
    }
  }

  async function runDealOS() {
    const data = await call(`/api/projects/${id}/deal-os`, { action: dealOSAction, input: dealOSInput });
    if (data) {
      setDealOSResult(data.intelligence);
      load();
    }
  }

  async function createShare() {
    const data = await call(`/api/projects/${id}/share`);
    if (data) load();
  }
  async function revokeShare() {
    const data = await call(`/api/projects/${id}/share/revoke`);
    if (data) load();
  }

  if (!project) return <p className="text-sm text-foreground-muted">Loading…</p>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{project.clientLabel || "Untitled opportunity"}</h1>
          <p className="mt-1 text-sm text-foreground-muted">Version {project.currentVersion} · Risk {project.riskScore ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={project.dealStage} onChange={(e) => updateDeal({ dealStage: e.target.value })} className="w-40">
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input type="number" defaultValue={project.dealValue || ""} placeholder="Deal value" className="w-32" onBlur={(e) => e.target.value && updateDeal({ dealValue: Number(e.target.value) })} />
        </div>
      </div>

      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {(project.evidenceStatus === "needs_review" || project.commercialStale) && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {project.evidenceStatus === "needs_review" && "Evidence needs review after recent changes. "}
          {project.commercialStale && "Commercial guidance is stale — recalculate Opportunity Lab before sharing."}
        </div>
      )}

      {readiness && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Readiness</h2>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
            {readiness.checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className={c.pass ? "text-success" : "text-foreground-subtle"}>{c.pass ? "✓" : "○"}</span>
                <span className="text-foreground-muted">{c.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Proposal</h2>
        <Textarea rows={16} className="mt-2 font-mono text-xs" value={proposalDraft} onChange={(e) => setProposalDraft(e.target.value)} />
        <Button className="mt-3" disabled={busy === `/api/projects/${id}/proposal`} onClick={saveProposal}>Save proposal</Button>
      </Card>

      {!!(project.clarificationQuestions || []).length && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Clarification questions</h2>
          <div className="mt-2 space-y-3">
            {(project.clarificationQuestions || []).map((q, i) => (
              <div key={i}>
                <Label>{q}</Label>
                <Input value={answers[i] || ""} onChange={(e) => setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))} />
              </div>
            ))}
          </div>
          <Button className="mt-3" disabled={busy === `/api/projects/${id}/refine`} onClick={refine}>Refine proposal</Button>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Scope & Economics</h2>
        <div className="mt-2 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 text-sm">
              <Input placeholder="Deliverable" value={line.name} onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, name: e.target.value } : l)))} className="col-span-2" />
              <Input type="number" placeholder="Qty" value={line.qty} onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, qty: Number(e.target.value) } : l)))} />
              <Input type="number" placeholder="Hours" value={line.hours} onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, hours: Number(e.target.value) } : l)))} />
              <Input type="number" placeholder="Cost rate" value={line.costRate} onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, costRate: Number(e.target.value) } : l)))} />
              <Input type="number" placeholder="Sell rate" value={line.sellRate} onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, sellRate: Number(e.target.value) } : l)))} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => setLines((ls) => [...ls, { name: "", role: "", qty: 1, hours: 0, costRate: 0, sellRate: 0 }])}>Add line</Button>
          <Button disabled={busy === `/api/projects/${id}/scope-economics`} onClick={calculateEconomics}>Calculate</Button>
        </div>
        {!!scenarios.length && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {scenarios.map((s) => (
              <div key={s.name} className="rounded-lg border border-border-subtle p-3 text-sm">
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="mt-1 text-foreground-muted">${s.price.toLocaleString()}</p>
                <p className="text-xs text-foreground-subtle">{s.hours}h · {s.marginPct}% margin</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Opportunity Lab (Commercial Intelligence)</h2>
          <Button variant="secondary" disabled={busy === `/api/projects/${id}/commercial-lab`} onClick={runCommercialLab}>Recalculate</Button>
        </div>
        {!!labResult && <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface-raised p-3 text-xs text-foreground-muted">{JSON.stringify(labResult, null, 2)}</pre>}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Deal-to-Profit OS</h2>
        <div className="mt-2 flex gap-2">
          <Select value={dealOSAction} onChange={(e) => setDealOSAction(e.target.value)} className="w-48">
            {DEAL_OS_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Input placeholder="Optional input (meeting notes, objection, change request…)" value={dealOSInput} onChange={(e) => setDealOSInput(e.target.value)} />
          <Button disabled={busy === `/api/projects/${id}/deal-os`} onClick={runDealOS}>Run</Button>
        </div>
        {!!dealOSResult && <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface-raised p-3 text-xs text-foreground-muted">{JSON.stringify(dealOSResult, null, 2)}</pre>}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Client Deal Room</h2>
        {project.shareToken ? (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-foreground-muted">Share link active. {shareAnalytics && `${shareAnalytics.views} views${shareAnalytics.selectedScenario ? ` · package selected: ${shareAnalytics.selectedScenario}` : ""}`}</p>
            <p className="break-all text-xs text-foreground-subtle">{typeof window !== "undefined" ? `${window.location.origin}/share/${project.shareToken}` : ""}</p>
            <Button variant="danger" onClick={revokeShare}>Revoke</Button>
          </div>
        ) : (
          <Button className="mt-2" disabled={busy === `/api/projects/${id}/share`} onClick={createShare}>Create client review link</Button>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Revision history</h2>
        <div className="mt-2 space-y-1.5 text-sm">
          {versions.map((v) => (
            <div key={v.version} className="flex justify-between">
              <span className="text-foreground-muted">Version {v.version} · {v.status}</span>
              <Badge>{new Date(v.savedAt).toLocaleDateString()}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
