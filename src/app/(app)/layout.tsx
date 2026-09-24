import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ToastProvider } from "@/components/Toast";
import { NavigationGuardProvider } from "@/components/NavigationGuard";
import Sidebar from "@/components/Sidebar";
import { getStaffContext } from "@/lib/admin/auth";

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
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  if (!orgId) redirect("/onboarding/workspace");

  const workspace = await prisma.workspace.findUnique({ where: { id: orgId }, select: { suspendedAt: true } });
  if (workspace?.suspendedAt) redirect("/suspended");

  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: orgId } });
  if (!profile?.onboarded) redirect("/onboarding");

  // Platform staff get a link into /admin. getStaffContext() ignores
  // view-as-customer sessions, so an impersonated customer never sees it.
  const staff = await getStaffContext();
  const nav = staff ? [...NAV, { href: "/admin", label: "Admin", icon: "admin_panel_settings" }] : NAV;
  const viewingAsCustomer = Boolean(sessionClaims?.act);

  return (
    <ToastProvider>
    <NavigationGuardProvider>
      {viewingAsCustomer && (
        <div role="status" className="no-print fixed inset-x-0 top-0 z-[60] flex h-8 items-center justify-center gap-2 bg-warning text-[11px] font-mono font-semibold uppercase tracking-wider text-[#1a1200]">
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          Staff view-as-customer session · read-only · sign out when done
        </div>
      )}
      <Sidebar nav={nav}>{children}</Sidebar>
    </NavigationGuardProvider>
    </ToastProvider>
  );
}
