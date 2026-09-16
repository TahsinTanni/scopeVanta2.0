import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

// GET /api/clients — legacy/backend/index.ts:1656-1702.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ where: { workspaceId: ctx.workspaceId }, take: 100 }),
    prisma.project.findMany({ where: { workspaceId: ctx.workspaceId }, take: 160, select: { id: true, clientId: true, riskScore: true, createdAt: true } }),
  ]);
  const enriched = clients
    .map((client) => {
      const linked = projects.filter((p) => p.clientId === client.id);
      const scores = linked.map((p) => Number(p.riskScore || 0)).filter(Number.isFinite);
      return {
        ...client,
        proposalCount: linked.length,
        averageRisk: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
        lastOpportunityAt: linked.map((p) => p.createdAt.toISOString()).sort().reverse()[0] || "",
      };
    })
    .sort((a, b) => (b.updatedAt || b.createdAt).toString().localeCompare((a.updatedAt || a.createdAt).toString()));
  return json({ clients: enriched });
});

type ClientBody = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  status?: string;
  notes?: string;
  goals?: string;
  preferences?: string;
  decisionMakers?: string;
  painPoints?: string;
  buyingCriteria?: string;
  knownObjections?: string;
  nextStep?: string;
  followUpDate?: string;
};

const STATUSES = ["Prospect", "Active", "Won", "Dormant", "Lost"];

// POST /api/clients — legacy/backend/index.ts:1703-1766.
export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const b = (await req.json().catch(() => ({}))) as ClientBody;
  if (!b.name?.trim()) return error("Client name is required.", 400);
  const email = String(b.email || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter a valid client email.", 400);

  const client = await prisma.client.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdByUserId: ctx.userId,
      name: b.name.trim().slice(0, 120),
      company: String(b.company || "").trim().slice(0, 160),
      email: email.slice(0, 200),
      phone: String(b.phone || "").trim().slice(0, 80),
      website: String(b.website || "").trim().slice(0, 500),
      industry: String(b.industry || "").trim().slice(0, 120),
      lifecycleStatus: STATUSES.includes(String(b.status)) ? String(b.status) : "Prospect",
      notes: String(b.notes || "").trim().slice(0, 5000),
      goals: String(b.goals || "").trim().slice(0, 4000),
      preferences: String(b.preferences || "").trim().slice(0, 4000),
      decisionMakers: String(b.decisionMakers || "").trim().slice(0, 3000),
      painPoints: String(b.painPoints || "").trim().slice(0, 3000),
      buyingCriteria: String(b.buyingCriteria || "").trim().slice(0, 3000),
      knownObjections: String(b.knownObjections || "").trim().slice(0, 3000),
      nextStep: String(b.nextStep || "").trim().slice(0, 2000),
      followUpDate: b.followUpDate ? new Date(String(b.followUpDate).slice(0, 10)) : null,
    },
  });
  return json({ client });
});
