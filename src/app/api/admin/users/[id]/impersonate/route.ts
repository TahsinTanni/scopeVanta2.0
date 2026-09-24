import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";
import { adminRoute } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";

// POST /api/admin/users/:id/impersonate — { reason }
// Mints a short-lived Clerk actor token. The resulting session carries an
// `act` claim naming the staff member, which src/proxy.ts uses to make the
// session read-only and to keep it out of /admin.
export const POST = adminRoute<{ id: string }>(
  "users.impersonate",
  async (ctx, req, { id }) => {
    const b = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = (b.reason || "").trim().slice(0, 500);
    if (reason.length < 3) return error("A reason is required.");
    if (id === ctx.userId) return error("You can't view as yourself.", 400);
    const staff = await prisma.platformStaff.findUnique({ where: { userId: id } });
    if (staff && !staff.revokedAt) return error("View-as-customer isn't available for staff accounts.", 409);

    let url: string | null | undefined;
    try {
      const token = await (await clerkClient()).actorTokens.create({
        userId: id,
        actor: { sub: ctx.userId, additionalProperties: { email: ctx.email, reason } },
        expiresInSeconds: 600,
        sessionMaxDurationInSeconds: 1800,
      });
      url = token.url;
    } catch (e) {
      console.error("Clerk actor token failed", e);
      return error("Clerk couldn't create the link. Check that impersonation is enabled for your Clerk instance.", 502);
    }
    if (!url) return error("Clerk didn't return a sign-in link.", 502);

    await logAdminAction(ctx, "user.impersonate", { targetType: "user", targetId: id, details: { reason } });
    return json({ url });
  },
  { reverify: true },
);
