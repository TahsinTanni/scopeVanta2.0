import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { square } from "@/lib/square";
import { storageDelete } from "@/lib/storage";

// POST /api/admin/workspaces/:id/delete — { confirmName }
// Permanent. Only allowed once the workspace is suspended, and only after the
// Square subscription is cancelled, so a deleted customer is never billed.
export const POST = adminRoute<{ id: string }>(
  "workspaces.delete",
  async (ctx, req, { id }) => {
    const b = (await req.json().catch(() => ({}))) as { confirmName?: string };
    const ws = await prisma.workspace.findUnique({
      where: { id },
      include: { billingSubscription: true, knowledgeFiles: { select: { storageKey: true } }, _count: { select: { members: true, projects: true } } },
    });
    if (!ws) return error("Workspace not found.", 404);
    if (!ws.suspendedAt) return error("Suspend the workspace before deleting it.", 409);
    if (b.confirmName !== ws.name) return error("The confirmation name doesn't match.", 400);

    // 1. Stop billing first. If Square can't confirm, stop here.
    const subId = ws.billingSubscription?.squareSubscriptionId;
    if (subId && ws.billingSubscription?.status !== "square_canceled") {
      try {
        await square(`/v2/subscriptions/${encodeURIComponent(subId)}/cancel`, { method: "POST" });
      } catch (e) {
        console.error("Square cancel failed during workspace delete", e);
        return error("Couldn't cancel the Square subscription, so nothing was deleted. Cancel it in Square, then try again.", 502);
      }
    }

    // 2. Uploaded files in blob storage (the DB rows cascade below).
    const failedFiles = (await Promise.all(ws.knowledgeFiles.map((f) => storageDelete(f.storageKey)))).filter((ok) => !ok).length;

    // 3. The Clerk organization (members lose access immediately).
    let clerkDeleted = true;
    try {
      await (await clerkClient()).organizations.deleteOrganization(id);
    } catch (e) {
      clerkDeleted = false;
      console.error("Clerk organization delete failed", e);
    }

    // 4. Database: workspace-scoped rows cascade from the workspace row.
    await prisma.$transaction([
      prisma.featureFlag.deleteMany({ where: { scope: id } }),
      prisma.workspace.delete({ where: { id } }),
    ]);

    await logAdminAction(ctx, "workspace.delete", {
      targetType: "workspace",
      targetId: id,
      workspaceId: id,
      details: {
        name: ws.name,
        members: ws._count.members,
        projects: ws._count.projects,
        squareSubscriptionCancelled: Boolean(subId),
        filesNotDeleted: failedFiles,
        clerkOrganizationDeleted: clerkDeleted,
      },
    });
    return json({ ok: true, filesNotDeleted: failedFiles, clerkOrganizationDeleted: clerkDeleted });
  },
  { reverify: true },
);
