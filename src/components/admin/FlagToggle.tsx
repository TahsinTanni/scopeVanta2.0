"use client";

import { useAdminRequest } from "@/components/admin/AdminAction";
import { Button } from "@/components/ui";

export function GlobalFlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const { run, busy } = useAdminRequest();
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-mono uppercase tracking-wider ${enabled ? "text-accent-hover" : "text-danger"}`}>{enabled ? "On" : "Off"}</span>
      <Button
        variant={enabled ? "danger" : "primary"}
        loading={busy}
        onClick={() => {
          if (enabled) {
            const reason = window.prompt("Why are you turning this off for everyone? (shown in the activity log)");
            if (!reason || reason.trim().length < 3) return;
            void run("/api/admin/flags", "POST", { key: flagKey, scope: "global", enabled: false, reason: reason.trim() }, { success: "Switched off." });
          } else {
            void run("/api/admin/flags", "POST", { key: flagKey, scope: "global", enabled: null }, { success: "Switched back on." });
          }
        }}
      >
        {enabled ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}
