import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { STAFF_ROLE_LABELS } from "@/lib/admin/permissions";
import type { StaffRole } from "@/generated/prisma/enums";

// There must always be at least one active super admin, or nobody could
// manage staff again without running the setup script.
async function wouldRemoveLastSuperAdmin(userId: string) {
  const target = await prisma.platformStaff.findUnique({ where: { userId } });
  if (!target || target.revokedAt || target.role !== "SUPER_ADMIN") return false;
  const others = await prisma.platformStaff.count({ where: { role: "SUPER_ADMIN", revokedAt: null, userId: { not: userId } } });
  return others === 0;
}

// PATCH /api/admin/staff/:userId — { role }
export const PATCH = adminRoute<{ userId: string }>(
  "staff.manage",
  async (ctx, req, { userId }) => {
    const b = (await req.json().catch(() => ({}))) as { role?: string };
    if (!b.role || !(b.role in STAFF_ROLE_LABELS)) return error("Choose a role.");
    if (userId === ctx.userId) return error("You can't change your own access.", 400);
    const staff = await prisma.platformStaff.findUnique({ where: { userId }, include: { user: true } });
    if (!staff || staff.revokedAt) return error("Not an active staff member.", 404);
    if (b.role !== "SUPER_ADMIN" && (await wouldRemoveLastSuperAdmin(userId))) return error("There must be at least one super admin.", 409);

    await prisma.platformStaff.update({ where: { userId }, data: { role: b.role as StaffRole } });
    await logAdminAction(ctx, "staff.role", { targetType: "user", targetId: userId, details: { email: staff.user.email, from: staff.role, to: b.role } });
    return json({ ok: true });
  },
  { reverify: true },
);

// DELETE /api/admin/staff/:userId — revokes access (row kept for history).
export const DELETE = adminRoute<{ userId: string }>(
  "staff.manage",
  async (ctx, _req, { userId }) => {
    if (userId === ctx.userId) return error("You can't remove your own access.", 400);
    const staff = await prisma.platformStaff.findUnique({ where: { userId }, include: { user: true } });
    if (!staff || staff.revokedAt) return error("Not an active staff member.", 404);
    if (await wouldRemoveLastSuperAdmin(userId)) return error("There must be at least one super admin.", 409);

    await prisma.platformStaff.update({ where: { userId }, data: { revokedAt: new Date() } });
    await logAdminAction(ctx, "staff.revoke", { targetType: "user", targetId: userId, details: { email: staff.user.email, role: staff.role } });
    return json({ ok: true });
  },
  { reverify: true },
);
