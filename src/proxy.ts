import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  // Social-share card for the landing page; crawlers fetch it unauthenticated.
  "/opengraph-image(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/_healthcheck",
  "/api/square/webhook",
  // Buyer-facing pages, real URLs replacing legacy's #share=/#discovery=
  // hash-fragment routing (see /share/[token] and /discovery/[token]).
  "/share/(.*)",
  "/discovery/(.*)",
  "/api/proposal-share/(.*)",
  "/api/discovery-share/(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // "View as customer" sessions (Clerk actor tokens minted from /admin) are
  // read-only: they can look around the customer's workspace but never change
  // anything through our API, and never reach the admin area. This is
  // enforced here, centrally, so no individual route can forget it.
  const { sessionClaims } = await auth();
  if (sessionClaims?.act) {
    if (isAdminRoute(req)) return new NextResponse(null, { status: 404 });
    // Every write, not just /api — this also covers any future server actions.
    if (!READ_METHODS.has(req.method)) {
      return NextResponse.json({ error: "View-as-customer sessions are read-only." }, { status: 403 });
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
