import {
  router,
  json,
  error,
  ai,
  db,
  storage,
  requireAuth,
  secrets,
} from "@appdeploy/sdk";
type Profile = {
  name: string;
  email: string;
  address: string;
  company: string;
  expertise: string;
  website: string;
  plan: string;
  logoPath?: string;
  onboarded?: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;
  checkoutStartedAt?: string;
  billingStatus?: string;
  squareSubscriptionId?: string;
  billingVerifiedAt?: string;
  chargedThroughDate?: string;
  billingAction?: string;
  lastBillingEvent?: string;
};
type ProposalOptions = {
  mode?: "Concise" | "Detailed" | "Premium";
  sections?: string[];
  includeSellerLogo?: boolean;
  includeClientLogo?: boolean;
  includeVisuals?: boolean;
};
type AnalyzeBody = {
  brief?: string;
  budget?: string;
  timeline?: string;
  client?: string;
  clientId?: string;
  proposalOptions?: ProposalOptions;
};
type RefineBody = {
  projectId?: string;
  answers?: string[];
  proposalOptions?: ProposalOptions;
};
type SaveProposalBody = {
  proposal?: string;
  proposalOptions?: ProposalOptions;
};
type WinPlan = {
  buyerPriorities: string[];
  decisionFriction: string[];
  decisionMakers: string[];
  dealSignals: string[];
  objections: Array<{ objection: string; response: string }>;
  differentiators: string[];
  nextActions: string[];
  followUp: string;
};
type DealStage =
  | "Draft"
  | "Proposal Ready"
  | "Sent"
  | "Follow-up"
  | "Negotiation"
  | "Won"
  | "Lost";
type DealUpdateBody = {
  dealStage?: DealStage;
  dealValue?: number;
  outcomeReason?: string;
};
type ShareDecisionBody = {
  decision?: "accepted" | "changes_requested";
  name?: string;
  email?: string;
  note?: string;
};
function shareTable(token: string) {
  return `proposal-share:${token.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
}
type UploadBody = {
  name?: string;
  type?: string;
  content?: string;
  kind?: "logo" | "reference" | "client_logo";
  clientId?: string;
};
type KnowledgeIntelligence = {
  documentType: string;
  summary: string;
  services: string[];
  differentiators: string[];
  deliverables: string[];
  pricingEvidence: string[];
  timelines: string[];
  processes: string[];
  constraints: string[];
  exclusions: string[];
  proofPoints: string[];
  clientFacts: string[];
};
type KnowledgeFileRecord = {
  path: string;
  name: string;
  type: string;
  createdAt: string;
  status?: "ready" | "stored" | "failed";
  extractedText?: string;
  extractionMethod?: string;
  error?: string;
  intelligence?: KnowledgeIntelligence;
  intelligenceStatus?: "ready" | "failed";
  intelligenceError?: string;
};
type KnowledgeRecord = {
  category: string;
  fact: string;
  sourceFileId: string;
  sourceFileName: string;
  documentType: string;
  createdAt: string;
  active: boolean;
};
type GroundingItem = {
  claim: string;
  kind: "seller_fact" | "client_fact" | "assumption" | "strategy";
  sourceRecordIds: string[];
  sourceFiles: string[];
  confidence: "grounded" | "client_supplied" | "assumption" | "recommendation";
};
type ClientBody = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  status?: string;
  notes?: string;
  goals?: string;
  preferences?: string;
  decisionMakers?: string;
  painPoints?: string;
  buyingCriteria?: string;
  knownObjections?: string;
  nextStep?: string;
  followUpDate?: string;
  logoPath?: string;
  createdAt?: string;
  updatedAt?: string;
};
const limits: Record<string, number> = { Freelancer: 10, Pro: 40, Agency: 150 };
const OWNER_TEST_EMAIL = "mirtaki123@gmail.com";
function hasOwnerTestAccess(email?: string) {
  return (
    String(email || "")
      .trim()
      .toLowerCase() === OWNER_TEST_EMAIL
  );
}
const prices: Record<string, number> = {
  Freelancer: 1900,
  Pro: 4900,
  Agency: 9900,
};
function billingDateAdvanced(
  previous: string | undefined,
  next: string | undefined,
) {
  if (!previous || !next) return false;
  const before = Date.parse(previous);
  const after = Date.parse(next);
  return Number.isFinite(before) && Number.isFinite(after) && after > before;
}
const retrievalStopWords = new Set([
  "about",
  "after",
  "also",
  "been",
  "being",
  "client",
  "could",
  "from",
  "have",
  "into",
  "more",
  "need",
  "project",
  "should",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "with",
  "would",
  "your",
]);
function retrievalTerms(value: string) {
  return Array.from(
    new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || []),
  )
    .filter((v) => !retrievalStopWords.has(v))
    .slice(0, 80);
}
function rankKnowledge(
  records: Array<KnowledgeRecord & { id: string }>,
  query: string,
) {
  const terms = retrievalTerms(query);
  const priority = new Set([
    "Pricing",
    "Constraint",
    "Exclusion",
    "Deliverable",
    "Timeline",
    "Proof point",
  ]);
  const ranked = records
    .map((record, index) => {
      const haystack =
        `${record.category} ${record.fact} ${record.documentType} ${record.sourceFileName}`.toLowerCase();
      const overlap = terms.reduce(
        (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
        0,
      );
      return {
        record,
        score: overlap * 4 + (priority.has(record.category) ? 1 : 0),
        index,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: Array<KnowledgeRecord & { id: string }> = [];
  const perSource = new Map<string, number>();
  for (const item of ranked) {
    const source = item.record.sourceFileId || item.record.sourceFileName;
    const count = perSource.get(source) || 0;
    if (count >= 18) continue;
    selected.push(item.record);
    perSource.set(source, count + 1);
    if (selected.length >= 60) break;
  }
  return selected;
}
const knowledgeCategories: [keyof KnowledgeIntelligence, string][] = [
  ["services", "Service"],
  ["differentiators", "Differentiator"],
  ["deliverables", "Deliverable"],
  ["pricingEvidence", "Pricing"],
  ["timelines", "Timeline"],
  ["processes", "Process"],
  ["constraints", "Constraint"],
  ["exclusions", "Exclusion"],
  ["proofPoints", "Proof point"],
  ["clientFacts", "Client fact"],
];
const knowledgeSchema = {
  type: "object",
  properties: {
    documentType: { type: "string" },
    summary: { type: "string" },
    services: { type: "array", items: { type: "string" } },
    differentiators: { type: "array", items: { type: "string" } },
    deliverables: { type: "array", items: { type: "string" } },
    pricingEvidence: { type: "array", items: { type: "string" } },
    timelines: { type: "array", items: { type: "string" } },
    processes: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    exclusions: { type: "array", items: { type: "string" } },
    proofPoints: { type: "array", items: { type: "string" } },
    clientFacts: { type: "array", items: { type: "string" } },
  },
  required: [
    "documentType",
    "summary",
    "services",
    "differentiators",
    "deliverables",
    "pricingEvidence",
    "timelines",
    "processes",
    "constraints",
    "exclusions",
    "proofPoints",
    "clientFacts",
  ],
};
async function structureKnowledge(text: string, name: string) {
  const r = await ai.extract({
    system:
      "Extract only explicit facts from the supplied business document. Never infer missing capabilities, prices, credentials, outcomes, clients, quantities, dates or guarantees. Keep uncertain or absent categories empty. Preserve important numbers and qualifiers in the fact strings.",
    prompt: `Organize the factual business knowledge from ${name}. Summary must be factual and concise. documentType should describe the document based only on its contents. pricingEvidence includes only explicit prices, budgets, rates, fees or commercial terms. proofPoints includes only explicit credentials, case-study facts, measured results or named evidence. clientFacts includes only facts clearly about a client, prospect or project rather than the seller.`,
    content: text.slice(0, 30000),
    schema: knowledgeSchema,
    maxRetries: 2,
    maxTokens: 4200,
    temperature: 0,
    thinkingMode: "FAST",
  });
  return r.data as KnowledgeIntelligence;
}
const squareVersion = "2026-08-19";
async function square(path: string, init: RequestInit = {}) {
  const token = await secrets.readSecret("SQUARE_ACCESS_TOKEN");
  const response = await fetch(`https://connect.squareup.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": squareVersion,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(`Square request failed: ${response.status}`);
  return data;
}
async function billingConfig() {
  const { items } = await db.list<{
    locationId: string;
    planId: string;
    variations: Record<string, string>;
  }>(`billing-config`, { limit: 1 });
  if (items[0]) return items[0];
  const locations = await square("/v2/locations");
  const location = (
    (locations.locations as
      Array<{ id: string; status: string; currency?: string }> | undefined) ||
    []
  ).find((x) => x.status === "ACTIVE");
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
        subscription_plan_data: {
          name: "ScopeVanta SaaS Plans",
          all_items: true,
        },
      },
    }),
  });
  const planId = String((plan.catalog_object as { id?: string })?.id || "");
  if (!planId) throw new Error("Square plan creation failed");
  const variations: Record<string, string> = {};
  for (const name of ["Freelancer", "Pro", "Agency"]) {
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
              {
                cadence: "MONTHLY",
                ordinal: 0,
                periods: 1,
                pricing: {
                  type: "STATIC",
                  price: { amount: 0, currency: "CAD" },
                },
              },
              {
                cadence: "MONTHLY",
                ordinal: 1,
                pricing: {
                  type: "STATIC",
                  price: { amount: prices[name], currency: "CAD" },
                },
              },
            ],
          },
        },
      }),
    });
    const id = String((v.catalog_object as { id?: string })?.id || "");
    if (!id) throw new Error(`Square ${name} variation creation failed`);
    variations[name] = id;
  }
  const record = { locationId: location.id, planId, variations };
  const [id] = await db.add("billing-config", [record]);
  if (!id) throw new Error("Could not save billing configuration");
  return { ...record, id };
}
async function createCheckout(profile: Profile, userId: string, plan: string) {
  const cfg = await billingConfig();
  const variationId = cfg.variations[plan];
  if (!variationId) throw new Error("Unknown plan");
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
        redirect_url: "https://dealforge-t4lzpn.v2.appdeploy.ai/",
      },
      pre_populated_data: { buyer_email: profile.email },
      payment_note: `ScopeVanta user ${userId}`,
    }),
  });
  const url = String((result.payment_link as { url?: string })?.url || "");
  if (!url) throw new Error("Square checkout link creation failed");
  return { url, variationId };
}
async function verifyEntitlement(profile: Profile) {
  const cfg = await billingConfig();
  const customers = await square("/v2/customers/search", {
    method: "POST",
    body: JSON.stringify({
      limit: 20,
      query: { filter: { email_address: { exact: profile.email } } },
    }),
  });
  const ids = (
    (customers.customers as Array<{ id: string }> | undefined) || []
  ).map((c) => c.id);
  if (!ids.length) return null;
  const found = await square("/v2/subscriptions/search", {
    method: "POST",
    body: JSON.stringify({
      limit: 50,
      query: { filter: { location_ids: [cfg.locationId], customer_ids: ids } },
    }),
  });
  const subscriptions =
    (found.subscriptions as
      | Array<{
          id: string;
          status: string;
          plan_variation_id?: string;
          start_date?: string;
          charged_through_date?: string;
          customer_id?: string;
        }>
      | undefined) || [];
  const matched = subscriptions
    .filter((s) =>
      Object.values(cfg.variations).includes(String(s.plan_variation_id || "")),
    )
    .sort((a, b) =>
      String(b.start_date || "").localeCompare(String(a.start_date || "")),
    )[0];
  if (!matched) return null;
  const plan =
    Object.entries(cfg.variations).find(
      ([, id]) => id === matched.plan_variation_id,
    )?.[0] || profile.plan;
  return { ...matched, plan };
}
async function bindSubscriptionOwner(
  subscriptionId: string,
  userId: string,
  profileId: string,
) {
  if (!subscriptionId || !userId || !profileId) return;
  const table = `billing-owner:${subscriptionId}`;
  const { items } = await db.list<{ userId: string; profileId: string }>(
    table,
    { limit: 1 },
  );
  const record = { userId, profileId, updatedAt: new Date().toISOString() };
  if (items[0]) await db.update(table, [{ id: items[0].id, record }]);
  else await db.add(table, [record]);
}
async function bindBillingEmail(
  email: string,
  userId: string,
  profileId: string,
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const table = `billing-email:${Buffer.from(normalized).toString("base64url")}`;
  const { items } = await db.list<{ userId: string; profileId: string }>(
    table,
    { limit: 1 },
  );
  const record = {
    email: normalized,
    userId,
    profileId,
    updatedAt: new Date().toISOString(),
  };
  if (items[0]) await db.update(table, [{ id: items[0].id, record }]);
  else await db.add(table, [record]);
}
async function ownerFromSubscription(subscription: Record<string, unknown>) {
  const subscriptionId = String(subscription.id || "");
  if (subscriptionId) {
    const { items } = await db.list<{ userId: string; profileId: string }>(
      `billing-owner:${subscriptionId}`,
      { limit: 1 },
    );
    if (items[0]) return items[0];
  }
  const customerId = String(subscription.customer_id || "");
  if (!customerId) return null;
  const customerResult = await square(
    `/v2/customers/${encodeURIComponent(customerId)}`,
  );
  const customer = (customerResult.customer || {}) as {
    email_address?: string;
  };
  const email = String(customer.email_address || "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const { items } = await db.list<{ userId: string; profileId: string }>(
    `billing-email:${Buffer.from(email).toString("base64url")}`,
    { limit: 1 },
  );
  return items[0] || null;
}

