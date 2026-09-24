import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { StaffContext } from "@/lib/admin/auth";

/**
 * Records one staff action in the append-only admin_audit_log. Called by
 * every mutating /api/admin route (and by sensitive reads such as data
 * export and "view as customer"), after the action succeeds.
 */
export async function logAdminAction(
  ctx: StaffContext,
  action: string,
  target: { targetType?: string; targetId?: string; workspaceId?: string | null; details?: Prisma.InputJsonValue } = {},
) {
  const h = await headers();
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: ctx.userId,
      actorEmail: ctx.email,
      action,
      targetType: target.targetType,
      targetId: target.targetId,
      workspaceId: target.workspaceId ?? undefined,
      details: target.details,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent")?.slice(0, 500) || null,
    },
  });
}
