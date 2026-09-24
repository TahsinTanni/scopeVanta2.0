import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

// POST /api/admin/workspaces/:id/suspend — { suspended: boolean, reason? }
export const POST = adminRoute<{ id: string }>(
  "workspaces.suspend",
  async (ctx, req, { id }) => {
    const b = (await req.json().catch(() => ({}))) as { suspended?: boolean; reason?: string };
    const reason = (b.reason || "").trim().slice(0, 500);
    if (typeof b.suspended !== "boolean") return error("suspended must be true or false.");
    if (b.suspended && reason.length < 3) return error("A reason is required to suspend a workspace.");

    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) return error("Workspace not found.", 404);

    await prisma.workspace.update({
      where: { id },
      data: b.suspended ? { suspendedAt: new Date(), suspendedReason: reason } : { suspendedAt: null, suspendedReason: null },
    });
    await logAdminAction(ctx, b.suspended ? "workspace.suspend" : "workspace.unsuspend", {
      targetType: "workspace",
      targetId: id,
      workspaceId: id,
      details: b.suspended ? { reason } : { previousReason: ws.suspendedReason },
    });
    return json({ ok: true });
  },
  { reverify: true },
);
