import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billing } from "@/lib/billing";
import { hasDevEntitlementBypass } from "@/lib/square";

// GET/PUT /api/profile — legacy/backend/index.ts:862-923, split into the
// workspace-level company profile per CLAUDE.md's "Profile split" (the
// billing lifecycle fields that used to live on Profile now live on
// BillingSubscription — see lib/billing.ts). PUT is Owner/Admin-only per
// CLAUDE.md; legacy had no role model so this is a genuine behavior change,
// not a translation artifact.

export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  return json({ profile, billing: billing(sub, hasDevEntitlementBypass()) });
});

type ProfileBody = {
  contactName?: string;
  contactEmail?: string;
  address?: string;
  businessName?: string;
  expertise?: string;
  website?: string;
  onboarded?: boolean;
};

export const PUT = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER", "ADMIN"]);
  const b = (await req.json().catch(() => ({}))) as ProfileBody;

  if (!b.contactName || !b.contactEmail || !b.address || !b.businessName || !b.expertise) {
    return error("Required profile fields are missing.", 400);
  }
  const email = String(b.contactEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter a valid email address.", 400);
  if (String(b.contactName).trim().length < 2) return error("Enter your full name.", 400);

  const profile = await prisma.companyProfile.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: {
      workspaceId: ctx.workspaceId,
      contactName: String(b.contactName).slice(0, 120),
      contactEmail: email,
      address: String(b.address).slice(0, 300),
      businessName: String(b.businessName).slice(0, 160),
      expertise: String(b.expertise).slice(0, 4000),
      website: String(b.website || "").slice(0, 500),
      onboarded: Boolean(b.onboarded),
    },
    update: {
      contactName: String(b.contactName).slice(0, 120),
      contactEmail: email,
      address: String(b.address).slice(0, 300),
      businessName: String(b.businessName).slice(0, 160),
      expertise: String(b.expertise).slice(0, 4000),
      website: String(b.website || "").slice(0, 500),
      onboarded: Boolean(b.onboarded),
    },
  });

  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  return json({ profile, billing: billing(sub, hasDevEntitlementBypass()) });
});
