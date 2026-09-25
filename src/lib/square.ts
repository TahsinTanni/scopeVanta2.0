import { prisma } from "@/lib/prisma";

// Translated from legacy/backend/index.ts's Square integration, with the
// customer/subscription-ownership model rebuilt per-workspace per
// CLAUDE.md ("Billing (Square)") instead of legacy's per-user-email model.
// See Step 5 report for the full rationale on what changed and why.

export const SQUARE_VERSION = "2026-08-19";
// SQUARE_ENVIRONMENT="sandbox" points every Square call at the sandbox host;
// anything else, or unset, means production.
export const SQUARE_ENVIRONMENT: "sandbox" | "production" =
  process.env.SQUARE_ENVIRONMENT?.trim().toLowerCase() === "sandbox" ? "sandbox" : "production";
export const SQUARE_API_BASE =
  SQUARE_ENVIRONMENT === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

// Prices and limits live in lib/plans.ts so marketing copy and checkout share them.
export { PLAN_PRICES_CENTS, PLAN_LIMITS } from "@/lib/plans";
import { PLAN_PRICES_CENTS, PLAN_CURRENCY, TRIAL_DAYS } from "@/lib/plans";

/**
 * A non-2xx Square API response. `status` lets callers tell 404 from an
 * outage; `codes` are Square's error codes (e.g. CARD_DECLINED) for callers
 * that need to explain a refusal.
 */
export class SquareApiError extends Error {
  constructor(
    public status: number,
    public codes: string[] = [],
  ) {
    super(`Square request failed: ${status}${codes.length ? ` (${codes.join(", ")})` : ""}`);
  }
}

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
  if (!response.ok) {
    const errors = (data.errors as Array<{ code?: string }> | undefined) || [];
    throw new SquareApiError(response.status, errors.map((e) => String(e.code || "")).filter(Boolean));
  }
  return data;
}

type PlanKey = "Freelancer" | "Pro" | "Agency";
const PLAN_KEYS: PlanKey[] = ["Freelancer", "Pro", "Agency"];
export type BillingConfig = { locationId: string; planId: string; variations: Record<string, string> };

/**
 * Catalog key of a plan's variation. `Pro` starts with the TRIAL_DAYS free
 * phase; `Pro:returning` has no trial and is used for workspaces that have
 * subscribed before, so cancelling and resubscribing can't repeat the trial.
 */
export const variationKey = (plan: PlanKey, returning: boolean) => (returning ? `${plan}:returning` : plan);

/** Plan name for a Square plan_variation_id, whichever variation (trial or returning) it is. */
export function planForVariation(cfg: BillingConfig, variationId: unknown): PlanKey | undefined {
  const key = Object.entries(cfg.variations).find(([, id]) => id === String(variationId || ""))?.[0];
  return key ? (key.split(":")[0] as PlanKey) : undefined;
}

async function createPlanVariation(planId: string, plan: PlanKey, returning: boolean): Promise<string> {
  const slug = `${plan.toLowerCase()}${returning ? "-returning" : ""}`;
  const paid = { cadence: "MONTHLY", pricing: { type: "STATIC", price: { amount: PLAN_PRICES_CENTS[plan], currency: PLAN_CURRENCY } } };
  const phases = returning
    ? [{ ...paid, ordinal: 0 }]
    : [
        { cadence: "DAILY", ordinal: 0, periods: TRIAL_DAYS, pricing: { type: "STATIC", price: { amount: 0, currency: PLAN_CURRENCY } } },
        { ...paid, ordinal: 1 },
      ];
  const v = await square("/v2/catalog/object", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: `scopevanta-${slug}-${crypto.randomUUID()}`,
      object: {
        type: "SUBSCRIPTION_PLAN_VARIATION",
        id: `#scopevanta-${slug}`,
        present_at_all_locations: true,
        subscription_plan_variation_data: { name: `ScopeVanta ${plan}${returning ? " (returning)" : ""}`, subscription_plan_id: planId, phases },
      },
    }),
  });
  const id = String((v.catalog_object as { id?: string })?.id || "");
  if (!id) throw new Error(`Square ${slug} variation creation failed`);
  return id;
}

/**
 * The Square catalog objects billing uses, created on first use and stored in
 * square_billing_config. Variations added later (e.g. the returning-customer
 * ones) are created and saved the first time they're missing.
 */
