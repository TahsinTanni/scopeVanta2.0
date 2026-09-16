import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import type { WorkspaceRole } from "@/generated/prisma/enums";

export type WorkspaceContext = {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
};

// Clerk's built-in org roles are just org:admin / org:member — there is no
// "owner" concept out of the box. CLAUDE.md's three-role model (Owner /
// Admin / Member) is layered on top: the first membership ever recorded for
// a workspace becomes OWNER (Clerk always makes the org creator org:admin,
// so this is unambiguous), everyone else maps org:admin -> ADMIN and
// org:member -> MEMBER. This mapping isn't specified by CLAUDE.md or the
// legacy source — it's the most reasonable reading of "Clerk Organizations
// as workspace_id" + "three roles", flagged here per the Step 5 report.
function mapClerkRole(clerkOrgRole: string | null | undefined, isFirstMember: boolean): WorkspaceRole {
  if (isFirstMember) return "OWNER";
  if (clerkOrgRole === "org:admin") return "ADMIN";
  return "MEMBER";
}

/**
 * Resolves the authenticated user + their active Clerk organization into a
 * WorkspaceContext, auto-provisioning the local User/Workspace/
 * WorkspaceMember rows on first sight. Equivalent of legacy `requireAuth()`
 * plus the workspace_id-scoping CLAUDE.md requires in place of userId.
 *
 * Lazy auto-provisioning here (rather than eager creation via a Clerk
 * webhook on organization.created / organizationMembership.created) is a
 * Phase-A simplification — see Step 5 report. It works, but a webhook-driven
 * version would avoid the extra Clerk API round-trip on a workspace's first
 * authenticated request.
 */
export async function requireWorkspaceAuth(): Promise<WorkspaceContext> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) throw new HttpError("Sign in required.", 401);
  if (!orgId) throw new HttpError("Select or create a workspace first.", 400);

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";
    user = await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email },
      update: { email },
    });
  }

  let workspace = await prisma.workspace.findUnique({ where: { id: orgId } });
  if (!workspace) {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    workspace = await prisma.workspace.create({ data: { id: orgId, name: org.name } });
  }

  let member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: orgId, userId } },
  });
  if (!member) {
    const isFirstMember = (await prisma.workspaceMember.count({ where: { workspaceId: orgId } })) === 0;
    member = await prisma.workspaceMember.create({
      data: { workspaceId: orgId, userId, role: mapClerkRole(orgRole, isFirstMember) },
    });
  }

  return { userId, email: user.email, workspaceId: orgId, role: member.role };
}

/** Throws 403 unless the context's role is one of `roles`. */
export function requireRole(ctx: WorkspaceContext, roles: WorkspaceRole[]) {
  if (!roles.includes(ctx.role)) throw new HttpError("You don't have permission to do this.", 403);
}
