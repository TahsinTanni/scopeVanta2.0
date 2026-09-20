"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Global transient toasts. In-memory only — never persisted across navigation.
type ToastTone = "success" | "error";
type ToastItem = { id: string; message: string; tone: ToastTone };

type ToastContextValue = { showToast: (message: string, tone: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_MS = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone) => {
      const id = crypto.randomUUID();
      // Functional update so rapid successive calls never overwrite each other.
      setToasts((prev) => [...prev, { id, message, tone }]);
      timers.current.set(id, setTimeout(() => dismiss(id), TOAST_MS));
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="no-print fixed bottom-5 left-5 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`flex min-w-[220px] max-w-sm items-start gap-3 rounded-[4px] border border-border-hairline border-l-4 bg-surface-2 px-3.5 py-2.5 text-sm text-ink-primary ${
              t.tone === "success" ? "border-l-success" : "border-l-danger"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-ink-muted transition-colors hover:text-ink-primary"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}
