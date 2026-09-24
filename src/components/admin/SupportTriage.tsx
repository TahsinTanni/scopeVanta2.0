"use client";

import { useState } from "react";
import { Button, Textarea } from "@/components/ui";
import { useAdminRequest } from "@/components/admin/AdminAction";

export function SupportTriage({ id, status, notes, email }: { id: string; status: string; notes: string; email: string | null }) {
  const { run, busy } = useAdminRequest();
  const [text, setText] = useState(notes);
  const url = `/api/admin/support/${id}`;
  return (
    <div className="space-y-3">
      <Textarea rows={4} placeholder="Internal notes…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => run(url, "POST", { staffNotes: text }, { success: "Notes saved." })}>
          Save notes
        </Button>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() =>
            run(url, "POST", { status: status === "open" ? "resolved" : "open" }, { success: status === "open" ? "Marked resolved." : "Reopened." })
          }
        >
          {status === "open" ? "Mark resolved" : "Reopen"}
        </Button>
        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent("Your ScopeVanta support question")}`}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-border-hairline px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:bg-surface-3"
          >
            <span className="material-symbols-outlined text-[16px]">mail</span>
            Email customer
          </a>
        )}
      </div>
    </div>
  );
}
