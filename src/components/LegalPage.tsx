import Link from "next/link";
import type { ReactNode } from "react";

// Shared layout for the public legal pages (/terms, /privacy, /refunds).
// Text in [brackets] is a placeholder the business must fill in before launch.
export const LEGAL_UPDATED = "September 25, 2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-xs font-mono uppercase tracking-wider text-ink-muted hover:text-ink-primary">
        ← ScopeVanta
      </Link>
      <h1 className="mt-6 font-display text-3xl text-ink-primary">{title}</h1>
      <p className="mt-2 text-xs font-mono text-ink-muted">Last updated: {LEGAL_UPDATED}</p>
      <div className="legal mt-8 space-y-4 text-sm leading-relaxed text-ink-secondary font-body [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-ink-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline">
        {children}
      </div>
      <nav className="mt-12 flex gap-4 border-t border-border-hairline pt-6 text-xs font-mono text-ink-muted" aria-label="Legal">
        <Link href="/terms" className="hover:text-ink-primary">Terms of Service</Link>
        <Link href="/privacy" className="hover:text-ink-primary">Privacy Policy</Link>
        <Link href="/refunds" className="hover:text-ink-primary">Cancellation &amp; Refunds</Link>
      </nav>
    </main>
  );
}
