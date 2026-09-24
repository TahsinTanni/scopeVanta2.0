import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { OrganizationSwitcher, SignOutButton } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

// Where the app shell sends members of a workspace that platform staff have
// suspended. They can switch to another workspace they belong to, or sign out.
export default async function SuspendedPage() {
  const { userId, orgId } = await auth();
  if (!userId) redirect("/sign-in");
  const workspace = orgId ? await prisma.workspace.findUnique({ where: { id: orgId }, select: { name: true, suspendedAt: true } }) : null;
  if (!workspace?.suspendedAt) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <div className="w-full max-w-md rounded-[12px] border border-border-hairline bg-surface-1 p-8 text-center">
        <span className="material-symbols-outlined text-[32px] text-warning">block</span>
        <h1 className="mt-3 font-display text-2xl text-ink-primary">Workspace suspended</h1>
        <p className="mt-2 text-sm text-ink-muted font-body">
          Access to <strong className="text-ink-secondary">{workspace.name}</strong> has been suspended. Please contact ScopeVanta
          support if you think this is a mistake.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/dashboard" />
          <SignOutButton>
            <button type="button" className="text-xs font-mono uppercase tracking-wider text-ink-muted hover:text-ink-primary">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
