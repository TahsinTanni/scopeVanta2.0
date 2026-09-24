import Link from "next/link";
import type { ReactNode } from "react";

// Presentational building blocks shared by every /admin page (server-safe).

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warning" }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink-primary";
  return (
    <div className="rounded-[8px] border border-border-hairline bg-surface-1 p-4">
      <p className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted font-body">{hint}</p>}
    </div>
  );
}

export function Section({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[8px] border border-border-hairline bg-surface-1">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-hairline px-4 py-3">
        <div>
          <h2 className="font-display text-lg text-ink-primary">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-muted font-body">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm font-body">
        <thead>
          <tr className="border-b border-border-hairline">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-[11px] font-mono font-medium uppercase tracking-wider text-ink-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-hairline">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-sm text-ink-muted">
                {empty || "Nothing here yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top text-ink-secondary ${className}`}>{children}</td>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-muted border-border-hairline",
    success: "bg-accent/10 text-accent-hover border-accent/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    info: "bg-surface-3 text-ink-primary border-border-hairline",
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-mono ${tones[tone]}`}>{children}</span>;
}

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl text-ink-primary tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted font-body">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** GET search form that keeps the rest of the page server-rendered. */
export function SearchForm({ placeholder, defaultValue, extra }: { placeholder: string; defaultValue: string; extra?: ReactNode }) {
  return (
    <form className="mb-4 flex flex-wrap gap-2" role="search">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-w-[240px] flex-1 rounded-[4px] border border-border-hairline bg-surface-1 px-3 py-1.5 text-sm text-ink-primary placeholder:text-ink-disabled focus:border-accent focus:outline-none"
      />
      {extra}
      <button type="submit" className="rounded-[4px] border border-border-hairline px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:bg-surface-3">
        Search
      </button>
    </form>
  );
}

export function Pager({ page, hasMore, basePath, query }: { page: number; hasMore: boolean; basePath: string; query: Record<string, string> }) {
  const href = (p: number) => `${basePath}?${new URLSearchParams({ ...query, page: String(p) }).toString()}`;
  if (page <= 1 && !hasMore) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs font-mono text-ink-muted">
      {page > 1 ? <Link className="hover:text-ink-primary" href={href(page - 1)}>← Previous</Link> : <span />}
      <span>Page {page}</span>
      {hasMore ? <Link className="hover:text-ink-primary" href={href(page + 1)}>Next →</Link> : <span />}
    </div>
  );
}

export function KeyValue({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] font-mono uppercase tracking-wider text-ink-muted">{k}</dt>
          <dd className="mt-0.5 text-sm text-ink-primary font-body break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
