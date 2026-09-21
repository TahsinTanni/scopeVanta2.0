import { renderToBuffer } from "@react-pdf/renderer";
import { error, withErrors } from "@/lib/http";
import { loadReleaseReceipt } from "@/lib/release";
import { ReleaseCertificate } from "@/lib/release-certificate";

export const runtime = "nodejs";

// GET /api/proposal-share/:token/receipt.pdf — public (token-gated) release certificate download.
export const GET = withErrors(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const receipt = await loadReleaseReceipt(token);
  if (!receipt) return error("This proposal link is unavailable.", 404);
  const pdf = await renderToBuffer(<ReleaseCertificate receipt={receipt} />);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="scopevanta-certificate-${receipt.releaseId}.pdf"`,
    },
  });
});
