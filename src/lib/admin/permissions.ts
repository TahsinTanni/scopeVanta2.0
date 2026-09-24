import type { StaffRole } from "@/generated/prisma/enums";

// The single, central map of what each platform-staff role may do. Every
// admin page and /api/admin route asks this table through `can()` /
// `requireStaff()` — there are no inline role checks anywhere else.
//
// Platform staff roles are unrelated to workspace roles (OWNER/ADMIN/MEMBER):
// a workspace ADMIN manages one customer's team and never gets any of these.

const ALL: StaffRole[] = ["SUPER_ADMIN", "SUPPORT", "BILLING"];

export const STAFF_PERMISSIONS = {
  "overview.view": ALL,
  "workspaces.view": ALL,
  "workspaces.suspend": ["SUPER_ADMIN"],
  "workspaces.export": ["SUPER_ADMIN"],
  "workspaces.delete": ["SUPER_ADMIN"],
  "users.view": ALL,
  "users.ban": ["SUPER_ADMIN"],
  "users.impersonate": ["SUPER_ADMIN", "SUPPORT"],
  "billing.view": ["SUPER_ADMIN", "BILLING"],
  "billing.manage": ["SUPER_ADMIN", "BILLING"],
  "support.view": ["SUPER_ADMIN", "SUPPORT"],
  "support.manage": ["SUPER_ADMIN", "SUPPORT"],
  "flags.manage": ["SUPER_ADMIN"],
  "health.view": ALL,
  "staff.manage": ["SUPER_ADMIN"],
  "audit.view": ["SUPER_ADMIN"],
} satisfies Record<string, StaffRole[]>;

export type StaffPermission = keyof typeof STAFF_PERMISSIONS;

export function can(role: StaffRole, permission: StaffPermission): boolean {
  return (STAFF_PERMISSIONS[permission] as StaffRole[]).includes(role);
}

export const STAFF_ROLE_LABELS: Record<StaffRole, { label: string; description: string }> = {
  SUPER_ADMIN: { label: "Super admin", description: "Full access, including managing other staff." },
  SUPPORT: { label: "Support", description: "Views workspaces and users, handles the support inbox, can view as a customer." },
  BILLING: { label: "Billing", description: "Manages subscriptions, free plans, limits and trials." },
};
