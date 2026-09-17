"use client";

import { use, useEffect, useState } from "react";
import { Card, Button, Textarea, Input, Label, Badge, Select } from "@/components/ui";

type Project = {
  id: string;
  clientLabel: string | null;
  brief: string | null;
  proposal: string | null;
  riskScore: number | null;
  summary: string | null;
  risks: string[] | null;
  clarificationQuestions: string[] | null;
  dealStage: string;
  dealValue: string | null;
  currentVersion: number;
  evidenceStatus: string;
  commercialStale: boolean;
  shareToken: string | null;
  budget?: string | null;
  timeline?: string | null;
  visuals?: Array<{ type: string; title: string; labels: string[]; values: number[] }> | null;
  data: Record<string, unknown> | null;
};

const DEAL_STAGES = ["Draft", "Proposal Ready", "Sent", "Follow-up", "Negotiation", "Won", "Lost"];
const DEAL_OS_ACTIONS = [
  "discovery", "compile", "margin", "choices", "negotiation", "change",
  "autopsy", "premortem", "redteam", "personalize", "meeting", "responsibilities", "handoff", "copilot"
];

function parseProposalSections(text: string): Array<{ title: string; lines: string[] }> {
  if (!text) return [];
  const lines = text.split("\n");
  const sections: Array<{ title: string; lines: string[] }> = [];
  let currentSection = { title: "Overview", lines: [] as string[] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const isHeader =
      line.length > 2 &&
      line.length < 60 &&
      line === line.toUpperCase() &&
      !line.startsWith("-") &&
      !line.startsWith("*") &&
      !line.startsWith("•") &&
      !line.includes("$") &&
      !/^\d+\./.test(line);

    if (isHeader) {
      if (currentSection.lines.some((l) => l.trim().length > 0)) {
        sections.push(currentSection);
      }
      currentSection = { title: line, lines: [] };
    } else {
      currentSection.lines.push(rawLine);
    }
  }

  if (currentSection.lines.some((l) => l.trim().length > 0)) {
    sections.push(currentSection);
  }

  return sections;
}

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
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

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
    if (data) {
      load();
      setViewMode("preview");
    }
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

  function handleCopy() {
    navigator.clipboard.writeText(proposalDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportAsWordDoc() {
    if (!project) return;
    const title = project.clientLabel || "Client Proposal";
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const sections = parseProposalSections(proposalDraft);

    let sectionsHtml = "";
    for (const sec of sections) {
      sectionsHtml += `
        <div style="margin-bottom: 20pt; page-break-inside: avoid;">
          <h2 style="font-size: 13pt; font-weight: bold; color: #1e3a8a; border-bottom: 1.5pt solid #cbd5e1; padding-bottom: 4pt; margin-bottom: 8pt; text-transform: uppercase; letter-spacing: 0.5pt;">
            ${sec.title}
          </h2>
      `;
      for (const line of sec.lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          sectionsHtml += `<div style="height: 6pt;"></div>`;
        } else if (trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•")) {
          sectionsHtml += `<p style="margin: 3pt 0 3pt 18pt; color: #334155; font-size: 11pt;">▪ ${trimmed.replace(/^[-*•]\s*/, "")}</p>`;
        } else {
          sectionsHtml += `<p style="margin: 0 0 6pt 0; color: #334155; font-size: 11pt; line-height: 1.6;">${trimmed}</p>`;
        }
      }
      sectionsHtml += `</div>`;
    }

    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page { size: A4 portrait; margin: 1in 1in 1in 1in; }
          body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; }
        </style>
      </head>
      <body>
        <div style="border-bottom: 3pt solid #2563eb; padding-bottom: 14pt; margin-bottom: 20pt;">
          <h1 style="font-size: 24pt; font-weight: bold; color: #1e3a8a; margin: 0 0 6pt 0;">${title}</h1>
          <p style="font-size: 11pt; color: #64748b; margin: 0; font-weight: 500;">Commercial Scope & Delivery Agreement Proposal</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24pt; background-color: #f8fafc; border: 1pt solid #e2e8f0;">
          <tr>
            <td style="padding: 8pt 12pt; font-weight: bold; color: #475569; width: 25%;">Client / Project:</td>
            <td style="padding: 8pt 12pt; color: #0f172a; font-weight: 600;">${title}</td>
          </tr>
          <tr>
            <td style="padding: 8pt 12pt; font-weight: bold; color: #475569;">Prepared By:</td>
            <td style="padding: 8pt 12pt; color: #0f172a;">ScopeVanta Commercial Architecture</td>
          </tr>
          <tr>
            <td style="padding: 8pt 12pt; font-weight: bold; color: #475569;">Date:</td>
            <td style="padding: 8pt 12pt; color: #0f172a;">${date}</td>
          </tr>
          ${project.budget ? `<tr><td style="padding: 8pt 12pt; font-weight: bold; color: #475569;">Target Investment:</td><td style="padding: 8pt 12pt; color: #0f172a; font-weight: 600;">${project.budget}</td></tr>` : ""}
          ${project.timeline ? `<tr><td style="padding: 8pt 12pt; font-weight: bold; color: #475569;">Target Timeline:</td><td style="padding: 8pt 12pt; color: #0f172a;">${project.timeline}</td></tr>` : ""}
        </table>

        ${sectionsHtml}

        <div style="margin-top: 36pt; page-break-inside: avoid; border-top: 1.5pt solid #cbd5e1; padding-top: 18pt;">
          <h3 style="font-size: 12pt; color: #1e3a8a; margin-bottom: 18pt; text-transform: uppercase;">Acceptance & Sign-off</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 48%; padding-right: 12pt;">
                <p style="margin: 0 0 32pt 0; color: #64748b; font-size: 10pt;">For Client (${title}):</p>
                <div style="border-bottom: 1pt solid #000; margin-bottom: 6pt;"></div>
                <p style="font-size: 9pt; color: #64748b; margin: 0;">Authorized Signature & Date</p>
              </td>
              <td style="width: 4%;"></td>
              <td style="width: 48%; padding-left: 12pt;">
                <p style="margin: 0 0 32pt 0; color: #64748b; font-size: 10pt;">For Service Provider:</p>
                <div style="border-bottom: 1pt solid #000; margin-bottom: 6pt;"></div>
                <p style="font-size: 9pt; color: #64748b; margin: 0;">Authorized Signature & Date</p>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(["\ufeff" + docContent], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Proposal.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintPDF() {
    window.print();
  }

  const [showDocModal, setShowDocModal] = useState(false);

  if (!project) return <p className="text-sm text-foreground-muted">Loading…</p>;

  const parsedSections = parseProposalSections(proposalDraft);

  return (
    <div className="max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      {/* Top action & status bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-5 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{project.clientLabel || "Untitled opportunity"}</h1>
            <Badge tone={project.riskScore && project.riskScore > 65 ? "warning" : "success"}>
              Risk {project.riskScore ?? "—"}/100
            </Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Version {project.currentVersion} · {project.dealStage} · Last saved {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={project.dealStage} onChange={(e) => updateDeal({ dealStage: e.target.value })} className="w-36">
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input
            type="number"
            defaultValue={project.dealValue || ""}
            placeholder="Deal value ($)"
            className="w-32"
            onBlur={(e) => e.target.value && updateDeal({ dealValue: Number(e.target.value) })}
          />
          <Button variant="secondary" onClick={exportAsWordDoc} className="flex items-center gap-1.5 shadow-sm text-xs">
            📄 Export Word (.doc)
          </Button>
          <Button variant="primary" onClick={() => setShowDocModal(true)} className="flex items-center gap-1.5 shadow-sm text-xs">
            🖨️ Document View & PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENT PREVIEW & PDF PRINT MODAL */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 no-print overflow-y-auto">
          <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-xl bg-surface border border-border shadow-2xl overflow-hidden">
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between border-b border-border bg-surface-raised px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Executive Proposal Document</h3>
                <p className="text-xs text-foreground-muted">Formatted document ready for client presentation & PDF generation</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={exportAsWordDoc} className="text-xs py-1.5 px-3">
                  📄 Download Word (.doc)
                </Button>
                <Button variant="primary" onClick={handlePrintPDF} className="text-xs py-1.5 px-3">
                  🖨️ Print / Save as PDF
                </Button>
                <button
                  onClick={() => setShowDocModal(false)}
                  className="rounded-lg p-1.5 text-foreground-muted hover:bg-surface hover:text-foreground text-sm font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scrollable White Document Sheet */}
            <div className="flex-1 overflow-y-auto p-6 bg-neutral-900/60 flex justify-center">
              <div className="w-full max-w-3xl bg-white text-gray-900 shadow-2xl rounded-sm p-10 font-sans border border-gray-200">
                {/* Document Header */}
                <div className="border-b-2 border-blue-600 pb-4 mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-blue-900">{project.clientLabel || "Client Proposal"}</h1>
                  <p className="text-sm font-medium text-gray-500 mt-1">Commercial Scope & Delivery Proposal</p>
                </div>

                {/* Metadata Box */}
                <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded p-4 mb-8 text-xs">
                  <div>
                    <span className="font-semibold text-gray-500 block">Client / Opportunity:</span>
                    <span className="font-bold text-gray-900">{project.clientLabel || "Untitled"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500 block">Prepared By:</span>
                    <span className="font-medium text-gray-900">ScopeVanta Architecture</span>
                  </div>
                  {project.budget && (
                    <div>
                      <span className="font-semibold text-gray-500 block">Target Investment:</span>
                      <span className="font-bold text-blue-800">{project.budget}</span>
                    </div>
                  )}
                  {project.timeline && (
                    <div>
                      <span className="font-semibold text-gray-500 block">Estimated Timeline:</span>
                      <span className="font-medium text-gray-900">{project.timeline}</span>
                    </div>
                  )}
                </div>

                {/* Sections */}
                <div className="space-y-6">
                  {parsedSections.map((sec, sIdx) => (
                    <div key={sIdx} className="space-y-2">
                      <h2 className="text-sm font-bold uppercase tracking-wider text-blue-900 border-b border-gray-200 pb-1">
                        {sec.title}
                      </h2>
                      <div className="space-y-1.5 text-xs leading-relaxed text-gray-700">
                        {sec.lines.map((line, lIdx) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={lIdx} className="h-1.5" />;
                          const isBullet = trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•");
                          if (isBullet) {
                            return (
                              <div key={lIdx} className="flex items-start gap-2 pl-3">
                                <span className="text-blue-600 font-bold">•</span>
                                <span>{trimmed.replace(/^[-*•]\s*/, "")}</span>
                              </div>
                            );
                          }
                          return <p key={lIdx}>{line}</p>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sign-off Block */}
                <div className="mt-12 pt-6 border-t border-gray-300">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-6">Acceptance & Authorization</h3>
                  <div className="grid grid-cols-2 gap-8 text-xs text-gray-600">
                    <div>
                      <p className="mb-10">For Client ({project.clientLabel}):</p>
                      <div className="border-b border-gray-400 mb-1" />
                      <p className="text-[10px] text-gray-500">Authorized Signature & Date</p>
                    </div>
                    <div>
                      <p className="mb-10">For Service Provider:</p>
                      <div className="border-b border-gray-400 mb-1" />
                      <p className="text-[10px] text-gray-500">Authorized Signature & Date</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY CONTAINER (USED FOR CLEAN BROWSER PDF PRINTING) */}
      <div id="printable-proposal-doc" className="hidden print:block bg-white text-gray-900 p-8 font-sans">
        <div className="border-b-2 border-blue-600 pb-4 mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-blue-900">{project.clientLabel || "Client Proposal"}</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Commercial Scope & Delivery Proposal</p>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded p-4 mb-8 text-xs">
          <div>
            <span className="font-semibold text-gray-500 block">Client / Opportunity:</span>
            <span className="font-bold text-gray-900">{project.clientLabel || "Untitled"}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-500 block">Prepared By:</span>
            <span className="font-medium text-gray-900">ScopeVanta Architecture</span>
          </div>
          {project.budget && (
            <div>
              <span className="font-semibold text-gray-500 block">Target Investment:</span>
              <span className="font-bold text-blue-800">{project.budget}</span>
            </div>
          )}
          {project.timeline && (
            <div>
              <span className="font-semibold text-gray-500 block">Estimated Timeline:</span>
              <span className="font-medium text-gray-900">{project.timeline}</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {parsedSections.map((sec, sIdx) => (
            <div key={sIdx} className="space-y-2 page-break-inside-avoid">
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-900 border-b border-gray-200 pb-1">
                {sec.title}
              </h2>
              <div className="space-y-1.5 text-xs leading-relaxed text-gray-800">
                {sec.lines.map((line, lIdx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <div key={lIdx} className="h-1.5" />;
                  const isBullet = trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•");
                  if (isBullet) {
                    return (
                      <div key={lIdx} className="flex items-start gap-2 pl-3">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{trimmed.replace(/^[-*•]\s*/, "")}</span>
                      </div>
                    );
                  }
                  return <p key={lIdx}>{line}</p>;
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-300 page-break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-6">Acceptance & Authorization</h3>
          <div className="grid grid-cols-2 gap-8 text-xs text-gray-600">
            <div>
              <p className="mb-10">For Client ({project.clientLabel}):</p>
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-[10px] text-gray-500">Authorized Signature & Date</p>
            </div>
            <div>
              <p className="mb-10">For Service Provider:</p>
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-[10px] text-gray-500">Authorized Signature & Date</p>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="no-print rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {(project.evidenceStatus === "needs_review" || project.commercialStale) && (
        <div className="no-print rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {project.evidenceStatus === "needs_review" && "Evidence needs review after recent changes. "}
          {project.commercialStale && "Commercial guidance is stale — recalculate Opportunity Lab before sharing."}
        </div>
      )}

      {/* INITIAL CLIENT BRIEF & INTAKE SECTION */}
      {project.brief && (
        <Card className="no-print border-border/80 bg-surface/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-xs font-semibold text-accent">📋</span>
              <h2 className="text-sm font-semibold text-foreground">Original Client Request & Intake Context</h2>
            </div>
            <button
              onClick={() => setBriefExpanded(!briefExpanded)}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              {briefExpanded ? "Hide Details" : "Show Brief"}
            </button>
          </div>

          {briefExpanded && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-xs leading-relaxed text-foreground-muted whitespace-pre-wrap">
                {project.brief}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {project.budget && (
                  <div className="rounded-md border border-border-subtle bg-surface-raised p-2">
                    <span className="text-foreground-subtle block">Target Budget</span>
                    <span className="font-medium text-foreground">{project.budget}</span>
                  </div>
                )}
                {project.timeline && (
                  <div className="rounded-md border border-border-subtle bg-surface-raised p-2">
                    <span className="text-foreground-subtle block">Target Timeline</span>
                    <span className="font-medium text-foreground">{project.timeline}</span>
                  </div>
                )}
                <div className="rounded-md border border-border-subtle bg-surface-raised p-2">
                  <span className="text-foreground-subtle block">Diagnostic Risk Score</span>
                  <span className="font-medium text-foreground">{project.riskScore ?? 50}/100 (Commercial Exposure)</span>
                </div>
              </div>

              {project.risks && project.risks.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs font-medium text-foreground-subtle block mb-1">Identified Scope & Commercial Risks:</span>
                  <ul className="space-y-1 text-xs text-foreground-muted">
                    {project.risks.map((risk, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-warning mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* READINESS CHECKLIST */}
      {readiness && (
        <Card className="no-print">
          <h2 className="text-sm font-semibold text-foreground">Commercial Readiness</h2>
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

      {/* SCOPE ARCHITECTURE & MILESTONES DIAGRAM */}
      <Card className="no-print border-border/80">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Scope Architecture & Milestone Roadmap</h2>
            <p className="text-xs text-foreground-muted">Visual delivery phases and execution trajectory</p>
          </div>
          <Badge tone="neutral">Interactive Diagram</Badge>
        </div>

        <div className="mt-4 space-y-4">
          {/* Phase Sequence Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {[
              { phase: "Phase 1", title: "Discovery & Audit", dur: "Wk 1-2", desc: "UX friction, mobile checkout analytics, technical audit" },
              { phase: "Phase 2", title: "Core Redesign", dur: "Wk 3-5", desc: "Shopify checkout flow, page speed optimization, photography" },
              { phase: "Phase 3", title: "Integration", dur: "Wk 6-7", desc: "Klaviyo abandoned cart flow setup, QA & testing" },
              { phase: "Phase 4", title: "Launch & Sign-off", dur: "Wk 8", desc: "Pre-Black Friday release, performance monitoring" },
            ].map((step, idx) => (
              <div key={idx} className="rounded-lg border border-border-subtle bg-surface-raised p-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-foreground-subtle">
                  <span className="font-semibold text-accent">{step.phase}</span>
                  <span className="font-mono">{step.dur}</span>
                </div>
                <h4 className="text-xs font-semibold text-foreground mt-1">{step.title}</h4>
                <p className="text-[11px] text-foreground-muted mt-1 leading-snug">{step.desc}</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent/30" />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* PROPOSAL PRESENTATION & EDITOR */}
      <Card className="print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 no-print">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Client Proposal Document</h2>
            <Badge tone="neutral">{parsedSections.length} Sections</Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-raised">
              <button
                onClick={() => setViewMode("preview")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "preview" ? "bg-surface text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Executive Document View
              </button>
              <button
                onClick={() => setViewMode("edit")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "edit" ? "bg-surface text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Edit Text
              </button>
            </div>

            <Button variant="ghost" onClick={handleCopy} className="text-xs py-1 px-2.5">
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
        </div>

        {/* FORMATTED EXECUTIVE PREVIEW MODE */}
        {viewMode === "preview" ? (
          <div className="mt-4 space-y-6">
            {/* Document Header for Print / View */}
            <div className="border-b border-border pb-4 print:border-black">
              <h2 className="text-xl font-bold tracking-tight text-foreground print:text-black">{project.clientLabel || "Client Proposal"}</h2>
              <div className="mt-1 flex flex-wrap gap-4 text-xs text-foreground-muted print:text-black">
                {project.budget && <span>Budget: <strong className="text-foreground print:text-black">{project.budget}</strong></span>}
                {project.timeline && <span>Timeline: <strong className="text-foreground print:text-black">{project.timeline}</strong></span>}
                <span>Prepared by: <strong className="text-foreground print:text-black">ScopeVanta</strong></span>
              </div>
            </div>

            {/* Render Parsed Sections */}
            {parsedSections.map((sec, idx) => (
              <div key={idx} className="proposal-document-section space-y-2 rounded-lg border border-border-subtle/50 bg-surface-raised/30 p-4 print:border-none print:p-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-accent print:text-black">
                  {sec.title}
                </h3>
                <div className="space-y-1.5 text-xs leading-relaxed text-foreground-muted print:text-black">
                  {sec.lines.map((line, lIdx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={lIdx} className="h-1.5" />;
                    const isBullet = trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("•");
                    if (isBullet) {
                      const content = trimmed.replace(/^[-*•]\s*/, "");
                      return (
                        <div key={lIdx} className="flex items-start gap-2 pl-2">
                          <span className="text-accent mt-0.5 print:text-black">•</span>
                          <span>{content}</span>
                        </div>
                      );
                    }
                    return <p key={lIdx}>{line}</p>;
                  })}
                </div>
              </div>
            ))}

            {/* Scope Visuals if generated */}
            {project.visuals && project.visuals.length > 0 && (
              <div className="no-print rounded-lg border border-border-subtle bg-surface-raised/40 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-3">Project Visuals & Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.visuals.map((vis, vIdx) => (
                    <div key={vIdx} className="rounded-md border border-border-subtle bg-surface p-3">
                      <p className="text-xs font-semibold text-foreground mb-2">{vis.title}</p>
                      <div className="space-y-2">
                        {vis.labels.map((label, lIdx) => {
                          const val = vis.values[lIdx] ?? 0;
                          const max = Math.max(...vis.values, 1);
                          const pct = Math.round((val / max) * 100);
                          return (
                            <div key={lIdx} className="space-y-0.5">
                              <div className="flex justify-between text-[11px] text-foreground-muted">
                                <span>{label}</span>
                                <span className="font-mono">{val}</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-border-subtle">
                                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* RAW TEXTAREA EDIT MODE */
          <div className="mt-4">
            <Textarea
              rows={20}
              className="font-mono text-xs leading-relaxed"
              value={proposalDraft}
              onChange={(e) => setProposalDraft(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-foreground-subtle">
                {proposalDraft.split(/\s+/).filter(Boolean).length} words · {proposalDraft.length} characters
              </span>
              <Button disabled={busy === `/api/projects/${id}/proposal`} onClick={saveProposal}>
                Save proposal
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* CLARIFICATION QUESTIONS */}
      {!!(project.clarificationQuestions || []).length && (
        <Card className="no-print">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Clarification Questions (Scope Resolver)</h2>
              <p className="text-xs text-foreground-muted">Answer these questions to remove assumptions and make your proposal watertight.</p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {(project.clarificationQuestions || []).map((q, i) => (
              <div key={i} className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3">
                <Label>{q}</Label>
                <Input
                  placeholder="Type answer or confirmed detail..."
                  value={answers[i] || ""}
                  onChange={(e) => setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))}
                />
              </div>
            ))}
          </div>
          <Button className="mt-3" disabled={busy === `/api/projects/${id}/refine`} onClick={refine}>
            Refine & Regenerate Proposal
          </Button>
        </Card>
      )}

      {/* SCOPE & ECONOMICS */}
      <Card className="no-print">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Scope & Economics (Pricing & Profit Engine)</h2>
            <p className="text-xs text-foreground-muted">List project deliverables, hours, and rates to generate Baseline, Target, and Value pricing packages.</p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 text-sm items-center">
              <Input
                placeholder="Deliverable name (e.g. Checkout Redesign)"
                value={line.name}
                onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, name: e.target.value } : l)))}
                className="col-span-5"
              />
              <Input
                type="number"
                placeholder="Qty"
                value={line.qty}
                onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, qty: Number(e.target.value) } : l)))}
                className="col-span-1"
              />
              <Input
                type="number"
                placeholder="Hours"
                value={line.hours}
                onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, hours: Number(e.target.value) } : l)))}
                className="col-span-2"
              />
              <Input
                type="number"
                placeholder="Cost rate ($)"
                value={line.costRate}
                onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, costRate: Number(e.target.value) } : l)))}
                className="col-span-1"
              />
              <Input
                type="number"
                placeholder="Sell rate ($)"
                value={line.sellRate}
                onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, sellRate: Number(e.target.value) } : l)))}
                className="col-span-2"
              />
              <button
                type="button"
                onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                className="col-span-1 p-2 text-danger hover:bg-danger/10 rounded-lg text-center font-bold text-sm transition-colors"
                title="Remove deliverable"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => setLines((ls) => [...ls, { name: "", role: "", qty: 1, hours: 0, costRate: 0, sellRate: 0 }])}>
            + Add Deliverable
          </Button>
          <Button disabled={busy === `/api/projects/${id}/scope-economics`} onClick={calculateEconomics}>
            Calculate Packages
          </Button>
        </div>

        {!!scenarios.length && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {scenarios.map((s) => (
              <div key={s.name} className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-sm">
                <p className="font-semibold text-foreground">{s.name}</p>
                <p className="mt-1 text-lg font-bold text-accent">${s.price.toLocaleString()}</p>
                <p className="text-xs text-foreground-muted">{s.hours} hours · {s.marginPct}% profit margin</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* OPPORTUNITY LAB */}
      <Card className="no-print">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Opportunity Lab (Commercial Intelligence)</h2>
            <p className="text-xs text-foreground-muted">AI scope diagnosis: unpriced work, margin firewall, and feasibility checks.</p>
          </div>
          <Button variant="secondary" disabled={busy === `/api/projects/${id}/commercial-lab`} onClick={runCommercialLab}>
            Recalculate
          </Button>
        </div>
        {!!labResult && <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface-raised p-3 text-xs text-foreground-muted">{JSON.stringify(labResult, null, 2)}</pre>}
      </Card>

      {/* DEAL OS */}
      <Card className="no-print">
        <div className="border-b border-border/50 pb-2">
          <h2 className="text-sm font-semibold text-foreground">Deal-to-Profit OS (Deal Strategy Assistant)</h2>
          <p className="text-xs text-foreground-muted">14 tactical commercial actions: objection handling, negotiation leverage, scope change firewall, and premortem.</p>
        </div>
        <div className="mt-3 flex gap-2">
          <Select value={dealOSAction} onChange={(e) => setDealOSAction(e.target.value)} className="w-48">
            {DEAL_OS_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Input placeholder="Optional input (client objection, meeting notes, change request…)" value={dealOSInput} onChange={(e) => setDealOSInput(e.target.value)} />
          <Button disabled={busy === `/api/projects/${id}/deal-os`} onClick={runDealOS}>Run</Button>
        </div>
        {!!dealOSResult && <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface-raised p-3 text-xs text-foreground-muted">{JSON.stringify(dealOSResult, null, 2)}</pre>}
      </Card>

      {/* CLIENT DEAL ROOM */}
      <Card className="no-print">
        <div className="border-b border-border/50 pb-2">
          <h2 className="text-sm font-semibold text-foreground">Client Deal Room (Shareable Client Portal)</h2>
          <p className="text-xs text-foreground-muted">A private, secure web link for your client to review the proposal and select packages online.</p>
        </div>
        {project.shareToken ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-foreground-muted">
              Share link active · {shareAnalytics && `${shareAnalytics.views} views${shareAnalytics.selectedScenario ? ` · package selected: ${shareAnalytics.selectedScenario}` : ""}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/share/${project.shareToken}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline text-xs font-mono break-all hover:text-foreground inline-flex items-center gap-1.5 bg-surface-raised px-3 py-1.5 rounded-lg border border-border"
              >
                <span>{typeof window !== "undefined" ? `${window.location.origin}/share/${project.shareToken}` : `/share/${project.shareToken}`}</span>
                <svg className="w-3.5 h-3.5 inline text-foreground-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <Button
                variant="secondary"
                className="text-xs py-1.5 px-3 shrink-0"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(`${window.location.origin}/share/${project.shareToken}`);
                  }
                }}
              >
                Copy Link
              </Button>
            </div>
            <div>
              <Button variant="danger" onClick={revokeShare} className="text-xs py-1 px-3">Revoke Link</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-3" disabled={busy === `/api/projects/${id}/share`} onClick={createShare}>
            Generate Client Review Link
          </Button>
        )}
      </Card>

      {/* REVISION HISTORY */}
      <Card className="no-print">
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

