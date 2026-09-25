"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it brings its own <html>/<body> and plain inline styles
// (the app's stylesheet and fonts may be what failed).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#111", color: "#eee" }}>
        <title>Something went wrong · ScopeVanta</title>
        <div style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>ScopeVanta hit an unexpected error</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>
            Your data is safe. Please try again{error.digest ? ` (reference ${error.digest})` : ""}.
          </p>
          <button type="button" onClick={() => retry()} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 4, border: 0, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
