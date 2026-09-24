import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";

// Feature switches platform staff can flip from /admin/controls, globally or
// for a single workspace. A workspace row overrides the global row; with no
// rows at all a feature is ON. Adding a key here is all it takes to show it
// in the admin panel — enforcement is wherever assertFeatureEnabled() is
// called for that key.
export const FEATURE_FLAGS = {
  ai: {
    label: "AI features",
    description: "Every AI call: proposal generation, deal tools, file reading and the support assistant.",
    disabledMessage: "AI features are temporarily unavailable. Please try again later.",
  },
  uploads: {
    label: "Knowledge uploads",
    description: "Uploading new files to the knowledge base.",
    disabledMessage: "File uploads are temporarily unavailable. Please try again later.",
  },
  sharing: {
    label: "New client share links",
    description: "Creating new proposal and discovery share links. Links already sent keep working.",
    disabledMessage: "Creating share links is temporarily unavailable. Please try again later.",
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const GLOBAL_SCOPE = "global";

export async function isFeatureEnabled(key: FeatureFlagKey, workspaceId?: string | null): Promise<boolean> {
  const rows = await prisma.featureFlag.findMany({
    where: { key, scope: { in: workspaceId ? [GLOBAL_SCOPE, workspaceId] : [GLOBAL_SCOPE] } },
  });
  const override = workspaceId ? rows.find((r) => r.scope === workspaceId) : undefined;
  if (override) return override.enabled;
  return rows.find((r) => r.scope === GLOBAL_SCOPE)?.enabled ?? true;
}

/** Throws a 503 with a customer-facing message when the feature is switched off. */
export async function assertFeatureEnabled(key: FeatureFlagKey, workspaceId?: string | null) {
  if (!(await isFeatureEnabled(key, workspaceId))) throw new HttpError(FEATURE_FLAGS[key].disabledMessage, 503);
}
