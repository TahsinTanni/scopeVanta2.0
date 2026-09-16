"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, PageHeader, Button, Badge, EmptyState } from "@/components/ui";

// Replaces legacy App.tsx's projects view (lines 5387-5420) — a list that
// hands off into the opportunity workspace.
type ProjectSummary = { id: string; clientLabel: string | null; riskScore: number | null; dealStage: string; createdAt: string };

export default function ProposalsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(d.projects || []));
  }, []);

  return (
    <div>
      <PageHeader title="Proposals" actions={<Link href="/proposals/new"><Button>New Proposal</Button></Link>} />
      {!projects.length ? (
        <EmptyState title="No proposals yet" description="Generate your first proposal from a client brief." />
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/proposals/${p.id}`}>
              <Card className="flex items-center justify-between hover:border-foreground-muted">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.clientLabel || "Untitled opportunity"}</p>
                  <p className="text-xs text-foreground-subtle">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{p.dealStage}</Badge>
                  {p.riskScore != null && <Badge tone={p.riskScore >= 70 ? "danger" : p.riskScore >= 40 ? "warning" : "success"}>{p.riskScore}</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
