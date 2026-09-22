"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Textarea, Input, Label, Badge, Select, IconButton, StatusBanner } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { trackEvent } from "@/lib/track";
import { useToast } from "@/components/Toast";
import { DEAL_STAGES } from "@/lib/deal-stages";
import { formatCurrency, currencySymbol } from "@/lib/currency";
import { AIProgress } from "@/components/AIProgress";
import { useNavigationGuard } from "@/components/NavigationGuard";

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
  discoveryShareToken: string | null;
  budget?: string | null;
  timeline?: string | null;
  visuals?: Array<{ type: string; title: string; labels: string[]; values: number[] }> | null;
  proposalOptions?: { includeSellerLogo?: boolean } | null;
  data: Record<string, unknown> | null;
};

const CONTRACT_STATUSES = ["Signed", "Verbal agreement — pending signature", "Purchase order received"];
const DEAL_OS_ACTIONS = [
  "discovery", "compile", "margin", "choices", "negotiation", "change",
  "autopsy", "premortem", "redteam", "personalize", "meeting", "responsibilities", "handoff", "copilot"
];

const STUDIO_ACTIONS: Array<{ value: string; label: string }> = [
  { value: "audit", label: "Proposal Audit" },
  { value: "coverage", label: "Requirement Coverage" },
  { value: "modular", label: "Modular Section Builder" },
  { value: "approaches", label: "Alternative Approaches" },
  { value: "meeting", label: "Meeting / Call Update" },
  { value: "objection", label: "Objection Workspace" },
  { value: "followUp", label: "Follow-up Draft" },
];

