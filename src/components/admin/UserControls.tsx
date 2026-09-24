"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useAdminRequest } from "@/components/admin/AdminAction";

export function BanControl({ userId, banned }: { userId: string; banned: boolean }) {
  const { run, busy } = useAdminRequest();
  const [reason, setReason] = useState("");
  const url = `/api/admin/users/${userId}/ban`;
  if (banned) {
    return (
      <Button variant="secondary" loading={busy} onClick={() => run(url, "POST", { banned: false }, { success: "User unbanned." })}>
        Unban user
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-secondary">Signs them out everywhere and blocks sign-in. Their workspaces and data are untouched.</p>
      <Input placeholder="Reason (required, stored in the activity log)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button
        variant="danger"
        loading={busy}
        disabled={reason.trim().length < 3}
        onClick={() => {
          if (window.confirm("Ban this user now?")) void run(url, "POST", { banned: true, reason: reason.trim() }, { success: "User banned." });
        }}
      >
        Ban user
      </Button>
    </div>
  );
}

export function ImpersonateControl({ userId }: { userId: string }) {
  const { run, busy } = useAdminRequest();
  const [reason, setReason] = useState("");
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-secondary">
        Creates a one-time sign-in link that opens their account read-only for up to 30 minutes, with a banner on every page. Use it
        to reproduce a problem they reported. It&apos;s logged with your reason.
      </p>
      {link ? (
        <div className="space-y-2 rounded-[4px] border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm text-ink-primary">
            Open this link in a <strong>private/incognito window</strong> so your own staff session isn&apos;t replaced. It expires in 10 minutes.
          </p>
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
      ) : (
        <>
          <Input placeholder="Reason, e.g. ticket reference (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            variant="secondary"
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              const res = await run<{ url: string }>(`/api/admin/users/${userId}/impersonate`, "POST", { reason: reason.trim() }, { refresh: false });
              if (res?.url) setLink(res.url);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            Create view-as-customer link
          </Button>
        </>
      )}
    </div>
  );
}
