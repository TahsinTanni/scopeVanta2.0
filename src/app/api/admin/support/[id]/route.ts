import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

// POST /api/admin/support/:id — { status?: "open" | "resolved", staffNotes? }
export const POST = adminRoute<{ id: string }>("support.manage", async (ctx, req, { id }) => {
  const b = (await req.json().catch(() => ({}))) as { status?: string; staffNotes?: string };
  const c = await prisma.supportConversation.findUnique({ where: { id } });
  if (!c) return error("Conversation not found.", 404);

  const data: { status?: string; resolvedAt?: Date | null; staffNotes?: string } = {};
  if (b.status !== undefined) {
    if (b.status !== "open" && b.status !== "resolved") return error("Status must be open or resolved.");
    data.status = b.status;
    data.resolvedAt = b.status === "resolved" ? new Date() : null;
  }
  if (b.staffNotes !== undefined) data.staffNotes = String(b.staffNotes).slice(0, 10_000);
  if (!Object.keys(data).length) return error("Nothing to change.");

  await prisma.supportConversation.update({ where: { id }, data });
  await logAdminAction(ctx, "support.update", {
    targetType: "support_conversation",
    targetId: id,
    workspaceId: c.workspaceId,
    details: { status: data.status, notesChanged: data.staffNotes !== undefined },
  });
  return json({ ok: true });
});
