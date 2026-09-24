import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaffPage } from "@/lib/admin/auth";
import { fmtAgo, param } from "@/lib/admin/format";
import { AdminHeader, Pager, Pill, Table, Td } from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

type LoggedMessage = { role: string; text: string; at: string };

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("support.view");
  const sp = await searchParams;
  const status = param(sp.status) || "open";
  const workspace = param(sp.workspace);
  const page = Math.max(1, Number(param(sp.page)) || 1);

  const where: Prisma.SupportConversationWhereInput = {
    ...(status === "all" ? {} : { status }),
    ...(workspace ? { workspaceId: workspace } : {}),
  };
  const rows = await prisma.supportConversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: { workspace: { select: { name: true } }, user: { select: { email: true } } },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const convos = rows.slice(0, PAGE_SIZE);

  return (
    <div>
      <AdminHeader
        title="Support"
        description="Conversations customers had with the in-app assistant. Review them, add notes, and follow up by email where a person is needed."
      />
      <nav className="mb-4 flex gap-1.5" aria-label="Filter conversations">
        {["open", "resolved", "all"].map((s) => (
          <Link
            key={s}
            href={`/admin/support?${new URLSearchParams({ status: s, ...(workspace ? { workspace } : {}) })}`}
            className={`rounded-full border px-3 py-1 text-xs font-mono capitalize ${status === s ? "border-accent bg-accent/10 text-accent-hover" : "border-border-hairline text-ink-muted hover:text-ink-primary"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      <div className="rounded-[8px] border border-border-hairline bg-surface-1">
        <Table head={["Last question", "Customer", "Workspace", "Messages", "Last activity", "Status"]} empty="No conversations here.">
          {convos.map((c) => {
            const messages = (c.messages as LoggedMessage[]) || [];
            const lastUser = [...messages].reverse().find((m) => m.role === "user");
            return (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/support/${c.id}`} className="line-clamp-2 text-ink-primary hover:text-accent">
                    {lastUser?.text || "(no message)"}
                  </Link>
                </Td>
                <Td>{c.user?.email ?? "—"}</Td>
                <Td>
                  <Link href={`/admin/workspaces/${c.workspaceId}`} className="hover:text-accent">{c.workspace.name}</Link>
                </Td>
                <Td className="font-mono tabular-nums">{messages.length}</Td>
                <Td>{fmtAgo(c.lastMessageAt)}</Td>
                <Td><Pill tone={c.status === "open" ? "warning" : "success"}>{c.status}</Pill></Td>
              </tr>
            );
          })}
        </Table>
      </div>
      <Pager page={page} hasMore={hasMore} basePath="/admin/support" query={{ status, ...(workspace ? { workspace } : {}) }} />
    </div>
  );
}
