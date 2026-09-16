"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Badge, EmptyState } from "@/components/ui";

// Replaces legacy App.tsx's knowledge view (lines 5923-6247).
type FileItem = { id: string; name: string; status: string; extractedChars: number; error?: string; documentType?: string; summary?: string };
type KnowledgeRecord = { id: string; category: string; content: { fact: string; sourceFileName: string }; isActive: boolean };
type Health = { healthy: boolean; files: number; facts: number; activeFacts: number; recommendation: string };

export default function KnowledgePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div>
      <PageHeader
        title="Knowledge"
        description="Knowledge Base"
        actions={
          <label className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            {uploading ? "Uploading…" : "Upload file"}
            <input type="file" className="hidden" accept=".pdf,.txt,.md,.doc,.docx,image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
        }
      />
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {health && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Knowledge health</p>
              <p className="mt-1 text-xs text-foreground-subtle">{health.recommendation}</p>
            </div>
            <Badge tone={health.healthy ? "success" : "warning"}>{health.healthy ? "Healthy" : "Needs review"}</Badge>
          </div>
          <div className="mt-3 flex gap-6 text-xs text-foreground-subtle">
            <span>{health.files} files</span>
            <span>{health.activeFacts}/{health.facts} active facts</span>
          </div>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold text-foreground">Files</h2>
      {!files.length ? (
        <EmptyState title="No knowledge files yet" description="Upload a capability deck, service sheet, or reference document." />
      ) : (
        <div className="mb-8 space-y-2">
          {files.map((f) => (
            <Card key={f.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{f.name}</p>
                <p className="text-xs text-foreground-subtle">{f.documentType || f.status} · {f.extractedChars} chars{f.error ? ` · ${f.error}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={f.status === "ready" ? "success" : f.status === "failed" ? "danger" : "neutral"}>{f.status}</Badge>
                <Button variant="secondary" onClick={() => reprocess(f.id)}>Reprocess</Button>
                <Button variant="danger" onClick={() => remove(f.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-foreground">Facts ({records.length})</h2>
      <div className="space-y-2">
        {records.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2 text-sm">
            <div>
              <Badge>{r.category}</Badge>
              <span className="ml-2 text-foreground-muted">{r.content.fact}</span>
            </div>
            <button onClick={() => toggleActive(r.id, !r.isActive)} className="text-xs text-foreground-subtle hover:text-foreground">
              {r.isActive ? "Pause" : "Activate"}
            </button>
          </div>
        ))}
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
