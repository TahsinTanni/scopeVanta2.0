import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import SupportChat from "@/components/SupportChat";
import { ToastProvider } from "@/components/Toast";
import CommandPalette from "@/components/CommandPalette";
import { NavigationGuardProvider } from "@/components/NavigationGuard";

// Post-auth app shell — replaces legacy App.tsx's sidebar nav (dashboard /
// new / projects / clients / files / company / billing) with real routes
// instead of a single-page `view` state string. Also gates onboarding here
// instead of a top-level `if (!profile.onboarded)` branch in one component.
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/proposals/new", label: "New Proposal", icon: "add_circle" },
  { href: "/proposals", label: "Proposals", icon: "description" },
  { href: "/clients", label: "Clients", icon: "group" },
  { href: "/knowledge", label: "Knowledge", icon: "library_books" },
  { href: "/settings/rates", label: "Rate Library", icon: "payments" },
  { href: "/settings/company", label: "Company Profile", icon: "domain" },
  { href: "/settings/billing", label: "Plan & Billing", icon: "credit_card" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/workspace");

  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: orgId } });
  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <ToastProvider>
    <NavigationGuardProvider>
    <div className="flex h-screen overflow-hidden bg-surface-0 font-body">
      <aside className="no-print flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border-hairline bg-surface-1">
        <div className="flex items-center gap-2.5 border-b border-border-hairline px-5 py-4">
          <div className="h-6 w-6 rounded-[4px] bg-accent flex items-center justify-center text-surface-0 font-bold text-xs">
            SV
          </div>
          <span className="font-display text-lg font-medium tracking-tight text-ink-primary">ScopeVanta</span>
        </div>
        <div className="border-b border-border-hairline px-3 py-3">
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-between text-ink-primary bg-surface-2 border border-border-hairline rounded-[4px] px-3 py-1.5 text-xs font-mono hover:bg-surface-3 transition-colors",
              },
            }}
          />
        </div>
        <div className="px-3 pt-3">
          <CommandPalette />
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink-primary transition-colors"
            >
              <span className="material-symbols-outlined text-ink-muted text-[18px]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-border-hairline px-5 py-3.5 bg-surface-1">
          <UserButton />
          <span className="text-xs text-ink-disabled font-mono">Workspace Auth</span>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-8 bg-surface-0">{children}</main>
      <SupportChat />
    </div>
    </NavigationGuardProvider>
    </ToastProvider>
  );
}
