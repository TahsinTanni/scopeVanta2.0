"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

// Shown when a page throws while rendering. Keeps the customer inside the app
// with a way to retry instead of Next's bare default error screen.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[12px] border border-border-hairline bg-surface-1 p-8 text-center">
        <span className="material-symbols-outlined text-[32px] text-warning">error</span>
        <h1 className="mt-3 font-display text-2xl text-ink-primary">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-muted font-body">
          This page hit an unexpected error. Your data is safe — try again, and if it keeps happening, contact support
          {error.digest ? (
            <>
              {" "}
              and mention reference <span className="font-mono text-ink-secondary">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-[4px] bg-accent px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white"
          >
            Try again
          </button>
          <Link href="/dashboard" className="text-xs font-mono uppercase tracking-wider text-ink-muted hover:text-ink-primary">
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
