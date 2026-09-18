"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Select, Badge, EmptyState } from "@/components/ui";
import { trackEvent } from "@/lib/track";

type FileItem = { id: string; name: string; status: string; extractedChars: number; error?: string; documentType?: string; summary?: string };
type KnowledgeRecord = {
  id: string;
  category: string;
  content: { fact: string; sourceFileName: string; documentType?: string };
  isActive: boolean;
  createdAt: string;
};
type Health = { healthy: boolean; files: number; facts: number; activeFacts: number; recommendation: string };

export default function KnowledgePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [factSearch, setFactSearch] = useState("");
  const [factCategory, setFactCategory] = useState("all");
  const [factSource, setFactSource] = useState("all");
  const [factStatus, setFactStatus] = useState("all");

  function load() {
    fetch("/api/files").then((r) => r.json()).then((d) => setFiles(d.files || []));
    fetch("/api/knowledge").then((r) => r.json()).then((d) => setRecords(d.records || []));
    fetch("/api/knowledge/health").then((r) => r.json()).then(setHealth);
  }
  useEffect(load, []);

  async function onUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const content = await fileToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, content, kind: "reference" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error || "Upload failed.");
      else if (body.status === "ready") trackEvent("knowledge_ready", { fileId: body.id, documentType: body.documentType });
      load();
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/knowledge/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    load();
  }

  async function reprocess(id: string) {
    const res = await fetch(`/api/files/${id}/reprocess`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error || "Reprocessing failed.");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    load();
  }

  const factCategories = Array.from(new Set(records.map((r) => r.category))).filter(Boolean);
  const factSources = Array.from(new Set(records.map((r) => r.content.sourceFileName))).filter(Boolean);
  const filteredRecords = records.filter((r) => {
    if (factSearch && !r.content.fact.toLowerCase().includes(factSearch.toLowerCase())) return false;
    if (factCategory !== "all" && r.category !== factCategory) return false;
    if (factSource !== "all" && r.content.sourceFileName !== factSource) return false;
    if (factStatus === "active" && !r.isActive) return false;
    if (factStatus === "paused" && r.isActive) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Firm capabilities, case studies, and commercial rules."
        actions={
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:bg-accent-hover transition-colors">
            <span className="material-symbols-outlined text-[18px]">
              {uploading ? "progress_activity" : "upload_file"}
            </span>
            <span>{uploading ? "Uploading…" : "Upload Document"}</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.doc,.docx,image/*"
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
          </label>
        }
      />
      {error && (
        <div className="rounded-[4px] border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger font-mono">
          {error}
        </div>
      )}

      {health && (
        <Card className="border-border-hairline bg-surface-1 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-primary">Knowledge Health</p>
              <p className="mt-1 text-xs text-ink-muted">{health.recommendation}</p>
            </div>
            <Badge tone={health.healthy ? "success" : "warning"}>
              {health.healthy ? "Optimal" : "Needs review"}
            </Badge>
          </div>
          <div className="mt-4 flex gap-6 text-xs text-ink-muted font-mono tabular-nums border-t border-border-hairline/60 pt-3">
            <span>{health.files} files indexed</span>
            <span>
              {health.activeFacts} / {health.facts} active facts
            </span>
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-primary">Indexed Documents</h2>
        {!files.length ? (
          <EmptyState title="No knowledge files yet" description="Upload a capability deck, service sheet, or reference document." />
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <Card key={f.id} className="flex items-center justify-between border-border-hairline bg-surface-1 p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink-primary">{f.name}</p>
                  <p className="text-xs text-ink-muted font-mono tabular-nums">
                    {f.documentType || f.status} · {f.extractedChars} chars{f.error ? ` · ${f.error}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={f.status === "ready" ? "success" : f.status === "failed" ? "danger" : "neutral"}>
                    {f.status}
                  </Badge>
                  <Button variant="secondary" className="text-xs py-1 px-2.5" onClick={() => reprocess(f.id)}>
                    Reprocess
                  </Button>
                  <Button variant="danger" className="text-xs py-1 px-2.5" onClick={() => remove(f.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-primary">
          Extracted Commercial Facts ({filteredRecords.length} of {records.length})
        </h2>

        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            placeholder="Search facts…"
            value={factSearch}
            onChange={(e) => setFactSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={factCategory} onChange={(e) => setFactCategory(e.target.value)} className="w-44 text-xs">
            <option value="all">All Categories</option>
            {factCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select value={factSource} onChange={(e) => setFactSource(e.target.value)} className="w-44 text-xs">
            <option value="all">All Sources</option>
            {factSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={factStatus} onChange={(e) => setFactStatus(e.target.value)} className="w-28 text-xs">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </Select>
        </div>

        <div className="space-y-2">
          {!filteredRecords.length && !!records.length && (
            <p className="text-xs text-ink-muted">No facts match the current filters.</p>
          )}
          {filteredRecords.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-[4px] border border-border-hairline bg-surface-1 px-3.5 py-2.5 text-sm hover:bg-surface-2 transition-colors"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <Badge tone="neutral">{r.category}</Badge>
                  <span className="text-xs text-ink-secondary">{r.content.fact}</span>
                </div>
                <span className="text-[11px] text-ink-muted font-mono">
                  {r.content.sourceFileName || "Unknown source"} · {r.content.documentType || "—"} · {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                onClick={() => toggleActive(r.id, !r.isActive)}
                className="text-xs font-mono text-ink-muted hover:text-ink-primary transition-colors ml-4 shrink-0"
              >
                {r.isActive ? "Pause" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      </div>
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
