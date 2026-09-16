import { requireWorkspaceAuth } from "@/lib/auth";
import { json, withErrors } from "@/lib/http";

// GET /api/billing/integration-status — legacy/backend/index.ts:769-836.
// secrets.listSecretNames()/readSecret() replaced with process.env
// (Vercel environment variables — see CLAUDE.md migration notes).
export const GET = withErrors(async () => {
  await requireWorkspaceAuth();
  const webhookConfigured = Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return json({ squareConfigured: false, connected: false, webhookConfigured, mode: "production", verification: "missing_token" });
  }
  try {
    const response = await fetch("https://connect.squareup.com/v2/locations", {
      headers: { Authorization: `Bearer ${token}`, "Square-Version": "2026-08-19", "Content-Type": "application/json" },
    });
    if (!response.ok) {
      return json({ squareConfigured: true, connected: false, webhookConfigured, mode: "production", verification: "token_rejected" });
    }
    const data = (await response.json()) as {
      locations?: Array<{ id: string; name?: string; status?: string; currency?: string; country?: string }>;
    };
    return json({
      squareConfigured: true,
      connected: true,
      webhookConfigured,
      mode: "production",
      verification: "api_verified",
      locations: (data.locations || []).map((l) => ({
        id: l.id,
        name: l.name || "Square location",
        status: l.status || "",
        currency: l.currency || "",
        country: l.country || "",
      })),
    });
  } catch (e) {
    console.warn("Square connectivity check failed", e);
    return json({ squareConfigured: true, connected: false, webhookConfigured, mode: "production", verification: "connection_error" });
  }
});
