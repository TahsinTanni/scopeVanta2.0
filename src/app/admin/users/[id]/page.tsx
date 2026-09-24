import Link from "next/link";
import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { can, STAFF_ROLE_LABELS } from "@/lib/admin/permissions";
import { fmtDate, fmtDateTime } from "@/lib/admin/format";
import { AdminHeader, KeyValue, Pill, Section, Table, Td } from "@/components/admin/AdminUI";
import { BanControl, ImpersonateControl } from "@/components/admin/UserControls";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("users.view");
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { memberships: { include: { workspace: { select: { id: true, name: true, suspendedAt: true } } } }, platformStaff: true },
  });
  if (!user) notFound();

  let clerkUser: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>> | null = null;
  try {
    clerkUser = await (await clerkClient()).users.getUser(id);
  } catch {
    clerkUser = null;
  }
  const isActiveStaff = Boolean(user.platformStaff && !user.platformStaff.revokedAt);
  const isSelf = id === ctx.userId;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-xs font-mono text-ink-muted hover:text-ink-primary">← Users</Link>
        <AdminHeader
          title={user.email}
          description={user.id}
          actions={
            <div className="flex flex-wrap gap-1.5">
              {clerkUser?.banned && <Pill tone="danger">banned</Pill>}
              {isActiveStaff && <Pill tone="info">staff · {STAFF_ROLE_LABELS[user.platformStaff!.role].label}</Pill>}
            </div>
          }
        />
      </div>

      <Section title="Account">
        <KeyValue
          items={[
            ["Name", [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || "—"],
            ["First seen", fmtDate(user.createdAt)],
            ["Last sign-in", fmtDateTime(clerkUser?.lastSignInAt ? new Date(clerkUser.lastSignInAt) : null)],
            ["Last active", fmtDateTime(clerkUser?.lastActiveAt ? new Date(clerkUser.lastActiveAt) : null)],
            ["Two-factor", clerkUser ? (clerkUser.twoFactorEnabled ? "Enabled" : "Not enabled") : "—"],
            ["Locked (too many attempts)", clerkUser ? (clerkUser.locked ? "Yes" : "No") : "—"],
          ]}
        />
        {!clerkUser && <p className="mt-3 text-sm text-warning">This user no longer exists in Clerk.</p>}
      </Section>

      <Section title="Workspaces">
        <Table head={["Workspace", "Role", "Joined"]} empty="Not a member of any workspace.">
          {user.memberships.map((m) => (
            <tr key={m.id}>
              <Td>
                <Link href={`/admin/workspaces/${m.workspaceId}`} className="text-ink-primary hover:text-accent">{m.workspace.name}</Link>
                {m.workspace.suspendedAt && <span className="ml-2"><Pill tone="danger">suspended</Pill></span>}
              </Td>
              <Td><Pill>{m.role.toLowerCase()}</Pill></Td>
              <Td>{fmtDate(m.joinedAt)}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {clerkUser && (can(ctx.role, "users.impersonate") || can(ctx.role, "users.ban")) && (
        <Section title="Actions">
          <div className="space-y-6">
            {can(ctx.role, "users.impersonate") && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-primary">View as this customer</h3>
                {isActiveStaff || isSelf ? (
                  <p className="text-sm text-ink-muted">Not available for staff accounts.</p>
                ) : (
                  <ImpersonateControl userId={id} />
                )}
              </div>
            )}
            {can(ctx.role, "users.ban") && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-primary">Ban</h3>
                {isActiveStaff || isSelf ? (
                  <p className="text-sm text-ink-muted">Revoke staff access before banning a staff account.</p>
                ) : (
                  <BanControl userId={id} banned={clerkUser.banned} />
                )}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