async function getProfile(userId: string) {
  const { items } = await db.list<Profile>(`profiles:${userId}`, { limit: 1 });
  return items[0] || null;
}
async function profileWithUrl(p: (Profile & { id: string }) | null) {
  if (!p) return null;
  let logoUrl = "";
  if (p.logoPath) {
    const [u] = await storage.url([p.logoPath]);
    logoUrl = u?.url || "";
  }
  return { ...p, profileId: p.id, logoUrl };
}
function billing(p: Profile | null, ownerTest = false) {
  if (ownerTest)
    return {
      status: "owner_test",
      daysLeft: 9999,
      limit: 1000000,
      checkoutStarted: true,
      verifiedAt: "",
      ownerTest: true,
      requiresAction: false,
      action: "",
    };
  if (!p)
    return {
      status: "setup",
      daysLeft: 30,
      limit: 0,
      requiresAction: true,
      action: "complete_setup",
    };
  const end = p.trialEndsAt ? new Date(p.trialEndsAt) : null;
  const start = p.trialStartedAt ? new Date(p.trialStartedAt) : null;
  const derivedEnd =
    end || (start ? new Date(start.getTime() + 30 * 86400000) : null);
  const days = derivedEnd
    ? Math.max(0, Math.ceil((derivedEnd.getTime() - Date.now()) / 86400000))
    : 30;
  const status = p.billingStatus || "trial_setup";
  return {
    status,
    daysLeft: days,
    limit: limits[p.plan] || 10,
    checkoutStarted: Boolean(p.checkoutStartedAt),
    verifiedAt: p.billingVerifiedAt || "",
    ownerTest: false,
    requiresAction: status !== "verified_active",
    action: p.billingAction || "",
    chargedThroughDate: p.chargedThroughDate || "",
    trialEndsAt: derivedEnd?.toISOString() || "",
  };
}
export const handler = router({
  "GET /api/_healthcheck": [async () => json({ message: "Success" })],
  "POST /api/square/webhook": [
    async (ctx) => {
      const names = await secrets.listSecretNames();
      if (!names.includes("SQUARE_WEBHOOK_SIGNATURE_KEY"))
        return error("Webhook signature verification is not configured.", 503);
      const signature = String(
        ctx.event?.headers?.["x-square-hmacsha256-signature"] ||
          ctx.event?.headers?.["X-Square-HmacSha256-Signature"] ||
          "",
      );
      if (!signature) return error("Missing Square signature.", 403);
      const rawBody =
        typeof ctx.event?.body === "string"
          ? ctx.event.isBase64Encoded
            ? Buffer.from(ctx.event.body, "base64").toString("utf8")
            : ctx.event.body
          : JSON.stringify(ctx.body || {});
      const key = await secrets.readSecret("SQUARE_WEBHOOK_SIGNATURE_KEY");
      const notificationUrl =
        "https://dealforge-t4lzpn.v2.appdeploy.ai/api/square/webhook";
      const cryptoModule = await import("node:crypto");
      const expected = cryptoModule
        .createHmac("sha256", key)
        .update(notificationUrl + rawBody, "utf8")
        .digest("base64");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !cryptoModule.timingSafeEqual(a, b))
        return error("Invalid Square signature.", 403);
      const event = (ctx.body || {}) as {
        event_id?: string;
        type?: string;
        data?: { object?: Record<string, unknown> };
      };
      if (!event.event_id || !event.type)
        return error("Invalid Square event.", 400);
      const eventTable = `square-webhook-event:${String(event.event_id)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 160)}`;
      const prior = await db.list<{ eventId: string }>(eventTable, {
        limit: 1,
      });
      if (prior.items[0]) return json({ received: true, duplicate: true });
      const object = event.data?.object || {};
      const embedded = (object.subscription || {}) as Record<string, unknown>;
      const invoice = (object.invoice || {}) as Record<string, unknown>;
      let subscriptionId = String(embedded.id || invoice.subscription_id || "");
      let subscription = embedded;
      if (subscriptionId) {
        try {
          const canonical = await square(
            `/v2/subscriptions/${encodeURIComponent(subscriptionId)}`,
          );
          subscription = (canonical.subscription || embedded) as Record<
            string,
            unknown
          >;
        } catch (e) {
          console.warn("Square webhook subscription retrieval failed", e);
        }
      }
      subscriptionId = String(subscription.id || subscriptionId);
      const status = String(subscription.status || "").toUpperCase();
      let entitlementUpdated = false;
      let ownerResolved = false;
      if (subscriptionId && status) {
        try {
          const owner = await ownerFromSubscription(subscription);
          if (owner) {
            ownerResolved = true;
            await bindSubscriptionOwner(
              subscriptionId,
              owner.userId,
              owner.profileId,
            );
            const [current] = await db.get<Profile>(
              `profiles:${owner.userId}`,
              [owner.profileId],
            );
            if (current) {
              const active = status === "ACTIVE";
              const cfg = await billingConfig();
              const plan =
                Object.entries(cfg.variations).find(
                  ([, id]) =>
                    id === String(subscription.plan_variation_id || ""),
                )?.[0] || current.plan;
              const invoiceStatus = String(invoice.status || "").toUpperCase();
              const eventType = String(event.type || "").toLowerCase();
              const paymentFailure =
                invoiceStatus === "FAILED" ||
                invoiceStatus === "PAYMENT_FAILED" ||
                eventType.includes("payment.failed") ||
                eventType.includes("invoice.payment_failed");
              const chargedThroughDate = String(
                subscription.charged_through_date ||
                  current.chargedThroughDate ||
                  "",
              );
              const paymentRecovered =
                current.billingStatus === "payment_failed" &&
                active &&
                billingDateAdvanced(
                  current.chargedThroughDate,
                  chargedThroughDate,
                );
              const paymentFailureLocked =
                paymentFailure ||
                (current.billingStatus === "payment_failed" &&
                  !paymentRecovered);
              const action = paymentFailureLocked
                ? "update_payment"
                : active
                  ? ""
                  : status === "CANCELED"
                    ? "resubscribe"
                    : status === "PAUSED"
                      ? "resume_subscription"
                      : "verify_subscription";
              const startDate = String(subscription.start_date || "");
              const trialStart =
                current.trialStartedAt ||
                (active && startDate
                  ? `${startDate}T00:00:00.000Z`
                  : active
                    ? new Date().toISOString()
                    : "");
              const trialEnd =
                current.trialEndsAt ||
                (trialStart
                  ? new Date(
                      new Date(trialStart).getTime() + 30 * 86400000,
                    ).toISOString()
                  : "");
              const record = {
                ...current,
                plan,
                billingStatus: paymentFailureLocked
                  ? "payment_failed"
                  : active
                    ? "verified_active"
                    : `square_${status.toLowerCase()}`,
                squareSubscriptionId: subscriptionId,
                billingVerifiedAt: new Date().toISOString(),
                trialStartedAt: trialStart,
                trialEndsAt: trialEnd,
                chargedThroughDate,
                billingAction: action,
                lastBillingEvent: String(event.type || ""),
              };
              const [ok] = await db.update(`profiles:${owner.userId}`, [
                { id: owner.profileId, record },
              ]);
              entitlementUpdated = Boolean(ok);
            }
          }
        } catch (e) {
          console.warn("Square webhook entitlement synchronization failed", e);
        }
      }
      const [id] = await db.add(eventTable, [
        {
          eventId: event.event_id,
          type: event.type,
          subscriptionId,
          status,
          ownerResolved,
          entitlementUpdated,
          receivedAt: new Date().toISOString(),
        },
      ]);
      if (!id) return error("Could not record Square event.", 500);
      return json({ received: true, entitlementUpdated });
    },
  ],
  "GET /api/billing/integration-status": [
    requireAuth(),
    async () => {
      const names = await secrets.listSecretNames();
      const webhookConfigured = names.includes("SQUARE_WEBHOOK_SIGNATURE_KEY");
      if (!names.includes("SQUARE_ACCESS_TOKEN"))
        return json({
          squareConfigured: false,
          connected: false,
          webhookConfigured,
          mode: "production",
          verification: "missing_token",
        });
      try {
        const token = await secrets.readSecret("SQUARE_ACCESS_TOKEN");
        const response = await fetch(
          "https://connect.squareup.com/v2/locations",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Square-Version": squareVersion,
              "Content-Type": "application/json",
            },
          },
        );
        if (!response.ok)
          return json({
            squareConfigured: true,
            connected: false,
            webhookConfigured,
            mode: "production",
            verification: "token_rejected",
          });
        const data = (await response.json()) as {
          locations?: Array<{
            id: string;
            name?: string;
            status?: string;
            currency?: string;
            country?: string;
          }>;
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
        return json({
          squareConfigured: true,
          connected: false,
          webhookConfigured,
          mode: "production",
          verification: "connection_error",
        });
      }
    },
  ],
  "GET /api/billing/status": [
    requireAuth(),
    async (ctx) => {
      const p = await getProfile(ctx.user!.userId);
      if (!p) return error("Complete profile first.", 400);
      const ownerTest = hasOwnerTestAccess(ctx.user!.email);
      const state = billing(p, ownerTest);
      return json({
        billing: state,
        plan: p.plan,
        subscriptionId: p.squareSubscriptionId
          ? `${p.squareSubscriptionId.slice(0, 6)}…${p.squareSubscriptionId.slice(-4)}`
          : "",
        verifiedAt: p.billingVerifiedAt || "",
        checkoutStartedAt: p.checkoutStartedAt || "",
        trialStartedAt: p.trialStartedAt || "",
        trialEndsAt: p.trialEndsAt || state.trialEndsAt || "",
        chargedThroughDate: p.chargedThroughDate || "",
        requiresAction: !ownerTest && p.billingStatus !== "verified_active",
        action: ownerTest ? "" : p.billingAction || "",
        lastBillingEvent: p.lastBillingEvent || "",
        lifecycle: p.billingStatus || "trial_setup",
      });
    },
  ],
  "GET /api/profile": [
    requireAuth(),
    async (ctx) => {
      const p = await getProfile(ctx.user!.userId);
      return json({
        profile: await profileWithUrl(p),
        billing: billing(p, hasOwnerTestAccess(ctx.user!.email)),
      });
    },
  ],
  "PUT /api/profile": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as Partial<Profile>;
      if (!b.name || !b.email || !b.address || !b.company || !b.expertise)
        return error("Required profile fields are missing.", 400);
      const email = String(b.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return error("Enter a valid email address.", 400);
      if (String(b.name).trim().length < 2)
        return error("Enter your full name.", 400);
      const old = await getProfile(ctx.user!.userId);
      const plan = ["Freelancer", "Pro", "Agency"].includes(String(b.plan))
        ? String(b.plan)
        : "Freelancer";
      const record = {
        name: String(b.name).slice(0, 120),
        email,
        address: String(b.address).slice(0, 300),
        company: String(b.company).slice(0, 160),
        expertise: String(b.expertise).slice(0, 4000),
        website: String(b.website || "").slice(0, 500),
        plan,
        logoPath: old?.logoPath || "",
        onboarded: Boolean(b.onboarded),
        trialStartedAt: old?.trialStartedAt || "",
        trialEndsAt: old?.trialEndsAt || "",
        checkoutStartedAt: old?.checkoutStartedAt || "",
        billingStatus: old?.billingStatus || "trial_setup",
        squareSubscriptionId: old?.squareSubscriptionId || "",
        billingVerifiedAt: old?.billingVerifiedAt || "",
        chargedThroughDate: old?.chargedThroughDate || "",
        billingAction: old?.billingAction || "",
        lastBillingEvent: old?.lastBillingEvent || "",
        updatedAt: new Date().toISOString(),
      };
      if (old) {
        const [ok] = await db.update(`profiles:${ctx.user!.userId}`, [
          { id: old.id, record },
        ]);
        if (!ok) return error("Could not save profile.", 500);
      } else {
        const [id] = await db.add(`profiles:${ctx.user!.userId}`, [record]);
        if (!id) return error("Could not create profile.", 500);
      }
      const p = await getProfile(ctx.user!.userId);
      const ownerTest = hasOwnerTestAccess(ctx.user!.email);
      return json({
        profile: await profileWithUrl(p),
        billing: billing(p, ownerTest),
      });
    },
  ],
  "POST /api/billing/checkout-started": [
    requireAuth(),
    async (ctx) => {
      const p = await getProfile(ctx.user!.userId);
      if (!p) return error("Complete profile first.", 400);
      const b = (ctx.body || {}) as { plan?: string };
      const plan = ["Freelancer", "Pro", "Agency"].includes(String(b.plan))
        ? String(b.plan)
        : p.plan;
      if (p.billingStatus === "verified_active" && p.squareSubscriptionId)
        return error(
          "An active Square subscription is already linked to this workspace. To avoid duplicate billing, change or cancel that subscription in Square before starting a new plan checkout.",
          409,
        );
      try {
        await bindBillingEmail(p.email, ctx.user!.userId, p.id);
        const checkout = await createCheckout(p, ctx.user!.userId, plan);
        const record = {
          ...p,
          plan,
          checkoutStartedAt: new Date().toISOString(),
          billingStatus: "awaiting_square_confirmation",
        };
        delete (record as { id?: string }).id;
        const [ok] = await db.update(`profiles:${ctx.user!.userId}`, [
          { id: p.id, record },
        ]);
        if (!ok) return error("Could not save checkout state.", 500);
        return json({ billing: billing(record), checkoutUrl: checkout.url });
      } catch (e) {
        console.error("Square checkout setup failed", e);
        return error(
          "Square checkout could not be prepared. Please try again.",
          502,
        );
      }
    },
  ],
  "POST /api/billing/sync": [
    requireAuth(),
    async (ctx) => {
      const p = await getProfile(ctx.user!.userId);
      if (!p) return error("Complete profile first.", 400);
      try {
        const sub = await verifyEntitlement(p);
        if (!sub) return json({ verified: false, billing: billing(p) });
        const active = sub.status === "ACTIVE";
        const chargedThroughDate = String(
          sub.charged_through_date || p.chargedThroughDate || "",
        );
        const paymentRecovery =
          p.billingStatus === "payment_failed" &&
          billingDateAdvanced(p.chargedThroughDate, chargedThroughDate);
        const paymentFailureLocked =
          p.billingStatus === "payment_failed" && !paymentRecovery;
        const trialStart = active
          ? p.trialStartedAt ||
            (sub.start_date
              ? `${sub.start_date}T00:00:00.000Z`
              : new Date().toISOString())
          : p.trialStartedAt;
        const record = {
          ...p,
          plan: sub.plan,
          trialStartedAt: trialStart,
          trialEndsAt:
            p.trialEndsAt ||
            (trialStart
              ? new Date(
                  new Date(trialStart).getTime() + 30 * 86400000,
                ).toISOString()
              : ""),
          billingStatus: paymentFailureLocked
            ? "payment_failed"
            : active
              ? "verified_active"
              : `square_${sub.status.toLowerCase()}`,
          squareSubscriptionId: sub.id,
          billingVerifiedAt: new Date().toISOString(),
          chargedThroughDate,
          billingAction: paymentFailureLocked
            ? "update_payment"
            : active
              ? ""
              : sub.status === "CANCELED"
                ? "resubscribe"
                : sub.status === "PAUSED"
                  ? "resume_subscription"
                  : "verify_subscription",
        };
        delete (record as { id?: string }).id;
        await db.update(`profiles:${ctx.user!.userId}`, [{ id: p.id, record }]);
        await bindBillingEmail(p.email, ctx.user!.userId, p.id);
        await bindSubscriptionOwner(sub.id, ctx.user!.userId, p.id);
        return json({
          verified: active && !paymentFailureLocked,
          status: sub.status,
          plan: sub.plan,
          billing: billing(record),
        });
      } catch (e) {
        console.error("Square subscription sync failed", e);
        return error(
          "Square subscription verification is temporarily unavailable.",
          502,
        );
      }
    },
  ],
  "POST /api/upload": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as UploadBody;
      if (!b.content || !b.name || !b.kind) return error("Missing file.", 400);
      if (b.kind === "client_logo" && !b.clientId)
        return error(
          "Choose a saved client before uploading a client logo.",
          400,
        );
      if (b.content.length > 7_200_000) return error("File is too large.", 400);
      const safe = b.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const path = `users/${ctx.user!.userId}/${b.kind}/${Date.now()}-${safe}`;
      const contentType = b.type || "application/octet-stream";
      const [ok] = await storage.write([
        { path, content: b.content, contentType },
      ]);
      if (!ok) return error("Upload failed.", 500);
      let fileId: string | undefined;
      let status: "ready" | "stored" | "failed" = "stored";
      let extractedText = "";
      let extractionMethod = "";
      let extractionError = "";
      let intelligence: KnowledgeIntelligence | undefined;
      let intelligenceStatus: "ready" | "failed" | undefined;
      let intelligenceError = "";
      if (b.kind === "logo") {
        const p = await getProfile(ctx.user!.userId);
        if (p) {
          const record = { ...p, logoPath: path };
          delete (record as { id?: string }).id;
          await db.update(`profiles:${ctx.user!.userId}`, [
            { id: p.id, record },
          ]);
        }
      } else if (b.kind === "client_logo") {
        const [client] = await db.get<ClientBody>(
          `clients:${ctx.user!.userId}`,
          [String(b.clientId)],
        );
        if (!client) {
          await storage.delete([path]);
          return error("Saved client not found.", 404);
        }
        const previousPath = String(client.logoPath || "");
        const [updated] = await db.update(`clients:${ctx.user!.userId}`, [
          {
            id: String(b.clientId),
            record: {
              ...client,
              logoPath: path,
              updatedAt: new Date().toISOString(),
            },
          },
        ]);
        if (!updated) {
          await storage.delete([path]);
          return error("Client logo could not be saved.", 500);
        }
        if (previousPath && previousPath !== path) {
          const [removed] = await storage.delete([previousPath]);
          if (!removed)
            console.warn("Previous client logo could not be removed");
        }
      } else {
        if (/\.(txt|md)$/i.test(safe)) {
          try {
            extractedText = Buffer.from(b.content, "base64")
              .toString("utf8")
              .slice(0, 30000);
            status = extractedText.trim() ? "ready" : "failed";
            extractionMethod = "text";
            if (status === "failed")
              extractionError = "No readable text was found.";
          } catch {
            status = "failed";
            extractionError = "Text extraction failed.";
          }
        } else if (/\.pdf$/i.test(safe) || contentType === "application/pdf") {
          try {
            const pdf = await ai.generate({
              system:
                "You are a document transcription engine. Extract only text that is actually present in the supplied PDF. Preserve headings, lists, numbers and important table content. Do not summarize, infer, correct, embellish or add facts. If text is unreadable, omit it.",
              prompt:
                "Transcribe the readable text in this PDF for a private business knowledge base. Return plain text only.",
              images: [{ data: b.content, mimeType: "application/pdf" }],
              maxTokens: 7600,
              temperature: 0,
              thinkingMode: "NONE",
            });
            extractedText = pdf.text.trim().slice(0, 30000);
            status = extractedText ? "ready" : "failed";
            extractionMethod = "pdf-ai";
            if (status === "failed")
              extractionError = "No readable PDF text was found.";
          } catch (e) {
            console.warn("PDF extraction unavailable", e);
            status = "failed";
            extractionMethod = "pdf-ai";
            extractionError =
              "PDF text extraction failed. The original file is still stored.";
          }
        } else if (
          /\.docx?$/i.test(safe) ||
          contentType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          contentType === "application/msword"
        ) {
          try {
            const word = await ai.generate({
              system:
                "You are a document transcription engine. Extract only text that is actually present in the supplied Word document bytes. Preserve headings, lists, numbers and important table content. Do not summarize, infer, correct, embellish or add facts. Ignore archive metadata and binary noise. If meaningful document text cannot be recovered, return an empty response.",
              prompt: `Recover the readable business-document text from this ${safe.toLowerCase().endsWith(".docx") ? "DOCX" : "DOC"} file. The following is a base64 representation of the original file bytes. Return plain document text only.\n\n${b.content}`,
              maxTokens: 7600,
              temperature: 0,
              thinkingMode: "NONE",
            });
            extractedText = word.text.trim().slice(0, 30000);
            const suspicious =
              !extractedText ||
              extractedText.length < 20 ||
              /^[A-Za-z0-9+/=\s]{100,}$/.test(extractedText);
            status = suspicious ? "failed" : "ready";
            extractionMethod = safe.toLowerCase().endsWith(".docx")
              ? "docx-ai"
              : "doc-ai";
            if (status === "failed") {
              extractedText = "";
              extractionError =
                "No reliable readable Word document text was recovered.";
            }
          } catch (e) {
            console.warn("Word extraction unavailable", e);
            status = "failed";
            extractionMethod = safe.toLowerCase().endsWith(".docx")
              ? "docx-ai"
              : "doc-ai";
            extractionError =
              "Word document text extraction failed. The original file is still stored.";
          }
        } else if (contentType.startsWith("image/")) {
          try {
            const imageText = await ai.ocr({
              system:
                "You are a document transcription engine. Transcribe only business-relevant text that is actually visible in the supplied image. Preserve headings, labels, numbers and table-like content. Do not summarize, infer, correct, embellish or add facts.",
              prompt:
                "Transcribe the readable text in this image for a private business knowledge base. Return plain text only.",
              images: [{ data: b.content, mimeType: contentType }],
              maxRetries: 2,
              maxTokens: 6000,
              temperature: 0,
              thinkingMode: "NONE",
            });
            extractedText = imageText.text.trim().slice(0, 30000);
            status = extractedText ? "ready" : "failed";
            extractionMethod = "image-ocr";
            if (status === "failed")
              extractionError = "No readable text was found in the image.";
          } catch (e) {
            console.warn("Image OCR unavailable", e);
            status = "failed";
            extractionMethod = "image-ocr";
            extractionError =
              "Image text extraction failed. The original file is still stored.";
          }
        }
        if (status === "ready" && extractedText.trim()) {
          try {
            intelligence = await structureKnowledge(extractedText, safe);
            intelligenceStatus = "ready";
          } catch (e) {
            console.warn("Knowledge structuring unavailable", e);
            intelligenceStatus = "failed";
            intelligenceError =
              "The file text is ready, but structured knowledge could not be created.";
          }
        }
        const [id] = await db.add(`files:${ctx.user!.userId}`, [
          {
            path,
            name: safe,
            type: contentType,
            createdAt: new Date().toISOString(),
            status,
            extractedText,
            extractionMethod,
            error: extractionError,
            intelligence,
            intelligenceStatus,
            intelligenceError,
          },
        ]);
        fileId = id || undefined;
        if (fileId && intelligenceStatus === "ready" && intelligence) {
          const createdAt = new Date().toISOString();
          const records: KnowledgeRecord[] = [];
          for (const [key, label] of knowledgeCategories) {
            const values = intelligence[key];
            if (Array.isArray(values)) {
              for (const value of values.slice(0, 40)) {
                const fact = String(value || "").trim();
                if (fact)
                  records.push({
                    category: label,
                    fact: fact.slice(0, 3000),
                    sourceFileId: fileId,
                    sourceFileName: safe,
                    documentType: intelligence.documentType,
                    createdAt,
                    active: true,
                  });
              }
            }
          }
          if (records.length) {
            const ids = await db.add(`knowledge:${ctx.user!.userId}`, records);
            if (ids.some((v) => !v))
              console.warn(
                "Some persistent knowledge records could not be saved",
              );
          }
        }
      }
      const [u] = await storage.url([path]);
      return json({
        url: u?.url || "",
        name: safe,
        id: fileId,
        status,
        extractedChars: extractedText.length,
        error: extractionError,
        intelligenceStatus,
        intelligenceSummary: intelligence?.summary || "",
        documentType: intelligence?.documentType || "",
      });
    },
  ],
  "GET /api/files": [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list<KnowledgeFileRecord>(
        `files:${ctx.user!.userId}`,
        { limit: 30 },
      );
      return json({
        files: items.map(
          ({
            id,
            name,
            type,
            createdAt,
            status,
            extractedText,
            error,
            intelligence,
            intelligenceStatus,
            intelligenceError,
          }) => ({
            id,
            name,
            type,
            createdAt,
            status: status || (/\.(txt|md)$/i.test(name) ? "ready" : "stored"),
            extractedChars: (extractedText || "").length,
            error: error || "",
            intelligenceStatus,
            intelligenceError: intelligenceError || "",
            documentType: intelligence?.documentType || "",
            summary: intelligence?.summary || "",
            knowledgeCounts: intelligence
              ? {
                  services: intelligence.services.length,
                  differentiators: intelligence.differentiators.length,
                  deliverables: intelligence.deliverables.length,
                  pricing: intelligence.pricingEvidence.length,
                  proof: intelligence.proofPoints.length,
                  constraints: intelligence.constraints.length,
                }
              : undefined,
          }),
        ),
      });
    },
  ],
  "POST /api/files/:id/reprocess": [
    requireAuth(),
    async (ctx) => {
      const fileId = String(ctx.params.id || "");
      if (!fileId) return error("Knowledge file is required.", 400);
      const [file] = await db.get<KnowledgeFileRecord>(
        `files:${ctx.user!.userId}`,
        [fileId],
      );
      if (!file) return error("Knowledge file not found.", 404);
      const [stored] = await storage.read([file.path]);
      if (!stored?.content)
        return error(
          "The original file is no longer available for reprocessing.",
          410,
        );
      let extractedText = "";
      let extractionMethod = "";
      let extractionError = "";
      try {
        if (/\.(txt|md)$/i.test(file.name)) {
          extractedText = Buffer.from(stored.content, "base64")
            .toString("utf8")
            .slice(0, 30000);
          if (!extractedText.trim() && file.extractedText)
            extractedText = file.extractedText.slice(0, 30000);
          extractionMethod = "text";
        } else if (
          /\.pdf$/i.test(file.name) ||
          file.type === "application/pdf"
        ) {
          const pdf = await ai.generate({
            system:
              "You are a document transcription engine. Extract only text actually present in the supplied PDF. Preserve headings, lists, numbers and important table content. Do not summarize or infer facts.",
            prompt:
              "Transcribe the readable text in this PDF. Return plain text only.",
            images: [{ data: stored.content, mimeType: "application/pdf" }],
            maxTokens: 7600,
            temperature: 0,
            thinkingMode: "NONE",
          });
          extractedText = pdf.text.trim().slice(0, 30000);
          extractionMethod = "pdf-ai";
        } else if (
          /\.docx?$/i.test(file.name) ||
          file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          file.type === "application/msword"
        ) {
          const word = await ai.generate({
            system:
              "You are a document transcription engine. Extract only text actually present in the supplied Word document bytes. Preserve headings, lists, numbers and table content. Ignore archive metadata and binary noise. Return empty text if reliable document text cannot be recovered.",
            prompt: `Recover readable business-document text from ${file.name}. Base64 original bytes follow. Return plain text only.\n\n${stored.content}`,
            maxTokens: 7600,
            temperature: 0,
            thinkingMode: "NONE",
          });
          extractedText = word.text.trim().slice(0, 30000);
          if (
            !extractedText ||
            extractedText.length < 20 ||
            /^[A-Za-z0-9+/=\s]{100,}$/.test(extractedText)
          )
            extractedText = "";
          extractionMethod = file.name.toLowerCase().endsWith(".docx")
            ? "docx-ai"
            : "doc-ai";
        } else if (file.type.startsWith("image/")) {
          const imageText = await ai.ocr({
            system:
              "Transcribe only business-relevant text actually visible in the image. Preserve headings, labels, numbers and table-like content. Do not infer facts.",
            prompt:
              "Transcribe readable text for the private business knowledge base. Return plain text only.",
            images: [{ data: stored.content, mimeType: file.type }],
            maxRetries: 2,
            maxTokens: 6000,
            temperature: 0,
            thinkingMode: "NONE",
          });
          extractedText = imageText.text.trim().slice(0, 30000);
          extractionMethod = "image-ocr";
        } else
          return error("This stored file format cannot be reprocessed.", 400);
      } catch (e) {
        console.warn("Knowledge reprocessing extraction failed", e);
        extractionError =
          "Reprocessing could not extract readable text from the original file.";
      }
      if (!extractedText.trim())
        return error(
          extractionError ||
            "No reliable readable text was found during reprocessing.",
          422,
        );
      let intelligence: KnowledgeIntelligence;
      try {
        intelligence = await structureKnowledge(extractedText, file.name);
      } catch (e) {
        console.warn("Knowledge reprocessing structuring failed", e);
        return error(
          "Text was extracted, but structured knowledge could not be rebuilt. Existing knowledge was left unchanged.",
          502,
        );
      }
      const { items: oldKnowledge } = await db.list<KnowledgeRecord>(
        `knowledge:${ctx.user!.userId}`,
        { limit: 200 },
      );
      const oldForFile = oldKnowledge.filter((v) => v.sourceFileId === fileId);
      const activeByFact = new Map(
        oldForFile.map((v) => [
          `${v.category}\n${v.fact}`.toLowerCase(),
          v.active !== false,
        ]),
      );
      const createdAt = new Date().toISOString();
      const records: KnowledgeRecord[] = [];
      for (const [key, label] of knowledgeCategories) {
        const values = intelligence[key];
        if (Array.isArray(values)) {
          for (const value of values.slice(0, 40)) {
            const fact = String(value || "").trim();
            if (fact) {
              const active =
                activeByFact.get(`${label}\n${fact}`.toLowerCase()) ?? true;
              records.push({
                category: label,
                fact: fact.slice(0, 3000),
                sourceFileId: fileId,
                sourceFileName: file.name,
                documentType: intelligence.documentType,
                createdAt,
                active,
              });
            }
          }
        }
      }
      const newIds = records.length
        ? await db.add(`knowledge:${ctx.user!.userId}`, records)
        : [];
      if (newIds.some((v) => !v)) {
        const createdIds = newIds.filter((v): v is string => Boolean(v));
        if (createdIds.length)
          await db.delete(`knowledge:${ctx.user!.userId}`, createdIds);
        return error(
          "Reprocessed facts could not be saved. Existing knowledge was left unchanged.",
          500,
        );
      }
      const createdIds = newIds.filter((v): v is string => Boolean(v));
      const updated: KnowledgeFileRecord = {
        ...file,
        status: "ready",
        extractedText,
        extractionMethod,
        error: "",
        intelligence,
        intelligenceStatus: "ready",
        intelligenceError: "",
      };
      const [ok] = await db.update(`files:${ctx.user!.userId}`, [
        { id: fileId, record: updated },
      ]);
      if (!ok) {
        if (createdIds.length)
          await db.delete(`knowledge:${ctx.user!.userId}`, createdIds);
        return error(
          "The reprocessed file could not be committed. Existing knowledge was left unchanged.",
          500,
        );
      }
      if (oldForFile.length) {
        const deleted = await db.delete(
          `knowledge:${ctx.user!.userId}`,
          oldForFile.map((v) => v.id),
        );
        if (deleted.some((v) => !v)) {
          console.warn(
            "Reprocessing committed, but some superseded knowledge records could not be removed",
            fileId,
          );
        }
      }
      return json({
        reprocessed: true,
        fileId,
        facts: records.length,
        extractedChars: extractedText.length,
        documentType: intelligence.documentType,
        cleanupPending: false,
      });
    },
  ],
  "DELETE /api/files/:id": [
    requireAuth(),
    async (ctx) => {
      const fileId = String(ctx.params.id || "");
      if (!fileId) return error("Knowledge file is required.", 400);
      const [file] = await db.get<KnowledgeFileRecord>(
        `files:${ctx.user!.userId}`,
        [fileId],
      );
      if (!file) return error("Knowledge file not found.", 404);
      const storageDeleted = await storage.delete([file.path]);
      if (!storageDeleted[0])
        return error(
          "The stored original could not be deleted, so no knowledge records were removed.",
          500,
        );
      const { items: knowledge } = await db.list<KnowledgeRecord>(
        `knowledge:${ctx.user!.userId}`,
        { limit: 200 },
      );
      const sourceRecords = knowledge.filter((v) => v.sourceFileId === fileId);
      if (sourceRecords.length) {
        const removed = await db.delete(
          `knowledge:${ctx.user!.userId}`,
          sourceRecords.map((v) => v.id),
        );
        if (removed.some((v) => !v))
          return error(
            "The original file was deleted, but some derived knowledge records could not be removed. Please retry deletion.",
            500,
          );
      }
      const [fileDeleted] = await db.delete(`files:${ctx.user!.userId}`, [
        fileId,
      ]);
      if (!fileDeleted)
        return error(
          "The original and derived knowledge were removed, but the file index could not be cleared. Please retry deletion.",
          500,
        );
      return json({
        deleted: true,
        fileId,
        removedFacts: sourceRecords.length,
        preservedProposalHistory: true,
      });
    },
  ],
  "GET /api/knowledge": [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list<KnowledgeRecord>(
        `knowledge:${ctx.user!.userId}`,
        { limit: 200 },
      );
      items.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      );
      return json({
        records: items,
        counts: items
          .filter((v) => v.active !== false)
          .reduce<Record<string, number>>((acc, v) => {
            acc[v.category] = (acc[v.category] || 0) + 1;
            return acc;
          }, {}),
      });
    },
  ],
  "GET /api/knowledge/health": [
    requireAuth(),
    async (ctx) => {
      const userId = ctx.user!.userId;
      const [{ items: files }, { items: knowledge }] = await Promise.all([
        db.list<KnowledgeFileRecord>(`files:${userId}`, { limit: 30 }),
        db.list<KnowledgeRecord>(`knowledge:${userId}`, { limit: 200 }),
      ]);
      const fileIds = new Set(files.map((v) => v.id));
      const orphanFacts = knowledge.filter((v) => !fileIds.has(v.sourceFileId));
      const duplicateKeys = new Map<string, number>();
      for (const fact of knowledge) {
        const key =
          `${fact.sourceFileId}\n${fact.category}\n${fact.fact}`.toLowerCase();
        duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
      }
      const duplicateFacts = Array.from(duplicateKeys.values()).reduce(
        (sum, count) => sum + Math.max(0, count - 1),
        0,
      );
      const failedFiles = files.filter(
        (v) => v.status === "failed" || v.intelligenceStatus === "failed",
      );
      const missingOriginals: string[] = [];
      if (files.length) {
        const originals = await storage.read(files.map((v) => v.path));
        originals.forEach((item, index) => {
          if (!item.content) missingOriginals.push(files[index].name);
        });
      }
      const issues =
        orphanFacts.length +
        duplicateFacts +
        failedFiles.length +
        missingOriginals.length;
      return json({
        healthy: issues === 0,
        checkedAt: new Date().toISOString(),
        files: files.length,
        facts: knowledge.length,
        activeFacts: knowledge.filter((v) => v.active !== false).length,
        issues: {
          orphanFacts: orphanFacts.length,
          duplicateFacts,
          failedFiles: failedFiles.length,
          missingOriginals: missingOriginals.length,
        },
        missingOriginalFiles: missingOriginals.slice(0, 10),
        recommendation:
          issues === 0
            ? "Knowledge integrity checks passed."
            : "Review failed files, reprocess recoverable sources, and delete sources whose originals are missing.",
      });
    },
  ],
  "PUT /api/knowledge/:id": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const body = (ctx.body || {}) as { active?: boolean };
      if (!id) return error("Knowledge record is required.", 400);
      if (typeof body.active !== "boolean")
        return error("Active status is required.", 400);
      const [current] = await db.get<KnowledgeRecord>(
        `knowledge:${ctx.user!.userId}`,
        [id],
      );
      if (!current) return error("Knowledge record not found.", 404);
      const [ok] = await db.update(`knowledge:${ctx.user!.userId}`, [
        { id, record: { ...current, active: body.active } },
      ]);
      if (!ok) return error("Knowledge record could not be updated.", 500);
      return json({ record: { ...current, id, active: body.active } });
    },
  ],
  "GET /api/clients": [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list<ClientBody>(
        `clients:${ctx.user!.userId}`,
        { limit: 100 },
      );
      const { items: projects } = await db.list<Record<string, unknown>>(
        `projects:${ctx.user!.userId}`,
        { limit: 160 },
      );
      const logoPaths = items
        .map((client) => String(client.logoPath || ""))
        .filter(Boolean);
      const logoUrls = logoPaths.length ? await storage.url(logoPaths) : [];
      const urlByPath = new Map(logoUrls.map((item) => [item.path, item.url]));
      const enriched = items.map((client) => {
        const linked = projects.filter(
          (project) => String(project.clientId || "") === client.id,
        );
        const scores = linked
          .map((project) => Number(project.score || 0))
          .filter(Number.isFinite);
        return {
          ...client,
          logoUrl: client.logoPath ? urlByPath.get(client.logoPath) || "" : "",
          proposalCount: linked.length,
          averageRisk: scores.length
            ? Math.round(
                scores.reduce((sum, value) => sum + value, 0) / scores.length,
              )
            : null,
          lastOpportunityAt:
            linked
              .map((project) => String(project.createdAt || ""))
              .sort()
              .reverse()[0] || "",
        };
      });
      enriched.sort((a, b) =>
        String(b.updatedAt || b.createdAt || "").localeCompare(
          String(a.updatedAt || a.createdAt || ""),
        ),
      );
      return json({ clients: enriched });
    },
  ],
  "POST /api/clients": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as ClientBody;
      if (!b.name?.trim()) return error("Client name is required.", 400);
      const email = String(b.email || "")
        .trim()
        .toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return error("Enter a valid client email.", 400);
      const now = new Date().toISOString();
      const record = {
        name: b.name.trim().slice(0, 120),
        company: String(b.company || "")
          .trim()
          .slice(0, 160),
        email: email.slice(0, 200),
        phone: String(b.phone || "")
          .trim()
          .slice(0, 80),
        website: String(b.website || "")
          .trim()
          .slice(0, 500),
        industry: String(b.industry || "")
          .trim()
          .slice(0, 120),
        status: ["Prospect", "Active", "Won", "Dormant", "Lost"].includes(
          String(b.status),
        )
          ? String(b.status)
          : "Prospect",
        notes: String(b.notes || "")
          .trim()
          .slice(0, 5000),
        goals: String(b.goals || "")
          .trim()
          .slice(0, 4000),
        preferences: String(b.preferences || "")
          .trim()
          .slice(0, 4000),
        decisionMakers: String(b.decisionMakers || "")
          .trim()
          .slice(0, 3000),
        painPoints: String(b.painPoints || "")
          .trim()
          .slice(0, 3000),
        buyingCriteria: String(b.buyingCriteria || "")
          .trim()
          .slice(0, 3000),
        knownObjections: String(b.knownObjections || "")
          .trim()
          .slice(0, 3000),
        nextStep: String(b.nextStep || "")
          .trim()
          .slice(0, 2000),
        followUpDate: String(b.followUpDate || "").slice(0, 10),
        createdAt: now,
        updatedAt: now,
      };
      const [id] = await db.add(`clients:${ctx.user!.userId}`, [record]);
      if (!id) return error("Could not create client.", 500);
      return json({ client: { ...record, id } });
    },
  ],
  "PUT /api/clients/:id": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const b = (ctx.body || {}) as ClientBody;
      if (!id) return error("Client is required.", 400);
      const [current] = await db.get<Record<string, unknown>>(
        `clients:${ctx.user!.userId}`,
        [id],
      );
      if (!current) return error("Client not found.", 404);
      const name = String(b.name ?? current.name ?? "").trim();
      if (!name) return error("Client name is required.", 400);
      const email = String(b.email ?? current.email ?? "")
        .trim()
        .toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return error("Enter a valid client email.", 400);
      const value = (key: keyof ClientBody, max: number) =>
        String(b[key] ?? current[key] ?? "")
          .trim()
          .slice(0, max);
      const record = {
        ...current,
        name: name.slice(0, 120),
        company: value("company", 160),
        email: email.slice(0, 200),
        phone: value("phone", 80),
        website: value("website", 500),
        industry: value("industry", 120),
        status: ["Prospect", "Active", "Won", "Dormant", "Lost"].includes(
          String(b.status ?? current.status),
        )
          ? String(b.status ?? current.status)
          : "Prospect",
        notes: value("notes", 5000),
        goals: value("goals", 4000),
        preferences: value("preferences", 4000),
        decisionMakers: value("decisionMakers", 3000),
        painPoints: value("painPoints", 3000),
        buyingCriteria: value("buyingCriteria", 3000),
        knownObjections: value("knownObjections", 3000),
        nextStep: value("nextStep", 2000),
        followUpDate: value("followUpDate", 10),
        updatedAt: new Date().toISOString(),
      };
      const [ok] = await db.update(`clients:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Client could not be updated.", 500);
      return json({ client: { ...record, id } });
    },
  ],
  "DELETE /api/clients/:id": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      if (!id) return error("Client is required.", 400);
      const [current] = await db.get<ClientBody>(
        `clients:${ctx.user!.userId}`,
        [id],
      );
      if (!current) return error("Client not found.", 404);
      const { items: projects } = await db.list<Record<string, unknown>>(
        `projects:${ctx.user!.userId}`,
        { limit: 160 },
      );
      const linked = projects.filter(
        (project) => String(project.clientId || "") === id,
      ).length;
      if (linked > 0)
        return error(
          `This client has ${linked} linked proposal${linked === 1 ? "" : "s"}. Keep the client record so proposal history remains connected.`,
          409,
        );
      const [ok] = await db.delete(`clients:${ctx.user!.userId}`, [id]);
      if (!ok) return error("Client could not be deleted.", 500);
      return json({ deleted: true, id });
    },
  ],
  "GET /api/projects": [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list(`projects:${ctx.user!.userId}`, {
        limit: 50,
      });
      items.sort((a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)),
      );
      return json({ projects: items });
    },
  ],
  "POST /api/analytics/event": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as {
        name?: string;
        context?: Record<string, unknown>;
      };
      const allowed = new Set([
        "workspace_loaded",
        "checkout_started",
        "billing_verified",
        "client_created",
        "knowledge_ready",
        "proposal_generated",
        "proposal_refined",
        "proposal_edited",
        "proposal_printed",
      ]);
      const name = String(b.name || "");
      if (!allowed.has(name)) return error("Unsupported analytics event.", 400);
      const raw = b.context && typeof b.context === "object" ? b.context : {};
      const context: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(raw).slice(0, 12)) {
        if (typeof value === "string")
          context[key.slice(0, 60)] = value.slice(0, 160);
        else if (typeof value === "number" && Number.isFinite(value))
          context[key.slice(0, 60)] = value;
        else if (typeof value === "boolean") context[key.slice(0, 60)] = value;
      }
      const [id] = await db.add(`analytics:${ctx.user!.userId}`, [
        { name, context, createdAt: new Date().toISOString() },
      ]);
      if (!id) return error("Analytics event could not be recorded.", 500);
      return json({ recorded: true });
    },
  ],
  "GET /api/analytics/summary": [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list<{ name: string; createdAt: string }>(
        `analytics:${ctx.user!.userId}`,
        { limit: 200 },
      );
      const counts = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + 1;
        return acc;
      }, {});
      const lastEventAt =
        items
          .map((v) => String(v.createdAt || ""))
          .sort()
          .reverse()[0] || "";
      return json({ counts, lastEventAt, eventsTracked: items.length });
    },
  ],
  "GET /api/dashboard/intelligence": [
    requireAuth(),
    async (ctx) => {
      const userId = ctx.user!.userId;
      const [{ items: projects }, { items: clients }] = await Promise.all([
        db.list<Record<string, unknown>>(`projects:${userId}`, { limit: 160 }),
        db.list<ClientBody>(`clients:${userId}`, { limit: 100 }),
      ]);
      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).getTime();
      const previousStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      ).getTime();
      const current = projects.filter(
        (p) => new Date(String(p.createdAt || "")).getTime() >= monthStart,
      );
      const previous = projects.filter((p) => {
        const t = new Date(String(p.createdAt || "")).getTime();
        return t >= previousStart && t < monthStart;
      });
      const avg = (rows: Array<Record<string, unknown>>) =>
        rows.length
          ? Math.round(
              rows.reduce((sum, p) => sum + Number(p.score || 0), 0) /
                rows.length,
            )
          : null;
      const highRisk = projects.filter((p) => Number(p.score || 0) >= 70);
      const controlled = projects.filter((p) => Number(p.score || 0) < 40);
      const statusCounts = clients.reduce<Record<string, number>>((acc, c) => {
        const key = String(c.status || "Prospect");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const linkedClients = new Set(
        projects.map((p) => String(p.clientId || "")).filter(Boolean),
      );
      const dueFollowUps = clients.filter(
        (c) =>
          c.followUpDate &&
          String(c.followUpDate) <= now.toISOString().slice(0, 10) &&
          !["Won", "Lost"].includes(String(c.status || "")),
      ).length;
      const groundedClaims = projects.reduce(
        (sum, p) =>
          sum +
          Number(
            (p.groundingSummary as Record<string, unknown> | undefined)
              ?.grounded || 0,
          ),
        0,
      );
      const assumptions = projects.reduce(
        (sum, p) =>
          sum +
          Number(
            (p.groundingSummary as Record<string, unknown> | undefined)
              ?.assumptions || 0,
          ),
        0,
      );
      const trend = Array.from({ length: 6 }, (_, index) => {
        const start = new Date(
          now.getFullYear(),
          now.getMonth() - 5 + index,
          1,
        );
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        const rows = projects.filter((p) => {
          const t = new Date(String(p.createdAt || "")).getTime();
          return t >= start.getTime() && t < end.getTime();
        });
        return {
          label: start.toLocaleString("en-US", { month: "short" }),
          proposals: rows.length,
          averageRisk: avg(rows),
        };
      });
      const riskDistribution = {
        high: highRisk.length,
        medium: projects.filter(
          (p) => Number(p.score || 0) >= 40 && Number(p.score || 0) < 70,
        ).length,
        low: controlled.length,
      };
      const topRisk = [...projects]
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 5)
        .map((p) => ({
          id: String(p.id || ""),
          client: String(p.client || "Untitled opportunity"),
          score: Number(p.score || 0),
          summary: String(p.summary || ""),
          createdAt: String(p.createdAt || ""),
        }));
      const won = projects.filter((p) => p.dealStage === "Won");
      const lost = projects.filter((p) => p.dealStage === "Lost");
      const closed = [...won, ...lost];
      const openStages = [
        "Draft",
        "Proposal Ready",
        "Sent",
        "Follow-up",
        "Negotiation",
      ];
      const pipelineByStage = openStages.map((stage) => {
        const rows = projects.filter(
          (p) => String(p.dealStage || "Draft") === stage,
        );
        return {
          stage,
          count: rows.length,
          value:
            Math.round(
              rows.reduce(
                (sum, p) => sum + Math.max(0, Number(p.dealValue || 0)),
                0,
              ) * 100,
            ) / 100,
        };
      });
      const wonValue =
        Math.round(
          won.reduce(
            (sum, p) => sum + Math.max(0, Number(p.dealValue || 0)),
            0,
          ) * 100,
        ) / 100;
      const lostValue =
        Math.round(
          lost.reduce(
            (sum, p) => sum + Math.max(0, Number(p.dealValue || 0)),
            0,
          ) * 100,
        ) / 100;
      const openPipelineValue =
        Math.round(
          pipelineByStage.reduce((sum, row) => sum + row.value, 0) * 100,
        ) / 100;
      const accepted = projects.filter((p) => p.shareStatus === "accepted");
      const changesRequested = projects.filter(
        (p) => p.shareStatus === "changes_requested",
      );
      const shared = projects.filter((p) =>
        Boolean(p.shareCreatedAt || p.shareToken),
      );
      const decisionHours = projects
        .map((p) => {
          const start = new Date(String(p.shareCreatedAt || "")).getTime();
          const end = new Date(String(p.clientDecisionAt || "")).getTime();
          return start > 0 && end >= start ? (end - start) / 3600000 : null;
        })
        .filter((v): v is number => v !== null);
      const commercialPerformance = {
        closedDeals: closed.length,
        wonDeals: won.length,
        lostDeals: lost.length,
        winRate: closed.length
          ? Math.round((won.length / closed.length) * 1000) / 10
          : null,
        wonValue,
        lostValue,
        averageWonDealSize: won.length
          ? Math.round((wonValue / won.length) * 100) / 100
          : null,
        openPipelineValue,
        pipelineByStage,
        proposalDecisions: {
          shared: shared.length,
          accepted: accepted.length,
          changesRequested: changesRequested.length,
          acceptanceRate: shared.length
            ? Math.round((accepted.length / shared.length) * 1000) / 10
            : null,
          averageDecisionHours: decisionHours.length
            ? Math.round(
                (decisionHours.reduce((a, b) => a + b, 0) /
                  decisionHours.length) *
                  10,
              ) / 10
            : null,
        },
      };
      return json({
        generatedAt: now.toISOString(),
        totals: {
          proposals: projects.length,
          clients: clients.length,
          linkedClients: linkedClients.size,
          averageRisk: avg(projects),
          highRisk: highRisk.length,
          controlled: controlled.length,
          dueFollowUps,
          groundedClaims,
          assumptions,
        },
        month: {
          proposals: current.length,
          previousProposals: previous.length,
          averageRisk: avg(current),
          previousAverageRisk: avg(previous),
        },
        riskDistribution,
        statusCounts,
        trend,
        topRisk,
        commercialPerformance,
      });
    },
  ],
  "POST /api/analyze": [
    requireAuth(),
    async (ctx) => {
      const x = (ctx.body || {}) as AnalyzeBody;
      const brief = (x.brief || "").trim();
      const requested = x.proposalOptions || {};
      const allowedSections = [
        "Executive Summary",
        "Client Challenge & Desired Outcome",
        "Our Understanding",
        "Strategic Approach",
        "Detailed Scope of Work",
        "Deliverables & Acceptance Criteria",
        "Project Phases",
        "Timeline & Milestones",
        "Client Inputs & Responsibilities",
        "Team & Delivery Approach",
        "Revision & Feedback Process",
        "Quality Assurance",
        "Success Measures",
        "Investment & Payment",
        "Assumptions",
        "Exclusions",
        "Change Control",
        "Why Us",
        "Next Steps & Acceptance",
      ];
      const proposalMode = ["Concise", "Detailed", "Premium"].includes(
        String(requested.mode),
      )
        ? String(requested.mode)
        : "Detailed";
      const proposalSections = (requested.sections || allowedSections)
        .filter((v) => allowedSections.includes(String(v)))
        .slice(0, allowedSections.length);
      if (!proposalSections.length)
        return error("Choose at least one proposal section.", 400);
      if (brief.length < 40)
        return error("Please provide a more detailed brief.", 400);
      if (brief.length > 12000) return error("Brief is too long.", 400);
      const p = await getProfile(ctx.user!.userId);
      if (!p?.onboarded) return error("Complete account setup first.", 403);
      const ownerTest = hasOwnerTestAccess(ctx.user!.email);
      if (!ownerTest && !p.checkoutStartedAt)
        return error(
          "Start your Square subscription checkout to activate the trial.",
          402,
        );
      try {
        const lastVerified = p.billingVerifiedAt
          ? new Date(p.billingVerifiedAt).getTime()
          : 0;
        const verificationStale = Date.now() - lastVerified > 15 * 60 * 1000;
        if (
          !ownerTest &&
          (p.billingStatus !== "verified_active" || verificationStale)
        ) {
          const sub = await verifyEntitlement(p);
          const chargedThroughDate = String(
            sub?.charged_through_date || p.chargedThroughDate || "",
          );
          const paymentRecovery =
            p.billingStatus === "payment_failed" &&
            billingDateAdvanced(p.chargedThroughDate, chargedThroughDate);
          if (
            !sub ||
            sub.status !== "ACTIVE" ||
            (p.billingStatus === "payment_failed" && !paymentRecovery)
          ) {
            if (p.billingStatus === "verified_active") {
              const revoked = {
                ...p,
                billingStatus: sub
                  ? `square_${sub.status.toLowerCase()}`
                  : "square_not_found",
                billingVerifiedAt: new Date().toISOString(),
              };
              delete (revoked as { id?: string }).id;
              await db.update(`profiles:${ctx.user!.userId}`, [
                { id: p.id, record: revoked },
              ]);
            }
            return error(
              "An active Square subscription is required before generating proposals. Open Plan & billing to verify your subscription.",
              402,
            );
          }
          const trialStart =
            p.trialStartedAt ||
            (sub.start_date
              ? `${sub.start_date}T00:00:00.000Z`
              : new Date().toISOString());
          const updated = {
            ...p,
            plan: sub.plan,
            billingStatus: "verified_active",
            trialStartedAt: trialStart,
            trialEndsAt:
              p.trialEndsAt ||
              new Date(
                new Date(trialStart).getTime() + 30 * 86400000,
              ).toISOString(),
            squareSubscriptionId: sub.id,
            billingVerifiedAt: new Date().toISOString(),
            chargedThroughDate,
            billingAction: "",
          };
          delete (updated as { id?: string }).id;
          await db.update(`profiles:${ctx.user!.userId}`, [
            { id: p.id, record: updated },
          ]);
          await bindSubscriptionOwner(sub.id, ctx.user!.userId, p.id);
          Object.assign(p, updated);
        }
      } catch {
        return error(
          "Your Square subscription could not be verified. Use Plan & billing to sync it.",
          402,
        );
      }
      const { items: month } = await db.list(`projects:${ctx.user!.userId}`, {
        limit: 160,
      });
      const cutoff = new Date();
      cutoff.setDate(1);
      cutoff.setHours(0, 0, 0, 0);
      const used = month.filter(
        (v) => new Date(String(v.createdAt)).getTime() >= cutoff.getTime(),
      ).length;
      const max = ownerTest ? 1000000 : limits[p.plan] || 10;
      if (used >= max)
        return error(
          `Your ${p.plan} monthly limit has been reached. Upgrade to continue.`,
          402,
        );
      let websiteContext = "";
      if (p.website && /^https?:\/\//i.test(p.website)) {
        try {
          const s = await ai.scrape({ url: p.website });
          if (s.status < 400) websiteContext = s.text.slice(0, 7000);
        } catch (e) {
          console.warn("Website context unavailable", e);
        }
      }
      let clientContext = "";
      if (x.clientId) {
        const [savedClient] = await db.get<ClientBody>(
          `clients:${ctx.user!.userId}`,
          [String(x.clientId)],
        );
        if (savedClient) {
          clientContext = [
            `Contact: ${savedClient.name || ""}`,
            `Company: ${savedClient.company || ""}`,
            `Industry: ${savedClient.industry || ""}`,
            `Relationship status: ${savedClient.status || ""}`,
            `Goals: ${savedClient.goals || ""}`,
            `Preferences: ${savedClient.preferences || ""}`,
            `Decision makers: ${savedClient.decisionMakers || ""}`,
            `Relationship notes: ${savedClient.notes || ""}`,
            `Next step: ${savedClient.nextStep || ""}`,
          ]
            .filter((line) => !line.endsWith(": "))
            .join("\\n");
        }
      }
      let fileContext = "";
      let proposalKnowledge: Array<KnowledgeRecord & { id: string }> = [];
      try {
        const { items: knowledge } = await db.list<KnowledgeRecord>(
          `knowledge:${ctx.user!.userId}`,
          { limit: 200 },
        );
        const activeKnowledge = knowledge.filter((v) => v.active !== false);
        const retrievalQuery = [
          brief,
          x.client || "",
          x.budget || "",
          x.timeline || "",
          clientContext,
        ].join(" ");
        const selectedKnowledge = rankKnowledge(
          activeKnowledge,
          retrievalQuery,
        );
        proposalKnowledge = selectedKnowledge;
        if (selectedKnowledge.length) {
          fileContext = selectedKnowledge
            .map(
              (v) =>
                `[KNOWLEDGE_ID:${v.id}] [${v.category}] ${v.fact} (source: ${v.sourceFileName})`,
            )
            .join("\n");
        } else {
          const { items: files } = await db.list<KnowledgeFileRecord>(
            `files:${ctx.user!.userId}`,
            { limit: 12 },
          );
          const ready = files
            .filter(
              (f) =>
                f.status === "ready" && String(f.extractedText || "").trim(),
            )
            .slice(0, 6);
          const legacy = files
            .filter((f) => !f.status && /\.(txt|md)$/i.test(f.name))
            .slice(0, Math.max(0, 6 - ready.length));
          const legacyRead = legacy.length
            ? await storage.read(legacy.map((f) => f.path))
            : [];
          const contexts = [
            ...ready.map((f) => {
              if (f.intelligenceStatus === "ready" && f.intelligence) {
                const k = f.intelligence;
                return `SOURCE FILE: ${f.name}\nDOCUMENT TYPE: ${k.documentType}\nSUMMARY: ${k.summary}\nSERVICES: ${k.services.join(" | ") || "None stated"}\nDIFFERENTIATORS: ${k.differentiators.join(" | ") || "None stated"}\nDELIVERABLES: ${k.deliverables.join(" | ") || "None stated"}\nPRICING EVIDENCE: ${k.pricingEvidence.join(" | ") || "None stated"}\nTIMELINES: ${k.timelines.join(" | ") || "None stated"}\nPROCESSES: ${k.processes.join(" | ") || "None stated"}\nCONSTRAINTS: ${k.constraints.join(" | ") || "None stated"}\nEXCLUSIONS: ${k.exclusions.join(" | ") || "None stated"}\nPROOF POINTS: ${k.proofPoints.join(" | ") || "None stated"}\nCLIENT/PROJECT FACTS: ${k.clientFacts.join(" | ") || "None stated"}`;
              }
              return `${f.name}: ${String(f.extractedText || "").slice(0, 5000)}`;
            }),
            ...legacyRead.map(
              (f, i) =>
                `${legacy[i].name}: ${(f.content || "").slice(0, 5000)}`,
            ),
          ];
          fileContext = contexts.join("\n\n");
        }
      } catch (e) {
        console.warn("Knowledge context unavailable", e);
      }
      try {
        const r = await ai.generate({
          system:
            "You are ScopeVanta, an elite B2B sales strategist, scope architect, commercial proposal director and delivery-risk reviewer for service businesses. Your job is to help the seller win the right deal without winning unprofitable work. Diagnose buyer priorities, decision friction, scope ambiguity, delivery dependencies, margin exposure and negotiation leverage before writing. Never fabricate facts, credentials, testimonials, pricing, quantities or guarantees. Separate confirmed facts from assumptions. Unknown requirements must be explicitly marked To be confirmed. Prefer precise commitments, measurable acceptance criteria and buyer-friendly language over generic marketing copy. Every recommendation must improve win probability, commercial clarity or margin protection.",
          prompt: `SELLER: ${p.company}\nEXPERTISE: ${p.expertise}\nWEBSITE: ${websiteContext || "Not available"}\nKNOWLEDGE FILES: ${fileContext || "No readable text files supplied"}\nCLIENT: ${x.client || "Not provided"}\nSAVED CLIENT CONTEXT: ${clientContext || "No saved client context"}\nBUDGET: ${x.budget || "Not provided"}\nTIMELINE: ${x.timeline || "Not provided"}\nBRIEF: ${brief}\n\nPROPOSAL MODE: ${proposalMode}\nINCLUDE ONLY THESE CLIENT-FACING SECTIONS: ${proposalSections.join(" | ")}\nVISUALS REQUESTED: ${requested.includeVisuals ? "Yes" : "No"}\n\nReturn ONLY JSON: score integer 0-100 where higher means greater scope/commercial risk; summary 2 sentences that state the opportunity and the biggest commercial issue; risks 5-7 specific items prioritized by impact; questions 5-8 high-value clarification questions that materially change scope, price, timeline, acceptance or buying confidence; proposal client-ready plain text containing only the requested sections; grounding array; visuals array. Each grounding item must contain claim, kind, sourceRecordIds, confidence. kind must be seller_fact, client_fact, assumption, or strategy. For seller_fact, cite only KNOWLEDGE_ID values that directly support that exact claim; never cite a merely related fact. client_fact is information supplied in the client brief, client field, budget or timeline and uses no knowledge IDs. assumption is an explicit proposal assumption or To be confirmed item and uses no knowledge IDs. strategy is ScopeVanta advice/recommended framing rather than a factual claim and uses no knowledge IDs. confidence must respectively be grounded, client_supplied, assumption, or recommendation. Include the material factual/assumption/strategy claims used in the proposal, capped at 30 grounding items. Each visual object must contain type, title, labels string array and values number array. If visuals were not requested, return an empty visuals array. If visuals are requested, create at most 3 useful charts only from numeric facts actually supplied in the brief, budget or timeline; never invent chart data. If there is insufficient numeric data, return an empty visuals array. Before drafting, internally distinguish confirmed scope, assumptions, dependencies, exclusions, acceptance criteria, buyer outcomes and unresolved decisions. Do not expose chain-of-thought. Honor the requested section list exactly: omit unselected client-facing sections rather than silently adding them. In Concise mode keep selected sections tight and decision-oriented; Detailed mode should be operationally specific; Premium mode should be polished and executive-ready while remaining factual. Make the opening buyer-focused and specific to the stated problem. Translate deliverables into buyer outcomes without inventing ROI. Scope deliverables with enough specificity that a delivery team could understand what is included. Where quantities, platforms, revision counts, integrations, content responsibilities or approval timing are unknown, write To be confirmed instead of guessing. Investment must use the supplied budget only when it is clearly a confirmed project price; otherwise label pricing To be confirmed and explain the pricing basis needed. Timeline must distinguish target dates from dependencies. Acceptance criteria must be observable. Assumptions and exclusions must actively prevent scope creep. Change control must define how out-of-scope requests are identified, estimated and approved before work begins. WHY section may use only seller facts supplied in profile, website or knowledge context. Finish with a concrete, low-friction next step and acceptance path. Avoid filler, hype, repeated ideas and generic AI-sounding language.`,
          maxTokens: 7600,
          temperature: 0.2,
          thinkingMode: "FAST",
        });
        const clean = r.text
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const out = JSON.parse(clean) as {
          score: number;
          summary: string;
          risks: string[];
          questions: string[];
          proposal: string;
          grounding?: Array<{
            claim: string;
            kind: string;
            sourceRecordIds?: string[];
            confidence?: string;
          }>;
          visuals?: Array<{
            type: string;
            title: string;
            labels: string[];
            values: number[];
          }>;
        };
        if (
          typeof out.score !== "number" ||
          !out.summary ||
          !Array.isArray(out.risks) ||
          !Array.isArray(out.questions) ||
          !out.proposal
        )
          return error("Incomplete analysis. Please retry.", 502);
        const knowledgeById = new Map(proposalKnowledge.map((v) => [v.id, v]));
        const grounding: GroundingItem[] = (
          Array.isArray(out.grounding) ? out.grounding : []
        )
          .slice(0, 30)
          .map((item) => {
            const kind = [
              "seller_fact",
              "client_fact",
              "assumption",
              "strategy",
            ].includes(String(item.kind))
              ? (String(item.kind) as GroundingItem["kind"])
              : "strategy";
            const ids =
              kind === "seller_fact"
                ? (item.sourceRecordIds || [])
                    .map(String)
                    .filter((id) => knowledgeById.has(id))
                    .slice(0, 8)
                : [];
            const files = Array.from(
              new Set(
                ids
                  .map((id) => knowledgeById.get(id)?.sourceFileName || "")
                  .filter(Boolean),
              ),
            );
            const confidence: GroundingItem["confidence"] =
              kind === "seller_fact"
                ? "grounded"
                : kind === "client_fact"
                  ? "client_supplied"
                  : kind === "assumption"
                    ? "assumption"
                    : "recommendation";
            return {
              claim: String(item.claim || "")
                .trim()
                .slice(0, 2000),
              kind,
              sourceRecordIds: ids,
              sourceFiles: files,
              confidence,
            };
          })
          .filter(
            (item) =>
              item.claim &&
              (item.kind !== "seller_fact" || item.sourceRecordIds.length > 0),
          );
        const groundingSummary = {
          grounded: grounding.filter((v) => v.kind === "seller_fact").length,
          clientSupplied: grounding.filter((v) => v.kind === "client_fact")
            .length,
          assumptions: grounding.filter((v) => v.kind === "assumption").length,
          recommendations: grounding.filter((v) => v.kind === "strategy")
            .length,
        };
        const record = {
          client: String(x.client || "Untitled opportunity").slice(0, 200),
          clientId: String(x.clientId || ""),
          brief,
          score: Math.max(0, Math.min(100, Math.round(out.score))),
          summary: out.summary,
          risks: out.risks.slice(0, 7),
          questions: out.questions.slice(0, 8),
          proposal: out.proposal,
          grounding,
          groundingSummary,
          visuals: Array.isArray(out.visuals) ? out.visuals.slice(0, 3) : [],
          proposalOptions: {
            mode: proposalMode,
            sections: proposalSections,
            includeSellerLogo: Boolean(requested.includeSellerLogo),
            includeClientLogo: Boolean(requested.includeClientLogo),
            includeVisuals: Boolean(requested.includeVisuals),
          },
          budget: String(x.budget || ""),
          timeline: String(x.timeline || ""),
          status: "Draft",
          version: 1,
          createdAt: new Date().toISOString(),
        };
        const [id] = await db.add(`projects:${ctx.user!.userId}`, [record]);
        return json({
          ...record,
          projectId: id || undefined,
          usage: { used: used + 1, limit: max },
        });
      } catch (e) {
        console.error("ScopeVanta analysis failed", e);
        return error("Analysis service temporarily unavailable.", 502);
      }
    },
  ],
  "POST /api/projects/:id/refine": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as RefineBody;
      const projectId = String(ctx.params.id || b.projectId || "");
      if (!projectId) return error("Project is required.", 400);
      const [project] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [projectId],
      );
      if (!project) return error("Proposal not found.", 404);
      const questions = Array.isArray(project.questions)
        ? project.questions.map(String).slice(0, 8)
        : [];
      const answers = (b.answers || []).map((v) =>
        String(v || "")
          .trim()
          .slice(0, 2500),
      );
      if (!questions.length)
        return error(
          "This proposal has no clarification questions to resolve.",
          400,
        );
      if (!answers.some(Boolean))
        return error(
          "Answer at least one clarification question before refining.",
          400,
        );
      const p = await getProfile(ctx.user!.userId);
      if (!p) return error("Complete profile first.", 400);
      const requested = b.proposalOptions || project.proposalOptions || {};
      const resolved = questions
        .map(
          (q: string, i: number) =>
            `${i + 1}. ${q}\nAnswer: ${answers[i] || "Not answered — keep To be confirmed"}`,
        )
        .join("\n\n");
      try {
        const r = await ai.generate({
          system:
            "You are ScopeVanta, an elite B2B proposal director and scope architect. Refine an existing proposal using seller-supplied clarification answers. Treat answers as authoritative only for the question they address. Never invent facts, quantities, prices, credentials, dates or guarantees. Preserve unresolved items as To be confirmed. Improve buyer clarity and margin protection without adding unsupported claims.",
          prompt: `SELLER: ${p.company}\nCLIENT: ${String(project.client || "Not provided")}\nORIGINAL BRIEF: ${String(project.brief || "")}\nBUDGET: ${String(project.budget || "Not provided")}\nTIMELINE: ${String(project.timeline || "Not provided")}\n\nCLARIFICATIONS:\n${resolved}\n\nPROPOSAL CUSTOMIZATION: ${JSON.stringify(requested)}\nKeep only the selected proposal sections, preserve the requested Concise/Detailed/Premium style, and include chart suggestions only when includeVisuals is true and supported by real numeric facts.\n\nCURRENT PROPOSAL:\n${String(project.proposal || "")}\n\nReturn ONLY JSON with summary (2 sentences), risks (array of 3-7 remaining material risks), proposal (complete revised client-ready proposal), grounding (array of material claims), visuals (array of at most 3 objects with type, title, labels and numeric values; empty when not requested or unsupported). Each grounding item must contain claim and kind. kind must be seller_fact, client_fact, assumption, or strategy. Preserve existing seller_fact sourceRecordIds only when the revised claim is still directly supported by the same persisted knowledge record; client_fact includes facts from the original brief, budget, timeline or clarification answers; assumption is an explicit assumption or To be confirmed item; strategy is ScopeVanta recommendation rather than fact. Reconcile the clarification answers throughout scope, deliverables, acceptance criteria, phases, timeline, client responsibilities, investment, assumptions, exclusions and change control. Remove resolved ambiguity, but do not silently resolve unanswered questions. Keep the proposal persuasive, specific and concise enough to be usable.`,
          maxTokens: 7600,
          temperature: 0.15,
          thinkingMode: "FAST",
        });
        const clean = r.text
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const out = JSON.parse(clean) as {
          summary: string;
          risks: string[];
          proposal: string;
          grounding?: Array<{ claim: string; kind: string }>;
          visuals?: Array<{
            type: string;
            title: string;
            labels: string[];
            values: number[];
          }>;
        };
        if (!out.summary || !Array.isArray(out.risks) || !out.proposal)
          return error("Incomplete refinement. Please retry.", 502);
        const previousGrounding = Array.isArray(project.grounding)
          ? (project.grounding as GroundingItem[])
          : [];
        const grounding: GroundingItem[] = (
          Array.isArray(out.grounding) ? out.grounding : []
        )
          .slice(0, 30)
          .map((item) => {
            const kind = [
              "seller_fact",
              "client_fact",
              "assumption",
              "strategy",
            ].includes(String(item.kind))
              ? (String(item.kind) as GroundingItem["kind"])
              : "strategy";
            const claim = String(item.claim || "")
              .trim()
              .slice(0, 2000);
            if (kind === "seller_fact") {
              const prior = previousGrounding.find(
                (v) =>
                  v.kind === "seller_fact" &&
                  v.claim.toLowerCase() === claim.toLowerCase() &&
                  v.sourceRecordIds?.length,
              );
              return prior ? { ...prior, claim } : null;
            }
            const confidence: GroundingItem["confidence"] =
              kind === "client_fact"
                ? "client_supplied"
                : kind === "assumption"
                  ? "assumption"
                  : "recommendation";
            return {
              claim,
              kind,
              sourceRecordIds: [],
              sourceFiles: [],
              confidence,
            };
          })
          .filter((item): item is GroundingItem => Boolean(item?.claim));
        const groundingSummary = {
          grounded: grounding.filter((v) => v.kind === "seller_fact").length,
          clientSupplied: grounding.filter((v) => v.kind === "client_fact")
            .length,
          assumptions: grounding.filter((v) => v.kind === "assumption").length,
          recommendations: grounding.filter((v) => v.kind === "strategy")
            .length,
        };
        const version = Number(project.version || 1) + 1;
        const refinedAt = new Date().toISOString();
        const snapshot = {
          projectId,
          version: Number(project.version || 1),
          proposal: String(project.proposal || ""),
          summary: String(project.summary || ""),
          risks: Array.isArray(project.risks) ? project.risks : [],
          grounding: Array.isArray(project.grounding) ? project.grounding : [],
          groundingSummary: project.groundingSummary || {},
          visuals: Array.isArray(project.visuals) ? project.visuals : [],
          proposalOptions: project.proposalOptions || {},
          clarificationAnswers: Array.isArray(project.clarificationAnswers)
            ? project.clarificationAnswers
            : [],
          savedAt: String(project.updatedAt || project.createdAt || refinedAt),
          status: String(project.status || "Draft"),
          revisionSource: "pre_refinement",
        };
        const [snapshotId] = await db.add(
          `proposal-versions:${ctx.user!.userId}:${projectId}`,
          [snapshot],
        );
        if (!snapshotId)
          return error(
            "Could not preserve the current proposal before refinement.",
            500,
          );
        const audit = Array.isArray(project.commercialAudit)
          ? project.commercialAudit.slice(-39)
          : [];
        audit.push({
          at: refinedAt,
          type: "proposal_refined",
          detail: `Proposal advanced to version ${version}; downstream commercial guidance marked stale.`,
        });
        const record = {
          ...project,
          summary: out.summary,
          risks: out.risks.slice(0, 7),
          proposal: out.proposal,
          grounding,
          groundingSummary,
          visuals: Array.isArray(out.visuals) ? out.visuals.slice(0, 3) : [],
          proposalOptions: requested,
          clarificationAnswers: answers,
          winPlan: undefined,
          winPlanUpdatedAt: "",
          closeCoach: undefined,
          nextBestAction: "Rebuild Opportunity Lab after proposal changes.",
          commercialLabStale: true,
          commercialAudit: audit,
          evidenceStatus: "current",
          version,
          status: "Refined draft",
          updatedAt: refinedAt,
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id: projectId, record },
        ]);
        if (!ok) {
          await db.delete(
            `proposal-versions:${ctx.user!.userId}:${projectId}`,
            [snapshotId],
          );
          return error("Could not save refined proposal.", 500);
        }
        return json({ ...record, projectId });
      } catch (e) {
        console.error("ScopeVanta proposal refinement failed", e);
        return error("Proposal refinement is temporarily unavailable.", 502);
      }
    },
  ],
  "GET /api/commercial/rates": [
    requireAuth(),
    async (ctx) => {
      const { items } = await db.list<Record<string, any>>(
        `rates:${ctx.user!.userId}`,
        { limit: 100 },
      );
      return json({ rates: items });
    },
  ],
  "POST /api/commercial/rates": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as {
        name?: string;
        costRate?: number;
        sellRate?: number;
        overheadPct?: number;
      };
      const name = String(b.name || "").trim();
      if (name.length < 2)
        return error("Role or service name is required.", 400);
      const record = {
        name,
        costRate: Math.max(0, Number(b.costRate || 0)),
        sellRate: Math.max(0, Number(b.sellRate || 0)),
        overheadPct: Math.min(100, Math.max(0, Number(b.overheadPct || 0))),
        createdAt: new Date().toISOString(),
      };
      const [id] = await db.add(`rates:${ctx.user!.userId}`, [record]);
      if (!id) return error("Could not save rate.", 500);
      return json({ rate: { id, ...record } }, 201);
    },
  ],
  "DELETE /api/commercial/rates/:id": [
    requireAuth(),
    async (ctx) => {
      const [ok] = await db.delete(`rates:${ctx.user!.userId}`, [
        String(ctx.params.id || ""),
      ]);
      return ok ? json({ deleted: true }) : error("Rate not found.", 404);
    },
  ],
  "POST /api/projects/:id/scope-economics": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const b = (ctx.body || {}) as {
        lines?: Array<{
          name?: string;
          role?: string;
          qty?: number;
          hours?: number;
          costRate?: number;
          sellRate?: number;
          acceptance?: string;
        }>;
        targetMargin?: number;
        floorMargin?: number;
        contingencyPct?: number;
        syncProposal?: boolean;
      };
      const lines = (Array.isArray(b.lines) ? b.lines : [])
        .slice(0, 120)
        .map((v) => ({
          name: String(v.name || "Untitled deliverable").slice(0, 180),
          role: String(v.role || "").slice(0, 120),
          qty: Math.max(0, Number(v.qty || 1)),
          hours: Math.max(0, Number(v.hours || 0)),
          costRate: Math.max(0, Number(v.costRate || 0)),
          sellRate: Math.max(0, Number(v.sellRate || 0)),
          acceptance: String(v.acceptance || "").slice(0, 500),
        }));
      if (!lines.length) return error("Add at least one scope line.", 400);
      const targetMargin = Math.min(
        90,
        Math.max(
          0,
          Number(b.targetMargin ?? p.commercialInputs?.targetMargin ?? 35),
        ),
      );
      const floorMargin = Math.min(
        targetMargin,
        Math.max(0, Number(b.floorMargin ?? 20)),
      );
      const contingencyPct = Math.min(
        100,
        Math.max(0, Number(b.contingencyPct ?? 10)),
      );
      const hours =
        Math.round(lines.reduce((s, v) => s + v.qty * v.hours, 0) * 100) / 100;
      const baseCost =
        Math.round(
          lines.reduce((s, v) => s + v.qty * v.hours * v.costRate, 0) * 100,
        ) / 100;
      const riskAdjustedCost =
        Math.round(baseCost * (1 + contingencyPct / 100) * 100) / 100;
      const floorPrice =
        riskAdjustedCost && floorMargin < 100
          ? Math.round((riskAdjustedCost / (1 - floorMargin / 100)) * 100) / 100
          : 0;
      const recommendedPrice =
        riskAdjustedCost && targetMargin < 100
          ? Math.round((riskAdjustedCost / (1 - targetMargin / 100)) * 100) /
            100
          : 0;
      const modeledSell =
        Math.round(
          lines.reduce((s, v) => s + v.qty * v.hours * v.sellRate, 0) * 100,
        ) / 100;
      const price = Math.max(recommendedPrice, modeledSell);
      const marginPct = price
        ? Math.round(((price - riskAdjustedCost) / price) * 1000) / 10
        : 0;
      const scenarios = [
        {
          name: "Lean",
          price: floorPrice,
          hours,
          marginPct: floorPrice
            ? Math.round(
                ((floorPrice - riskAdjustedCost) / floorPrice) * 1000,
              ) / 10
            : 0,
          tradeoff:
            "Protect the floor margin; remove or defer scope rather than discount below this economics.",
        },
        {
          name: "Recommended",
          price,
          hours,
          marginPct,
          tradeoff: "Current engineered scope at target economics.",
        },
        {
          name: "Premium",
          price: Math.round(price * 1.2 * 100) / 100,
          hours: Math.round(hours * 1.1 * 100) / 100,
          marginPct:
            Math.round(
              ((price * 1.2 - riskAdjustedCost * 1.1) / (price * 1.2)) * 1000,
            ) / 10,
          tradeoff:
            "Use added value, service depth or speed only when explicitly included in scope.",
        },
      ];
      const commercialSummary = `\n\nCOMMERCIAL SCOPE SUMMARY\n${lines.map((v) => `- ${v.name}: ${v.qty} × ${v.hours}h${v.acceptance ? ` · Acceptance: ${v.acceptance}` : ""}`).join("\n")}\nEstimated effort: ${hours} hours\nRisk-adjusted delivery cost: ${riskAdjustedCost.toFixed(2)}\nRecommended investment: ${price.toFixed(2)}\nTarget gross margin: ${targetMargin}%\nContingency: ${contingencyPct}%`;
      const proposal = Boolean(b.syncProposal)
        ? String(p.proposal || "").replace(
            /\n\nCOMMERCIAL SCOPE SUMMARY[\s\S]*$/,
            "",
          ) + commercialSummary
        : p.proposal;
      const now = new Date().toISOString();
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: now,
        type: "scope_economics",
        detail: `Editable scope saved · ${lines.length} lines · ${hours}h · ${price.toFixed(0)} recommended · ${marginPct}% modeled margin.`,
      });
      const record = {
        ...p,
        estimateLines: lines,
        estimateSummary: {
          estimatedHours: hours,
          estimatedCost: riskAdjustedCost,
          estimatedPrice: price,
          estimatedMarginPct: marginPct,
          baseCost,
          floorPrice,
          targetMargin,
          floorMargin,
          contingencyPct,
        },
        dealScenarios: scenarios,
        proposal,
        commercialLabStale: true,
        commercialAudit: audit,
        nextBestAction:
          "Review the three commercial scenarios, then sync/recalculate downstream intelligence before sharing.",
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Could not save scope economics.", 500);
      return json({ project: { id, ...record }, scenarios });
    },
  ],
  "POST /api/projects/:id/commercial-state": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const b = (ctx.body || {}) as {
        estimateLines?: Array<{
          name?: string;
          role?: string;
          qty?: number;
          hours?: number;
          costRate?: number;
          sellRate?: number;
        }>;
        actualRevenue?: number;
        actualCost?: number;
        actualHours?: number;
        clientRequest?: string;
      };
      const lines = (Array.isArray(b.estimateLines) ? b.estimateLines : [])
        .slice(0, 100)
        .map((v) => ({
          name: String(v.name || "Untitled item").slice(0, 180),
          role: String(v.role || "").slice(0, 120),
          qty: Math.max(0, Number(v.qty || 1)),
          hours: Math.max(0, Number(v.hours || 0)),
          costRate: Math.max(0, Number(v.costRate || 0)),
          sellRate: Math.max(0, Number(v.sellRate || 0)),
        }));
      const estimatedHours =
        Math.round(lines.reduce((s, v) => s + v.qty * v.hours, 0) * 100) / 100;
      const estimatedCost =
        Math.round(
          lines.reduce((s, v) => s + v.qty * v.hours * v.costRate, 0) * 100,
        ) / 100;
      const estimatedPrice =
        Math.round(
          lines.reduce((s, v) => s + v.qty * v.hours * v.sellRate, 0) * 100,
        ) / 100;
      const estimatedMarginPct = estimatedPrice
        ? Math.round(
            ((estimatedPrice - estimatedCost) / estimatedPrice) * 1000,
          ) / 10
        : 0;
      const actualRevenue = Math.max(0, Number(b.actualRevenue || 0));
      const actualCost = Math.max(0, Number(b.actualCost || 0));
      const actualHours = Math.max(0, Number(b.actualHours || 0));
      const actualMarginPct = actualRevenue
        ? Math.round(((actualRevenue - actualCost) / actualRevenue) * 1000) / 10
        : 0;
      const now = new Date().toISOString();
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: now,
        type: "commercial_state",
        detail: `Estimate updated · ${estimatedHours}h · ${estimatedMarginPct}% modeled margin${actualHours ? ` · ${actualHours} actual hours` : ""}.`,
      });
      const record = {
        ...p,
        estimateLines: lines,
        estimateSummary: {
          estimatedHours,
          estimatedCost,
          estimatedPrice,
          estimatedMarginPct,
        },
        actualRevenue,
        actualCost: actualCost || p.actualCost || 0,
        actualHours: actualHours || p.actualHours || 0,
        actualMarginPct,
        clientRequestInbox: String(
          b.clientRequest || p.clientRequestInbox || "",
        ).slice(0, 10000),
        commercialAudit: audit,
        commercialLabStale: true,
        nextBestAction:
          "Recalculate Opportunity Lab so scope, pricing, feasibility and negotiation reflect the latest estimate.",
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Could not save commercial state.", 500);
      return json({ project: { id, ...record } });
    },
  ],
  "POST /api/projects/:id/commercial-autopilot": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const history = (
        await db.list<Record<string, any>>(`projects:${ctx.user!.userId}`, {
          limit: 80,
        })
      ).items
        .filter((v) => v.id !== id)
        .slice(0, 40);
      const comparable = history
        .map((v) => ({
          id: v.id,
          client: v.client,
          stage: v.dealStage || "Draft",
          score: Number(v.score || 0),
          estimatedHours: Number(
            v.estimateSummary?.estimatedHours ||
              v.commercialLab?.pricing?.estimatedHours ||
              0,
          ),
          actualHours: Number(v.actualHours || 0),
          estimatedCost: Number(v.estimateSummary?.estimatedCost || 0),
          actualCost: Number(v.actualCost || 0),
          value: Number(v.dealValue || 0),
        }))
        .filter((v) => v.actualHours || v.actualCost)
        .slice(0, 8);
      try {
        const r = await ai.generate({
          system:
            "You are ScopeVanta Commercial Autopilot. Recommend actions from supplied evidence only. Never invent client intent, capacity, costs, results or contractual status. Similar projects are descriptive references, not predictions.",
          prompt: `CURRENT OPPORTUNITY: ${JSON.stringify({ client: p.client, brief: p.brief, score: p.score, risks: p.risks, questions: p.questions, dealStage: p.dealStage, dealValue: p.dealValue, commercialLab: p.commercialLab, estimateSummary: p.estimateSummary, actualHours: p.actualHours, actualCost: p.actualCost, scopeBaseline: p.scopeBaseline, lastClientRequest: p.clientRequestInbox || p.lastChangeRequest, proposalVersion: p.version, shareStatus: p.shareStatus }).slice(0, 30000)}\nCOMPARABLE COMPLETED RECORDS: ${JSON.stringify(comparable).slice(0, 10000)}\nReturn ONLY JSON: autopilot {actions:Array<{priority:number,action:string,why:string,evidence:string,module:string}>,blockers:string[]}; calibration {estimatedVsActualSignals:string[],suggestedAdjustment:string}; redline {baseline:string[],requested:string[],commercialImpact:string[]}; negotiationScenarios:Array<{name:string,price:number,scopeTrade:string,marginImpact:string}>; handoff {status:string,agreedScope:string[],commercialTerms:string[],openItems:string[]}; similarity Array<{label:string,reason:string,estimatedVsActual:string}>; profitability {quotedValue:number,estimatedCost:number,actualCost:number,forecastCost:number,estimatedMarginPct:number,actualMarginPct:number,scopeAdded:string[],changeOrders:string[]}. Cap actions 6, similarities 5, negotiation scenarios 4. If data is absent say To be confirmed or return empty arrays.`,
          maxTokens: 5200,
          temperature: 0.15,
          thinkingMode: "FAST",
        });
        const intelligence = JSON.parse(
          r.text
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim(),
        );
        const now = new Date().toISOString();
        const audit = Array.isArray(p.commercialAudit)
          ? p.commercialAudit.slice(-39)
          : [];
        audit.push({
          at: now,
          type: "commercial_autopilot",
          detail:
            "Autopilot, calibration, redline, similarity and profitability intelligence refreshed.",
        });
        const record = {
          ...p,
          commercialAutopilot: intelligence,
          commercialAudit: audit,
          commercialAutopilotAt: now,
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id, record },
        ]);
        if (!ok) return error("Could not save Commercial Autopilot.", 500);
        return json({ project: { id, ...record }, intelligence });
      } catch (e) {
        console.error("Commercial Autopilot failed", e);
        return error("Commercial Autopilot is temporarily unavailable.", 502);
      }
    },
  ],
  "POST /api/projects/:id/commercial-lab": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const b = (ctx.body || {}) as {
        internalRate?: number;
        targetMargin?: number;
        teamCapacityHours?: number;
        actualHours?: number;
        actualCost?: number;
        changeRequest?: string;
        negotiationMessage?: string;
        scenarioPrice?: number;
        scenarioHours?: number;
      };
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const profile = await getProfile(ctx.user!.userId);
      if (!profile) return error("Complete profile first.", 400);
      const internalRate = Math.max(0, Number(b.internalRate || 0));
      const targetMargin = Math.min(
        90,
        Math.max(0, Number(b.targetMargin || 35)),
      );
      const teamCapacityHours = Math.max(0, Number(b.teamCapacityHours || 0));
      const history = (
        await db.list<Record<string, any>>(`projects:${ctx.user!.userId}`, {
          limit: 80,
        })
      ).items
        .filter((v) => v.id !== id)
        .slice(0, 40)
        .map((v) => ({
          stage: v.dealStage || "Draft",
          value: Number(v.dealValue || 0),
          reason: v.outcomeReason || "",
          score: Number(v.score || 0),
          actualHours: Number(v.actualHours || 0),
          actualCost: Number(v.actualCost || 0),
          estimatedHours: Number(v.commercialLab?.pricing?.estimatedHours || 0),
        }));
      try {
        const r = await ai.generate({
          system:
            "You are ScopeVanta Commercial Intelligence. Engineer profitable, winnable service scopes from supplied facts. Never invent client requirements, team capacity, historical performance, rates, ROI or acceptance. Mark missing facts To be confirmed. Historical patterns are descriptive hints only. Distinguish included, ambiguous and out-of-scope work. Negotiation advice must protect value and scope rather than defaulting to discounting.",
          prompt: `SELLER: ${profile.company}\nEXPERTISE: ${profile.expertise}\nCLIENT: ${p.client}\nBRIEF: ${p.brief}\nPROPOSAL: ${String(p.proposal || "").slice(0, 26000)}\nRISKS: ${(p.risks || []).join(" | ")}\nQUESTIONS: ${(p.questions || []).join(" | ")}\nBUDGET: ${p.budget || "Not provided"}\nTIMELINE: ${p.timeline || "Not provided"}\nINTERNAL COST/RATE PER HOUR: ${internalRate || "Not provided"}\nTARGET GROSS MARGIN %: ${targetMargin}\nAVAILABLE DELIVERY HOURS: ${teamCapacityHours || "Not provided"}\nACTUAL HOURS IF COMPLETED: ${Number(b.actualHours || 0) || "Not provided"}\nACTUAL COST IF COMPLETED: ${Number(b.actualCost || 0) || "Not provided"}\nNEW CLIENT REQUEST TO CHECK: ${String(b.changeRequest || "Not provided").slice(0, 5000)}\nNEGOTIATION MESSAGE: ${String(b.negotiationMessage || "Not provided").slice(0, 5000)}\nSCENARIO PRICE: ${Number(b.scenarioPrice || 0) || "Not provided"}\nSCENARIO HOURS: ${Number(b.scenarioHours || 0) || "Not provided"}\nHISTORICAL OUTCOMES: ${JSON.stringify(history).slice(0, 12000)}\nReturn ONLY JSON with: pricing {estimatedHours:number,estimatedCost:number,recommendedPrice:number,minimumSafePrice:number,expectedMarginPct:number,contingencyPct:number,basis:string[]}; scope {phases:Array<{name:string,deliverables:string[],tasks:string[],acceptanceCriteria:string[]}>,assumptions:string[],dependencies:string[],clientResponsibilities:string[],exclusions:string[]}; changeDetection {classification:'Included'|'Ambiguous'|'Out of Scope'|'Not assessed',reason:string,estimatedExtraHours:number,changeOrderRecommendation:string}; simulator {scenarioPrice:number,scenarioHours:number,marginPct:number,riskImpact:string,tradeoffs:string[]}; historical {signals:string[],sampleSize:number}; intake {requirements:string[],contradictions:string[],deadlines:string[],openQuestions:string[]}; traceability Array<{requirement:string,coverage:'Covered'|'Ambiguous'|'Unanswered',proposalSection:string,evidence:string,acceptanceCriterion:string}>; feasibility {status:'Feasible'|'At Risk'|'Unknown',estimatedHours:number,capacityHours:number,bottlenecks:string[]}; negotiation {recommendedApproach:string,protect:string[],giveGetTrades:string[],responseDraft:string}; memory {estimatedVsActual:string,lessons:string[],futurePricingAdjustment:string}. Calculations must be internally consistent. If internal rate is absent, do not invent cost or safe price: use 0 and explain the missing basis. If actuals are absent, say no completed-project learning yet. If no new request or negotiation message is supplied, return Not assessed/empty guidance rather than inventing one. Trace every material stated client requirement, capped at 25.`,
          maxTokens: 7600,
          temperature: 0.15,
          thinkingMode: "FAST",
        });
        const lab = JSON.parse(
          r.text
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim(),
        );
        if (!lab.scope || !lab.pricing || !Array.isArray(lab.traceability))
          return error(
            "Commercial intelligence was incomplete. Please retry.",
            502,
          );
        const estimatedHours = Math.max(
          0,
          Number(
            lab.pricing?.estimatedHours || lab.feasibility?.estimatedHours || 0,
          ),
        );
        const estimatedCost =
          internalRate && estimatedHours
            ? Math.round(internalRate * estimatedHours * 100) / 100
            : 0;
        const minimumSafePrice =
          estimatedCost && targetMargin < 100
            ? Math.round((estimatedCost / (1 - targetMargin / 100)) * 100) / 100
            : 0;
        const recommendedPrice = Math.max(
          minimumSafePrice,
          Number(lab.pricing?.recommendedPrice || 0),
        );
        const expectedMarginPct =
          recommendedPrice && estimatedCost
            ? Math.round(
                ((recommendedPrice - estimatedCost) / recommendedPrice) * 1000,
              ) / 10
            : 0;
        const scenarioPrice = Math.max(0, Number(b.scenarioPrice || 0));
        const scenarioHours = Math.max(
          0,
          Number(b.scenarioHours || estimatedHours),
        );
        const scenarioCost =
          internalRate && scenarioHours
            ? Math.round(internalRate * scenarioHours * 100) / 100
            : 0;
        const scenarioMarginPct =
          scenarioPrice && scenarioCost
            ? Math.round(
                ((scenarioPrice - scenarioCost) / scenarioPrice) * 1000,
              ) / 10
            : 0;
        lab.pricing = {
          ...lab.pricing,
          estimatedHours,
          estimatedCost,
          recommendedPrice,
          minimumSafePrice,
          expectedMarginPct,
        };
        lab.simulator = {
          ...lab.simulator,
          scenarioPrice,
          scenarioHours,
          marginPct: scenarioMarginPct,
        };
        lab.feasibility = {
          ...lab.feasibility,
          estimatedHours,
          capacityHours: teamCapacityHours,
        };
        const coverage = {
          covered: lab.traceability.filter((v: any) => v.coverage === "Covered")
            .length,
          ambiguous: lab.traceability.filter(
            (v: any) => v.coverage === "Ambiguous",
          ).length,
          unanswered: lab.traceability.filter(
            (v: any) => v.coverage === "Unanswered",
          ).length,
        };
        const changeOrderDraft =
          String(b.changeRequest || "").trim() &&
          lab.changeDetection?.classification === "Out of Scope"
            ? `CHANGE ORDER — ${String(p.client || "Client")}\n\nRequested change\n${String(b.changeRequest).trim()}\n\nScope assessment\n${String(lab.changeDetection.reason || "")}\n\nEstimated additional effort\n${Number(lab.changeDetection.estimatedExtraHours || 0) || "To be confirmed"} hours\n\nCommercial recommendation\n${String(lab.changeDetection.changeOrderRecommendation || "Price and approval to be confirmed before work begins.")}\n\nApproval\nThis change is not added to the delivery baseline until scope, price and timeline impact are approved.`
            : "";
        const now = new Date().toISOString();
        const audit = Array.isArray(p.commercialAudit)
          ? p.commercialAudit.slice(-39)
          : [];
        audit.push({
          at: now,
          type: "commercial_recalculation",
          detail: `Pricing/scope recalculated${String(b.changeRequest || "").trim() ? ` · change classified ${String(lab.changeDetection?.classification || "Not assessed")}` : ""}${String(b.negotiationMessage || "").trim() ? " · negotiation assessed" : ""}.`,
        });
        const baselineExists = Boolean(p.scopeBaseline);
        const record = {
          ...p,
          commercialLab: { ...lab, coverage },
          commercialInputs: {
            internalRate,
            targetMargin,
            teamCapacityHours,
            scenarioPrice,
            scenarioHours,
          },
          actualHours: Number(b.actualHours || p.actualHours || 0),
          actualCost: Number(b.actualCost || p.actualCost || 0),
          lastChangeRequest: String(b.changeRequest || ""),
          lastNegotiationMessage: String(b.negotiationMessage || ""),
          changeOrderDraft,
          changeOrderStatus: changeOrderDraft
            ? "draft"
            : p.changeOrderStatus || "",
          commercialAudit: audit,
          commercialLabUpdatedAt: now,
          winPlan: undefined,
          winPlanUpdatedAt: "",
          closeCoach: undefined,
          nextBestAction:
            baselineExists && String(b.changeRequest || "").trim()
              ? "Review the scope-change assessment and commercial impact before responding to the client."
              : "Review the recalculated scope, price and delivery feasibility before advancing the deal.",
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id, record },
        ]);
        if (!ok) return error("Could not save commercial intelligence.", 500);
        return json({ commercialLab: lab, project: { id, ...record } });
      } catch (e) {
        console.error("Commercial lab failed", e);
        return error(
          "Commercial intelligence is temporarily unavailable.",
          502,
        );
      }
    },
  ],
  "POST /api/projects/:id/scope-baseline": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      if (!p.commercialLab?.scope)
        return error(
          "Build the Opportunity Lab before establishing a scope baseline.",
          400,
        );
      const now = new Date().toISOString();
      const baseline = {
        version: Number(p.scopeBaseline?.version || 0) + 1,
        createdAt: now,
        proposalVersion: Number(p.version || 1),
        scope: p.commercialLab.scope,
        traceability: p.commercialLab.traceability || [],
        pricing: p.commercialLab.pricing || {},
        feasibility: p.commercialLab.feasibility || {},
        estimateLines: Array.isArray(p.estimateLines) ? p.estimateLines : [],
        estimateSummary: p.estimateSummary || {},
        scopeGraph: Array.isArray(p.scopeGraph) ? p.scopeGraph : [],
        proposal: String(p.proposal || ""),
      };
      const [baselineHistoryId] = await db.add(
        `scope-baselines:${ctx.user!.userId}:${id}`,
        [baseline],
      );
      if (!baselineHistoryId)
        return error("Could not preserve scope baseline history.", 500);
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: now,
        type: "scope_baseline",
        detail: `Baseline ${baseline.version} established from proposal version ${baseline.proposalVersion}.`,
      });
      const record = {
        ...p,
        scopeBaseline: baseline,
        commercialAudit: audit,
        changeOrderStatus: "",
        changeOrderDraft: "",
        nextBestAction:
          "Monitor new client requests against the approved scope baseline.",
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Could not establish scope baseline.", 500);
      return json({ project: { id, ...record } });
    },
  ],
  "POST /api/projects/:id/change-order/approve": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      if (
        !String(p.changeOrderDraft || "").trim() ||
        p.commercialLab?.changeDetection?.classification !== "Out of Scope"
      )
        return error(
          "There is no out-of-scope change order ready to approve.",
          400,
        );
      const now = new Date().toISOString();
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: now,
        type: "change_order_approved",
        detail: String(p.lastChangeRequest || "Approved scope change").slice(
          0,
          700,
        ),
      });
      const changeRecord = {
        request: String(p.lastChangeRequest || ""),
        draft: String(p.changeOrderDraft || ""),
        classification: String(
          p.commercialLab?.changeDetection?.classification || "",
        ),
        estimatedExtraHours: Number(
          p.commercialLab?.changeDetection?.estimatedExtraHours || 0,
        ),
        baselineVersion: Number(p.scopeBaseline?.version || 0),
        proposalVersion: Number(p.version || 1),
        status: "approved",
        createdAt: now,
        approvedAt: now,
      };
      const [changeId] = await db.add(
        `change-orders:${ctx.user!.userId}:${id}`,
        [changeRecord],
      );
      if (!changeId)
        return error("Could not preserve change-order history.", 500);
      const record = {
        ...p,
        changeOrderStatus: "approved",
        changeOrderApprovedAt: now,
        lastChangeOrderId: changeId,
        commercialAudit: audit,
        nextBestAction:
          "Rebuild the Opportunity Lab to incorporate the approved change into a new scope baseline.",
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Could not approve change order.", 500);
      return json({ project: { id, ...record } });
    },
  ],
  "POST /api/projects/:id/proposal-studio": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const b = (ctx.body || {}) as { action?: string; input?: string };
      const action = String(b.action || "audit").slice(0, 40);
      const input = String(b.input || "").slice(0, 12000);
      const profile = await getProfile(ctx.user!.userId);
      if (!profile) return error("Complete profile first.", 400);
      try {
        const r = await ai.generate({
          system:
            "You are ScopeVanta Proposal Studio. Help a service seller create a clear, persuasive, commercially safe proposal and move the deal forward. Use supplied evidence only. Never invent requirements, buyer intent, ROI, proof, urgency, competitors, pricing or acceptance. Missing information must be To be confirmed. Distinguish observed facts from recommendations.",
          prompt: `ACTION: ${action}\nSELLER: ${profile.company}\nEXPERTISE: ${profile.expertise}\nCLIENT: ${p.client}\nBRIEF: ${String(p.brief || "").slice(0, 16000)}\nPROPOSAL: ${String(p.proposal || "").slice(0, 30000)}\nCOMMERCIAL MODEL: ${JSON.stringify({ estimate: p.estimateSummary, scenarios: p.dealScenarios, baseline: p.scopeBaseline, traceability: p.commercialLab?.traceability, scope: p.commercialLab?.scope }).slice(0, 18000)}\nBUYER INTELLIGENCE: ${JSON.stringify(p.winPlan || {}).slice(0, 10000)}\nUSER INPUT / MEETING / OBJECTION: ${input || "Not provided"}\nReturn ONLY JSON: audit {score:number,ready:boolean,issues:Array<{severity:'High'|'Medium'|'Low',type:string,issue:string,fix:string}>,strengths:string[]}; coverage {covered:number,ambiguous:number,unanswered:number,items:Array<{requirement:string,status:'Covered'|'Ambiguous'|'Unanswered',section:string,gap:string}>}; sections Array<{title:string,purpose:string,content:string}>; approaches Array<{name:string,positioning:string,bestWhen:string}>; meeting {newRequirements:string[],changedRequirements:string[],buyerSignals:string[],objections:string[],openQuestions:string[],recommendedUpdates:string[]}; objection {objection:string,diagnosis:string,protect:string[],options:Array<{approach:string,commercialTradeoff:string,response:string}>}; followUp {stage:string,subject:string,body:string,nextStep:string}. Keep sections modular and grounded. Audit must check unanswered requirements, vague deliverables, acceptance criteria, unsupported claims, exclusions, commercial inconsistencies, jargon and buyer-priority coverage. If input is absent, meeting/objection arrays can be empty.`,
          maxTokens: 7200,
          temperature: 0.15,
          thinkingMode: "FAST",
        });
        const studio = JSON.parse(
          r.text
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim(),
        );
        const now = new Date().toISOString();
        const audit = Array.isArray(p.commercialAudit)
          ? p.commercialAudit.slice(-39)
          : [];
        audit.push({
          at: now,
          type: `proposal_studio_${action}`,
          detail: `Proposal Studio ${action} refreshed for proposal version ${Number(p.version || 1)}.`,
        });
        const record = {
          ...p,
          proposalStudio: studio,
          proposalStudioAt: now,
          commercialAudit: audit,
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id, record },
        ]);
        if (!ok)
          return error("Could not save Proposal Studio intelligence.", 500);
        return json({ studio, project: { id, ...record } });
      } catch (e) {
        console.error("Proposal Studio failed", e);
        return error("Proposal Studio is temporarily unavailable.", 502);
      }
    },
  ],
  "POST /api/projects/:id/win-plan": [
    requireAuth(),
    async (ctx) => {
      const projectId = String(ctx.params.id || "");
      if (!projectId) return error("Project is required.", 400);
      const [project] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [projectId],
      );
      if (!project) return error("Proposal not found.", 404);
      const p = await getProfile(ctx.user!.userId);
      if (!p) return error("Complete profile first.", 400);
      let clientContext = "";
      if (project.clientId) {
        const [c] = await db.get<ClientBody>(`clients:${ctx.user!.userId}`, [
          String(project.clientId),
        ]);
        if (c)
          clientContext = [
            `Goals: ${c.goals || ""}`,
            `Preferences: ${c.preferences || ""}`,
            `Decision makers: ${c.decisionMakers || ""}`,
            `Pain points: ${c.painPoints || ""}`,
            `Buying criteria: ${c.buyingCriteria || ""}`,
            `Known objections: ${c.knownObjections || ""}`,
            `Notes: ${c.notes || ""}`,
            `Next step: ${c.nextStep || ""}`,
          ]
            .filter((v) => !v.endsWith(": "))
            .join("\n");
      }
      try {
        const r = await ai.generate({
          system:
            "You are a B2B deal coach helping a service business improve its chance of winning a specific opportunity without discounting blindly, fabricating evidence or accepting dangerous scope. Use only supplied facts. Separate observed buyer signals from recommended sales strategy. Do not claim to know buyer motives. Objection responses must be credible, concise and grounded in the proposal or seller context.",
          prompt: `SELLER: ${p.company}\nSELLER EXPERTISE: ${p.expertise}\nCLIENT: ${String(project.client || "")}\nCLIENT CONTEXT: ${clientContext || "No saved buyer context"}\nBRIEF: ${String(project.brief || "")}\nBUDGET: ${String(project.budget || "Not provided")}\nTIMELINE: ${String(project.timeline || "Not provided")}\nSCOPE RISKS: ${(Array.isArray(project.risks) ? project.risks : []).join(" | ")}\nPROPOSAL:\n${String(project.proposal || "").slice(0, 30000)}\n\nCreate a practical win plan for the seller. Return ONLY JSON with buyerPriorities (3-5 priorities supported by the supplied material), decisionFriction (2-5 unresolved issues that could delay or weaken a decision), decisionMakers (1-5 known decision participants or 'To be confirmed' discovery items; never invent names or roles), dealSignals (2-5 observed positive/negative/unknown signals grounded in supplied material), objections (2-5 objects with objection and response; response must not invent proof or promise discounts), differentiators (2-5 seller/proposal strengths actually supported by supplied material), nextActions (3-5 concrete seller actions ordered from highest leverage to lowest), followUp (a concise client follow-up email, maximum 180 words, focused on buyer outcomes, resolved concerns and one clear next step). Use saved pain points, buying criteria and known objections when present. Do not fabricate decision makers, competitors, ROI, urgency, testimonials, results or buyer intent. When information is missing, frame it as a question or recommended discovery action rather than a fact.`,
          maxTokens: 2600,
          temperature: 0.2,
          thinkingMode: "FAST",
        });
        const clean = r.text
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const out = JSON.parse(clean) as WinPlan;
        if (
          !Array.isArray(out.buyerPriorities) ||
          !Array.isArray(out.decisionFriction) ||
          !Array.isArray(out.decisionMakers) ||
          !Array.isArray(out.dealSignals) ||
          !Array.isArray(out.objections) ||
          !Array.isArray(out.nextActions) ||
          !out.followUp
        )
          return error("Incomplete win plan. Please retry.", 502);
        const winPlan: WinPlan = {
          buyerPriorities: out.buyerPriorities.map(String).slice(0, 5),
          decisionFriction: out.decisionFriction.map(String).slice(0, 5),
          decisionMakers: out.decisionMakers.map(String).slice(0, 5),
          dealSignals: out.dealSignals.map(String).slice(0, 5),
          objections: out.objections
            .slice(0, 5)
            .map((v) => ({
              objection: String(v.objection || ""),
              response: String(v.response || ""),
            }))
            .filter((v) => v.objection && v.response),
          differentiators: (out.differentiators || []).map(String).slice(0, 5),
          nextActions: out.nextActions.map(String).slice(0, 5),
          followUp: String(out.followUp).slice(0, 5000),
        };
        const updated = {
          ...project,
          winPlan,
          winPlanUpdatedAt: new Date().toISOString(),
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id: projectId, record: updated },
        ]);
        if (!ok) return error("Could not save the win plan.", 500);
        return json({ winPlan });
      } catch (e) {
        console.error("ScopeVanta win plan failed", e);
        return error("Win strategy is temporarily unavailable.", 502);
      }
    },
  ],
  "GET /api/projects/:id/commercial-history": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const baselines = (
        await db.list<Record<string, any>>(
          `scope-baselines:${ctx.user!.userId}:${id}`,
          { limit: 40 },
        )
      ).items;
      const changes = (
        await db.list<Record<string, any>>(
          `change-orders:${ctx.user!.userId}:${id}`,
          { limit: 80 },
        )
      ).items;
      return json({
        baselines: baselines.sort(
          (a, b) => Number(b.version || 0) - Number(a.version || 0),
        ),
        changeOrders: changes.sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
        ),
      });
    },
  ],
  "POST /api/projects/:id/scope-graph": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const b = (ctx.body || {}) as {
        nodes?: Array<{
          id?: string;
          type?: string;
          label?: string;
          parentId?: string;
          hours?: number;
          cost?: number;
          price?: number;
          acceptance?: string;
          dependency?: string;
        }>;
      };
      const allowed = new Set([
        "requirement",
        "phase",
        "deliverable",
        "task",
        "economics",
        "acceptance",
      ]);
      const nodes = (Array.isArray(b.nodes) ? b.nodes : [])
        .slice(0, 180)
        .map((v, i) => ({
          id:
            String(v.id || `node-${i + 1}`)
              .replace(/[^a-zA-Z0-9_-]/g, "")
              .slice(0, 80) || `node-${i + 1}`,
          type: allowed.has(String(v.type)) ? String(v.type) : "deliverable",
          label: String(v.label || "")
            .trim()
            .slice(0, 300),
          parentId: String(v.parentId || "")
            .replace(/[^a-zA-Z0-9_-]/g, "")
            .slice(0, 80),
          hours: Math.max(0, Number(v.hours || 0)),
          cost: Math.max(0, Number(v.cost || 0)),
          price: Math.max(0, Number(v.price || 0)),
          acceptance: String(v.acceptance || "").slice(0, 700),
          dependency: String(v.dependency || "").slice(0, 700),
        }))
        .filter((v) => v.label);
      if (!nodes.length)
        return error("Add at least one scope graph node.", 400);
      const ids = new Set(nodes.map((v) => v.id));
      if (nodes.some((v) => v.parentId && !ids.has(v.parentId)))
        return error(
          "Every parent relationship must reference a node in this scope graph.",
          400,
        );
      const now = new Date().toISOString();
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-49)
        : [];
      audit.push({
        at: now,
        type: "scope_graph_saved",
        detail: `Editable scope graph saved · ${nodes.length} nodes.`,
      });
      const record = {
        ...p,
        scopeGraph: nodes,
        scopeGraphUpdatedAt: now,
        commercialLabStale: true,
        evidenceStatus: "needs_review",
        winPlan: undefined,
        closeCoach: undefined,
        commercialAudit: audit,
        nextBestAction:
          "Recompile pricing and proposal guidance after scope graph edits.",
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Could not save scope graph.", 500);
      return json({ project: { id, ...record }, nodes });
    },
  ],
  "GET /api/pricing-brain": [
    requireAuth(),
    async (ctx) => {
      const items = (
        await db.list<Record<string, any>>(`projects:${ctx.user!.userId}`, {
          limit: 160,
        })
      ).items;
      const completed = items.filter(
        (v) =>
          (v.dealStage === "Won" || v.dealStage === "Lost") &&
          (Number(v.actualHours || 0) > 0 || Number(v.actualCost || 0) > 0),
      );
      const rows = completed.map((v) => {
        const eh = Number(v.estimateSummary?.estimatedHours || 0),
          ec = Number(v.estimateSummary?.estimatedCost || 0),
          ep = Number(v.estimateSummary?.estimatedPrice || v.dealValue || 0),
          ah = Number(v.actualHours || 0),
          ac = Number(v.actualCost || 0),
          ar = Number(v.actualRevenue || v.dealValue || 0);
        return {
          projectId: v.id,
          client: v.client || "Opportunity",
          stage: v.dealStage,
          estimatedHours: eh,
          actualHours: ah,
          hoursVariance: eh && ah ? Math.round((ah - eh) * 100) / 100 : null,
          estimatedCost: ec,
          actualCost: ac,
          costVariance: ec && ac ? Math.round((ac - ec) * 100) / 100 : null,
          quotedPrice: ep,
          actualRevenue: ar,
          actualMarginPct:
            ar && ac ? Math.round(((ar - ac) / ar) * 1000) / 10 : null,
        };
      });
      const avg = (vals: number[]) =>
        vals.length
          ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) /
            10
          : null;
      const hv = rows
        .map((v) =>
          v.estimatedHours && v.actualHours
            ? ((v.actualHours - v.estimatedHours) / v.estimatedHours) * 100
            : null,
        )
        .filter((v): v is number => v !== null);
      const cv = rows
        .map((v) =>
          v.estimatedCost && v.actualCost
            ? ((v.actualCost - v.estimatedCost) / v.estimatedCost) * 100
            : null,
        )
        .filter((v): v is number => v !== null);
      const margins = rows
        .map((v) => v.actualMarginPct)
        .filter((v): v is number => v !== null);
      return json({
        sampleSize: rows.length,
        averageHoursVariancePct: avg(hv),
        averageCostVariancePct: avg(cv),
        averageActualMarginPct: avg(margins),
        records: rows.slice(0, 40),
        guidance:
          rows.length < 3
            ? "More completed records are needed before treating patterns as reusable pricing guidance."
            : "Use these descriptive actual-vs-estimate patterns as calibration evidence, not as a prediction for a new deal.",
      });
    },
  ],
  "POST /api/projects/:id/discovery-share": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const questions = (
        p.dealOS?.discovery?.discovery?.questions ||
        p.dealOS?.discovery?.questions ||
        []
      ).slice(0, 12);
      if (!questions.length)
        return error(
          "Run Discovery Agent before creating a client discovery link.",
          400,
        );
      const token = `d${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
      const record = {
        token,
        ownerId: ctx.user!.userId,
        projectId: id,
        client: String(p.client || "Client"),
        questions,
        answers: [],
        status: "open",
        createdAt: new Date().toISOString(),
        submittedAt: "",
      };
      const [shareId] = await db.add(shareTable(token), [record]);
      if (!shareId) return error("Could not create discovery link.", 500);
      const updated = {
        ...p,
        discoveryShareToken: token,
        discoveryShareStatus: "open",
      };
      await db.update(`projects:${ctx.user!.userId}`, [
        { id, record: updated },
      ]);
      return json({ token, project: { id, ...updated } });
    },
  ],
  "GET /api/discovery-share/:token": [
    async (ctx) => {
      const token = String(ctx.params.token || "");
      const { items } = await db.list<Record<string, any>>(shareTable(token), {
        limit: 1,
      });
      const s = items[0];
      if (!s || s.token !== token || s.status === "revoked")
        return error("This discovery link is unavailable.", 404);
      return json({
        discovery: {
          client: s.client,
          questions: s.questions,
          status: s.status,
          submittedAt: s.submittedAt || "",
        },
      });
    },
  ],
  "POST /api/discovery-share/:token": [
    async (ctx) => {
      const token = String(ctx.params.token || "");
      const b = (ctx.body || {}) as {
        name?: string;
        email?: string;
        answers?: string[];
      };
      const { items } = await db.list<Record<string, any>>(shareTable(token), {
        limit: 1,
      });
      const s = items[0];
      if (!s || s.token !== token || s.status !== "open")
        return error("This discovery link is unavailable.", 404);
      const name = String(b.name || "")
          .trim()
          .slice(0, 200),
        email = String(b.email || "")
          .trim()
          .toLowerCase()
          .slice(0, 320);
      if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email))
        return error("Name and valid email are required.", 400);
      const answers = (Array.isArray(b.answers) ? b.answers : [])
        .slice(0, s.questions.length)
        .map((v) =>
          String(v || "")
            .trim()
            .slice(0, 3000),
        );
      if (!answers.some(Boolean))
        return error("Answer at least one discovery question.", 400);
      const submittedAt = new Date().toISOString();
      const [ok] = await db.update(shareTable(token), [
        {
          id: s.id,
          record: {
            ...s,
            name,
            email,
            answers,
            status: "submitted",
            submittedAt,
          },
        },
      ]);
      if (!ok) return error("Could not submit discovery answers.", 500);
      const [p] = await db.get<Record<string, any>>(`projects:${s.ownerId}`, [
        String(s.projectId),
      ]);
      if (p) {
        const audit = Array.isArray(p.commercialAudit)
          ? p.commercialAudit.slice(-49)
          : [];
        audit.push({
          at: submittedAt,
          type: "client_discovery_submitted",
          detail: `Client discovery answers received from ${name}.`,
        });
        await db.update(`projects:${s.ownerId}`, [
          {
            id: String(s.projectId),
            record: {
              ...p,
              clientDiscovery: {
                name,
                email,
                answers,
                questions: s.questions,
                submittedAt,
              },
              discoveryShareStatus: "submitted",
              commercialAudit: audit,
              nextBestAction:
                "Review client discovery answers and refine the proposal before sharing.",
            },
          },
        ]);
      }
      return json({ submitted: true });
    },
  ],
  "POST /api/projects/:id/deal-os": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const b = (ctx.body || {}) as {
        action?: string;
        input?: string;
        targetPrice?: number;
        targetMargin?: number;
      };
      const action = String(b.action || "copilot").slice(0, 40);
      const input = String(b.input || "").slice(0, 16000);
      const targetPrice = Math.max(0, Number(b.targetPrice || 0));
      const targetMargin = Math.min(
        90,
        Math.max(
          0,
          Number(b.targetMargin ?? p.estimateSummary?.targetMargin ?? 35),
        ),
      );
      const allowed = new Set([
        "discovery",
        "compile",
        "margin",
        "choices",
        "negotiation",
        "change",
        "autopsy",
        "premortem",
        "redteam",
        "personalize",
        "meeting",
        "responsibilities",
        "handoff",
        "copilot",
      ]);
      if (!allowed.has(action)) return error("Unknown Deal OS action.", 400);
      const profile = await getProfile(ctx.user!.userId);
      if (!profile) return error("Complete profile first.", 400);
      const history = (
        await db.list<Record<string, any>>(`projects:${ctx.user!.userId}`, {
          limit: 80,
        })
      ).items
        .filter(
          (v) =>
            v.id !== id && (v.actualHours || v.actualCost || v.outcomeLearning),
        )
        .slice(0, 12)
        .map((v) => ({
          stage: v.dealStage,
          value: v.dealValue,
          estimate: v.estimateSummary,
          actualHours: v.actualHours,
          actualCost: v.actualCost,
          outcome: v.outcomeLearning,
          scope: v.estimateLines,
        }));
      try {
        const r = await ai.generate({
          system:
            "You are ScopeVanta Deal-to-Profit OS. Operate as a rigorous commercial architect for service businesses. Use supplied evidence only. Never invent buyer motives, urgency, ROI, competitors, delivery capacity, costs, historical results or contractual acceptance. Recommendations are not predictions. Missing facts must be To be confirmed. Protect scope and economics while helping the seller make the offer easier to understand and buy.",
          prompt: `ACTION: ${action}\nSELLER: ${profile.company}\nEXPERTISE: ${profile.expertise}\nCLIENT: ${p.client}\nBRIEF/DEAL INBOX: ${String(p.brief || "").slice(0, 18000)}\nPROPOSAL: ${String(p.proposal || "").slice(0, 24000)}\nSCOPE GRAPH INPUT: ${JSON.stringify({ lines: p.estimateLines, scope: p.commercialLab?.scope, traceability: p.commercialLab?.traceability, baseline: p.scopeBaseline }).slice(0, 18000)}\nECONOMICS: ${JSON.stringify({ estimate: p.estimateSummary, scenarios: p.dealScenarios, actualRevenue: p.actualRevenue, actualHours: p.actualHours, actualCost: p.actualCost }).slice(0, 10000)}\nBUYER/DEAL: ${JSON.stringify({ stage: p.dealStage, win: p.winPlan, studio: p.proposalStudio, request: p.clientRequestInbox || p.lastChangeRequest }).slice(0, 14000)}\nRECORDED HISTORY: ${JSON.stringify(history).slice(0, 12000)}\nUSER INPUT: ${input || "Not provided"}\nTARGET PRICE: ${targetPrice || "Not provided"}\nTARGET MARGIN: ${targetMargin}%\nReturn ONLY JSON with these keys. Populate the requested action deeply and keep other keys concise/empty when not relevant: discovery {questions:Array<{question:string,why:string,answerType:string}>}; graph {nodes:Array<{id:string,type:string,label:string,parentId:string,hours:number,cost:number,price:number,acceptance:string,dependency:string}>}; compiler {targetPrice:number,targetMargin:number,changes:string[],removedOrDeferred:string[],warnings:string[]}; marginFirewall {status:'Safe'|'Review'|'Unsafe'|'Unknown',risks:Array<{issue:string,impact:string,fix:string}>,unpricedWork:string[],summary:string}; buyerChoices Array<{name:string,price:number,hours:number,marginPct:number,included:string[],excluded:string[],bestFor:string}>; negotiation {position:string,options:Array<{approach:string,price:number,scopeChange:string,marginImpact:string,response:string}>}; changeFirewall {classification:'Included'|'Ambiguous'|'Out of Scope'|'Not assessed',baselineEvidence:string,request:string,addedWork:string[],estimatedExtraHours:number,commercialImpact:string,recommendedAction:string}; autopsy {estimateVsActual:string[],varianceDrivers:string[],lessons:string[],pricingBrainUpdates:string[]}; premortem Array<{failureMode:string,evidence:string,prevention:string}>; redteam Array<{persona:string,challenge:string,fix:string}>; personalization {recommendedModules:string[],buyerSpecificEdits:string[],unsupportedClaimsToRemove:string[]}; meetingDelta {newRequirements:string[],changedRequirements:string[],removedRequirements:string[],objections:string[],promises:string[],stakeholdersMentioned:string[],deadlines:string[],approveBeforeApplying:string[]}; responsibilities Array<{owner:'Client'|'Seller'|'Shared'|'To be confirmed',item:string,due:string,dependency:string,delayImpact:string}>; handoff {finalScope:string[],milestones:string[],acceptance:string[],clientResponsibilities:string[],commercialTerms:string[],openItems:string[],changeControl:string}; copilot {answer:string,evidence:string[],recommendedActions:string[]}. For graph, preserve requirement→deliverable→task→economics→acceptance relationships where evidence permits. For buyerChoices and compiler never claim a target can be met if arithmetic or evidence does not support it.`,
          maxTokens: 7600,
          temperature: 0.12,
          thinkingMode: "FAST",
        });
        const intelligence = JSON.parse(
          r.text
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim(),
        );
        const now = new Date().toISOString();
        const audit = Array.isArray(p.commercialAudit)
          ? p.commercialAudit.slice(-49)
          : [];
        audit.push({
          at: now,
          type: `deal_os_${action}`,
          detail: `Deal-to-Profit OS ${action} refreshed from current opportunity evidence.`,
        });
        const prior = p.dealOS || {};
        const dealOS = {
          ...prior,
          [action]: intelligence,
          updatedAt: now,
          lastAction: action,
        };
        const record = { ...p, dealOS, commercialAudit: audit };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id, record },
        ]);
        if (!ok) return error("Could not save Deal OS intelligence.", 500);
        return json({ intelligence, project: { id, ...record } });
      } catch (e) {
        console.error("Deal OS failed", e);
        return error("Deal OS intelligence is temporarily unavailable.", 502);
      }
    },
  ],
  "GET /api/projects/:id/readiness": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const checks = [
        {
          key: "brief",
          label: "Client brief analyzed",
          pass: Boolean(String(p.brief || "").trim()),
        },
        {
          key: "scope",
          label: "Scope engineered",
          pass: Boolean(p.commercialLab?.scope),
        },
        {
          key: "economics",
          label: "Economics modeled",
          pass: Boolean(p.estimateSummary?.estimatedPrice),
        },
        {
          key: "proposal",
          label: "Proposal generated",
          pass: Boolean(String(p.proposal || "").trim()),
        },
        {
          key: "audit",
          label: "Proposal audited",
          pass: Boolean(p.proposalStudio?.audit),
        },
        {
          key: "evidence",
          label: "Evidence current",
          pass: p.evidenceStatus !== "needs_review",
        },
        {
          key: "commercial",
          label: "Commercial intelligence current",
          pass: !p.commercialLabStale,
        },
        {
          key: "win",
          label: "Win strategy prepared",
          pass: Boolean(p.winPlan || p.closeCoach),
        },
        {
          key: "share",
          label: "Client review created",
          pass: Boolean(p.shareToken && p.shareStatus !== "revoked"),
        },
        {
          key: "baseline",
          label: "Scope baseline established",
          pass: Boolean(p.scopeBaseline),
        },
      ];
      const passed = checks.filter((v) => v.pass).length;
      return json({
        checks,
        passed,
        total: checks.length,
        readyToShare: checks
          .filter((v) =>
            ["proposal", "audit", "evidence", "commercial"].includes(v.key),
          )
          .every((v) => v.pass),
        readyToProtect: Boolean(p.scopeBaseline),
        next:
          checks.find((v) => !v.pass)?.label ||
          "Run a real client decision/change cycle",
      });
    },
  ],
  "POST /api/projects/:id/share/revoke": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      if (!p.shareToken) return error("No active proposal share exists.", 400);
      const { items } = await db.list<Record<string, any>>(
        shareTable(String(p.shareToken)),
        { limit: 1 },
      );
      const s = items[0];
      if (s) {
        await db.update(shareTable(String(p.shareToken)), [
          {
            id: s.id,
            record: {
              ...s,
              status: "revoked",
              revokedAt: new Date().toISOString(),
            },
          },
        ]);
      }
      const now = new Date().toISOString();
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: now,
        type: "proposal_share_revoked",
        detail: `Client review for proposal version ${Number(p.version || 1)} revoked.`,
      });
      const record = { ...p, shareStatus: "revoked", commercialAudit: audit };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record },
      ]);
      if (!ok) return error("Could not revoke proposal share.", 500);
      return json({ project: { id, ...record } });
    },
  ],
  "POST /api/projects/:id/share": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      if (!String(p.proposal || "").trim())
        return error("Generate a proposal before sharing.", 400);
      if (p.evidenceStatus === "needs_review")
        return error(
          "This proposal changed after its evidence was verified. Review or regenerate the proposal before sharing.",
          409,
        );
      if (p.commercialLabStale === true)
        return error(
          "Commercial guidance is stale after recent scope or proposal changes. Recalculate Opportunity Lab before sharing.",
          409,
        );
      const profile = await getProfile(ctx.user!.userId);
      if (!profile) return error("Complete profile first.", 400);
      const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      const record = {
        token,
        ownerId: ctx.user!.userId,
        projectId: id,
        client: String(p.client || "Client"),
        seller: String(profile.company || profile.name || "Seller"),
        proposal: String(p.proposal).slice(0, 80000),
        version: Number(p.version || 1),
        dealValue: Number(p.dealValue || 0),
        status: "shared",
        createdAt: new Date().toISOString(),
        decision: "",
        decidedAt: "",
        decisionName: "",
        decisionEmail: "",
        decisionNote: "",
        selectedScenario: "",
        scopeSummary: Array.isArray(p.estimateLines)
          ? p.estimateLines
              .slice(0, 60)
              .map((v: any) => ({
                name: v.name,
                qty: v.qty,
                hours: v.hours,
                acceptance: v.acceptance || "",
              }))
          : [],
        scenarios: Array.isArray(p.dealOS?.choices?.buyerChoices)
          ? p.dealOS.choices.buyerChoices.slice(0, 3)
          : Array.isArray(p.dealScenarios)
            ? p.dealScenarios.slice(0, 3)
            : [],
        timeline: String(p.timeline || ""),
        proposalAuditScore: Number(p.proposalStudio?.audit?.score || 0),
        responsibilities: p.dealOS?.responsibilities?.responsibilities || [],
        handoff: p.dealOS?.handoff?.handoff || {},
        views: 0,
        lastViewedAt: "",
        engagement: [],
      };
      const [shareId] = await db.add(shareTable(token), [record]);
      if (!shareId) return error("Could not create proposal share.", 500);
      const updated = {
        ...p,
        shareToken: token,
        shareStatus: "shared",
        shareCreatedAt: record.createdAt,
        dealStage:
          p.dealStage === "Draft" || !p.dealStage ? "Sent" : p.dealStage,
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record: updated },
      ]);
      if (!ok) {
        await db.delete(shareTable(token), [shareId]);
        return error("Could not save proposal share.", 500);
      }
      return json({ token, status: "shared", project: { id, ...updated } });
    },
  ],
  "GET /api/proposal-share/:token": [
    async (ctx) => {
      const token = String(ctx.params.token || "");
      if (!token) return error("Share link is invalid.", 400);
      const { items } = await db.list<Record<string, any>>(shareTable(token), {
        limit: 1,
      });
      const s = items[0];
      if (!s || s.token !== token || s.status === "revoked")
        return error("This proposal link is unavailable.", 404);
      const viewedAt = new Date().toISOString();
      const engagement = [
        ...(Array.isArray(s.engagement) ? s.engagement : []).slice(-49),
        { type: "view", at: viewedAt },
      ];
      await db.update(shareTable(token), [
        {
          id: s.id,
          record: {
            ...s,
            views: Number(s.views || 0) + 1,
            lastViewedAt: viewedAt,
            engagement,
          },
        },
      ]);
      return json({
        share: {
          client: s.client,
          seller: s.seller,
          proposal: s.proposal,
          version: s.version,
          dealValue: s.dealValue,
          status: s.status,
          decision: s.decision,
          decidedAt: s.decidedAt,
          selectedScenario: s.selectedScenario || "",
          scopeSummary: s.scopeSummary || [],
          scenarios: s.scenarios || [],
          timeline: s.timeline || "",
          proposalAuditScore: s.proposalAuditScore || 0,
          responsibilities: s.responsibilities || [],
          handoff: s.handoff || {},
          views: Number(s.views || 0) + 1,
        },
      });
    },
  ],
  "POST /api/proposal-share/:token/scenario": [
    async (ctx) => {
      const token = String(ctx.params.token || "");
      const b = (ctx.body || {}) as { name?: string };
      const { items } = await db.list<Record<string, any>>(shareTable(token), {
        limit: 1,
      });
      const s = items[0];
      if (!s || s.token !== token || s.status === "revoked")
        return error("This proposal link is unavailable.", 404);
      if (s.decision)
        return error("This proposal already has a recorded decision.", 409);
      const name = String(b.name || "")
        .trim()
        .slice(0, 120);
      const scenario = (Array.isArray(s.scenarios) ? s.scenarios : []).find(
        (v: any) => String(v.name || "") === name,
      );
      if (!scenario) return error("Choose an available package.", 400);
      const at = new Date().toISOString();
      const engagement = [
        ...(Array.isArray(s.engagement) ? s.engagement : []).slice(-49),
        { type: "scenario_selected", name, at },
      ];
      const [ok] = await db.update(shareTable(token), [
        { id: s.id, record: { ...s, selectedScenario: name, engagement } },
      ]);
      if (!ok) return error("Could not save package selection.", 500);
      const [p] = await db.get<Record<string, any>>(`projects:${s.ownerId}`, [
        String(s.projectId),
      ]);
      if (p)
        await db.update(`projects:${s.ownerId}`, [
          {
            id: String(s.projectId),
            record: {
              ...p,
              clientSelectedScenario: name,
              clientSelectedScenarioAt: at,
              nextBestAction: `Client selected ${name}; confirm package details before acceptance.`,
            },
          },
        ]);
      return json({ selectedScenario: name });
    },
  ],
  "GET /api/projects/:id/share-analytics": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      if (!p.shareToken)
        return json({
          views: 0,
          lastViewedAt: "",
          selectedScenario: "",
          events: [],
        });
      const { items } = await db.list<Record<string, any>>(
        shareTable(String(p.shareToken)),
        { limit: 1 },
      );
      const s = items[0];
      return json({
        views: Number(s?.views || 0),
        lastViewedAt: String(s?.lastViewedAt || ""),
        selectedScenario: String(s?.selectedScenario || ""),
        decision: String(s?.decision || ""),
        events: Array.isArray(s?.engagement) ? s.engagement : [],
      });
    },
  ],
  "POST /api/proposal-share/:token/decision": [
    async (ctx) => {
      const token = String(ctx.params.token || "");
      const b = (ctx.body || {}) as ShareDecisionBody;
      const { items } = await db.list<Record<string, any>>(shareTable(token), {
        limit: 1,
      });
      const s = items[0];
      if (!s || s.token !== token || s.status === "revoked")
        return error("This proposal link is unavailable.", 404);
      if (s.decision)
        return error(
          "A decision has already been recorded for this proposal.",
          409,
        );
      if (b.decision !== "accepted" && b.decision !== "changes_requested")
        return error("Choose accept or request changes.", 400);
      const name = String(b.name || "")
        .trim()
        .slice(0, 200);
      const email = String(b.email || "")
        .trim()
        .toLowerCase()
        .slice(0, 320);
      const note = String(b.note || "")
        .trim()
        .slice(0, 4000);
      if (name.length < 2) return error("Your name is required.", 400);
      if (!/^\S+@\S+\.\S+$/.test(email))
        return error("A valid email is required.", 400);
      if (b.decision === "changes_requested" && !note)
        return error("Tell the seller what should change.", 400);
      const decidedAt = new Date().toISOString();
      const shareRecord = {
        ...s,
        status: b.decision,
        decision: b.decision,
        decidedAt,
        decisionName: name,
        decisionEmail: email,
        decisionNote: note,
        engagement: [
          ...(Array.isArray(s.engagement) ? s.engagement : []).slice(-49),
          { type: b.decision, at: decidedAt },
        ],
      };
      const [shareOk] = await db.update(shareTable(token), [
        { id: s.id, record: shareRecord },
      ]);
      if (!shareOk) return error("Could not record your decision.", 500);
      const [p] = await db.get<Record<string, any>>(`projects:${s.ownerId}`, [
        String(s.projectId),
      ]);
      if (p) {
        const accepted = b.decision === "accepted";
        const project = {
          ...p,
          shareStatus: b.decision,
          clientDecision: b.decision,
          clientDecisionAt: decidedAt,
          clientDecisionName: name,
          clientDecisionEmail: email,
          clientDecisionNote: note,
          dealStage: accepted ? "Won" : "Negotiation",
          outcomeReason: accepted
            ? `Client accepted proposal version ${s.version}. ${note}`.trim()
            : p.outcomeReason || "",
          outcomeAt: accepted ? decidedAt : p.outcomeAt || "",
          nextBestAction: accepted
            ? "Confirm kickoff, contract and delivery start."
            : "Review requested changes before revising scope or price.",
        };
        await db.update(`projects:${s.ownerId}`, [
          { id: String(s.projectId), record: project },
        ]);
      }
      return json({ recorded: true, decision: b.decision, decidedAt });
    },
  ],
  "PUT /api/projects/:id/deal": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const b = (ctx.body || {}) as DealUpdateBody;
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const stages = new Set<DealStage>([
        "Draft",
        "Proposal Ready",
        "Sent",
        "Follow-up",
        "Negotiation",
        "Won",
        "Lost",
      ]);
      const dealStage = (b.dealStage || p.dealStage || "Draft") as DealStage;
      if (!stages.has(dealStage)) return error("Invalid deal stage.", 400);
      const dealValue =
        Number.isFinite(Number(b.dealValue)) && Number(b.dealValue) >= 0
          ? Math.round(Number(b.dealValue) * 100) / 100
          : Number(p.dealValue || 0);
      const outcomeReason = String(b.outcomeReason ?? p.outcomeReason ?? "")
        .trim()
        .slice(0, 3000);
      if ((dealStage === "Won" || dealStage === "Lost") && !outcomeReason)
        return error(
          "Record why the deal was won or lost so ScopeVanta can learn from the outcome.",
          400,
        );
      const now = new Date().toISOString();
      const audit = Array.isArray(p.commercialAudit)
        ? p.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: now,
        type: "deal_stage",
        detail: `Deal moved to ${dealStage}${outcomeReason ? ` · ${outcomeReason}` : ""}.`,
      });
      const outcomeLearning =
        dealStage === "Won" || dealStage === "Lost"
          ? {
              stage: dealStage,
              reason: outcomeReason,
              finalValue: dealValue,
              proposalVersion: Number(p.version || 1),
              estimatedHours: Number(p.estimateSummary?.estimatedHours || 0),
              actualHours: Number(p.actualHours || 0),
              estimatedCost: Number(p.estimateSummary?.estimatedCost || 0),
              actualCost: Number(p.actualCost || 0),
              recordedAt: now,
            }
          : p.outcomeLearning;
      const updated = {
        ...p,
        dealStage,
        dealValue,
        outcomeReason,
        outcomeLearning,
        commercialAudit: audit,
        dealStageUpdatedAt: now,
        outcomeAt: dealStage === "Won" || dealStage === "Lost" ? now : "",
        nextBestAction: "",
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id, record: updated },
      ]);
      if (!ok) return error("Could not update deal.", 500);
      return json({ project: { id, ...updated } });
    },
  ],
  "POST /api/projects/:id/close-coach": [
    requireAuth(),
    async (ctx) => {
      const id = String(ctx.params.id || "");
      const [p] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [id],
      );
      if (!p) return error("Opportunity not found.", 404);
      const profile = await getProfile(ctx.user!.userId);
      if (!profile) return error("Complete profile first.", 400);
      const { items } = await db.list<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        { limit: 80 },
      );
      const outcomes = items
        .filter(
          (v) =>
            v.id !== id &&
            (v.dealStage === "Won" || v.dealStage === "Lost") &&
            v.outcomeReason,
        )
        .slice(0, 12);
      const history = outcomes
        .map((v) => `${v.dealStage}: ${String(v.outcomeReason).slice(0, 500)}`)
        .join("\n");
      try {
        const r = await ai.generate({
          system:
            "You are a B2B deal-closing coach. Help a service seller move a real opportunity forward without inventing buyer intent, urgency, proof, ROI, competitors or decision makers. Never recommend blind discounting. Missing facts become discovery questions. Historical win/loss patterns are hints, not guarantees.",
          prompt: `SELLER: ${profile.company}\nCLIENT: ${String(p.client || "")}\nDEAL STAGE: ${String(p.dealStage || "Draft")}\nDEAL VALUE: ${Number(p.dealValue || 0) || "Not recorded"}\nBRIEF: ${String(p.brief || "")}\nRISKS: ${(p.risks || []).join(" | ")}\nWIN PLAN: ${JSON.stringify(p.winPlan || {})}\nPROPOSAL: ${String(p.proposal || "").slice(0, 22000)}\nPAST OUTCOMES:\n${history || "No recorded win/loss learning yet."}\nReturn ONLY JSON: {nextBestAction:string,why:string,followUp:string,discoveryQuestions:string[],risk:string}. Give one concrete highest-leverage next action for the current stage. Follow-up must be client-ready and under 170 words. For Draft or Proposal Ready, recommend discovery when needed rather than pretending the proposal was sent. In Negotiation, address known friction without automatic concessions.`,
          maxTokens: 1800,
          temperature: 0.2,
          thinkingMode: "FAST",
        });
        const out = JSON.parse(
          r.text
            .replace(/^```json\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim(),
        );
        if (!out.nextBestAction || !out.followUp)
          return error("Closing guidance was incomplete. Please retry.", 502);
        const closeCoach = {
          nextBestAction: String(out.nextBestAction).slice(0, 1200),
          why: String(out.why || "").slice(0, 1800),
          followUp: String(out.followUp).slice(0, 5000),
          discoveryQuestions: Array.isArray(out.discoveryQuestions)
            ? out.discoveryQuestions.map(String).slice(0, 4)
            : [],
          risk: String(out.risk || "").slice(0, 1800),
          generatedAt: new Date().toISOString(),
        };
        const updated = {
          ...p,
          closeCoach,
          nextBestAction: closeCoach.nextBestAction,
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id, record: updated },
        ]);
        if (!ok) return error("Could not save closing guidance.", 500);
        return json({ closeCoach });
      } catch (e) {
        console.error("ScopeVanta close coach failed", e);
        return error("Closing guidance is temporarily unavailable.", 502);
      }
    },
  ],
  "PUT /api/projects/:id/proposal": [
    requireAuth(),
    async (ctx) => {
      const projectId = String(ctx.params.id || "");
      const b = (ctx.body || {}) as SaveProposalBody;
      if (!projectId) return error("Project is required.", 400);
      const proposal = String(b.proposal || "").trim();
      if (proposal.length < 80)
        return error("Proposal is too short to save.", 400);
      if (proposal.length > 80000)
        return error("Proposal is too long to save.", 400);
      const [project] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [projectId],
      );
      if (!project) return error("Proposal not found.", 404);
      const proposalChanged =
        proposal !== String(project.proposal || "").trim();
      const options = b.proposalOptions || project.proposalOptions || {};
      const optionsChanged =
        JSON.stringify(options) !==
        JSON.stringify(project.proposalOptions || {});
      if (!proposalChanged && !optionsChanged)
        return json({ ...project, projectId, unchanged: true });
      const savedAt = new Date().toISOString();
      if (!proposalChanged) {
        const record = {
          ...project,
          proposalOptions: options,
          updatedAt: savedAt,
        };
        const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
          { id: projectId, record },
        ]);
        if (!ok) return error("Could not save proposal settings.", 500);
        return json({ ...record, projectId, unchanged: true });
      }
      const version = Number(project.version || 1) + 1;
      const snapshot = {
        projectId,
        version: Number(project.version || 1),
        proposal: String(project.proposal || ""),
        summary: String(project.summary || ""),
        risks: Array.isArray(project.risks) ? project.risks : [],
        grounding: Array.isArray(project.grounding) ? project.grounding : [],
        groundingSummary: project.groundingSummary || {},
        visuals: Array.isArray(project.visuals) ? project.visuals : [],
        proposalOptions: project.proposalOptions || {},
        savedAt: String(project.updatedAt || project.createdAt || savedAt),
        status: String(project.status || "Draft"),
        revisionSource: "pre_manual_edit",
      };
      const [snapshotId] = await db.add(
        `proposal-versions:${ctx.user!.userId}:${projectId}`,
        [snapshot],
      );
      if (!snapshotId)
        return error("Could not preserve the current proposal revision.", 500);
      const audit = Array.isArray(project.commercialAudit)
        ? project.commercialAudit.slice(-39)
        : [];
      audit.push({
        at: savedAt,
        type: "proposal_edited",
        detail: `Proposal advanced to version ${version}; commercial analysis and closing guidance marked stale.`,
      });
      const record = {
        ...project,
        proposal,
        proposalOptions: options,
        grounding: [],
        groundingSummary: {
          grounded: 0,
          clientSupplied: 0,
          assumptions: 0,
          recommendations: 0,
        },
        winPlan: undefined,
        winPlanUpdatedAt: "",
        closeCoach: undefined,
        nextBestAction:
          "Rebuild Opportunity Lab and rerun Proposal Studio after proposal changes.",
        commercialLabStale: true,
        proposalStudio: undefined,
        proposalStudioAt: "",
        shareStatus:
          project.shareStatus === "shared"
            ? "stale_shared_version"
            : project.shareStatus,
        commercialAudit: audit,
        evidenceStatus: "needs_review",
        version,
        status: "Edited draft · evidence review required",
        updatedAt: savedAt,
      };
      const [ok] = await db.update(`projects:${ctx.user!.userId}`, [
        { id: projectId, record },
      ]);
      if (!ok) {
        await db.delete(`proposal-versions:${ctx.user!.userId}:${projectId}`, [
          snapshotId,
        ]);
        return error("Could not save proposal.", 500);
      }
      return json({ ...record, projectId });
    },
  ],
  "GET /api/projects/:id/versions": [
    requireAuth(),
    async (ctx) => {
      const projectId = String(ctx.params.id || "");
      if (!projectId) return error("Project is required.", 400);
      const [current] = await db.get<Record<string, any>>(
        `projects:${ctx.user!.userId}`,
        [projectId],
      );
      if (!current) return error("Proposal not found.", 404);
      const { items } = await db.list(
        `proposal-versions:${ctx.user!.userId}:${projectId}`,
        { limit: 30 },
      );
      const versions = [
        ...items.map((v) => ({
          version: Number(v.version || 1),
          proposal: String(v.proposal || ""),
          summary: String(v.summary || ""),
          risks: Array.isArray(v.risks) ? v.risks : [],
          grounding: Array.isArray(v.grounding) ? v.grounding : [],
          groundingSummary: v.groundingSummary || {},
          visuals: Array.isArray(v.visuals) ? v.visuals : [],
          proposalOptions: v.proposalOptions || {},
          clarificationAnswers: Array.isArray(v.clarificationAnswers)
            ? v.clarificationAnswers
            : [],
          savedAt: String(v.savedAt || ""),
          status: String(v.status || "Saved revision"),
          revisionSource: String(v.revisionSource || "manual_save"),
        })),
        {
          version: Number(current.version || 1),
          proposal: String(current.proposal || ""),
          summary: String(current.summary || ""),
          risks: Array.isArray(current.risks) ? current.risks : [],
          grounding: Array.isArray(current.grounding) ? current.grounding : [],
          groundingSummary: current.groundingSummary || {},
          visuals: Array.isArray(current.visuals) ? current.visuals : [],
          proposalOptions: current.proposalOptions || {},
          clarificationAnswers: Array.isArray(current.clarificationAnswers)
            ? current.clarificationAnswers
            : [],
          savedAt: String(current.updatedAt || current.createdAt || ""),
          status: String(current.status || "Current"),
          revisionSource: "current",
        },
      ].sort((a, b) => b.version - a.version);
      return json({ versions });
    },
  ],
  "POST /api/support": [
    requireAuth(),
    async (ctx) => {
      const b = (ctx.body || {}) as {
        message?: string;
        history?: Array<{ role: string; text: string }>;
      };
      const message = (b.message || "").trim();
      if (!message) return error("Message is required.", 400);
      const p = await getProfile(ctx.user!.userId);
      const r = await ai.generate({
        system:
          "You are ScopeVanta Guide, an ethical conversion-focused SaaS concierge. Help users get activated, create a strong first proposal, understand limits, and select Freelancer ($19/10 deals), Pro ($49/40), or Agency ($99/150). Ask concise diagnostic questions when useful and recommend the smallest suitable plan. Never claim a payment is verified or invent discounts. Square controls actual billing until payment verification is integrated.",
        messages: [
          ...(b.history || [])
            .slice(-8)
            .map((m) => ({
              role:
                m.role === "assistant"
                  ? ("assistant" as const)
                  : ("user" as const),
              content: m.text.slice(0, 1500),
            })),
          {
            role: "user",
            content: `Plan: ${p?.plan || "none"}. Billing: ${p?.billingStatus || "setup"}. Question: ${message.slice(0, 2500)}`,
          },
        ],
        maxTokens: 900,
        temperature: 0.25,
        thinkingMode: "FAST",
      });
      return json({ reply: r.text });
    },
  ],
});
