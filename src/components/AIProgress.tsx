"use client";

import { useEffect, useRef, useState } from "react";

// Honest "still working" indicator for AI actions: three dots (matching
// SupportChat's typing indicator) plus a percentage that eases toward ~90%
// over `durationMs` — never a precise measured number — and snaps to 100%
// the instant `active` goes false, then clears shortly after.
export function AIProgress({ active, durationMs = 6000, label }: { active: boolean; durationMs?: number; label?: string }) {
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      setVisible(true);
      startRef.current = Date.now();
      setPct(4);
      const id = setInterval(() => {
        const elapsed = Date.now() - (startRef.current ?? Date.now());
        setPct(Math.min(90, 90 * (1 - Math.exp(-elapsed / durationMs))));
      }, 120);
      return () => clearInterval(id);
    }
    if (startRef.current !== null) {
      setPct(100);
      startRef.current = null;
      const id = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(id);
    }
  }, [active, durationMs]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-ink-muted font-mono tabular-nums" role="status" aria-label={label ? `${label} in progress` : "Working"}>
      <span className="flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </span>
      <span>
        {label ? `${label} — ` : ""}
        {Math.round(pct)}%
      </span>
    </div>
  );
}
