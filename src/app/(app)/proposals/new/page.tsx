"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, PageHeader, Button, Input, Textarea, Label, Select, IconButton } from "@/components/ui";
import { trackEvent } from "@/lib/track";
import { AIProgress } from "@/components/AIProgress";

type ClientOption = { id: string; name: string };

// Copied verbatim from src/app/api/analyze/route.ts's ALLOWED_SECTIONS —
// keep in sync with that list, don't retype/reorder from memory.
const ALLOWED_SECTIONS = [
  "Executive Summary", "Client Challenge & Desired Outcome", "Our Understanding", "Strategic Approach",
  "Detailed Scope of Work", "Deliverables & Acceptance Criteria", "Project Phases", "Timeline & Milestones",
  "Client Inputs & Responsibilities", "Team & Delivery Approach", "Revision & Feedback Process", "Quality Assurance",
  "Success Measures", "Investment & Payment", "Assumptions", "Exclusions", "Change Control", "Why Us", "Next Steps & Acceptance",
];

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
  const [mode, setMode] = useState<"Concise" | "Detailed" | "Premium">("Detailed");
  const [selectedSections, setSelectedSections] = useState<string[]>([...ALLOWED_SECTIONS]);
  const [includeVisuals, setIncludeVisuals] = useState(false);
  const [includeSellerLogo, setIncludeSellerLogo] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.clients || []));
  }, []);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      if (referenceFile) {
        setUploadingReference(true);
        try {
          const content = await fileToBase64(referenceFile);
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: referenceFile.name, type: referenceFile.type, content, kind: "reference" }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(body.error || "Reference file upload failed.");
            return;
          }
          // It's in the knowledge base now; clear it so retrying Generate
          // (e.g. after a billing error) doesn't upload a duplicate.
          setReferenceFile(null);
        } finally {
          setUploadingReference(false);
        }
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          budget,
          timeline,
          client: clientName,
          clientId: clientId || undefined,
          proposalOptions: { mode, sections: selectedSections, includeVisuals, includeSellerLogo },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Analysis failed.");
        return;
      }
      trackEvent("proposal_generated", { projectId: body.projectId });
      router.push(`/proposals/${body.projectId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Proposal" description="Analyze → Clarify → Scope → Price → Propose" />
      <Card className="sidebar-expandable max-w-4xl border-border-hairline bg-surface-1 p-6">
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
          <div>
            <Label>Proposal mode</Label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as "Concise" | "Detailed" | "Premium")}>
              <option value="Concise">Concise</option>
              <option value="Detailed">Detailed</option>
              <option value="Premium">Premium</option>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Sections to include</Label>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" className="text-accent hover:underline" onClick={() => setSelectedSections([...ALLOWED_SECTIONS])}>
                  Select all
                </button>
                <span className="text-ink-muted">·</span>
                <button type="button" className="text-accent hover:underline" onClick={() => setSelectedSections([])}>
                  Select none
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALLOWED_SECTIONS.map((section) => (
                <label key={section} className="flex items-center gap-2 text-xs text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(section)}
                    onChange={(e) =>
                      setSelectedSections((prev) =>
                        e.target.checked ? [...prev, section] : prev.filter((v) => v !== section)
                      )
                    }
                  />
                  <span>{section}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-ink-secondary">
              <input type="checkbox" checked={includeVisuals} onChange={(e) => setIncludeVisuals(e.target.checked)} />
              <span>Include charts &amp; visuals</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-secondary">
              <input type="checkbox" checked={includeSellerLogo} onChange={(e) => setIncludeSellerLogo(e.target.checked)} />
              <span>Include our logo on this proposal</span>
            </label>
          </div>
          <div>
            <Label>Reference file (optional)</Label>
            {referenceFile ? (
              // Not uploaded until Generate, so removing just clears the selection.
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-border-hairline px-3 py-1.5 text-sm text-ink-primary">
                <span className="material-symbols-outlined text-[18px]">description</span>
                <span className="max-w-[240px] truncate">{referenceFile.name}</span>
                <IconButton icon="close" label="Remove file" onClick={() => setReferenceFile(null)} disabled={busy} />
              </span>
            ) : (
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:bg-accent-hover transition-colors">
                <span className="material-symbols-outlined text-[18px]">attach_file</span>
                <span>Attach reference file</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.doc,.docx,image/*"
                  onChange={(e) => {
                    setReferenceFile(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>
        {error && (
          <div className="mt-4 rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <Button
              disabled={busy || brief.trim().length < 40 || selectedSections.length === 0}
              loading={busy}
              onClick={generate}
              className="flex items-center gap-2"
            >
              {busy ? (
                <>{uploadingReference ? "Uploading reference…" : "Analyzing Scope…"}</>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  Generate proposal
                </>
              )}
            </Button>
            <AIProgress active={busy} durationMs={13000} label="Generating proposal" />
          </div>
          <div className="text-right space-y-0.5">
            {brief.trim().length > 0 && brief.trim().length < 40 && (
              <p className="text-xs text-ink-muted">Add at least {40 - brief.trim().length} more characters to brief.</p>
            )}
            {selectedSections.length === 0 && (
              <p className="text-xs text-ink-muted">Select at least one section.</p>
            )}
          </div>
        </div>
      </Card>
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
