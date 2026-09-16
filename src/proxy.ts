import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
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

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
