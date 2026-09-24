import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { STAFF_ROLE_LABELS } from "@/lib/admin/permissions";
import { fmtDate } from "@/lib/admin/format";
import { AdminHeader, Pill, Section, Table, Td } from "@/components/admin/AdminUI";
import { AddStaffForm, StaffRowActions } from "@/components/admin/StaffControls";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const ctx = await requireStaffPage("staff.manage");
  const staff = await prisma.platformStaff.findMany({ orderBy: [{ revokedAt: "asc" }, { createdAt: "asc" }], include: { user: true } });
  const active = staff.filter((s) => !s.revokedAt);
  const revoked = staff.filter((s) => s.revokedAt);
  const grantors = await prisma.user.findMany({
    where: { id: { in: staff.map((s) => s.grantedByUserId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, email: true },
  });
  const emailOf = new Map(grantors.map((g) => [g.id, g.email]));

  return (
    <div className="space-y-6">
      <AdminHeader title="Staff" description="People on the ScopeVanta team with admin access. Every change here needs your password again and is logged." />

      <Section title="Roles">
        <ul className="grid gap-3 sm:grid-cols-3">
          {Object.entries(STAFF_ROLE_LABELS).map(([role, v]) => (
            <li key={role} className="rounded-[8px] border border-border-hairline p-3">
              <p className="text-sm font-medium text-ink-primary">{v.label}</p>
              <p className="mt-1 text-xs text-ink-muted">{v.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Add staff" description="They must have signed in to ScopeVanta at least once. They'll need two-factor authentication before the admin area opens for them.">
        <AddStaffForm />
      </Section>

      <Section title="Active staff">
        <Table head={["Person", "Role", "Added", "Added by", ""]}>
          {active.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link href={`/admin/users/${s.userId}`} className="text-ink-primary hover:text-accent">{s.user.email}</Link>
                {s.userId === ctx.userId && <span className="ml-2"><Pill>you</Pill></span>}
              </Td>
              <Td>{STAFF_ROLE_LABELS[s.role].label}</Td>
              <Td>{fmtDate(s.createdAt)}</Td>
              <Td>{s.grantedByUserId ? emailOf.get(s.grantedByUserId) ?? "—" : "setup script"}</Td>
              <Td>{s.userId !== ctx.userId && <StaffRowActions userId={s.userId} role={s.role} email={s.user.email} />}</Td>
            </tr>
          ))}
        </Table>
      </Section>

      {revoked.length > 0 && (
        <Section title="Former staff">
          <Table head={["Person", "Last role", "Revoked"]}>
            {revoked.map((s) => (
              <tr key={s.id}>
                <Td>{s.user.email}</Td>
                <Td>{STAFF_ROLE_LABELS[s.role].label}</Td>
                <Td>{fmtDate(s.revokedAt)}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      )}
    </div>
  );
}
