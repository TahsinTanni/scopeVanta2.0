import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { FEATURE_FLAGS, GLOBAL_SCOPE } from "@/lib/flags";

// POST /api/admin/flags — { key, scope: "global" | workspaceId, enabled: boolean | null, reason? }
// enabled: null removes the row (global → back to default on; workspace → follow global).
export const POST = adminRoute(
  "flags.manage",
  async (ctx, req) => {
    const b = (await req.json().catch(() => ({}))) as { key?: string; scope?: string; enabled?: boolean | null; reason?: string | null };
    if (!b.key || !(b.key in FEATURE_FLAGS)) return error("Unknown switch.");
    const scope = b.scope || GLOBAL_SCOPE;
    if (scope !== GLOBAL_SCOPE && !(await prisma.workspace.findUnique({ where: { id: scope }, select: { id: true } }))) {
      return error("Workspace not found.", 404);
    }
    if (b.enabled !== null && typeof b.enabled !== "boolean") return error("enabled must be true, false or null.");
    const reason = (b.reason || "").trim().slice(0, 300) || null;

    if (b.enabled === null) {
      await prisma.featureFlag.deleteMany({ where: { key: b.key, scope } });
    } else {
      await prisma.featureFlag.upsert({
        where: { key_scope: { key: b.key, scope } },
        create: { key: b.key, scope, enabled: b.enabled, reason, updatedByUserId: ctx.userId },
        update: { enabled: b.enabled, reason, updatedByUserId: ctx.userId },
      });
    }
    await logAdminAction(ctx, "flag.set", {
      targetType: "feature_flag",
      targetId: b.key,
      workspaceId: scope === GLOBAL_SCOPE ? null : scope,
      details: { scope, enabled: b.enabled, reason },
    });
    return json({ ok: true });
  },
  { reverify: true },
);
