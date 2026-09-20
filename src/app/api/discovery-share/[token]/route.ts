import { prisma } from "@/lib/prisma";
import { json, error, withErrors } from "@/lib/http";
import { projectData } from "@/lib/project-data";

// GET/POST /api/discovery-share/:token — legacy/backend/index.ts:3735-3835.
// Public routes (no auth — token-gated), listed in src/proxy.ts's
// isPublicRoute matcher.

type ShareData = { client: string; questions: Array<{ question: string; why?: string; answerType?: string } | string>; answers: string[]; name?: string; email?: string; submittedAt?: string };

export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const s = await prisma.discoveryShare.findUnique({ where: { token } });
  if (!s || s.token !== token || s.status === "revoked" || (s.expiresAt && s.expiresAt.getTime() < Date.now())) return error("This discovery link is unavailable.", 404);
  const d = s.data as ShareData;
  return json({ discovery: { client: d.client, questions: d.questions, status: s.status, submittedAt: d.submittedAt || "" } });
});

export const POST = withErrors(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string; answers?: string[] };
  const s = await prisma.discoveryShare.findUnique({ where: { token } });
  if (!s || s.token !== token || s.status !== "open" || (s.expiresAt && s.expiresAt.getTime() < Date.now())) return error("This discovery link is unavailable.", 404);
  const d = s.data as ShareData;

  const name = String(b.name || "").trim().slice(0, 200);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 320);
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return error("Name and valid email are required.", 400);
  const answers = (Array.isArray(b.answers) ? b.answers : []).slice(0, d.questions.length).map((v) => String(v || "").trim().slice(0, 3000));
  if (!answers.some(Boolean)) return error("Answer at least one discovery question.", 400);

  const submittedAt = new Date().toISOString();
  await prisma.discoveryShare.update({ where: { id: s.id }, data: { status: "submitted", data: { ...d, name, email, answers, submittedAt } } });

  if (s.projectId) {
    const p = await prisma.project.findUnique({ where: { id: s.projectId } });
    if (p) {
      await prisma.commercialAudit.create({
        data: { workspaceId: s.workspaceId, projectId: s.projectId, action: "client_discovery_submitted", payload: { detail: `Client discovery answers received from ${name}.` } },
      });
      await prisma.project.update({
        where: { id: s.projectId },
        data: { data: { ...projectData(p.data), clientDiscovery: { name, email, answers, questions: d.questions, submittedAt }, discoveryShareStatus: "submitted", nextBestAction: "Review client discovery answers and refine the proposal before sharing." } as object },
      });
    }
  }
  return json({ submitted: true });
});
