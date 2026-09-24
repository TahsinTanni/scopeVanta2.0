"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Button } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Method = "POST" | "PATCH" | "DELETE" | "GET";

async function send(url: string, method: Method, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Clerk's reverification hint (see adminRoute) comes back as JSON too, and
  // useReverification intercepts it, prompts, then retries this function.
  return res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
}

/**
 * One way to call /api/admin from the admin UI: handles Clerk's
 * re-enter-your-password prompt for sensitive actions, shows the result as a
 * toast, and refreshes the server-rendered page so it reflects the change.
 */
export function useAdminRequest() {
  const router = useRouter();
  const { showToast } = useToast();
  const request = useReverification(send);
  const [busy, setBusy] = useState(false);

  async function run<T = Record<string, unknown>>(
    url: string,
    method: Method,
    body?: unknown,
    opts: { success?: string; refresh?: boolean } = {},
  ): Promise<T | null> {
    setBusy(true);
    try {
      const data = (await request(url, method, body)) as T & { error?: string };
      if (data && typeof data === "object" && "error" in data && data.error) {
        showToast(data.error, "error");
        return null;
      }
      if (opts.success) showToast(opts.success, "success");
      if (opts.refresh !== false) router.refresh();
      return data;
    } catch (e) {
      if (!isReverificationCancelledError(e)) showToast("Something went wrong. Please try again.", "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy };
}

/** A button that performs one admin action, optionally after a confirm(). */
export function ActionButton({
  url,
  method = "POST",
  body,
  label,
  success,
  confirmText,
  variant = "secondary",
  icon,
}: {
  url: string;
  method?: Method;
  body?: unknown;
  label: string;
  success?: string;
  confirmText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
}) {
  const { run, busy } = useAdminRequest();
  return (
    <Button
      variant={variant}
      loading={busy}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        void run(url, method, body, { success });
      }}
    >
      {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}
      {label}
    </Button>
  );
}
