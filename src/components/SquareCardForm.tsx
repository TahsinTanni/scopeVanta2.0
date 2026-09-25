"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

// Minimal typing for the parts of Square's Web Payments SDK used here.
type SquareCard = {
  attach: (selector: HTMLElement) => Promise<void>;
  tokenize: (details: Record<string, unknown>) => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>;
  destroy: () => Promise<boolean>;
};
type SquareSdk = { payments: (applicationId: string, locationId: string) => { card: () => Promise<SquareCard> } };
declare global {
  interface Window {
    Square?: SquareSdk;
  }
}

const SDK_URL = {
  sandbox: "https://sandbox.web.squarecdn.com/v1/square.js",
  production: "https://web.squarecdn.com/v1/square.js",
} as const;

// One <script> per page load; sandbox and production never mix in one session.
let sdkPromise: Promise<SquareSdk> | null = null;
function loadSquareSdk(environment: keyof typeof SDK_URL): Promise<SquareSdk> {
  if (window.Square) return Promise.resolve(window.Square);
  sdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL[environment];
    script.async = true;
    script.onload = () => (window.Square ? resolve(window.Square) : reject(new Error("Square SDK missing")));
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Square SDK failed to load"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/**
 * Square-hosted card fields (the card number never touches ScopeVanta) plus a
 * submit button. The card token is handed to `onToken`, which sends it to the
 * server (subscribe or update-card) and resolves to an error message, or null
 * on success.
 */
export function SquareCardForm({
  intro,
  submitLabel,
  busyLabel,
  onToken,
  onDone,
  onCancel,
}: {
  intro: ReactNode;
  submitLabel: string;
  busyLabel: string;
  onToken: (token: string) => Promise<string | null>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let card: SquareCard | null = null;
    (async () => {
      try {
        const res = await fetch("/api/billing/checkout-config");
        const cfg = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(cfg.error || "Square checkout is unavailable.");
        const sdk = await loadSquareSdk(cfg.environment === "sandbox" ? "sandbox" : "production");
        if (cancelled || !containerRef.current) return;
        card = await sdk.payments(cfg.applicationId, cfg.locationId).card();
        if (cancelled || !containerRef.current) return void card.destroy();
        await card.attach(containerRef.current);
        cardRef.current = card;
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Square checkout is unavailable.");
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current = null;
      card?.destroy();
    };
  }, []);

  async function submit() {
    if (!cardRef.current) return;
    setBusy(true);
    setError("");
    try {
      const result = await cardRef.current.tokenize({
        // STORE rejects currencyCode/amount: nothing is charged when saving.
        intent: "STORE",
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact: {},
      });
      if (result.status !== "OK" || !result.token) {
        setError(result.errors?.[0]?.message || "Check your card details and try again.");
        return;
      }
      const failure = await onToken(result.token);
      if (failure) {
        setError(failure);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-primary">{intro}</p>
      <div ref={containerRef} className="mt-4 min-h-[90px]" />
      {!ready && !error && <p className="text-xs font-mono text-ink-muted">Loading secure card form…</p>}
      {error && (
        <div className="mt-3 rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">{error}</div>
      )}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={!ready || busy} loading={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Card details are entered in Square&apos;s secure form. ScopeVanta never sees the full card number.</p>
    </div>
  );
}
