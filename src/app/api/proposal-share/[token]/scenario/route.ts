import { prisma } from "@/lib/prisma";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// POST /api/proposal-share/:token/scenario — legacy/backend/index.ts:4196-4241. Public.
type ShareData = { scenarios?: Array<{ name?: string }>; selectedScenario?: string; decision?: string; engagement: Array<{ type: string; at: string; name?: string }> };

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const b = (await req.json().catch(() => ({}))) as { name?: string };
  const s = await prisma.proposalShare.findUnique({ where: { token } });
  if (!s || s.token !== token || s.status === "revoked" || (s.expiresAt && s.expiresAt.getTime() < Date.now())) return error("This proposal link is unavailable.", 404);
  const d = s.data as ShareData;
  if (d.decision) return error("This proposal already has a recorded decision.", 409);

  const name = String(b.name || "").trim().slice(0, 120);
  const scenario = (Array.isArray(d.scenarios) ? d.scenarios : []).find((v) => String(v.name || "") === name);
  if (!scenario) return error("Choose an available package.", 400);

  const at = new Date().toISOString();
  const engagement = [...(Array.isArray(d.engagement) ? d.engagement : []).slice(-49), { type: "scenario_selected", name, at }];
  await prisma.proposalShare.update({ where: { id: s.id }, data: { data: { ...d, selectedScenario: name, engagement } } });

  if (s.projectId) {
    const p = await prisma.project.findUnique({ where: { id: s.projectId } });
    if (p) {
      await prisma.project.update({
        where: { id: s.projectId },
        data: { data: { ...projectData(p.data), clientSelectedScenario: name, clientSelectedScenarioAt: at, nextBestAction: `Client selected ${name}; confirm package details before acceptance.` } as object },
      });
    }
  }
  return json({ selectedScenario: name });
});
