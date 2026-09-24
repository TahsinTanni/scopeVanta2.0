import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth, clerkClient, reverificationErrorResponse } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { HttpError, withErrors } from "@/lib/http";
import type { StaffRole } from "@/generated/prisma/enums";
import { can, type StaffPermission } from "@/lib/admin/permissions";

export type StaffContext = {
  userId: string;
  email: string;
  role: StaffRole;
  /** True when this session passed a second factor (or the dev escape hatch is on). */
  mfaVerified: boolean;
};

// Local development only: lets you use /admin before setting up two-factor
// auth on a dev Clerk instance. Ignored in production, always.
function mfaWaivedForDev() {
  return process.env.NODE_ENV !== "production" && process.env.ADMIN_ALLOW_NO_MFA === "true";
}

/**
 * Resolves the signed-in user's platform-staff record, or null.
 *
 * Staff status comes only from the platform_staff table (never from a
 * client-supplied value, an email allowlist, or Clerk metadata the user
 * could influence). Sessions created by "view as customer" impersonation
 * never carry staff powers, even if the impersonated user is staff.
 * Cached per request so layouts and pages share one lookup.
 */
export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const { userId, sessionClaims } = await auth();
  if (!userId || sessionClaims?.act) return null;

  const staff = await prisma.platformStaff.findUnique({ where: { userId }, include: { user: true } });
  if (!staff || staff.revokedAt) return null;

  // Clerk's `fva` claim is [minutes since first factor, minutes since second
  // factor], with -1 meaning "never in this session". Fall back to the user's
  // 2FA setting when the claim isn't present in this token version.
  const fva = (sessionClaims as { fva?: [number, number] } | null)?.fva;
  let mfaVerified: boolean;
  if (Array.isArray(fva)) {
    mfaVerified = fva[1] !== -1;
  } else {
    const client = await clerkClient();
    mfaVerified = (await client.users.getUser(userId)).twoFactorEnabled;
  }

  return { userId, email: staff.user.email, role: staff.role, mfaVerified: mfaVerified || mfaWaivedForDev() };
});

/**
 * For admin pages (server components). Non-staff get a plain 404 so the
 * admin area's existence isn't revealed; staff without a verified second
 * factor are sent to set one up; staff lacking the permission get a 404.
 */
export async function requireStaffPage(permission?: StaffPermission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) notFound();
  if (!ctx.mfaVerified) redirect("/admin/security");
  if (permission && !can(ctx.role, permission)) notFound();
  return ctx;
}

/** For /api/admin route handlers. Same rules as requireStaffPage, as HTTP errors. */
export async function requireStaff(permission: StaffPermission): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new HttpError("Not found.", 404);
  if (!ctx.mfaVerified) throw new HttpError("Two-factor authentication is required for staff actions.", 403);
  if (!can(ctx.role, permission)) throw new HttpError("Your staff role can't do this.", 403);
  return ctx;
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Wraps an /api/admin route: enforces the permission, and for sensitive
 * actions (`reverify: true`) requires the staff member to have re-entered
 * their credentials within the last ~10 minutes. The client handles the
 * resulting prompt with Clerk's `useReverification` (see AdminAction.tsx).
 */
export function adminRoute<P = Record<string, never>>(
  permission: StaffPermission,
  handler: (ctx: StaffContext, req: Request, params: P) => Promise<Response>,
  opts: { reverify?: boolean } = {},
) {
  return withErrors(async (req: Request, routeCtx: RouteContext<P>) => {
    const ctx = await requireStaff(permission);
    if (opts.reverify && !mfaWaivedForDev()) {
      const { has } = await auth();
      if (!has({ reverification: "strict" })) return reverificationErrorResponse("strict");
    }
    return handler(ctx, req, await routeCtx.params);
  });
}
