import { prisma } from "@/lib/prisma";
import { json, error } from "@/lib/http";

// GET /api/healthcheck — for uptime monitoring (legacy/backend/index.ts:593).
// Public (see src/proxy.ts). Also checks the database, so a monitor catches
// the most common real outage, not just "the server answered".
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ message: "Success" });
  } catch (e) {
    console.error("Healthcheck database probe failed", e);
    return error("Database unavailable", 503);
  }
}
