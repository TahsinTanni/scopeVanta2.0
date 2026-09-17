"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Button, Badge, EmptyState } from "@/components/ui";

type ProjectSummary = { id: string; clientLabel: string | null; riskScore: number | null; dealStage: string; createdAt: string };

export default function ProposalsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects || []));
  }, []);

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
      {!projects.length ? (
        <EmptyState title="No proposals yet" description="Generate your first proposal from a client brief." />
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/proposals/${p.id}`} className="block group">
              <Card className="flex items-center justify-between border-border-hairline bg-surface-1 hover:bg-surface-2 transition-colors py-3.5 px-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink-primary group-hover:text-accent transition-colors">
                    {p.clientLabel || "Untitled opportunity"}
                  </p>
                  <p className="text-xs text-ink-muted font-mono tabular-nums">
                    {new Date(p.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="neutral">{p.dealStage}</Badge>
                  {p.riskScore != null && (
                    <Badge tone={p.riskScore >= 70 ? "danger" : p.riskScore >= 40 ? "warning" : "success"}>
                      Risk {p.riskScore}
                    </Badge>
                  )}
                  <span className="material-symbols-outlined text-[18px] text-ink-faint group-hover:text-ink-primary transition-colors">
                    chevron_right
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
