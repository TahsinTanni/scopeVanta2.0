"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PageHeader, Button, Badge, EmptyState, Input, Select, IconButton, StatusBanner } from "@/components/ui";
import { DEAL_STAGES } from "@/lib/deal-stages";

type ProjectSummary = { id: string; clientLabel: string | null; riskScore: number | null; dealStage: string; createdAt: string };

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "client_az", label: "Client A–Z" },
  { value: "client_za", label: "Client Z–A" },
  { value: "risk_desc", label: "Highest risk first" },
];

export default function ProposalsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [sort, setSort] = useState("newest");
  const router = useRouter();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function duplicate(e: React.MouseEvent, id: string) {
    e.preventDefault(); // the row is a <Link>; don't navigate to the source
    e.stopPropagation();
    if (duplicatingId) return;
    setDuplicatingId(id);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.project?.id) {
        setError(body.error || "Could not duplicate this proposal.");
        return;
      }
      router.push(`/proposals/${body.project.id}`);
    } finally {
      setDuplicatingId(null);
    }
  }

  // Debounce the search box (~300ms) into `q`; a new query returns to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), stage, sort });
    if (q) params.set("q", q);
    fetch(`/api/projects?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const t = d.total || 0;
        const ps = d.pageSize || 20;
        const last = Math.max(1, Math.ceil(t / ps));
        if (page > last) {
          setPage(last);
          return;
        }
        setProjects(d.projects || []);
        setTotal(t);
        setPageSize(ps);
      });
    return () => {
      cancelled = true;
    };
  }, [q, stage, sort, page]);

  const hasFilters = q !== "" || stage !== "all";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Commercial agreements and active scopes."
        actions={
          <Link href="/proposals/new">
            <Button className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Proposal
            </Button>
          </Link>
        }
      />
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:min-w-[200px] sm:flex-1">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client…" aria-label="Search proposals by client" />
        </div>
        <div className="w-full sm:w-44">
          <Select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }} aria-label="Filter by stage">
            <option value="all">All Stages</option>
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort proposals">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>
      {!projects.length ? (
        hasFilters ? (
          <EmptyState title="No proposals match your filters" description="Try a different search term or stage." />
        ) : (
          <EmptyState title="No proposals yet" description="Generate your first proposal from a client brief." />
        )
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/proposals/${p.id}`} className="block group">
              <Card className="flex flex-col gap-2 border-border-hairline bg-surface-1 hover:bg-surface-2 transition-colors py-3.5 px-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-medium text-ink-primary group-hover:text-accent transition-colors">
                    {p.clientLabel || "Untitled opportunity"}
                  </p>
                  <p className="text-xs text-ink-muted font-mono tabular-nums">
                    {new Date(p.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="neutral">{p.dealStage}</Badge>
                  {p.riskScore != null && (
                    <Badge tone={p.riskScore >= 70 ? "danger" : p.riskScore >= 40 ? "warning" : "success"}>
                      Risk {p.riskScore}
                    </Badge>
                  )}
                  <IconButton
                    icon="content_copy"
                    label="Duplicate this proposal"
                    disabled={duplicatingId === p.id}
                    onClick={(e) => duplicate(e, p.id)}
                  />
                  <span className="material-symbols-outlined text-[18px] text-ink-faint group-hover:text-ink-primary transition-colors">
                    chevron_right
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" className="text-xs py-1 px-2.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-ink-muted font-mono tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" className="text-xs py-1 px-2.5" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
