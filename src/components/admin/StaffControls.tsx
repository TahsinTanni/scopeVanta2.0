"use client";

import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { useAdminRequest } from "@/components/admin/AdminAction";
import { STAFF_ROLE_LABELS } from "@/lib/admin/permissions";

const ROLES = Object.entries(STAFF_ROLE_LABELS) as Array<[string, { label: string }]>;

export function AddStaffForm() {
  const { run, busy } = useAdminRequest();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SUPPORT");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run("/api/admin/staff", "POST", { email: email.trim(), role }, { success: "Staff access granted." });
        if (res) setEmail("");
      }}
    >
      <div className="min-w-[240px] flex-1">
        <Input type="email" required placeholder="their-email@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="w-44">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map(([value, v]) => (
            <option key={value} value={value}>{v.label}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" loading={busy}>Grant access</Button>
    </form>
  );
}

export function StaffRowActions({ userId, role, email }: { userId: string; role: string; email: string }) {
  const { run, busy } = useAdminRequest();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="w-36">
        <Select
          value={role}
          disabled={busy}
          onChange={(e) => void run(`/api/admin/staff/${userId}`, "PATCH", { role: e.target.value }, { success: "Role updated." })}
          aria-label={`Role for ${email}`}
        >
          {ROLES.map(([value, v]) => (
            <option key={value} value={value}>{v.label}</option>
          ))}
        </Select>
      </div>
      <Button
        variant="danger"
        loading={busy}
        onClick={() => {
          if (window.confirm(`Remove admin access for ${email}?`)) void run(`/api/admin/staff/${userId}`, "DELETE", undefined, { success: "Access removed." });
        }}
      >
        Remove
      </Button>
    </div>
  );
}
