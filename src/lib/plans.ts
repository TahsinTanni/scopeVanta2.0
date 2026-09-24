// Single source of truth for plan names, prices, limits and marketing copy.
// Client-safe (no server imports) so the landing page, the billing settings
// page and lib/square.ts all read the same values and cannot drift apart.
//
// Keep the copy honest to what the code enforces: today the ONLY difference
// between plans is the monthly proposal limit (api/analyze counts projects
// created since the 1st of the month). Every product feature is available on
// every plan, and checkout charges one flat price per workspace — per-seat
// quantity billing is not built yet. Update this copy when that changes.

export type PlanName = "Freelancer" | "Pro" | "Agency";

export const PLAN_CURRENCY = "CAD";
export const TRIAL_DAYS = 30;

export const PLAN_PRICES_CENTS: Record<PlanName, number> = {
  Freelancer: 1900,
  Pro: 4900,
  Agency: 9900,
};

export const PLAN_LIMITS: Record<PlanName, number> = {
  Freelancer: 10,
  Pro: 40,
  Agency: 150,
};

// Included on every plan — nothing here is gated by tier.
export const ALL_PLAN_FEATURES = [
  "AI brief analysis & risk scoring",
  "Margin modeling & pricing scenarios",
  "Proposal audit & red-team review",
  "Client deal room share links",
  "Scope baselines & change orders",
  "Knowledge base grounding",
  "PDF export",
];

export const PLANS: ReadonlyArray<{
  name: PlanName;
  price: string;
  cadence: string;
  description: string;
  limit: string;
  popular: boolean;
}> = (
  [
    { name: "Freelancer", description: "For independent consultants sending a few proposals a month.", popular: false },
    { name: "Pro", description: "For boutique studios closing new work every week.", popular: true },
    { name: "Agency", description: "For service teams running a high-volume pipeline.", popular: false },
  ] as const
).map((p) => ({
  ...p,
  price: `$${PLAN_PRICES_CENTS[p.name] / 100}`,
  cadence: "/month",
  limit: `${PLAN_LIMITS[p.name]} new proposals per month`,
}));
