import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[12px] border border-border-hairline bg-surface-1 p-8 text-center">
        <span className="material-symbols-outlined text-[32px] text-ink-muted">search_off</span>
        <h1 className="mt-3 font-display text-2xl text-ink-primary">Page not found</h1>
        <p className="mt-2 text-sm text-ink-muted font-body">This page doesn&apos;t exist, or the link has expired.</p>
        <Link href="/" className="mt-6 inline-block text-xs font-mono uppercase tracking-wider text-ink-muted hover:text-ink-primary">
          Back to ScopeVanta
        </Link>
      </div>
    </main>
  );
}
