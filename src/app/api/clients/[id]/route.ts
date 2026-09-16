import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";

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

// PUT /api/clients/:id — legacy/backend/index.ts:1767-1819.
export const PUT = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as ClientBody;
  if (!id) return error("Client is required.", 400);

  const current = await prisma.client.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!current) return error("Client not found.", 404);

  const name = String(b.name ?? current.name ?? "").trim();
  if (!name) return error("Client name is required.", 400);
  const email = String(b.email ?? current.email ?? "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Enter a valid client email.", 400);
  const value = (key: keyof ClientBody, currentValue: string | null, max: number) =>
    String(b[key] ?? currentValue ?? "").trim().slice(0, max);

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: name.slice(0, 120),
      company: value("company", current.company, 160),
      email: email.slice(0, 200),
      phone: value("phone", current.phone, 80),
      website: value("website", current.website, 500),
      industry: value("industry", current.industry, 120),
      lifecycleStatus: STATUSES.includes(String(b.status ?? current.lifecycleStatus)) ? String(b.status ?? current.lifecycleStatus) : "Prospect",
      notes: value("notes", current.notes, 5000),
      goals: value("goals", current.goals, 4000),
      preferences: value("preferences", current.preferences, 4000),
      decisionMakers: value("decisionMakers", current.decisionMakers, 3000),
      painPoints: value("painPoints", current.painPoints, 3000),
      buyingCriteria: value("buyingCriteria", current.buyingCriteria, 3000),
      knownObjections: value("knownObjections", current.knownObjections, 3000),
      nextStep: value("nextStep", current.nextStep, 2000),
      followUpDate: b.followUpDate ? new Date(String(b.followUpDate).slice(0, 10)) : current.followUpDate,
    },
  });
  return json({ client });
});

// DELETE /api/clients/:id — legacy/backend/index.ts:1820-1846.
export const DELETE = withErrors(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireWorkspaceAuth();
  const { id } = await params;
  if (!id) return error("Client is required.", 400);

  const current = await prisma.client.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!current) return error("Client not found.", 404);

  const linked = await prisma.project.count({ where: { clientId: id } });
  if (linked > 0) {
    return error(`This client has ${linked} linked proposal${linked === 1 ? "" : "s"}. Keep the client record so proposal history remains connected.`, 409);
  }

  await prisma.client.delete({ where: { id } });
  return json({ deleted: true, id });
});
