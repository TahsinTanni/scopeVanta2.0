import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ToastProvider } from "@/components/Toast";
import AdminNav, { type AdminNavItem } from "@/components/admin/AdminNav";
import { getStaffContext } from "@/lib/admin/auth";
import { can, STAFF_ROLE_LABELS, type StaffPermission } from "@/lib/admin/permissions";

export const metadata: Metadata = {
  title: "Admin · ScopeVanta",
  robots: { index: false, follow: false },
};

const NAV: Array<AdminNavItem & { permission: StaffPermission }> = [
  { href: "/admin", label: "Overview", icon: "monitoring", permission: "overview.view" },
  { href: "/admin/workspaces", label: "Workspaces", icon: "domain", permission: "workspaces.view" },
  { href: "/admin/users", label: "Users", icon: "group", permission: "users.view" },
  { href: "/admin/billing", label: "Billing", icon: "credit_card", permission: "billing.view" },
  { href: "/admin/support", label: "Support", icon: "support_agent", permission: "support.view" },
  { href: "/admin/controls", label: "Controls", icon: "toggle_on", permission: "flags.manage" },
  { href: "/admin/health", label: "Health", icon: "ecg_heart", permission: "health.view" },
  { href: "/admin/staff", label: "Staff", icon: "badge", permission: "staff.manage" },
  { href: "/admin/audit", label: "Activity log", icon: "history", permission: "audit.view" },
];

// Platform-staff area. Anyone who isn't active staff gets a 404 here, before
// any admin UI renders; each page then re-checks its own permission.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();
  if (!ctx) notFound();

  const items = ctx.mfaVerified
    ? NAV.filter((n) => can(ctx.role, n.permission)).map(({ href, label, icon }) => ({ href, label, icon }))
    : [{ href: "/admin/security", label: "Security setup", icon: "lock" }];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-0 font-body lg:flex">
        <aside className="border-b border-border-hairline bg-surface-1 p-3 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between gap-2 px-2 lg:mb-6">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-accent text-[10px] font-bold text-[#002116]">SV</span>
              <span className="font-display text-base text-ink-primary">Admin</span>
            </Link>
            <UserButton />
          </div>
          <AdminNav items={items} />
          <div className="mt-4 hidden border-t border-border-hairline px-2 pt-4 text-xs text-ink-muted lg:block">
            <p className="font-mono uppercase tracking-wider">{STAFF_ROLE_LABELS[ctx.role].label}</p>
            <p className="mt-0.5 truncate">{ctx.email}</p>
            <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 hover:text-ink-primary">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to app
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
