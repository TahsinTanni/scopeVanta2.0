import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { STAFF_ROLE_LABELS } from "@/lib/admin/permissions";
import type { StaffRole } from "@/generated/prisma/enums";

// POST /api/admin/staff — { email, role } grants (or restores) staff access.
export const POST = adminRoute(
  "staff.manage",
  async (ctx, req) => {
    const b = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
    const email = (b.email || "").trim();
    if (!email) return error("Email is required.");
    if (!b.role || !(b.role in STAFF_ROLE_LABELS)) return error("Choose a role.");
    const role = b.role as StaffRole;

    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (!user) return error("No ScopeVanta account uses that email. Ask them to sign up and sign in once first.", 404);
    if (user.id === ctx.userId) return error("You can't change your own access.", 400);

    const existing = await prisma.platformStaff.findUnique({ where: { userId: user.id } });
    if (existing && !existing.revokedAt) return error("They're already staff. Change their role in the list instead.", 409);

    await prisma.platformStaff.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role, grantedByUserId: ctx.userId },
      update: { role, revokedAt: null, grantedByUserId: ctx.userId },
    });
    await logAdminAction(ctx, "staff.grant", { targetType: "user", targetId: user.id, details: { email: user.email, role } });
    return json({ ok: true });
  },
  { reverify: true },
);
