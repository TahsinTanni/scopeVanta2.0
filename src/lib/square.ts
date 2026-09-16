import { prisma } from "@/lib/prisma";

// Translated from legacy/backend/index.ts's Square integration, with the
// customer/subscription-ownership model rebuilt per-workspace per
// CLAUDE.md ("Billing (Square)") instead of legacy's per-user-email model.
// See Step 5 report for the full rationale on what changed and why.

const SQUARE_VERSION = "2026-08-19";
const SQUARE_API_BASE = "https://connect.squareup.com";

export const PLAN_PRICES_CENTS: Record<"Freelancer" | "Pro" | "Agency", number> = {
  Freelancer: 1900,
  Pro: 4900,
  Agency: 9900,
};

export const PLAN_LIMITS: Record<"Freelancer" | "Pro" | "Agency", number> = {
  Freelancer: 10,
  Pro: 40,
  Agency: 150,
};

export async function square(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN is not configured.");
  const response = await fetch(`${SQUARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Square request failed: ${response.status}`);
  return data;
}

export async function billingConfig() {
  const existing = await prisma.squareBillingConfig.findFirst();
  if (existing) return existing as unknown as { locationId: string; planId: string; variations: Record<string, string> };

  const locations = await square("/v2/locations");
  const location = ((locations.locations as Array<{ id: string; status: string }> | undefined) || []).find(
    (x) => x.status === "ACTIVE",
  );
  if (!location) throw new Error("No active Square location");

  const key = crypto.randomUUID();
  const plan = await square("/v2/catalog/object", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: `scopevanta-plan-${key}`,
      object: {
        type: "SUBSCRIPTION_PLAN",
        id: "#scopevanta",
        present_at_all_locations: true,
        subscription_plan_data: { name: "ScopeVanta SaaS Plans", all_items: true },
      },
    }),
  });
  const planId = String((plan.catalog_object as { id?: string })?.id || "");
  if (!planId) throw new Error("Square plan creation failed");

  const variations: Record<string, string> = {};
  for (const name of ["Freelancer", "Pro", "Agency"] as const) {
    const v = await square("/v2/catalog/object", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `scopevanta-${name.toLowerCase()}-${key}`,
        object: {
          type: "SUBSCRIPTION_PLAN_VARIATION",
          id: `#scopevanta-${name.toLowerCase()}`,
          present_at_all_locations: true,
          subscription_plan_variation_data: {
            name: `ScopeVanta ${name}`,
            subscription_plan_id: planId,
            phases: [
              { cadence: "MONTHLY", ordinal: 0, periods: 1, pricing: { type: "STATIC", price: { amount: 0, currency: "CAD" } } },
              { cadence: "MONTHLY", ordinal: 1, pricing: { type: "STATIC", price: { amount: PLAN_PRICES_CENTS[name], currency: "CAD" } } },
            ],
          },
        },
      }),
    });
    const id = String((v.catalog_object as { id?: string })?.id || "");
    if (!id) throw new Error(`Square ${name} variation creation failed`);
    variations[name] = id;
  }

  return prisma.squareBillingConfig.create({
    data: { locationId: location.id, planId, variations },
  }) as unknown as { locationId: string; planId: string; variations: Record<string, string> };
}

/**
 * Ensures a Square Customer exists for the workspace, stored via
 * `reference_id` = workspaceId so the webhook handler can resolve ownership
 * from Square's own data instead of an email-keyed lookup table (the
 * legacy `bindBillingEmail` / `bindSubscriptionOwner` KV pattern). Customer
 * lookups thereafter always use the stored `square_customer_id` on
 * BillingSubscription — never a re-search by email — per CLAUDE.md.
 */
export async function ensureSquareCustomer(workspaceId: string, buyerEmail: string): Promise<string> {
  const existing = await prisma.billingSubscription.findUnique({ where: { workspaceId } });
  if (existing?.squareCustomerId) return existing.squareCustomerId;

  const result = await square("/v2/customers", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      given_name: "ScopeVanta workspace",
      reference_id: workspaceId,
      email_address: buyerEmail || undefined,
    }),
  });
  const customerId = String((result.customer as { id?: string })?.id || "");
  if (!customerId) throw new Error("Square customer creation failed");

  await prisma.billingSubscription.upsert({
    where: { workspaceId },
    create: { workspaceId, squareCustomerId: customerId },
    update: { squareCustomerId: customerId },
  });
  return customerId;
}

