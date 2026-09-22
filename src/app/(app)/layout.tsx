import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ToastProvider } from "@/components/Toast";
import { NavigationGuardProvider } from "@/components/NavigationGuard";
import Sidebar from "@/components/Sidebar";

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
      <Sidebar nav={NAV}>{children}</Sidebar>
    </NavigationGuardProvider>
    </ToastProvider>
  );
}
