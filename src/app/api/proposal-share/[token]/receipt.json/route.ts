import { error, withErrors } from "@/lib/http";
import { loadReleaseReceipt } from "@/lib/release";

// GET /api/proposal-share/:token/receipt.json — public (token-gated) release receipt download.
export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const receipt = await loadReleaseReceipt(token);
  if (!receipt) return error("This proposal link is unavailable.", 404);
  return new Response(JSON.stringify(receipt, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="scopevanta-receipt-${receipt.releaseId}.json"`,
    },
  });
});
