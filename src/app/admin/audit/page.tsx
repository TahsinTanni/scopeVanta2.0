import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaffPage } from "@/lib/admin/auth";
import { fmtDateTime, param } from "@/lib/admin/format";
import { AdminHeader, Pager, SearchForm, Table, Td } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("audit.view");
  const sp = await searchParams;
  const q = param(sp.q);
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const where: Prisma.AdminAuditLogWhereInput = q
    ? {
        OR: [
          { actorEmail: { contains: q, mode: "insensitive" } },
          { action: { contains: q, mode: "insensitive" } },
          { workspaceId: q },
          { targetId: q },
        ],
      }
    : {};
  const rows = await prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 });
  const hasMore = rows.length > PAGE_SIZE;
  const entries = rows.slice(0, PAGE_SIZE);

  return (
    <div>
      <AdminHeader
        title="Activity log"
        description="Every action taken by ScopeVanta staff. Entries can't be edited or deleted, by anyone — the database refuses it."
      />
      <SearchForm placeholder="Filter by staff email, action, workspace ID or target ID…" defaultValue={q} />
      <div className="rounded-[8px] border border-border-hairline bg-surface-1">
        <Table head={["When", "Staff", "Action", "Target", "Details", "IP"]} empty="No activity recorded.">
          {entries.map((e) => (
            <tr key={e.id}>
              <Td className="whitespace-nowrap">{fmtDateTime(e.createdAt)}</Td>
              <Td>{e.actorEmail}</Td>
              <Td className="font-mono text-xs">{e.action}</Td>
              <Td className="text-xs">
                {e.workspaceId ? (
                  <Link href={`/admin/workspaces/${e.workspaceId}`} className="hover:text-accent">workspace {e.workspaceId.slice(0, 12)}…</Link>
                ) : e.targetType === "user" && e.targetId ? (
                  <Link href={`/admin/users/${e.targetId}`} className="hover:text-accent">user {e.targetId.slice(0, 12)}…</Link>
                ) : (
                  e.targetId ?? "—"
                )}
              </Td>
              <Td className="max-w-sm">
                {e.details ? <code className="block whitespace-pre-wrap break-words font-mono text-[11px] text-ink-muted">{JSON.stringify(e.details)}</code> : "—"}
              </Td>
              <Td className="font-mono text-xs">{e.ip ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      </div>
      <Pager page={page} hasMore={hasMore} basePath="/admin/audit" query={{ q }} />
    </div>
  );
}
