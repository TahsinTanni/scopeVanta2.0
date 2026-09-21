import { prisma } from "@/lib/prisma";

type ReleaseShareData = { client?: string; seller?: string; version?: number; dealValue?: number };

export type ReleaseReceipt = {
  releaseId: string;
  releaseHash: string;
  releasedAt: string;
  client: string;
  seller: string;
  proposalVersion: number;
  dealValue: number;
  currency: string;
};

// Loads a share's release receipt for the public receipt routes. Returns null
// when the link is unavailable, using the same missing/revoked/expired test as
// GET /api/proposal-share/[token]; also null for shares created before Buyer
// Release existed (no release record to certify).
export async function loadReleaseReceipt(token: string): Promise<ReleaseReceipt | null> {
  if (!token) return null;
  const s = await prisma.proposalShare.findUnique({ where: { token } });
  if (!s || s.token !== token || s.status === "revoked" || (s.expiresAt && s.status !== "accepted" && s.status !== "changes_requested" && s.expiresAt.getTime() < Date.now())) return null;
  if (!s.releaseId || !s.releaseHash || !s.releasedAt) return null;
  const d = (s.data as ReleaseShareData) || {};
  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: s.workspaceId } }).catch(() => null);
  return {
    releaseId: s.releaseId,
    releaseHash: s.releaseHash,
    releasedAt: s.releasedAt.toISOString(),
    client: String(d.client || ""),
    seller: String(d.seller || ""),
    proposalVersion: Number(d.version || 0),
    dealValue: Number(d.dealValue || 0),
    currency: profile?.currency || "USD",
  };
}
