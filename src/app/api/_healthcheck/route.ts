import { json } from "@/lib/http";

// GET /api/_healthcheck — legacy/backend/index.ts:593
export async function GET() {
  return json({ message: "Success" });
}
