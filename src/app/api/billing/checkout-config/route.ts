import { requireWorkspaceAuth, requireRole } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { billingConfig, SQUARE_ENVIRONMENT } from "@/lib/square";

// GET /api/billing/checkout-config — what the browser needs to render Square's
// card form (Web Payments SDK). The application ID and location ID are public
// identifiers, not secrets; the access token never leaves the server.
export const GET = withErrors(async () => {
  const ctx = await requireWorkspaceAuth();
  requireRole(ctx, ["OWNER"]);
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  if (!applicationId) return error("Square card payments are not configured (SQUARE_APPLICATION_ID).", 503);
  try {
    const cfg = await billingConfig();
    return json({ applicationId, locationId: cfg.locationId, environment: SQUARE_ENVIRONMENT });
  } catch (e) {
    console.error("Square checkout config failed", e);
    return error("Square checkout is temporarily unavailable. Please try again.", 502);
  }
});
