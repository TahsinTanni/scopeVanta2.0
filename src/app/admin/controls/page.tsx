import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/format";
import { FEATURE_FLAGS, GLOBAL_SCOPE, type FeatureFlagKey } from "@/lib/flags";
import { AdminHeader, Pill, Section, Table, Td } from "@/components/admin/AdminUI";
import { GlobalFlagToggle } from "@/components/admin/FlagToggle";

export const dynamic = "force-dynamic";

export default async function AdminControlsPage() {
  await requireStaffPage("flags.manage");
  const rows = await prisma.featureFlag.findMany({ orderBy: { updatedAt: "desc" } });
  const overrides = rows.filter((r) => r.scope !== GLOBAL_SCOPE);
  const names = await prisma.workspace.findMany({ where: { id: { in: overrides.map((o) => o.scope) } }, select: { id: true, name: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.name]));

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Controls"
        description="Emergency switches. Turning a feature off takes effect on the next request, for every workspace without its own override."
      />
      <Section title="Global switches">
        <div className="divide-y divide-border-hairline">
          {(Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map((key) => {
            const row = rows.find((r) => r.key === key && r.scope === GLOBAL_SCOPE);
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="max-w-xl">
                  <p className="text-sm font-medium text-ink-primary">{FEATURE_FLAGS[key].label}</p>
                  <p className="text-xs text-ink-muted">{FEATURE_FLAGS[key].description}</p>
                  {row && !row.enabled && row.reason && <p className="mt-1 text-xs text-warning">Off: {row.reason}</p>}
                </div>
                <GlobalFlagToggle flagKey={key} enabled={row ? row.enabled : true} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Workspace overrides" description="Set from a workspace's page. They win over the global switch for that workspace.">
        <Table head={["Workspace", "Switch", "Setting", "Reason", "Changed"]} empty="No workspace overrides.">
          {overrides.map((o) => (
            <tr key={o.id}>
              <Td>
                <Link href={`/admin/workspaces/${o.scope}`} className="text-ink-primary hover:text-accent">{nameOf.get(o.scope) ?? o.scope}</Link>
              </Td>
              <Td>{FEATURE_FLAGS[o.key as FeatureFlagKey]?.label ?? o.key}</Td>
              <Td><Pill tone={o.enabled ? "success" : "danger"}>{o.enabled ? "forced on" : "forced off"}</Pill></Td>
              <Td>{o.reason || "—"}</Td>
              <Td>{fmtDateTime(o.updatedAt)}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  );
}
