"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { useAdminRequest } from "@/components/admin/AdminAction";
import { useToast } from "@/components/Toast";

export function SuspendControl({ workspaceId, suspended, reason }: { workspaceId: string; suspended: boolean; reason: string | null }) {
  const { run, busy } = useAdminRequest();
  const [text, setText] = useState("");
  const url = `/api/admin/workspaces/${workspaceId}/suspend`;

  if (suspended) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-secondary">
          Suspended{reason ? <>: <span className="text-ink-primary">{reason}</span></> : null}. Members can&apos;t use the app and share links are off.
        </p>
        <Button variant="secondary" loading={busy} onClick={() => run(url, "POST", { suspended: false }, { success: "Workspace restored." })}>
          Restore access
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-secondary">Blocks every member from the app and turns off this workspace&apos;s client share links. Nothing is deleted.</p>
      <Input placeholder="Reason (required, stored in the activity log)" value={text} onChange={(e) => setText(e.target.value)} />
      <Button
        variant="danger"
        loading={busy}
        disabled={text.trim().length < 3}
        onClick={() => {
          if (window.confirm("Suspend this workspace now?")) void run(url, "POST", { suspended: true, reason: text.trim() }, { success: "Workspace suspended." });
        }}
      >
        Suspend workspace
      </Button>
    </div>
  );
}

export function BillingControls({
  workspaceId,
  compPlan,
  compNote,
  limitOverride,
  plan,
  trialEndsAt,
}: {
  workspaceId: string;
  compPlan: boolean;
  compNote: string | null;
  limitOverride: number | null;
  plan: string;
  trialEndsAt: string | null;
}) {
  const { run, busy } = useAdminRequest();
  const [comp, setComp] = useState(compPlan);
  const [note, setNote] = useState(compNote ?? "");
  const [planValue, setPlanValue] = useState(plan);
  const [limit, setLimit] = useState(limitOverride == null ? "" : String(limitOverride));
  const [extend, setExtend] = useState("");
  const url = `/api/admin/workspaces/${workspaceId}/billing`;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Free plan</Label>
          <label className="mt-1 flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" checked={comp} onChange={(e) => setComp(e.target.checked)} className="accent-[var(--accent)]" />
            Complimentary access (no Square charge or checks)
          </label>
          <Input className="mt-2" placeholder="Why? e.g. internal, partner, goodwill" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div>
          <Label>Plan</Label>
          <Select value={planValue} onChange={(e) => setPlanValue(e.target.value)}>
            {["Freelancer", "Pro", "Agency"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-muted">Only affects limits and labels here; paid plans are still set by Square checkout.</p>
        </div>
        <div>
          <Label>Monthly proposal limit override</Label>
          <Input type="number" min={0} placeholder="Blank = use the plan's limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
      </div>
      <Button
        loading={busy}
        disabled={comp && note.trim().length < 3}
        onClick={() =>
          run(
            url,
            "POST",
            { compPlan: comp, compNote: note.trim() || null, plan: planValue, limitOverride: limit.trim() === "" ? null : Number(limit) },
            { success: "Billing overrides saved." },
          )
        }
      >
        Save overrides
      </Button>

      <div className="border-t border-border-hairline pt-4">
        <Label>Extend trial</Label>
        <p className="mb-2 text-xs text-ink-muted">
          Current trial end: {trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("en-CA") : "not started"}. This changes ScopeVanta&apos;s record only — Square&apos;s
          own billing date is unchanged, so pair it with a Square adjustment if the customer shouldn&apos;t be charged.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input type="number" min={1} max={365} placeholder="Days" value={extend} onChange={(e) => setExtend(e.target.value)} className="w-28" />
          <Button
            variant="secondary"
            loading={busy}
            disabled={!(Number(extend) >= 1)}
            onClick={() => run(url, "POST", { extendTrialDays: Number(extend) }, { success: "Trial extended." })}
          >
            Extend
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ExportButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  const { run, busy } = useAdminRequest();
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        const data = await run(`/api/admin/workspaces/${workspaceId}/export`, "GET", undefined, { refresh: false });
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `scopevanta-export-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }}
    >
      <span className="material-symbols-outlined text-[16px]">download</span>
      Export all data (JSON)
    </Button>
  );
}

export function DeleteWorkspace({ workspaceId, name, suspended }: { workspaceId: string; name: string; suspended: boolean }) {
  const { run, busy } = useAdminRequest();
  const router = useRouter();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState("");
  if (!suspended) {
    return <p className="text-sm text-ink-muted">Suspend the workspace first. Deletion is only allowed for suspended workspaces, as a safety step.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-secondary">
        Permanently deletes the workspace, all its data and uploaded files, cancels its Square subscription and removes the Clerk
        organization. This cannot be undone. Export first if the customer asked for a copy.
      </p>
      <Input placeholder={`Type "${name}" to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button
        variant="danger"
        loading={busy}
        disabled={confirm !== name}
        onClick={async () => {
          const res = await run(`/api/admin/workspaces/${workspaceId}/delete`, "POST", { confirmName: confirm }, { refresh: false });
          if (res) {
            showToast("Workspace deleted.", "success");
            router.push("/admin/workspaces");
          }
        }}
      >
        Delete workspace permanently
      </Button>
    </div>
  );
}

export function FlagOverrides({
  workspaceId,
  flags,
}: {
  workspaceId: string;
  flags: Array<{ key: string; label: string; override: boolean | null; global: boolean }>;
}) {
  const { run, busy } = useAdminRequest();
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <Textarea rows={2} placeholder="Reason for changing a switch (stored in the activity log)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="divide-y divide-border-hairline">
        {flags.map((f) => (
          <div key={f.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm text-ink-primary">{f.label}</p>
              <p className="text-xs text-ink-muted">
                {f.override === null ? `Following global setting (${f.global ? "on" : "off"})` : `Overridden: ${f.override ? "on" : "off"} for this workspace`}
              </p>
            </div>
            <div className="w-40">
            <Select
              value={f.override === null ? "inherit" : f.override ? "on" : "off"}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                void run(
                  "/api/admin/flags",
                  "POST",
                  { key: f.key, scope: workspaceId, enabled: v === "inherit" ? null : v === "on", reason: reason.trim() || null },
                  { success: "Switch updated." },
                );
              }}
            >
              <option value="inherit">Use global</option>
              <option value="on">Force on</option>
              <option value="off">Force off</option>
            </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResyncButton({ workspaceId }: { workspaceId: string }) {
  const { run, busy } = useAdminRequest();
  const { showToast } = useToast();
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={async () => {
        const res = await run<{ message: string }>(`/api/admin/workspaces/${workspaceId}/resync`, "POST");
        if (res?.message) showToast(res.message, "success");
      }}
    >
      <span className="material-symbols-outlined text-[16px]">sync</span>
      Resync with Square
    </Button>
  );
}
