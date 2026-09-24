import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaffPage } from "@/lib/admin/auth";
import { fmtDate, param, startOfMonth } from "@/lib/admin/format";
import { AdminHeader, Pager, Pill, SearchForm, Table, Td } from "@/components/admin/AdminUI";
import { billingPill } from "@/components/admin/billingPill";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function AdminWorkspacesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("workspaces.view");
  const sp = await searchParams;
  const q = param(sp.q);
  const filter = param(sp.filter);
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const where: Prisma.WorkspaceWhereInput = {
    ...(q
      ? {
          OR: [
            { id: q },
            { name: { contains: q, mode: "insensitive" } },
            { members: { some: { user: { email: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
    ...(filter === "suspended" ? { suspendedAt: { not: null } } : {}),
    ...(filter === "comp" ? { billingSubscription: { compPlan: true } } : {}),
    ...(filter === "failed" ? { billingSubscription: { status: "payment_failed" } } : {}),
  };

  const rows = await prisma.workspace.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      billingSubscription: true,
      _count: { select: { members: true, projects: { where: { createdAt: { gte: startOfMonth() } } } } },
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const workspaces = rows.slice(0, PAGE_SIZE);

  const filters = [
    ["", "All"],
    ["suspended", "Suspended"],
    ["comp", "Free plans"],
    ["failed", "Payment failed"],
  ];

  return (
    <div>
      <AdminHeader title="Workspaces" description="Every customer workspace. Search by name, workspace ID, or a member's email." />
      <SearchForm
        placeholder="Search workspaces…"
        defaultValue={q}
        extra={
          <select
            name="filter"
            defaultValue={filter}
            className="rounded-[4px] border border-border-hairline bg-surface-1 px-2 py-1.5 text-sm text-ink-primary"
            aria-label="Filter"
          >
            {filters.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        }
      />
      <div className="rounded-[8px] border border-border-hairline bg-surface-1">
        <Table head={["Workspace", "Created", "Members", "Plan", "Proposals this month", "Status"]} empty="No workspaces match.">
          {workspaces.map((w) => (
            <tr key={w.id}>
              <Td>
                <Link href={`/admin/workspaces/${w.id}`} className="font-medium text-ink-primary hover:text-accent">{w.name}</Link>
                <p className="font-mono text-[11px] text-ink-disabled">{w.id}</p>
              </Td>
              <Td>{fmtDate(w.createdAt)}</Td>
              <Td className="font-mono tabular-nums">{w._count.members}</Td>
              <Td>{w.billingSubscription?.plan ?? "—"}</Td>
              <Td className="font-mono tabular-nums">{w._count.projects}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {w.suspendedAt && <Pill tone="danger">suspended</Pill>}
                  {billingPill(w.billingSubscription)}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </div>
      <Pager page={page} hasMore={hasMore} basePath="/admin/workspaces" query={{ q, filter }} />
    </div>
  );
}
