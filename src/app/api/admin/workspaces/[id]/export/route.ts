import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

// GET /api/admin/workspaces/:id/export — every record stored for a workspace,
// for customer data-access requests. Uploaded files are listed with their
// metadata and extracted text; the original binaries stay in blob storage.
export const GET = adminRoute<{ id: string }>(
  "workspaces.export",
  async (ctx, _req, { id }) => {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, email: true, createdAt: true } } } },
        invites: true,
        companyProfile: true,
        userSettings: true,
        clients: true,
        projects: true,
        proposalVersions: true,
        knowledgeFiles: true,
        knowledgeRecords: true,
        rates: true,
        scopeBaselines: true,
        changeOrders: true,
        proposalShares: true,
        discoveryShares: true,
        commercialAudits: true,
        supportConversations: true,
        billingSubscription: true,
        billingEvents: true,
        analyticsEvents: true,
      },
    });
    if (!workspace) return error("Workspace not found.", 404);

    await logAdminAction(ctx, "workspace.export", { targetType: "workspace", targetId: id, workspaceId: id });
    return json({ exportedAt: new Date().toISOString(), exportedBy: ctx.email, workspace });
  },
  { reverify: true },
);