// The six-step rail's step keys, in display order. "propose" is excluded
// from the Expand All / Collapse All "all expanded" calculation since its
// Client Proposal Document card is always visible regardless of this set.
const STEP_KEYS = ["understand", "scope", "price", "propose", "win", "protect"] as const;
const STEP_LABELS: Record<(typeof STEP_KEYS)[number], string> = {
  understand: "Understand",
  scope: "Scope",
  price: "Price",
  propose: "Propose",
  win: "Win",
  protect: "Protect",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectStudioShape(s: any): "audit" | "coverage" | "sections" | "approaches" | "meeting" | "objection" | "followUp" | "unknown" {
  if (Array.isArray(s) && s[0]?.title !== undefined) return "sections";
  if (Array.isArray(s) && s[0]?.name !== undefined) return "approaches";
  if (typeof s?.score === "number") return "audit";
  if (typeof s?.covered === "number") return "coverage";
  if (Array.isArray(s?.newRequirements)) return "meeting";
  if (typeof s?.objection === "string") return "objection";
  if (typeof s?.subject === "string") return "followUp";
  return "unknown";
}

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
  const [versions, setVersions] = useState<Array<{ version: number; savedAt: string; status: string; proposal: string; revisionSource: string }>>([]);
  const [restoredVersion, setRestoredVersion] = useState<number | null>(null);
  const editorCardRef = useRef<HTMLDivElement>(null);
  const [shareAnalytics, setShareAnalytics] = useState<{
    views: number; lastViewedAt: string; selectedScenario: string;
    decision?: string; decisionNote?: string; decisionName?: string; decisionEmail?: string; decidedAt?: string;
    releaseId?: string; releaseHash?: string;
    events?: Array<{ type: string; at: string; name?: string }>;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [briefExpanded, setBriefExpanded] = useState(true);
  const { showToast } = useToast();
  const router = useRouter();
  const { setNavigationGuard } = useNavigationGuard();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [intelligenceMode, setIntelligenceMode] = useState<"guided" | "full">("guided");
  const [pendingDealStage, setPendingDealStage] = useState<"Won" | "Lost" | null>(null);
  const [outcomeReasonDraft, setOutcomeReasonDraft] = useState("");
  // Commercial Closure Gate (Won only)
  const [contractStatus, setContractStatus] = useState("");
  const [packageChoice, setPackageChoice] = useState("");
  const [packageCustom, setPackageCustom] = useState("");
  const [finalPriceDraft, setFinalPriceDraft] = useState("");
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositReceived, setDepositReceived] = useState(false);
  const [kickoffDate, setKickoffDate] = useState("");
  const [kickoffAuthorized, setKickoffAuthorized] = useState(false);

  const [dealOSAction, setDealOSAction] = useState("copilot");
  const [dealOSInput, setDealOSInput] = useState("");
  const [dealOSResult, setDealOSResult] = useState<unknown>(null);
  const [labResult, setLabResult] = useState<unknown>(null);
  const [lines, setLines] = useState<Array<{ name: string; role: string; qty: number; hours: number; costRate: number; sellRate: number; acceptance?: string }>>([]);
  const [graphNodes, setGraphNodes] = useState<Array<{ id: string; type: string; label: string; parentId: string; hours: number; acceptance: string }>>([]);
  const [scenarios, setScenarios] = useState<Array<{ name: string; price: number; hours: number; marginPct: number }>>([]);
  const [actualRevenue, setActualRevenue] = useState(0);
  const [actualCost, setActualCost] = useState(0);
  const [actualHours, setActualHours] = useState(0);
  const [clientRequestInbox, setClientRequestInbox] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [history, setHistory] = useState<{ baselines: Array<{ id: string; createdAt: string; snapshot: { version?: number } }>; changeOrders: Array<{ id: string; createdAt: string; status: string }> }>({ baselines: [], changeOrders: [] });
  const [copiedChangeOrder, setCopiedChangeOrder] = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState(false);
  const [copiedWinPlanFollowUp, setCopiedWinPlanFollowUp] = useState(false);
  const [studioAction, setStudioAction] = useState("audit");
  const [studioInput, setStudioInput] = useState("");
  const [copiedStudioFollowUp, setCopiedStudioFollowUp] = useState(false);
  const [copiedDiscoveryLink, setCopiedDiscoveryLink] = useState(false);
  const [sellerLogoPath, setSellerLogoPath] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(["understand"]));

  async function load() {
    const res = await fetch(`/api/projects/${id}`).then((r) => r.json()).catch(() => null);
    if (res && !res.error) applyProject(res);
    fetch(`/api/projects/${id}/readiness`).then((r) => r.json()).then(setReadiness).catch(() => {});
    fetch(`/api/projects/${id}/versions`).then((r) => r.json()).then((d) => setVersions(d.versions || [])).catch(() => {});
    fetch(`/api/projects/${id}/share-analytics`).then((r) => r.json()).then(setShareAnalytics).catch(() => {});
    fetch(`/api/projects/${id}/commercial-history`).then((r) => r.json()).then((d) => setHistory({ baselines: d.baselines || [], changeOrders: d.changeOrders || [] })).catch(() => {});
    fetch(`/api/workspace/profile`).then((r) => r.json()).then((d) => { setSellerLogoPath(d.profile?.logoPath || ""); setCurrency(d.profile?.currency || "USD"); }).catch(() => {});
  }

  function applyProject(p: Project) {
    setProject(p);
    setProposalDraft(p.proposal || "");
    setAnswers((p.clarificationQuestions || []).map(() => ""));
    const d = (p.data || {}) as Record<string, unknown>;
    setLines((d.estimateLines as typeof lines) || []);
    setGraphNodes((d.scopeGraph as typeof graphNodes) || []);
    setScenarios((d.dealScenarios as typeof scenarios) || []);
    setActualRevenue((d.actualRevenue as number) || 0);
    setActualCost((d.actualCost as number) || 0);
    setActualHours((d.actualHours as number) || 0);
    setClientRequestInbox((d.clientRequestInbox as string) || "");
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
      if (!data.unchanged) trackEvent("proposal_edited", { projectId: id });
      load();
      setViewMode("preview");
    }
  }

  // Per-browser UI preference (not project data). Read on mount, written on change.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("scopevanta:intelligenceMode");
      if (saved === "guided" || saved === "full") setIntelligenceMode(saved);
    } catch {}
  }, []);

  function changeIntelligenceMode(mode: "guided" | "full") {
    setIntelligenceMode(mode);
    try {
      localStorage.setItem("scopevanta:intelligenceMode", mode);
    } catch {}
  }

  const nextBestAction = typeof project?.data?.nextBestAction === "string" ? project.data.nextBestAction.trim() : "";

  const unsavedEdits = proposalDraft !== (project?.proposal || "");

  // Guard user clicks on links (sidebar etc.) while there are unsaved edits.
  // Programmatic router.push() calls never pass through here.
  useEffect(() => {
    if (!unsavedEdits) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || !anchor.href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      setPendingNavigation(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [unsavedEdits]);

  // Own the shared navigation guard only while there is something to protect,
  // so programmatic navigation (command palette) opens the same dialog.
  useEffect(() => {
    if (!unsavedEdits) return;
    setNavigationGuard((href) => setPendingNavigation(href));
    return () => setNavigationGuard(null);
  }, [unsavedEdits, setNavigationGuard]);

  // Native "leave site?" prompt for tab close / refresh / typed URL / external links.
  useEffect(() => {
    if (!unsavedEdits) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedEdits]);

  function restoreVersion(version: (typeof versions)[number]) {
    const hasUnsavedEdits = proposalDraft !== (project?.proposal || "");
    if (hasUnsavedEdits) {
      const confirmed = window.confirm(
        `You have unsaved changes in the editor. Restoring version ${version.version} will discard them. Continue?`
      );
      if (!confirmed) return;
    }
    setProposalDraft(version.proposal);
    setViewMode("edit");
    editorCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setRestoredVersion(version.version);
    setTimeout(() => setRestoredVersion(null), 2000);
  }

  async function refine() {
    const data = await call(`/api/projects/${id}/refine`, { answers });
    if (data) {
      trackEvent("proposal_refined", { projectId: id });
      load();
    }
  }

  function closeDealDialog() {
    setPendingDealStage(null);
    setOutcomeReasonDraft("");
    setContractStatus("");
    setPackageChoice("");
    setPackageCustom("");
    setFinalPriceDraft("");
    setDepositRequired(false);
    setDepositReceived(false);
    setKickoffDate("");
    setKickoffAuthorized(false);
  }

  async function updateDeal(patch: {
    dealStage?: string; dealValue?: number; outcomeReason?: string;
    contractStatus?: string; finalPackage?: string; finalPrice?: number; depositRequired?: boolean; depositReceived?: boolean;
    kickoffDate?: string; kickoffAuthorized?: boolean;
  }) {
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

  async function saveScopeGraph() {
    const data = await call(`/api/projects/${id}/scope-graph`, { nodes: graphNodes });
    if (data) load();
  }

  async function saveActuals() {
    const data = await call(`/api/projects/${id}/commercial-state`, { estimateLines: lines, actualRevenue, actualCost, actualHours, clientRequest: clientRequestInbox });
    if (data) load();
  }

  async function runCommercialLab() {
    const data = await call(`/api/projects/${id}/commercial-lab`, { internalRate: 0, targetMargin: 35, changeRequest });
    if (data) {
      setLabResult(data.commercialLab);
      setChangeRequest("");
      load();
    }
  }

  async function establishBaseline() {
    const data = await call(`/api/projects/${id}/scope-baseline`);
    if (data) load();
  }

  async function approveChangeOrder() {
    const data = await call(`/api/projects/${id}/change-order/approve`);
    if (data) load();
  }

  function handleCopyChangeOrder() {
    navigator.clipboard.writeText(String(project?.data?.changeOrderDraft || ""));
    setCopiedChangeOrder(true);
    setTimeout(() => setCopiedChangeOrder(false), 2000);
  }

  async function getClosingGuidance() {
    const data = await call(`/api/projects/${id}/close-coach`);
    if (data) load();
  }

  function handleCopyFollowUp() {
    navigator.clipboard.writeText(String((project?.data?.closeCoach as { followUp?: string } | undefined)?.followUp || ""));
    setCopiedFollowUp(true);
    setTimeout(() => setCopiedFollowUp(false), 2000);
  }

  async function buildWinPlan() {
    const data = await call(`/api/projects/${id}/win-plan`);
    if (data) load();
  }

  function handleCopyWinPlanFollowUp() {
    navigator.clipboard.writeText(String((project?.data?.winPlan as { followUp?: string } | undefined)?.followUp || ""));
    setCopiedWinPlanFollowUp(true);
    setTimeout(() => setCopiedWinPlanFollowUp(false), 2000);
  }

  async function runProposalStudio() {
    const data = await call(`/api/projects/${id}/proposal-studio`, { action: studioAction, input: studioInput });
    if (data) {
      setStudioInput("");
      load();
    }
  }

  function handleCopyStudioFollowUp() {
    navigator.clipboard.writeText(String((project?.data?.proposalStudio as { body?: string } | undefined)?.body || ""));
    setCopiedStudioFollowUp(true);
    setTimeout(() => setCopiedStudioFollowUp(false), 2000);
  }

  async function runAutopilot() {
    const data = await call(`/api/projects/${id}/commercial-autopilot`);
    if (data) load();
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

  async function createDiscoveryShare() {
    const data = await call(`/api/projects/${id}/discovery-share`);
    if (data) load();
  }

  async function revokeDiscoveryShare() {
    const data = await call(`/api/projects/${id}/discovery-share/revoke`);
    if (data) load();
  }

  function handleCopyDiscoveryLink() {
    navigator.clipboard.writeText(
      `${typeof window !== "undefined" ? window.location.origin : ""}/discovery/${project?.discoveryShareToken || ""}`
    );
    setCopiedDiscoveryLink(true);
    setTimeout(() => setCopiedDiscoveryLink(false), 2000);
  }

  function handleCopy() {
    navigator.clipboard.writeText(proposalDraft);
    showToast("Copied to clipboard", "success");
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

    const blob = new Blob(["﻿" + docContent], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Proposal.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrintPDF() {
    trackEvent("proposal_printed", { projectId: id });
    window.print();
  }

  const [showDocModal, setShowDocModal] = useState(false);

  if (!project) return <p className="text-sm text-foreground-muted">Loading…</p>;

  const parsedSections = parseProposalSections(proposalDraft);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studio = project.data?.proposalStudio as any;
  const studioShape = detectStudioShape(studio);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autopilot = project.data?.commercialAutopilot as any;

  function graphNodeDepth(node: (typeof graphNodes)[number]): number {
    let depth = 0;
    let current = node;
    for (let steps = 0; steps < graphNodes.length && current.parentId; steps++) {
      const parent = graphNodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      depth++;
      current = parent;
    }
    return depth;
  }

  function toggleStep(key: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAndScrollTo(key: string) {
    setExpandedSteps((prev) => new Set(prev).add(key));
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function expandAllSteps() {
    setExpandedSteps(new Set(STEP_KEYS));
  }

  function collapseAllSteps() {
    setExpandedSteps(new Set(["understand"]));
  }

  const coreSteps = ["understand", "scope", "price", "win", "protect"];
  const allCoreExpanded = coreSteps.every((k) => expandedSteps.has(k));

  // Only wired to fields this file already confirms exist on project.data
  // elsewhere (winPlan, scopeGraph, proposalStudio, scopeBaseline,
  // clientDiscovery) — "price" has no confirmed persisted flag for whether
  // Opportunity Lab has been run, so it's deliberately left without a dot
  // rather than guessing one.
  const stepHasContent: Record<string, boolean> = {
    understand: !!project.data?.clientDiscovery,
    scope: !!(project.data?.scopeGraph as unknown[] | undefined)?.length,
    price: false,
    propose: !!project.data?.proposalStudio,
    win: !!project.data?.winPlan,
    protect: !!project.data?.scopeBaseline,
  };

  // Step header counts: base cards always shown + the advanced (AI) modules only in Full mode.
  const advancedCount = (n: number) => (intelligenceMode === "full" ? n : 0);
  const priceCount = 1 + advancedCount(1); // Scope & Economics (+ Opportunity Lab)
  const proposeCount = 2 + advancedCount(1); // Document, Deal Room (+ Proposal Studio)
  const winCount = advancedCount(3); // Deal-to-Profit OS, Win Plan, Close Coach
  const protectCount = 3 + advancedCount(1); // Baseline, Actuals, History (+ Commercial Autopilot)
  const understandCount = (project.brief ? 1 : 0) + ((project.clarificationQuestions || []).length ? 1 : 0) + 1;

  function StepHeader({ stepKey, count }: { stepKey: (typeof STEP_KEYS)[number]; count: number }) {
    const expanded = expandedSteps.has(stepKey);
    return (
      <button
        onClick={() => toggleStep(stepKey)}
        className="no-print flex w-full items-center justify-between py-2 text-left"
      >
        <span className="text-sm font-semibold text-ink-primary font-display">
          {STEP_LABELS[stepKey]} <span className="text-xs font-mono text-ink-muted">({count})</span>
        </span>
        <span
          className={`material-symbols-outlined text-[20px] text-ink-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Top action & status bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-hairline pb-5 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-medium tracking-tight text-ink-primary">
              {project.clientLabel || "Untitled opportunity"}
            </h1>
            <Badge tone={project.riskScore && project.riskScore > 65 ? "warning" : "success"}>
              Risk {project.riskScore ?? "—"}/100
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted font-mono tabular-nums">
            Version {project.currentVersion} · {project.dealStage} · Last saved {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={project.dealStage}
            onChange={(e) => {
              const next = e.target.value;
              // Won/Lost need a recorded reason (required by the deal route), so collect it first.
              if (next === "Won" || next === "Lost") {
                setPendingDealStage(next);
                if (next === "Won") setFinalPriceDraft(String(Number(project.dealValue || 0) || ""));
              }
              else updateDeal({ dealStage: next });
            }}
            className="w-36 text-xs"
          >
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input
            type="number"
            defaultValue={project.dealValue || ""}
            placeholder={`Deal value (${currencySymbol(currency)})`}
            className="w-32 text-xs font-mono tabular-nums"
            onBlur={(e) => e.target.value && updateDeal({ dealValue: Number(e.target.value) })}
          />
          <Button variant="secondary" onClick={exportAsWordDoc} className="flex items-center gap-1.5 text-xs py-1.5 px-3">
            <span className="material-symbols-outlined text-[16px]">description</span>
            Word (.doc)
          </Button>
          <Button variant="primary" onClick={() => setShowDocModal(true)} className="flex items-center gap-1.5 text-xs py-1.5 px-3">
            <span className="material-symbols-outlined text-[16px]">print</span>
            Document / PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENT PREVIEW & PDF PRINT MODAL */}
      <Dialog open={showDocModal} onClose={() => setShowDocModal(false)} title="Executive Proposal Document" className="max-w-4xl">
            {/* Modal Header Bar */}
            <div className="flex items-center justify-between border-b border-border-hairline bg-surface-2 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-ink-primary font-display">Executive Proposal Document</h3>
                <p className="text-xs text-ink-muted">Formatted document ready for client presentation & PDF generation</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={exportAsWordDoc} className="text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  Word (.doc)
                </Button>
                <Button variant="primary" onClick={handlePrintPDF} className="text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print / Save PDF
                </Button>
                <IconButton icon="close" label="Close" onClick={() => setShowDocModal(false)} className="ml-2" />
              </div>
            </div>

            {/* Modal Scrollable White Document Sheet */}
            <div className="flex-1 overflow-y-auto p-6 bg-surface-0 flex justify-center">
              <div className="w-full max-w-3xl bg-white text-gray-900 shadow-2xl rounded-[4px] p-10 font-sans border border-gray-200">
                {/* Document Header */}
                <div className="border-b-2 border-emerald-700 pb-4 mb-6">
                  <h1 className="text-2xl font-bold tracking-tight text-emerald-950 font-serif">{project.clientLabel || "Client Proposal"}</h1>
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
      </Dialog>

      <Dialog open={pendingNavigation !== null} onClose={() => setPendingNavigation(null)} title="Unsaved changes">
        <div className="space-y-4 p-6">
          <h3 className="font-display text-base font-semibold text-ink-primary">Unsaved changes</h3>
          <p className="text-sm text-ink-secondary">
            You have unsaved changes in the proposal editor. Leaving now will discard them.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingNavigation(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = pendingNavigation;
                if (target) router.push(target);
                setPendingNavigation(null);
              }}
            >
              Leave Without Saving
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={pendingDealStage !== null}
        onClose={closeDealDialog}
        title={`Why was this deal ${pendingDealStage ?? ""}?`}
      >
        <div className="space-y-4 p-6">
          <h3 className="font-display text-base font-semibold text-ink-primary">Why was this deal {pendingDealStage}?</h3>
          <Textarea rows={4} value={outcomeReasonDraft} onChange={(e) => setOutcomeReasonDraft(e.target.value)} />
          {pendingDealStage === "Won" && (
            <div className="space-y-3 border-t border-border-hairline pt-4">
              <div>
                <Label>Contract status</Label>
                <Select value={contractStatus} onChange={(e) => setContractStatus(e.target.value)}>
                  <option value="">Select…</option>
                  {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label>Final package</Label>
                {scenarios.length > 0 && (
                  <Select value={packageChoice} onChange={(e) => setPackageChoice(e.target.value)}>
                    <option value="">Select…</option>
                    {scenarios.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    <option value="__custom">Custom</option>
                  </Select>
                )}
                {(scenarios.length === 0 || packageChoice === "__custom") && (
                  <Input className={scenarios.length > 0 ? "mt-2" : ""} value={packageCustom} onChange={(e) => setPackageCustom(e.target.value)} placeholder="Package name" />
                )}
              </div>
              <div>
                <Label>Final price ({currencySymbol(currency)})</Label>
                <Input type="number" min={0} step="0.01" value={finalPriceDraft} onChange={(e) => setFinalPriceDraft(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-ink-secondary">
                  <input type="checkbox" className="h-4 w-4 accent-accent" checked={depositRequired} onChange={(e) => { setDepositRequired(e.target.checked); if (!e.target.checked) setDepositReceived(false); }} />
                  Deposit required
                </label>
                {depositRequired && (
                  <label className="ml-6 flex items-center gap-2 text-xs text-ink-secondary">
                    <input type="checkbox" className="h-4 w-4 accent-accent" checked={depositReceived} onChange={(e) => setDepositReceived(e.target.checked)} />
                    Deposit received
                  </label>
                )}
              </div>
              <div>
                <Label>Kickoff date</Label>
                <Input type="date" value={kickoffDate} onChange={(e) => setKickoffDate(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-primary">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={kickoffAuthorized} onChange={(e) => setKickoffAuthorized(e.target.checked)} />
                I confirm this deal is ready for kickoff
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDealDialog}>
              Cancel
            </Button>
            <Button
              variant={pendingDealStage === "Lost" ? "danger" : "primary"}
              disabled={
                !outcomeReasonDraft.trim() ||
                (pendingDealStage === "Won" &&
                  (!contractStatus ||
                    finalPriceDraft.trim() === "" ||
                    !Number.isFinite(Number(finalPriceDraft)) ||
                    Number(finalPriceDraft) < 0 ||
                    !kickoffDate ||
                    !kickoffAuthorized))
              }
              onClick={() => {
                if (!pendingDealStage) return;
                if (pendingDealStage === "Won") {
                  updateDeal({
                    dealStage: "Won",
                    outcomeReason: outcomeReasonDraft.trim(),
                    contractStatus,
                    finalPackage: (scenarios.length === 0 || packageChoice === "__custom" ? packageCustom : packageChoice).trim(),
                    finalPrice: Number(finalPriceDraft),
                    depositRequired,
                    depositReceived,
                    kickoffDate,
                    kickoffAuthorized,
                  });
                } else {
                  updateDeal({ dealStage: pendingDealStage, outcomeReason: outcomeReasonDraft.trim() });
                }
                closeDealDialog();
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>

      {/* HIDDEN PRINT-ONLY CONTAINER (USED FOR CLEAN BROWSER PDF PRINTING) */}
      <div id="printable-proposal-doc" className="hidden print:block bg-white text-gray-900 p-8 font-sans">
        {project.proposalOptions?.includeSellerLogo && sellerLogoPath && (
          <img src={sellerLogoPath} alt="" className="max-h-12 mb-4" />
        )}
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

      {error && <StatusBanner tone="danger" className="no-print">{error}</StatusBanner>}

      {(project.evidenceStatus === "needs_review" || project.commercialStale) && (
        <div className="no-print rounded-[4px] border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-mono text-warning">
          {project.evidenceStatus === "needs_review" && "Evidence needs review after recent changes. "}
          {project.commercialStale && "Commercial guidance is stale — recalculate Opportunity Lab before sharing."}
        </div>
      )}

      {/* INTELLIGENCE MODE */}
      <div className="no-print inline-flex rounded-[4px] border border-border-hairline bg-surface-1 p-0.5" role="group" aria-label="Intelligence mode">
        {([["guided", "Guided"], ["full", "Full Intelligence"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={intelligenceMode === mode}
            onClick={() => changeIntelligenceMode(mode)}
            className={`rounded-[3px] px-3 py-1 text-xs font-medium transition-colors ${
              intelligenceMode === mode ? "bg-accent text-surface-0" : "text-ink-muted hover:text-ink-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* GUIDED-MODE HERO */}
      {intelligenceMode === "guided" && (
        <Card className="no-print border-border-hairline bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-ink-primary font-display">Next Recommended Action</h2>
          {nextBestAction ? (
            <p className="mt-2 text-sm text-ink-secondary">{nextBestAction}</p>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              Run the opportunity through Scope &amp; Economics and Deal-to-Profit OS to get a specific next step
            </p>
          )}
          <Button variant="secondary" className="mt-4 text-xs py-1 px-2.5" onClick={() => changeIntelligenceMode("full")}>
            Switch to Full Intelligence
          </Button>
        </Card>
      )}

      {/* SIX-STEP RAIL */}
      <div className="no-print sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-border-hairline bg-surface-0 py-2.5">
        <div className="flex items-center gap-1">
          {STEP_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => expandAndScrollTo(key)}
              className="relative rounded-[4px] px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary transition-colors"
            >
              {STEP_LABELS[key]}
              {stepHasContent[key] && <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={allCoreExpanded ? collapseAllSteps : expandAllSteps}>
          {allCoreExpanded ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {/* READINESS CHECKLIST */}
      {readiness && (
        <Card className="no-print border-border-hairline bg-surface-1 p-5">
          <h2 className="text-sm font-semibold text-ink-primary font-display">Commercial Readiness</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs font-mono">
            {readiness.checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className={c.pass ? "text-success font-bold" : "text-ink-muted"}>
                  {c.pass ? "✓" : "○"}
                </span>
                <span className="text-ink-secondary">{c.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* STEP: UNDERSTAND */}
      <div id="step-understand">
        <StepHeader stepKey="understand" count={understandCount} />
        {expandedSteps.has("understand") && (
          <div className="mt-2 space-y-6">
            {/* INITIAL CLIENT BRIEF & INTAKE SECTION */}
            {project.brief && (
              <Card className="no-print border-border-hairline bg-surface-1 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-accent text-[18px]">assignment</span>
                    <h2 className="text-sm font-semibold text-ink-primary font-display">Original Client Request & Intake Context</h2>
                  </div>
                  <button
                    onClick={() => setBriefExpanded(!briefExpanded)}
                    className="text-xs text-ink-muted hover:text-ink-primary font-mono transition-colors"
                  >
                    {briefExpanded ? "Hide Details" : "Show Brief"}
                  </button>
                </div>

                {briefExpanded && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 text-xs leading-relaxed text-ink-secondary whitespace-pre-wrap font-body">
                      {project.brief}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-mono tabular-nums">
                      {project.budget && (
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Target Budget</span>
                          <span className="font-semibold text-ink-primary">{project.budget}</span>
                        </div>
                      )}
                      {project.timeline && (
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Target Timeline</span>
                          <span className="font-semibold text-ink-primary">{project.timeline}</span>
                        </div>
                      )}
                      <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                        <span className="text-ink-muted block text-[11px]">Diagnostic Risk Score</span>
                        <span className="font-semibold text-ink-primary">{project.riskScore ?? 50}/100</span>
                      </div>
                    </div>

                    {project.risks && project.risks.length > 0 && (
                      <div className="mt-3 border-t border-border-hairline/60 pt-3">
                        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider block mb-2 font-mono">
                          Identified Commercial Risks:
                        </span>
                        <ul className="space-y-1.5 text-xs text-ink-secondary">
                          {project.risks.map((risk, idx) => (
                            <li key={idx} className="flex items-start gap-2">
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

            {/* CLARIFICATION QUESTIONS */}
            {!!(project.clarificationQuestions || []).length && (
              <Card className="no-print border-border-hairline bg-surface-1 p-5">
                <div className="flex items-center justify-between border-b border-border-hairline pb-2">
                  <div>
                    <h2 className="text-sm font-semibold text-ink-primary font-display">Clarification Questions (Scope Resolver)</h2>
                    <p className="text-xs text-ink-muted">Answer these questions to remove assumptions and make your proposal watertight.</p>
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {(project.clarificationQuestions || []).map((q, i) => (
                    <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3.5">
                      <Label>{q}</Label>
                      <Input
                        placeholder="Type answer or confirmed detail..."
                        value={answers[i] || ""}
                        onChange={(e) => setAnswers((a) => a.map((v, idx) => (idx === i ? e.target.value : v)))}
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button disabled={busy === `/api/projects/${id}/refine`} loading={busy === `/api/projects/${id}/refine`} onClick={refine}>
                    Refine & Regenerate Proposal
                  </Button>
                  <AIProgress active={busy === `/api/projects/${id}/refine`} durationMs={10000} label="Refining" />
                </div>
              </Card>
            )}

            {/* DISCOVERY LINK */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Discovery Link</h2>
                <p className="text-xs text-ink-muted">Send buyer-facing discovery questions and collect answers before scoping.</p>
              </div>

              {!project.discoveryShareToken ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-ink-muted">Run Discovery Agent in Deal-to-Profit OS below, then create a discovery link to collect buyer answers before scoping.</p>
                  <Button disabled={busy === `/api/projects/${id}/discovery-share`} onClick={createDiscoveryShare}>
                    Create Discovery Link
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <Badge
                    tone={
                      project.data?.discoveryShareStatus === "submitted" ? "verified" :
                      project.data?.discoveryShareStatus === "revoked" ? "danger" : "success"
                    }
                  >
                    {project.data?.discoveryShareStatus === "submitted" ? "Submitted" :
                      project.data?.discoveryShareStatus === "revoked" ? "Revoked" : "Open — awaiting buyer"}
                  </Badge>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/discovery/${project.discoveryShareToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline text-xs font-mono break-all inline-flex items-center gap-1.5 bg-surface-2 px-3 py-2 rounded-[4px] border border-border-hairline"
                    >
                      <span>{typeof window !== "undefined" ? `${window.location.origin}/discovery/${project.discoveryShareToken}` : `/discovery/${project.discoveryShareToken}`}</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                    <Button variant="secondary" onClick={handleCopyDiscoveryLink} className="text-xs py-1.5 px-3 shrink-0">
                      {copiedDiscoveryLink ? "Copied ✓" : "Copy Link"}
                    </Button>
                  </div>

                  {project.data?.discoveryShareStatus === "open" && (
                    <div>
                      <Button variant="danger" onClick={revokeDiscoveryShare} className="text-xs py-1 px-3">Revoke Link</Button>
                    </div>
                  )}

                  {!!project.data?.clientDiscovery && (
                    <div className="mt-2 space-y-3 border-t border-border-hairline/60 pt-3">
                      {(project.data.clientDiscovery as { questions: Array<{ question: string; why?: string; answerType?: string } | string>; answers: string[] }).questions.map((q, i) => {
                        const a = (project.data!.clientDiscovery as { answers: string[] }).answers[i];
                        if (!a || !a.trim()) return null;
                        return (
                          <div key={i}>
                            <p className="text-xs font-medium text-ink-primary">{typeof q === "string" ? q : q.question}</p>
                            <p className="mt-0.5 text-sm text-ink-secondary">{a}</p>
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-ink-muted font-mono tabular-nums">
                        Submitted by {(project.data.clientDiscovery as { name: string }).name} (
                        {(project.data.clientDiscovery as { email: string }).email}) on{" "}
                        {new Date((project.data.clientDiscovery as { submittedAt: string }).submittedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* STEP: SCOPE */}
      <div id="step-scope">
        <StepHeader stepKey="scope" count={2} />
        {expandedSteps.has("scope") && (
          <div className="mt-2 space-y-6">
            {/* SCOPE ARCHITECTURE & MILESTONES DIAGRAM */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="flex items-center justify-between border-b border-border-hairline pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary font-display">Scope Architecture & Milestone Roadmap</h2>
                  <p className="text-xs text-ink-muted">Visual delivery phases and execution trajectory</p>
                </div>
                <Badge tone="neutral">Interactive Diagram</Badge>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  {[
                    { phase: "Phase 1", title: "Discovery & Audit", dur: "Wk 1-2", desc: "UX friction, mobile checkout analytics, technical audit" },
                    { phase: "Phase 2", title: "Core Redesign", dur: "Wk 3-5", desc: "Shopify checkout flow, page speed optimization, photography" },
                    { phase: "Phase 3", title: "Integration", dur: "Wk 6-7", desc: "Klaviyo abandoned cart flow setup, QA & testing" },
                    { phase: "Phase 4", title: "Launch & Sign-off", dur: "Wk 8", desc: "Pre-Black Friday release, performance monitoring" },
                  ].map((step, idx) => (
                    <div key={idx} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-ink-muted font-mono tabular-nums">
                          <span className="font-semibold text-accent">{step.phase}</span>
                          <span>{step.dur}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-ink-primary mt-1.5">{step.title}</h4>
                        <p className="text-[11px] text-ink-secondary mt-1 leading-snug">{step.desc}</p>
                      </div>
                      <div className="mt-3 h-1 w-full rounded-full bg-surface-3 overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${(idx + 1) * 25}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* SCOPE GRAPH */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="flex items-center justify-between border-b border-border-hairline pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary font-display">Scope Graph</h2>
                  <p className="text-xs text-ink-muted">Structure requirements into phases, deliverables, and tasks — feeds Deal-to-Profit OS and the scope baseline.</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {graphNodes.length === 0 && (
                  <p className="text-xs text-ink-muted">No nodes yet — add a requirement, phase, or deliverable to start structuring this opportunity.</p>
                )}
                {graphNodes.map((node, i) => (
                  <div key={node.id} className="grid grid-cols-12 gap-2 text-sm items-center" style={{ paddingLeft: graphNodeDepth(node) * 16 }}>
                    <Select
                      value={node.type}
                      onChange={(e) => setGraphNodes((ns) => ns.map((n, idx) => (idx === i ? { ...n, type: e.target.value } : n)))}
                      className="col-span-2"
                    >
                      {["requirement", "phase", "deliverable", "task", "economics", "acceptance"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                    <Input
                      placeholder="What is this node?"
                      value={node.label}
                      onChange={(e) => setGraphNodes((ns) => ns.map((n, idx) => (idx === i ? { ...n, label: e.target.value } : n)))}
                      className="col-span-4"
                    />
                    <Select
                      value={node.parentId}
                      onChange={(e) => setGraphNodes((ns) => ns.map((n, idx) => (idx === i ? { ...n, parentId: e.target.value } : n)))}
                      className="col-span-2"
                    >
                      <option value="">— none (root) —</option>
                      {graphNodes.filter((n) => n.id !== node.id).map((n) => (
                        <option key={n.id} value={n.id}>{n.label || n.id}</option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      value={node.hours}
                      onChange={(e) => setGraphNodes((ns) => ns.map((n, idx) => (idx === i ? { ...n, hours: Number(e.target.value) } : n)))}
                      className="col-span-1 font-mono tabular-nums text-xs"
                    />
                    <Input
                      placeholder="Acceptance criteria"
                      value={node.acceptance}
                      onChange={(e) => setGraphNodes((ns) => ns.map((n, idx) => (idx === i ? { ...n, acceptance: e.target.value } : n)))}
                      className="col-span-2"
                    />
                    <button
                      type="button"
                      onClick={() => setGraphNodes((ns) => ns.filter((_, idx) => idx !== i))}
                      className="col-span-1 p-2 text-danger hover:bg-danger/10 rounded-[4px] text-center font-bold text-sm transition-colors"
                      title="Remove node"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setGraphNodes((ns) => [
                      ...ns,
                      {
                        id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                        type: "deliverable",
                        label: "",
                        parentId: "",
                        hours: 0,
                        acceptance: "",
                      },
                    ])
                  }
                >
                  + Add Node
                </Button>
                <Button
                  disabled={busy === `/api/projects/${id}/scope-graph`}
                  onClick={saveScopeGraph}
                >
                  Save Scope Graph
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* STEP: PRICE */}
      <div id="step-price">
        <StepHeader stepKey="price" count={priceCount} />
        {expandedSteps.has("price") && (
          <div className="mt-2 space-y-6">
            {/* SCOPE & ECONOMICS */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="flex items-center justify-between border-b border-border-hairline pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary font-display">Scope & Economics (Pricing & Profit Engine)</h2>
                  <p className="text-xs text-ink-muted">List project deliverables, hours, and rates to generate Baseline, Target, and Value pricing packages.</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
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
                      className="col-span-1 font-mono tabular-nums text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Hours"
                      value={line.hours}
                      onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, hours: Number(e.target.value) } : l)))}
                      className="col-span-2 font-mono tabular-nums text-xs"
                    />
                    <Input
                      type="number"
                      placeholder={`Cost rate (${currencySymbol(currency)})`}
                      value={line.costRate}
                      onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, costRate: Number(e.target.value) } : l)))}
                      className="col-span-1 font-mono tabular-nums text-xs"
                    />
                    <Input
                      type="number"
                      placeholder={`Sell rate (${currencySymbol(currency)})`}
                      value={line.sellRate}
                      onChange={(e) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, sellRate: Number(e.target.value) } : l)))}
                      className="col-span-2 font-mono tabular-nums text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      className="col-span-1 p-2 text-danger hover:bg-danger/10 rounded-[4px] text-center font-bold text-sm transition-colors"
                      title="Remove deliverable"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setLines((ls) => [...ls, { name: "", role: "", qty: 1, hours: 0, costRate: 0, sellRate: 0 }])}>
                  + Add Deliverable
                </Button>
                <Button disabled={busy === `/api/projects/${id}/scope-economics`} loading={busy === `/api/projects/${id}/scope-economics`} onClick={calculateEconomics}>
                  Calculate Packages
                </Button>
                <AIProgress active={busy === `/api/projects/${id}/scope-economics`} durationMs={5000} label="Calculating" />
              </div>

              {!!scenarios.length && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {scenarios.map((s) => (
                    <div key={s.name} className="rounded-[4px] border border-border-hairline bg-surface-2 p-4 text-sm">
                      <p className="font-semibold text-ink-primary">{s.name}</p>
                      <p className="mt-2 text-xl font-bold font-mono tabular-nums text-accent">{formatCurrency(s.price, currency)}</p>
                      <p className="mt-1 text-xs text-ink-muted font-mono tabular-nums">{s.hours} hours · {s.marginPct}% profit margin</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* OPPORTUNITY LAB */}
            {intelligenceMode === "full" && (
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary font-display">Opportunity Lab (Commercial Intelligence)</h2>
                  <p className="text-xs text-ink-muted">AI scope diagnosis: unpriced work, margin firewall, and feasibility checks.</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Button variant="secondary" disabled={busy === `/api/projects/${id}/commercial-lab`} loading={busy === `/api/projects/${id}/commercial-lab`} onClick={runCommercialLab}>
                    Recalculate
                  </Button>
                  <AIProgress active={busy === `/api/projects/${id}/commercial-lab`} durationMs={7000} label="Analyzing" />
                </div>
              </div>
              <div className="mt-4">
                <Label>New client request / scope change (optional)</Label>
                <Textarea rows={2} value={changeRequest} onChange={(e) => setChangeRequest(e.target.value)} />
              </div>
              {!!labResult && (
                <pre className="mt-3 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                  {JSON.stringify(labResult, null, 2)}
                </pre>
              )}
            </Card>
            )}
          </div>
        )}
      </div>

      {/* STEP: PROPOSE */}
      <div id="step-propose">
        <StepHeader stepKey="propose" count={proposeCount} />

        {/* PROPOSAL PRESENTATION & EDITOR — always visible, not collapsible */}
        <div className="mt-2">
          <Card className="border-border-hairline bg-surface-1 p-5 print:border-none print:p-0 print:shadow-none">
            <div ref={editorCardRef} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-hairline pb-3 no-print">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink-primary font-display">Client Proposal Document</h2>
                <Badge tone="neutral">{parsedSections.length} Sections</Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-[4px] border border-border-hairline p-0.5 bg-surface-2">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`rounded-[2px] px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "preview" ? "bg-surface-3 text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Executive Document View
                  </button>
                  <button
                    onClick={() => setViewMode("edit")}
                    className={`rounded-[2px] px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "edit" ? "bg-surface-3 text-ink-primary shadow-sm" : "text-ink-muted hover:text-ink-primary"
                    }`}
                  >
                    Edit Text
                  </button>
                </div>

                <Button variant="ghost" onClick={handleCopy} className="text-xs py-1 px-2.5">
                  Copy
                </Button>
              </div>
            </div>

            {/* FORMATTED EXECUTIVE PREVIEW MODE */}
            {viewMode === "preview" ? (
              <div className="mt-4 space-y-6">
                {project.proposalOptions?.includeSellerLogo && sellerLogoPath && (
                  <img src={sellerLogoPath} alt="" className="max-h-12" />
                )}
                {/* Document Header for Print / View */}
                <div className="border-b border-border-hairline pb-4 print:border-black">
                  <h2 className="text-xl font-display font-medium tracking-tight text-ink-primary print:text-black">
                    {project.clientLabel || "Client Proposal"}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs font-mono tabular-nums text-ink-muted print:text-black">
                    {project.budget && <span>Budget: <strong className="text-ink-primary print:text-black">{project.budget}</strong></span>}
                    {project.timeline && <span>Timeline: <strong className="text-ink-primary print:text-black">{project.timeline}</strong></span>}
                    <span>Prepared by: <strong className="text-ink-primary print:text-black">ScopeVanta</strong></span>
                  </div>
                </div>

                {/* Render Parsed Sections */}
                {parsedSections.map((sec, idx) => (
                  <div key={idx} className="proposal-document-section space-y-2.5 rounded-[4px] border border-border-hairline bg-surface-2 p-4 print:border-none print:p-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-accent print:text-black font-mono">
                      {sec.title}
                    </h3>
                    <div className="space-y-1.5 text-xs leading-relaxed text-ink-secondary print:text-black font-body">
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
                  <div className="no-print rounded-[4px] border border-border-hairline bg-surface-2 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-accent mb-3 font-mono">
                      Project Visuals & Analytics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {project.visuals.map((vis, vIdx) => (
                        <div key={vIdx} className="rounded-[4px] border border-border-hairline bg-surface-1 p-3.5">
                          <p className="text-xs font-semibold text-ink-primary mb-2">{vis.title}</p>
                          <div className="space-y-2">
                            {vis.labels.map((label, lIdx) => {
                              const val = vis.values[lIdx] ?? 0;
                              const max = Math.max(...vis.values, 1);
                              const pct = Math.round((val / max) * 100);
                              return (
                                <div key={lIdx} className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-mono tabular-nums text-ink-muted">
                                    <span>{label}</span>
                                    <span>{val}</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
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
                  <span className="text-xs font-mono tabular-nums text-ink-muted">
                    {proposalDraft.split(/\s+/).filter(Boolean).length} words · {proposalDraft.length} characters
                  </span>
                  <Button disabled={busy === `/api/projects/${id}/proposal`} onClick={saveProposal}>
                    Save proposal
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {expandedSteps.has("propose") && (
          <div className="mt-6 space-y-6">
            {/* PROPOSAL STUDIO */}
            {intelligenceMode === "full" && (
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Proposal Studio</h2>
                <p className="text-xs text-ink-muted">Audit, structure, and adapt the proposal itself.</p>
              </div>

              <div className="mt-4 flex gap-2">
                <Select value={studioAction} onChange={(e) => setStudioAction(e.target.value)} className="w-56 text-xs">
                  {STUDIO_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </Select>
                <Button disabled={busy === `/api/projects/${id}/proposal-studio`} loading={busy === `/api/projects/${id}/proposal-studio`} onClick={runProposalStudio}>
                  Run Proposal Studio
                </Button>
              </div>
              <AIProgress active={busy === `/api/projects/${id}/proposal-studio`} durationMs={8000} label="Studio working" />
              <div className="mt-3">
                <Label>Meeting notes, objection, or context (used by Meeting Update, Objection Workspace, and Follow-up Draft)</Label>
                <Textarea rows={3} value={studioInput} onChange={(e) => setStudioInput(e.target.value)} />
              </div>

              {!studio && (
                <p className="mt-4 text-xs text-ink-muted">Pick an action above and run Proposal Studio to audit, restructure, or adapt this proposal.</p>
              )}

              {!!studio && studioShape === "audit" && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={studio.ready ? "success" : "warning"}>{studio.ready ? "Ready to send" : "Not ready yet"}</Badge>
                    <span className="font-mono text-lg text-ink-primary">{studio.score}</span>
                  </div>
                  {!!studio.issues?.length && (
                    <div className="space-y-2.5">
                      {studio.issues.map((iss: { severity: string; type: string; issue: string; fix: string }, i: number) => (
                        <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3">
                          <div className="flex items-center gap-2">
                            <Badge tone={iss.severity === "High" ? "danger" : iss.severity === "Medium" ? "warning" : "neutral"}>{iss.severity}</Badge>
                            <span className="text-xs font-medium text-ink-primary">{iss.type}</span>
                          </div>
                          <p className="mt-1.5 text-sm text-ink-primary">{iss.issue}</p>
                          <p className="mt-1 text-xs text-ink-muted">{iss.fix}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!!studio.strengths?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Strengths</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {studio.strengths.map((v: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!!studio && studioShape === "coverage" && (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs font-mono tabular-nums">
                    <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5 text-center">
                      <span className="text-ink-muted block text-[11px]">Covered</span>
                      <span className="font-semibold text-success">{studio.covered}</span>
                    </div>
                    <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5 text-center">
                      <span className="text-ink-muted block text-[11px]">Ambiguous</span>
                      <span className="font-semibold text-warning">{studio.ambiguous}</span>
                    </div>
                    <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5 text-center">
                      <span className="text-ink-muted block text-[11px]">Unanswered</span>
                      <span className="font-semibold text-danger">{studio.unanswered}</span>
                    </div>
                  </div>
                  {!!studio.items?.length && (
                    <div className="space-y-2.5">
                      {studio.items.map((it: { requirement: string; status: string; section: string; gap: string }, i: number) => (
                        <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-ink-primary">{it.requirement}</span>
                            <Badge tone={it.status === "Covered" ? "success" : it.status === "Ambiguous" ? "warning" : "danger"}>{it.status}</Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-ink-muted font-mono">{it.section}</p>
                          {!!it.gap && <p className="mt-1 text-xs text-ink-muted">{it.gap}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!!studio && studioShape === "sections" && (
                <div className="mt-4 space-y-3">
                  {studio.map((sec: { title: string; purpose: string; content: string }, i: number) => (
                    <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3.5">
                      <p className="font-medium text-ink-primary text-sm">{sec.title}</p>
                      <p className="mt-0.5 text-xs italic text-ink-muted">{sec.purpose}</p>
                      <pre className="mt-2 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-1 p-3.5 font-mono text-xs text-ink-secondary">
                        {sec.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {!!studio && studioShape === "approaches" && (
                <div className="mt-4 space-y-3">
                  {studio.map((ap: { name: string; positioning: string; bestWhen: string }, i: number) => (
                    <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3.5">
                      <p className="font-medium text-ink-primary text-sm">{ap.name}</p>
                      <p className="mt-1 text-sm text-ink-secondary">{ap.positioning}</p>
                      <p className="mt-1.5 text-xs text-ink-muted"><span className="font-medium text-ink-secondary">Best when: </span>{ap.bestWhen}</p>
                    </div>
                  ))}
                </div>
              )}

              {!!studio && studioShape === "meeting" && (
                <div className="mt-4 space-y-4">
                  {[
                    { key: "newRequirements", label: "New Requirements" },
                    { key: "changedRequirements", label: "Changed Requirements" },
                    { key: "buyerSignals", label: "Buyer Signals" },
                    { key: "objections", label: "Objections" },
                    { key: "openQuestions", label: "Open Questions" },
                    { key: "recommendedUpdates", label: "Recommended Updates" },
                  ].map(({ key, label }) => {
                    const items: string[] = studio[key] || [];
                    if (!items.length) return null;
                    return (
                      <div key={key} className="border-t border-border-hairline/60 pt-3 first:border-0 first:pt-0">
                        <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">{label}</h3>
                        <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                          {items.map((v, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-accent mt-0.5">•</span>
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              {!!studio && studioShape === "objection" && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-ink-primary font-body">{studio.objection}</p>
                    <p className="mt-1 text-xs text-ink-muted">{studio.diagnosis}</p>
                  </div>
                  {!!studio.protect?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Protect</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {studio.protect.map((v: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!studio.options?.length && (
                    <div className="border-t border-border-hairline/60 pt-3 space-y-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Response Options</h3>
                      {studio.options.map((opt: { approach: string; commercialTradeoff: string; response: string }, i: number) => (
                        <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3">
                          <p className="text-sm font-medium text-ink-primary">{opt.approach}</p>
                          <p className="mt-1 text-xs text-ink-muted">{opt.commercialTradeoff}</p>
                          <p className="mt-1.5 text-sm text-ink-secondary">{opt.response}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!!studio && studioShape === "followUp" && (
                <div className="mt-4 space-y-3">
                  <Badge tone="neutral">{studio.stage}</Badge>
                  <p className="text-sm font-bold text-ink-primary">{studio.subject}</p>
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                      {studio.body}
                    </pre>
                    <Button variant="ghost" onClick={handleCopyStudioFollowUp} className="text-xs py-1 px-2.5 shrink-0">
                      {copiedStudioFollowUp ? "Copied ✓" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-xs text-ink-muted border-t border-border-hairline/60 pt-3">{studio.nextStep}</p>
                </div>
              )}

              {!!studio && studioShape === "unknown" && (
                <pre className="mt-4 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                  {JSON.stringify(studio, null, 2)}
                </pre>
              )}
            </Card>
            )}

            {/* CLIENT DEAL ROOM */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Client Deal Room (Shareable Client Portal)</h2>
                <p className="text-xs text-ink-muted">A private, secure web link for your client to review the proposal and select packages online.</p>
              </div>
              {project.shareToken ? (
                <div className="mt-4 space-y-3 text-sm">
                  {shareAnalytics?.decision === "accepted" && (
                    <StatusBanner tone="success">
                      <span className="block font-semibold">
                        Accepted by {shareAnalytics.decisionName || "the client"}
                        {shareAnalytics.decidedAt ? ` on ${new Date(shareAnalytics.decidedAt).toLocaleString()}` : ""}
                      </span>
                      <span className="mt-1 block font-semibold">This acceptance is not a signed contract.</span>
                    </StatusBanner>
                  )}
                  {shareAnalytics?.decision === "changes_requested" && (
                    <div className="space-y-2">
                      <StatusBanner tone="warning">
                        Changes requested by {shareAnalytics.decisionName || "the client"}
                        {shareAnalytics.decidedAt ? ` on ${new Date(shareAnalytics.decidedAt).toLocaleString()}` : ""}
                      </StatusBanner>
                      {shareAnalytics.decisionNote && (
                        <pre className="whitespace-pre-wrap rounded-[4px] border border-warning/30 bg-surface-2 p-3 font-body text-sm text-ink-primary">
                          {shareAnalytics.decisionNote}
                        </pre>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-ink-muted font-mono tabular-nums">
                    Share link active · {shareAnalytics && `${shareAnalytics.views} views${shareAnalytics.selectedScenario ? ` · package selected: ${shareAnalytics.selectedScenario}` : ""}${shareAnalytics.lastViewedAt ? ` · last viewed ${new Date(shareAnalytics.lastViewedAt).toLocaleString()}` : ""}`}
                  </p>
                  {shareAnalytics?.releaseId && (
                    <p className="text-[11px] text-ink-muted font-mono tabular-nums break-all">
                      Release {shareAnalytics.releaseId}
                      {shareAnalytics.releaseHash ? ` · SHA-256 ${shareAnalytics.releaseHash.slice(0, 12)}…${shareAnalytics.releaseHash.slice(-8)}` : ""}
                    </p>
                  )}
                  {!!shareAnalytics?.events?.length && (
                    <details className="text-xs text-ink-muted font-mono">
                      <summary className="cursor-pointer hover:text-ink-primary">View activity log</summary>
                      <ul className="mt-2 space-y-1 tabular-nums">
                        {shareAnalytics.events.map((ev, i) => (
                          <li key={i}>
                            {ev.type.replaceAll("_", " ")} — {new Date(ev.at).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/share/${project.shareToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline text-xs font-mono break-all inline-flex items-center gap-1.5 bg-surface-2 px-3 py-2 rounded-[4px] border border-border-hairline"
                    >
                      <span>{typeof window !== "undefined" ? `${window.location.origin}/share/${project.shareToken}` : `/share/${project.shareToken}`}</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
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
                <Button className="mt-4" disabled={busy === `/api/projects/${id}/share`} onClick={createShare}>
                  Generate Client Review Link
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* STEP: WIN */}
      <div id="step-win">
        <StepHeader stepKey="win" count={winCount} />
        {expandedSteps.has("win") && (
          <div className="mt-2 space-y-6">
            {/* DEAL OS */}
            {intelligenceMode === "full" && (
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Deal-to-Profit OS (Deal Strategy Assistant)</h2>
                <p className="text-xs text-ink-muted">14 tactical commercial actions: objection handling, negotiation leverage, scope change firewall, and premortem.</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Select value={dealOSAction} onChange={(e) => setDealOSAction(e.target.value)} className="w-48 text-xs">
                  {DEAL_OS_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
                <Input placeholder="Optional input (client objection, meeting notes, change request…)" value={dealOSInput} onChange={(e) => setDealOSInput(e.target.value)} />
                <Button disabled={busy === `/api/projects/${id}/deal-os`} loading={busy === `/api/projects/${id}/deal-os`} onClick={runDealOS}>Run</Button>
              </div>
              <AIProgress active={busy === `/api/projects/${id}/deal-os`} durationMs={9000} label="Deal OS working" />
              {!!dealOSResult && (
                <pre className="mt-3 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                  {JSON.stringify(dealOSResult, null, 2)}
                </pre>
              )}
            </Card>
            )}

            {/* WIN PLAN */}
            {intelligenceMode === "full" && (
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Win Plan</h2>
                <p className="text-xs text-ink-muted">Strategy to move this specific opportunity toward a decision.</p>
              </div>

              <div className="mt-4">
                <Button
                  variant={project.data?.winPlan ? "secondary" : "primary"}
                  disabled={busy === `/api/projects/${id}/win-plan`}
                  loading={busy === `/api/projects/${id}/win-plan`}
                  onClick={buildWinPlan}
                >
                  {project.data?.winPlan ? "Refresh Win Plan" : "Build Win Plan"}
                </Button>
                <div className="mt-2">
                  <AIProgress active={busy === `/api/projects/${id}/win-plan`} durationMs={6000} label="Building win plan" />
                </div>
              </div>

              {project.data?.winPlan ? (
                <div className="mt-4 space-y-4">
                  {!!(project.data.winPlan as { buyerPriorities?: string[] }).buyerPriorities?.length && (
                    <div>
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Buyer Priorities</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {(project.data.winPlan as { buyerPriorities?: string[] }).buyerPriorities!.map((v, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!(project.data.winPlan as { decisionFriction?: string[] }).decisionFriction?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Decision Friction</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {(project.data.winPlan as { decisionFriction?: string[] }).decisionFriction!.map((v, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!(project.data.winPlan as { decisionMakers?: string[] }).decisionMakers?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Decision Makers</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {(project.data.winPlan as { decisionMakers?: string[] }).decisionMakers!.map((v, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!(project.data.winPlan as { dealSignals?: string[] }).dealSignals?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Deal Signals</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {(project.data.winPlan as { dealSignals?: string[] }).dealSignals!.map((v, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!(project.data.winPlan as { objections?: Array<{ objection: string; response: string }> }).objections?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Objections & Responses</h3>
                      <div className="mt-1.5 space-y-3">
                        {(project.data.winPlan as { objections?: Array<{ objection: string; response: string }> }).objections!.map((o, i) => (
                          <div key={i}>
                            <p className="text-xs font-medium text-ink-primary">{o.objection}</p>
                            <p className="mt-0.5 text-sm text-ink-muted">{o.response}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!(project.data.winPlan as { differentiators?: string[] }).differentiators?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Differentiators</h3>
                      <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                        {(project.data.winPlan as { differentiators?: string[] }).differentiators!.map((v, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!(project.data.winPlan as { nextActions?: string[] }).nextActions?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Next Actions</h3>
                      <ol className="mt-1.5 space-y-1.5 text-xs text-ink-secondary list-decimal list-inside">
                        {(project.data.winPlan as { nextActions?: string[] }).nextActions!.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="border-t border-border-hairline/60 pt-3">
                    <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Suggested Follow-up</h3>
                    <div className="mt-2 flex items-start gap-2">
                      <pre className="flex-1 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                        {(project.data.winPlan as { followUp?: string }).followUp}
                      </pre>
                      <Button variant="ghost" onClick={handleCopyWinPlanFollowUp} className="text-xs py-1 px-2.5 shrink-0">
                        {copiedWinPlanFollowUp ? "Copied ✓" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  {!!project.data.winPlanUpdatedAt && (
                    <p className="text-[11px] text-ink-muted font-mono tabular-nums">
                      Updated {new Date(String(project.data.winPlanUpdatedAt)).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs text-ink-muted">Build a win plan to surface buyer priorities, likely objections with responses, and a ranked list of next actions.</p>
              )}
            </Card>
            )}

            {/* CLOSE COACH */}
            {intelligenceMode === "full" && (
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Close Coach</h2>
                <p className="text-xs text-ink-muted">The highest-leverage next action for where this deal stands right now.</p>
              </div>

              <div className="mt-4">
                <Button
                  variant={project.data?.closeCoach ? "secondary" : "primary"}
                  disabled={busy === `/api/projects/${id}/close-coach`}
                  loading={busy === `/api/projects/${id}/close-coach`}
                  onClick={getClosingGuidance}
                >
                  {project.data?.closeCoach ? "Refresh Closing Guidance" : "Get Closing Guidance"}
                </Button>
                <div className="mt-2">
                  <AIProgress active={busy === `/api/projects/${id}/close-coach`} durationMs={4000} label="Coaching" />
                </div>
              </div>

              {!!project.data?.closeCoach && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-ink-primary font-body">
                      {(project.data.closeCoach as { nextBestAction?: string }).nextBestAction}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {(project.data.closeCoach as { why?: string }).why}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider font-mono">Suggested follow-up</h3>
                    <div className="mt-2 flex items-start gap-2">
                      <pre className="flex-1 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                        {(project.data.closeCoach as { followUp?: string }).followUp}
                      </pre>
                      <Button variant="ghost" onClick={handleCopyFollowUp} className="text-xs py-1 px-2.5 shrink-0">
                        {copiedFollowUp ? "Copied ✓" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  {!!(project.data.closeCoach as { discoveryQuestions?: string[] }).discoveryQuestions?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider font-mono">Discovery questions</h3>
                      <ul className="mt-2 space-y-1.5 text-xs text-ink-secondary">
                        {(project.data.closeCoach as { discoveryQuestions?: string[] }).discoveryQuestions!.map((q, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!(project.data.closeCoach as { risk?: string }).risk && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <Badge tone="warning">Closing Risk</Badge>
                      <p className="mt-1 text-sm text-ink-primary">{(project.data.closeCoach as { risk?: string }).risk}</p>
                    </div>
                  )}

                  {!!(project.data.closeCoach as { generatedAt?: string }).generatedAt && (
                    <p className="text-[11px] text-ink-muted font-mono tabular-nums">
                      Generated {new Date((project.data.closeCoach as { generatedAt?: string }).generatedAt!).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </Card>
            )}
          </div>
        )}
      </div>

      {/* STEP: PROTECT */}
      <div id="step-protect">
        <StepHeader stepKey="protect" count={protectCount} />
        {expandedSteps.has("protect") && (
          <div className="mt-2 space-y-6">
            {/* SCOPE BASELINE & CHANGE ORDERS */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Scope Baseline & Change Orders</h2>
                <p className="text-xs text-ink-muted">Lock in the agreed scope, then track and approve requests that fall outside it.</p>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider font-mono">Baseline</h3>
                {project.data?.scopeBaseline ? (
                  <p className="mt-2 text-xs text-ink-muted font-mono tabular-nums">
                    Baseline v{(project.data.scopeBaseline as { version?: number }).version} · established from proposal v
                    {(project.data.scopeBaseline as { proposalVersion?: number }).proposalVersion} ·{" "}
                    {new Date((project.data.scopeBaseline as { createdAt?: string }).createdAt || "").toLocaleDateString()}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink-muted">No baseline established yet.</p>
                )}
                <Button
                  variant={project.data?.scopeBaseline ? "secondary" : "primary"}
                  className="mt-3"
                  disabled={busy === `/api/projects/${id}/scope-baseline`}
                  onClick={establishBaseline}
                >
                  {project.data?.scopeBaseline ? "Re-establish Baseline" : "Establish Baseline"}
                </Button>
              </div>

              <div className="mt-5 border-t border-border-hairline/60 pt-4">
                <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider font-mono">Change Order</h3>
                {!!String(project.data?.changeOrderDraft || "") ? (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      {project.data?.changeOrderStatus === "draft" && <Badge tone="warning">Draft — pending approval</Badge>}
                      {project.data?.changeOrderStatus === "approved" && <Badge tone="success">Approved</Badge>}
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <pre className="flex-1 max-h-80 overflow-auto rounded-[4px] border border-border-hairline bg-surface-2 p-3.5 font-mono text-xs text-ink-secondary">
                        {String(project.data?.changeOrderDraft || "")}
                      </pre>
                      <Button variant="ghost" onClick={handleCopyChangeOrder} className="text-xs py-1 px-2.5 shrink-0">
                        {copiedChangeOrder ? "Copied ✓" : "Copy"}
                      </Button>
                    </div>
                    <Button
                      variant="primary"
                      className="mt-3"
                      disabled={project.data?.changeOrderStatus !== "draft" || busy === `/api/projects/${id}/change-order/approve`}
                      onClick={approveChangeOrder}
                    >
                      Approve Change Order
                    </Button>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-ink-muted">Enter a client request in Commercial Lab above and run it to check for out-of-scope changes.</p>
                )}
              </div>

              <div className="mt-5 border-t border-border-hairline/60 pt-4">
                <h3 className="text-xs font-semibold text-ink-primary uppercase tracking-wider font-mono">History</h3>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <p className="text-[11px] text-ink-muted font-mono uppercase tracking-wider">Baselines</p>
                    {history.baselines.map((b) => (
                      <div key={b.id} className="flex justify-between items-center border-b border-border-hairline/40 pb-2">
                        <span className="text-ink-secondary text-xs font-mono">v{b.snapshot?.version ?? "—"}</span>
                        <Badge tone="neutral">{new Date(b.createdAt).toLocaleDateString()}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-[11px] text-ink-muted font-mono uppercase tracking-wider">Change Orders</p>
                    {history.changeOrders.map((c) => (
                      <div key={c.id} className="flex justify-between items-center border-b border-border-hairline/40 pb-2">
                        <span className="text-ink-secondary text-xs font-mono">{new Date(c.createdAt).toLocaleDateString()}</span>
                        <Badge tone={c.status === "APPROVED" ? "success" : "warning"}>{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* DELIVERY & ACTUALS */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Delivery & Actuals</h2>
                <p className="text-xs text-ink-muted">Record real hours, cost and revenue once work starts or completes — feeds Pricing Brain and Commercial Autopilot.</p>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Actual revenue ({currencySymbol(currency)})</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={actualRevenue}
                    onChange={(e) => setActualRevenue(Number(e.target.value))}
                    className="font-mono tabular-nums text-xs"
                  />
                </div>
                <div>
                  <Label>Actual cost ({currencySymbol(currency)})</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={actualCost}
                    onChange={(e) => setActualCost(Number(e.target.value))}
                    className="font-mono tabular-nums text-xs"
                  />
                </div>
                <div>
                  <Label>Actual hours</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={actualHours}
                    onChange={(e) => setActualHours(Number(e.target.value))}
                    className="font-mono tabular-nums text-xs"
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label>Latest client request / delivery note</Label>
                <Textarea
                  rows={3}
                  maxLength={10000}
                  value={clientRequestInbox}
                  onChange={(e) => setClientRequestInbox(e.target.value)}
                />
              </div>
              {(actualHours > 0 || actualRevenue > 0) && (
                <div className="mt-3">
                  <Badge tone={((project.data?.actualMarginPct as number) ?? 0) >= 20 ? "success" : ((project.data?.actualMarginPct as number) ?? 0) >= 0 ? "warning" : "danger"}>
                    {(project.data?.actualMarginPct as number) ?? 0}% actual margin
                  </Badge>
                </div>
              )}
              <div className="mt-4">
                <Button variant="primary" disabled={busy === `/api/projects/${id}/commercial-state`} onClick={saveActuals}>
                  Save Actuals
                </Button>
              </div>
            </Card>

            {/* COMMERCIAL AUTOPILOT */}
            {intelligenceMode === "full" && (
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <div className="border-b border-border-hairline pb-2">
                <h2 className="text-sm font-semibold text-ink-primary font-display">Commercial Autopilot</h2>
                <p className="text-xs text-ink-muted">Prioritized next actions, estimate calibration, and profitability, drawn from this deal's own history.</p>
              </div>

              <div className="mt-4">
                <Button
                  variant={autopilot ? "secondary" : "primary"}
                  disabled={busy === `/api/projects/${id}/commercial-autopilot`}
                  loading={busy === `/api/projects/${id}/commercial-autopilot`}
                  onClick={runAutopilot}
                >
                  {autopilot ? "Refresh Autopilot" : "Run Autopilot"}
                </Button>
                <div className="mt-2">
                  <AIProgress active={busy === `/api/projects/${id}/commercial-autopilot`} durationMs={7000} label="Running autopilot" />
                </div>
              </div>

              {!autopilot && (
                <p className="mt-4 text-xs text-ink-muted">Run Commercial Autopilot for prioritized actions, estimate calibration, and a profitability snapshot based on this deal's actual data.</p>
              )}

              {!!autopilot && (
                <div className="mt-4 space-y-4">
                  {!!autopilot.autopilot?.actions?.length && (
                    <div>
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Prioritized Actions</h3>
                      <div className="mt-1.5 space-y-2.5">
                        {[...autopilot.autopilot.actions]
                          .sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority)
                          .map((a: { priority: number; action: string; why: string; evidence: string; module: string }, i: number) => (
                            <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-ink-muted">#{a.priority}</span>
                                <span className="text-sm font-medium text-ink-primary">{a.action}</span>
                                <Badge tone="neutral">{a.module}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-ink-muted">{a.why}</p>
                              <p className="mt-1 text-xs text-ink-disabled">{a.evidence}</p>
                            </div>
                          ))}
                      </div>
                      {!!autopilot.autopilot?.blockers?.length && (
                        <ul className="mt-2.5 space-y-1.5 text-xs text-ink-secondary">
                          {autopilot.autopilot.blockers.map((v: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-accent mt-0.5">•</span>
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {!!(autopilot.calibration?.estimatedVsActualSignals?.length || autopilot.calibration?.suggestedAdjustment) && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Estimate Calibration</h3>
                      {!!autopilot.calibration?.estimatedVsActualSignals?.length && (
                        <ul className="mt-1.5 space-y-1.5 text-xs text-ink-secondary">
                          {autopilot.calibration.estimatedVsActualSignals.map((v: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-accent mt-0.5">•</span>
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!!autopilot.calibration?.suggestedAdjustment && (
                        <p className="mt-2 text-sm text-ink-primary">{autopilot.calibration.suggestedAdjustment}</p>
                      )}
                    </div>
                  )}

                  {!!(autopilot.redline?.baseline?.length || autopilot.redline?.requested?.length || autopilot.redline?.commercialImpact?.length) && (
                    <div className="border-t border-border-hairline/60 pt-3 space-y-2.5">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Redline</h3>
                      {!!autopilot.redline?.baseline?.length && (
                        <div>
                          <p className="text-xs font-medium text-ink-secondary">Baseline</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.redline.baseline.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!autopilot.redline?.requested?.length && (
                        <div>
                          <p className="text-xs font-medium text-ink-secondary">Requested</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.redline.requested.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!autopilot.redline?.commercialImpact?.length && (
                        <div>
                          <p className="text-xs font-medium text-ink-secondary">Commercial Impact</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.redline.commercialImpact.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {!!autopilot.negotiationScenarios?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Negotiation Scenarios</h3>
                      <div className="mt-1.5 space-y-2.5">
                        {autopilot.negotiationScenarios.map((s: { name: string; price: number; scopeTrade: string; marginImpact: string }, i: number) => (
                          <div key={i} className="rounded-[4px] border border-border-hairline bg-surface-2 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-ink-primary">{s.name}</span>
                              <span className="font-mono text-sm text-ink-primary">{formatCurrency(s.price, currency)}</span>
                            </div>
                            <p className="mt-1 text-sm text-ink-secondary">{s.scopeTrade}</p>
                            <p className="mt-1 text-xs text-ink-muted">{s.marginImpact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!autopilot.handoff && (
                    <div className="border-t border-border-hairline/60 pt-3 space-y-2.5">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Handoff</h3>
                      <Badge tone="neutral">{autopilot.handoff.status}</Badge>
                      {!!autopilot.handoff.agreedScope?.length && (
                        <div>
                          <p className="text-xs font-medium text-ink-secondary">Agreed Scope</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.handoff.agreedScope.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!autopilot.handoff.commercialTerms?.length && (
                        <div>
                          <p className="text-xs font-medium text-ink-secondary">Commercial Terms</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.handoff.commercialTerms.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!autopilot.handoff.openItems?.length && (
                        <div>
                          <p className="text-xs font-medium text-ink-secondary">Open Items</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.handoff.openItems.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {!!autopilot.similarity?.length && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Similar Opportunities</h3>
                      <div className="mt-1.5 space-y-2.5">
                        {autopilot.similarity.map((s: { label: string; reason: string; estimatedVsActual: string }, i: number) => (
                          <div key={i}>
                            <p className="text-sm font-medium text-ink-primary">{s.label}</p>
                            <p className="mt-0.5 text-sm text-ink-secondary">{s.reason}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">{s.estimatedVsActual}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!autopilot.profitability && (
                    <div className="border-t border-border-hairline/60 pt-3">
                      <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">Profitability</h3>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono tabular-nums">
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Quoted Value</span>
                          <span className="font-semibold text-ink-primary">{formatCurrency(Number(autopilot.profitability.quotedValue || 0), currency)}</span>
                        </div>
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Estimated Cost</span>
                          <span className="font-semibold text-ink-primary">{formatCurrency(Number(autopilot.profitability.estimatedCost || 0), currency)}</span>
                        </div>
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Actual Cost</span>
                          <span className="font-semibold text-ink-primary">{formatCurrency(Number(autopilot.profitability.actualCost || 0), currency)}</span>
                        </div>
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Forecast Cost</span>
                          <span className="font-semibold text-ink-primary">{formatCurrency(Number(autopilot.profitability.forecastCost || 0), currency)}</span>
                        </div>
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Estimated Margin</span>
                          <Badge tone={Number(autopilot.profitability.estimatedMarginPct || 0) >= 20 ? "success" : Number(autopilot.profitability.estimatedMarginPct || 0) >= 0 ? "warning" : "danger"}>
                            {autopilot.profitability.estimatedMarginPct}%
                          </Badge>
                        </div>
                        <div className="rounded-[4px] border border-border-hairline bg-surface-2 p-2.5">
                          <span className="text-ink-muted block text-[11px]">Actual Margin</span>
                          <Badge tone={Number(autopilot.profitability.actualMarginPct || 0) >= 20 ? "success" : Number(autopilot.profitability.actualMarginPct || 0) >= 0 ? "warning" : "danger"}>
                            {autopilot.profitability.actualMarginPct}%
                          </Badge>
                        </div>
                      </div>
                      {!!autopilot.profitability.scopeAdded?.length && (
                        <div className="mt-2.5">
                          <p className="text-xs font-medium text-ink-secondary">Scope Added</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.profitability.scopeAdded.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!!autopilot.profitability.changeOrders?.length && (
                        <div className="mt-2.5">
                          <p className="text-xs font-medium text-ink-secondary">Change Orders</p>
                          <ul className="mt-1 space-y-1.5 text-xs text-ink-secondary">
                            {autopilot.profitability.changeOrders.map((v: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-accent mt-0.5">•</span>
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {!!project.data?.commercialAutopilotAt && (
                    <p className="text-[11px] text-ink-muted font-mono tabular-nums">
                      Updated {new Date(String(project.data.commercialAutopilotAt)).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </Card>
            )}

            {/* REVISION HISTORY */}
            <Card className="no-print border-border-hairline bg-surface-1 p-5">
              <h2 className="text-sm font-semibold text-ink-primary font-display">Revision History</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Restoring a version loads it into the editor — click Save Proposal to keep it as a new version.
              </p>
              <div className="mt-3 space-y-2 text-sm">
                {versions.map((v) => (
                  <div key={v.version} className="flex justify-between items-center border-b border-border-hairline/40 pb-2">
                    <span className="text-ink-secondary text-xs font-mono">Version {v.version} · {v.status}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{new Date(v.savedAt).toLocaleDateString()}</Badge>
                      {v.revisionSource !== "current" && (
                        <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={() => restoreVersion(v)}>
                          {restoredVersion === v.version ? "Restored ✓" : "Restore"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
