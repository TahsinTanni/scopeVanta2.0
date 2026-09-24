// Small, dependency-free display helpers for the admin panel.

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtAgo(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-CA");
}

export function fmtPct(n: number | null): string {
  return n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;
}

export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

export function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Reads a single string query param from Next's searchParams. */
export function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}
