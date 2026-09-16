import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// GET/PUT /api/user/settings — net new, per CLAUDE.md's "Profile split"
// (per-membership settings; has no legacy equivalent since legacy had no
// multi-member workspaces).
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const settings = await prisma.userSettings.findUnique({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: ctx.userId } },
  });
  return json({ settings });
});

type SettingsBody = {
  displayName?: string;
  notificationPreferences?: Record<string, unknown>;
  uiPreferences?: Record<string, unknown>;
};

export const PUT = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as SettingsBody;
  const settings = await prisma.userSettings.upsert({
    where: { workspaceId_userId: { workspaceId: ctx.workspaceId, userId: ctx.userId } },
    create: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      displayName: b.displayName ? String(b.displayName).slice(0, 120) : null,
      notificationPreferences: (b.notificationPreferences as object) ?? undefined,
      uiPreferences: (b.uiPreferences as object) ?? undefined,
    },
    update: {
      displayName: b.displayName ? String(b.displayName).slice(0, 120) : null,
      notificationPreferences: (b.notificationPreferences as object) ?? undefined,
      uiPreferences: (b.uiPreferences as object) ?? undefined,
    },
  });
  return json({ settings });
});
