import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";
import { fmtDateTime } from "@/lib/admin/format";
import { AdminHeader, KeyValue, Pill, Section } from "@/components/admin/AdminUI";
import { SupportTriage } from "@/components/admin/SupportTriage";

export const dynamic = "force-dynamic";

type LoggedMessage = { role: string; text: string; at: string };

export default async function AdminSupportConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("support.view");
  const { id } = await params;
  const c = await prisma.supportConversation.findUnique({
    where: { id },
    include: { workspace: { select: { id: true, name: true } }, user: { select: { id: true, email: true } } },
  });
  if (!c) notFound();
  const messages = (c.messages as LoggedMessage[]) || [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/support" className="text-xs font-mono text-ink-muted hover:text-ink-primary">← Support</Link>
        <AdminHeader title="Support conversation" actions={<Pill tone={c.status === "open" ? "warning" : "success"}>{c.status}</Pill>} />
      </div>

      <Section title="Customer">
        <KeyValue
          items={[
            ["User", c.user ? <Link className="hover:text-accent" href={`/admin/users/${c.user.id}`}>{c.user.email}</Link> : "—"],
            ["Workspace", <Link key="w" className="hover:text-accent" href={`/admin/workspaces/${c.workspace.id}`}>{c.workspace.name}</Link>],
            ["Started", fmtDateTime(c.createdAt)],
            ["Last message", fmtDateTime(c.lastMessageAt)],
          ]}
        />
      </Section>

      <Section title="Transcript">
        <ol className="space-y-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`rounded-[8px] border px-3 py-2 text-sm font-body ${m.role === "user" ? "border-border-hairline bg-surface-2 text-ink-primary" : "border-accent/20 bg-accent/5 text-ink-secondary"}`}
            >
              <p className="mb-1 text-[11px] font-mono uppercase tracking-wider text-ink-muted">
                {m.role === "user" ? "Customer" : "Assistant"} · {fmtDateTime(m.at)}
              </p>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {can(ctx.role, "support.manage") && (
        <Section title="Staff follow-up" description="Notes are internal and never shown to the customer.">
          <SupportTriage id={c.id} status={c.status} notes={c.staffNotes ?? ""} email={c.user?.email ?? null} />
        </Section>
      )}
    </div>
  );
}
