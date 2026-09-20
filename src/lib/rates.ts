import { prisma } from "@/lib/prisma";

export type RateInput = { name?: string; costRate?: number; sellRate?: number; overheadPct?: number };

// Shared by rates POST and PUT so both apply the same validation/clamping.
export function parseRateInput(b: RateInput) {
  return {
    name: String(b.name || "").trim(),
    costRate: Math.max(0, Number(b.costRate || 0)),
    sellRate: Math.max(0, Number(b.sellRate || 0)),
    overheadPct: Math.min(100, Math.max(0, Number(b.overheadPct || 0))),
  };
}

// Case-insensitive duplicate check within one workspace. `excludeId` lets a
// rate keep its own name when edited.
export async function rateNameTaken(workspaceId: string, name: string, excludeId?: string) {
  const dup = await prisma.rate.findFirst({
    where: {
      workspaceId,
      role: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return !!dup;
}
