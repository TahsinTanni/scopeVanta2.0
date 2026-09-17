import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Post-auth app shell — replaces legacy App.tsx's sidebar nav (dashboard /
// new / projects / clients / files / company / billing) with real routes
// instead of a single-page `view` state string. Also gates onboarding here
// instead of a top-level `if (!profile.onboarded)` branch in one component.
const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/proposals/new", label: "New Proposal" },
  { href: "/proposals", label: "Proposals" },
  { href: "/clients", label: "Clients" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/settings/company", label: "Company Profile" },
  { href: "/settings/billing", label: "Plan & Billing" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/workspace");

  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: orgId } });
  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <aside className="no-print flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="text-sm font-semibold tracking-tight text-foreground">ScopeVanta</span>
        </div>
        <div className="border-b border-border px-3 py-3">
          <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: "w-full", organizationSwitcherTrigger: "w-full justify-between text-foreground" } }} />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          <UserButton />
          <span className="text-xs text-foreground-subtle">Account</span>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
