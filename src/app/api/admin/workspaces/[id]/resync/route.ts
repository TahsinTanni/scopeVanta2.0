import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { syncSquareSubscription } from "@/lib/square-sync";

// POST /api/admin/workspaces/:id/resync — re-reads the subscription from Square.
export const POST = adminRoute<{ id: string }>("billing.manage", async (ctx, _req, { id }) => {
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: id } });
  if (!sub?.squareCustomerId) return error("This workspace has no Square customer yet.", 400);
  let message: string;
  try {
    const result = await syncSquareSubscription(id, sub);
    message = result ? `Square reports ${result.status} on the ${result.plan} plan.` : "Square has no matching subscription for this workspace.";
  } catch (e) {
    console.error("Admin Square resync failed", e);
    return error("Couldn't reach Square. Try again shortly.", 502);
  }
  await logAdminAction(ctx, "workspace.billing.resync", { targetType: "workspace", targetId: id, workspaceId: id, details: { message } });
  return json({ ok: true, message });
});
