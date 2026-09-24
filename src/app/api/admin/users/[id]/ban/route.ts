import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

// POST /api/admin/users/:id/ban — { banned: boolean, reason? }
export const POST = adminRoute<{ id: string }>(
  "users.ban",
  async (ctx, req, { id }) => {
    const b = (await req.json().catch(() => ({}))) as { banned?: boolean; reason?: string };
    const reason = (b.reason || "").trim().slice(0, 500);
    if (typeof b.banned !== "boolean") return error("banned must be true or false.");
    if (b.banned && reason.length < 3) return error("A reason is required to ban a user.");
    if (id === ctx.userId) return error("You can't ban yourself.", 400);
    const staff = await prisma.platformStaff.findUnique({ where: { userId: id } });
    if (b.banned && staff && !staff.revokedAt) return error("Revoke this person's staff access before banning them.", 409);

    const clerk = await clerkClient();
    try {
      if (b.banned) await clerk.users.banUser(id);
      else await clerk.users.unbanUser(id);
    } catch (e) {
      console.error("Clerk ban/unban failed", e);
      return error("Clerk couldn't update this user. They may no longer exist.", 502);
    }
    await logAdminAction(ctx, b.banned ? "user.ban" : "user.unban", { targetType: "user", targetId: id, details: b.banned ? { reason } : undefined });
    return json({ ok: true });
  },
  { reverify: true },
);