export async function billingConfig(): Promise<BillingConfig> {
  let cfg = (await prisma.squareBillingConfig.findFirst()) as unknown as (BillingConfig & { id: string }) | null;

  if (!cfg) {
    const locations = await square("/v2/locations");
    const location = ((locations.locations as Array<{ id: string; status: string }> | undefined) || []).find(
      (x) => x.status === "ACTIVE",
    );
    if (!location) throw new Error("No active Square location");

    const plan = await square("/v2/catalog/object", {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `scopevanta-plan-${crypto.randomUUID()}`,
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
    for (const name of PLAN_KEYS) variations[name] = await createPlanVariation(planId, name, false);
    cfg = (await prisma.squareBillingConfig.create({
      data: { locationId: location.id, planId, variations },
    })) as unknown as BillingConfig & { id: string };
  }

  const missing = PLAN_KEYS.filter((name) => !cfg!.variations[variationKey(name, true)]);
  if (missing.length) {
    const variations = { ...cfg.variations };
    for (const name of missing) variations[variationKey(name, true)] = await createPlanVariation(cfg.planId, name, true);
    cfg = (await prisma.squareBillingConfig.update({ where: { id: cfg.id }, data: { variations } })) as unknown as BillingConfig & {
      id: string;
    };
  }

  return { locationId: cfg.locationId, planId: cfg.planId, variations: cfg.variations };
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

export type SquareSubscription = {
  id: string;
  status: string;
  start_date?: string;
  charged_through_date?: string;
  canceled_date?: string;
  card_id?: string;
  customer_id?: string;
};

/** Saves a Web Payments SDK card token as a card on file for `customerId`; returns the card ID. */
export async function saveCardOnFile(customerId: string, cardToken: string): Promise<string> {
  const card = await square("/v2/cards", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      source_id: cardToken,
      card: { customer_id: customerId },
    }),
  });
  const cardId = String((card.card as { id?: string })?.id || "");
  if (!cardId) throw new Error("Square card creation failed");
  return cardId;
}

/** Points the subscription's future charges at `cardId`. */
export async function setSubscriptionCard(subscriptionId: string, cardId: string): Promise<void> {
  await square(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "PUT",
    body: JSON.stringify({ subscription: { card_id: cardId } }),
  });
}

/**
 * Schedules cancellation. Square ends the subscription at the end of the
 * current billing cycle (canceled_date), so access continues until then.
 */
export async function cancelSubscription(subscriptionId: string): Promise<SquareSubscription> {
  const result = await square(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: "POST" });
  return result.subscription as SquareSubscription;
}

export type LiveSubscriptionDetails = {
  cancelsOn: string;
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  overdueInvoiceUrl: string;
};

/**
 * Live details for the owner's billing page, read from Square each time (none
 * of it is stored locally): scheduled cancellation, the card on file, and —
 * after a failed charge — the hosted page for paying the unpaid invoice.
 * Square's APIs can't pay an invoice, so that link is how a customer settles it.
 */
export async function liveSubscriptionDetails(
  subscriptionId: string,
  opts: { withOverdueInvoice: boolean },
): Promise<LiveSubscriptionDetails> {
  const found = await square(`/v2/subscriptions/${encodeURIComponent(subscriptionId)}`);
  const subscription = found.subscription as SquareSubscription;
  let card: LiveSubscriptionDetails["card"] = null;
  if (subscription.card_id) {
    const c = (await square(`/v2/cards/${encodeURIComponent(subscription.card_id)}`)).card as
      | { card_brand?: string; last_4?: string; exp_month?: number; exp_year?: number }
      | undefined;
    if (c) card = { brand: c.card_brand || "Card", last4: c.last_4 || "", expMonth: c.exp_month || 0, expYear: c.exp_year || 0 };
  }
  let overdueInvoiceUrl = "";
  if (opts.withOverdueInvoice && subscription.customer_id) {
    const cfg = await billingConfig();
    const search = await square("/v2/invoices/search", {
      method: "POST",
      body: JSON.stringify({
        limit: 20,
        query: {
          filter: { location_ids: [cfg.locationId], customer_ids: [subscription.customer_id] },
          sort: { field: "INVOICE_SORT_DATE", order: "DESC" },
        },
      }),
    });
    const invoices = (search.invoices as Array<{ subscription_id?: string; status?: string; public_url?: string }> | undefined) || [];
    const unpaid = invoices.find(
      (inv) => inv.subscription_id === subscriptionId && ["UNPAID", "PARTIALLY_PAID"].includes(String(inv.status)),
    );
    overdueInvoiceUrl = unpaid?.public_url || "";
  }
  return { cancelsOn: subscription.canceled_date || "", card, overdueInvoiceUrl };
}

/**
 * Subscribes the workspace's own Square customer (never a customer Square
 * matched by phone/email, which is what hosted payment links do) to `plan`:
 * saves the card from a Web Payments SDK token on that customer, then creates
 * the subscription charging it. A first-time subscriber's variation starts
 * with the TRIAL_DAYS $0 trial; a `returning` one is charged from day one.
 */
export async function subscribeWorkspace(
  workspaceId: string,
  buyerEmail: string,
  plan: PlanKey,
  cardToken: string,
  returning: boolean,
): Promise<SquareSubscription> {
  const cfg = await billingConfig();
  const variationId = cfg.variations[variationKey(plan, returning)];
  if (!variationId) throw new Error("Unknown plan");
  const customerId = await ensureSquareCustomer(workspaceId, buyerEmail);
  const cardId = await saveCardOnFile(customerId, cardToken);

  const created = await square("/v2/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      location_id: cfg.locationId,
      plan_variation_id: variationId,
      customer_id: customerId,
      card_id: cardId,
    }),
  });
  const subscription = created.subscription as SquareSubscription | undefined;
  if (!subscription?.id) throw new Error("Square subscription creation failed");
  return subscription;
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
      const planName = planForVariation(cfg, subscription.plan_variation_id);
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
  const planName = planForVariation(cfg, matched.plan_variation_id);
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
