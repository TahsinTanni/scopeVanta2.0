import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { fmtAgo, fmtDate, param } from "@/lib/admin/format";
import { AdminHeader, Pager, Pill, SearchForm, Table, Td } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("users.view");
  const sp = await searchParams;
  const q = param(sp.q);
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const rows = await prisma.user.findMany({
    where: q ? { OR: [{ id: q }, { email: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      memberships: { include: { workspace: { select: { id: true, name: true } } } },
      platformStaff: true,
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const users = rows.slice(0, PAGE_SIZE);

  // Live sign-in / ban state comes from Clerk (the identity source of truth).
  const clerk = users.length
    ? (await (await clerkClient()).users.getUserList({ userId: users.map((u) => u.id), limit: PAGE_SIZE })).data
    : [];
  const clerkById = new Map(clerk.map((c) => [c.id, c]));

  return (
    <div>
      <AdminHeader title="Users" description="Everyone who has signed in. Search by email or user ID." />
      <SearchForm placeholder="Search by email…" defaultValue={q} />
      <div className="rounded-[8px] border border-border-hairline bg-surface-1">
        <Table head={["User", "Workspaces", "Joined", "Last sign-in", "Status"]} empty="No users match.">
          {users.map((u) => {
            const c = clerkById.get(u.id);
            return (
              <tr key={u.id}>
                <Td>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-ink-primary hover:text-accent">{u.email}</Link>
                  <p className="font-mono text-[11px] text-ink-disabled">{u.id}</p>
                </Td>
                <Td>
                  {u.memberships.length ? (
                    u.memberships.map((m) => (
                      <Link key={m.id} href={`/admin/workspaces/${m.workspaceId}`} className="block hover:text-accent">
                        {m.workspace.name} <span className="text-ink-disabled">· {m.role.toLowerCase()}</span>
                      </Link>
                    ))
                  ) : (
                    <span className="text-ink-disabled">none</span>
                  )}
                </Td>
                <Td>{fmtDate(u.createdAt)}</Td>
                <Td>{c ? fmtAgo(c.lastSignInAt ? new Date(c.lastSignInAt) : null) : "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {c?.banned && <Pill tone="danger">banned</Pill>}
                    {c?.locked && <Pill tone="warning">locked</Pill>}
                    {u.platformStaff && !u.platformStaff.revokedAt && <Pill tone="info">staff</Pill>}
                    {!c && <Pill>not in Clerk</Pill>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </div>
      <Pager page={page} hasMore={hasMore} basePath="/admin/users" query={{ q }} />
    </div>
  );
}