export async function createCheckout(workspaceId: string, buyerEmail: string, plan: "Freelancer" | "Pro" | "Agency") {
  const cfg = await billingConfig();
  const variationId = cfg.variations[plan];
  if (!variationId) throw new Error("Unknown plan");
  const customerId = await ensureSquareCustomer(workspaceId, buyerEmail);
  const result = await square("/v2/online-checkout/payment-links", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      quick_pay: {
        name: `ScopeVanta ${plan} - 30 day trial`,
        price_money: { amount: 0, currency: "CAD" },
        location_id: cfg.locationId,
      },
      checkout_options: {
        subscription_plan_id: variationId,
        redirect_url: process.env.NEXT_PUBLIC_APP_URL || "",
      },
      pre_populated_data: { buyer_email: buyerEmail },
      payment_note: `ScopeVanta workspace ${workspaceId} · customer ${customerId}`,
    }),
  });
  const url = String((result.payment_link as { url?: string })?.url || "");
  if (!url) throw new Error("Square checkout link creation failed");
  return { url, variationId };
}

/** Verifies entitlement using the workspace's stored Square IDs only — never re-searches by email. */
export async function verifyEntitlement(workspaceId: string) {
  const sub = await prisma.billingSubscription.findUnique({ where: { workspaceId } });
  if (!sub?.squareCustomerId) return null;
  const cfg = await billingConfig();

  if (sub.squareSubscriptionId) {
    const canonical = await square(`/v2/subscriptions/${encodeURIComponent(sub.squareSubscriptionId)}`);
    const subscription = canonical.subscription as
      | { id: string; status: string; plan_variation_id?: string; start_date?: string; charged_through_date?: string }
      | undefined;
    if (subscription) {
      const planName = Object.entries(cfg.variations).find(([, id]) => id === subscription.plan_variation_id)?.[0];
      return { ...subscription, plan: planName || sub.plan };
    }
  }

  const found = await square("/v2/subscriptions/search", {
    method: "POST",
    body: JSON.stringify({
      limit: 50,
      query: { filter: { location_ids: [cfg.locationId], customer_ids: [sub.squareCustomerId] } },
    }),
  });
  const subscriptions =
    (found.subscriptions as
      | Array<{ id: string; status: string; plan_variation_id?: string; start_date?: string; charged_through_date?: string }>
      | undefined) || [];
  const matched = subscriptions
    .filter((s) => Object.values(cfg.variations).includes(String(s.plan_variation_id || "")))
    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))[0];
  if (!matched) return null;
  const planName = Object.entries(cfg.variations).find(([, id]) => id === matched.plan_variation_id)?.[0];
  return { ...matched, plan: planName || sub.plan };
}

/** Resolves which workspace a Square subscription belongs to, via the subscription's customer's reference_id. */
export async function workspaceFromSubscription(subscription: Record<string, unknown>): Promise<string | null> {
  const subscriptionId = String(subscription.id || "");
  if (subscriptionId) {
    const bound = await prisma.billingSubscription.findUnique({ where: { squareSubscriptionId: subscriptionId } });
    if (bound) return bound.workspaceId;
  }
  const customerId = String(subscription.customer_id || "");
  if (!customerId) return null;
  const bound = await prisma.billingSubscription.findUnique({ where: { squareCustomerId: customerId } });
  if (bound) return bound.workspaceId;
  const customerResult = await square(`/v2/customers/${encodeURIComponent(customerId)}`);
  const referenceId = String((customerResult.customer as { reference_id?: string })?.reference_id || "");
  if (!referenceId) return null;
  const workspace = await prisma.workspace.findUnique({ where: { id: referenceId } });
  return workspace?.id || null;
}

export function billingDateAdvanced(previous: Date | null | undefined, next: string | undefined): boolean {
  if (!previous || !next) return false;
  const before = previous.getTime();
  const after = Date.parse(next);
  return Number.isFinite(before) && Number.isFinite(after) && after > before;
}

/**
 * Replaces the legacy hardcoded OWNER_TEST_EMAIL bypass (excluded — not
 * carried into this codebase; see Step 5 report). This is the "explicit
 * non-production/admin entitlement mechanism" the docs' hardening notes
 * call for: gated by environment, never by a specific person's email, and
 * inert entirely in production.
 */
export function hasDevEntitlementBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.SCOPEVANTA_DEV_UNLIMITED_ENTITLEMENT === "true";
}
