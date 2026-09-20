"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/ui";
import { useNavigationGuard } from "@/components/NavigationGuard";

type Results = {
  clients: Array<{ id: string; name: string; company: string | null }>;
  proposals: Array<{ id: string; clientLabel: string | null; dealStage: string }>;
  knowledge: Array<{ id: string; name: string }>;
};

const EMPTY: Results = { clients: [], proposals: [], knowledge: [] };

// Global Cmd/Ctrl+K search. Renders its own sidebar trigger plus the dialog.
// Nothing is persisted: closing clears the query and results.
export default function CommandPalette() {
  const { requestNavigation } = useNavigationGuard();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced search-as-you-type (~250ms); stale responses are ignored.
  useEffect(() => {
    if (!open || !q.trim()) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setResults({ clients: d.clients || [], proposals: d.proposals || [], knowledge: d.knowledge || [] });
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  function close() {
    setOpen(false);
    setQ("");
    setResults(EMPTY);
  }

  function go(href: string) {
    close();
    requestNavigation(href);
  }

  const shown = q.trim() ? results : EMPTY;
  const flat = [
    ...shown.clients.map((c) => `/clients?edit=${c.id}`),
    ...shown.proposals.map((p) => `/proposals/${p.id}`),
    ...shown.knowledge.map(() => "/knowledge"),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-[4px] border border-border-hairline bg-surface-2 px-3 py-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">search</span>
          Search...
        </span>
        <kbd className="font-mono text-[11px] text-ink-disabled">⌘K</kbd>
      </button>

      <Dialog open={open} onClose={close} title="Search" className="max-w-xl">
        <div className="p-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && flat.length === 1) go(flat[0]);
            }}
            placeholder="Search clients, proposals, knowledge…"
            aria-label="Search"
          />
          <div className="mt-3 max-h-[60vh] space-y-3 overflow-y-auto">
            {shown.clients.length > 0 && (
              <Section title="Clients">
                {shown.clients.map((c) => (
                  <ResultRow key={c.id} onSelect={() => go(`/clients?edit=${c.id}`)} primary={c.name} secondary={c.company || undefined} />
                ))}
              </Section>
            )}
            {shown.proposals.length > 0 && (
              <Section title="Proposals">
                {shown.proposals.map((p) => (
                  <ResultRow key={p.id} onSelect={() => go(`/proposals/${p.id}`)} primary={p.clientLabel || "Untitled opportunity"} secondary={p.dealStage} />
                ))}
              </Section>
            )}
            {shown.knowledge.length > 0 && (
              <Section title="Knowledge">
                {shown.knowledge.map((f) => (
                  <ResultRow key={f.id} onSelect={() => go("/knowledge")} primary={f.name} />
                ))}
              </Section>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-mono uppercase tracking-wider text-ink-muted">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultRow({ primary, secondary, onSelect }: { primary: string; secondary?: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-left text-sm text-ink-primary transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none"
    >
      <span>{primary}</span>
      {secondary && <span className="text-xs text-ink-muted">{secondary}</span>}
    </button>
  );
}
