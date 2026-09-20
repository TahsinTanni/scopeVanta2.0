// Shape of Project.data — the catch-all JSON bag for the AI-intelligence
// sub-objects and denormalized share/decision fields the legacy system
// grows on a project record over time. See schema.prisma's comment on
// Project.data for why this stays a JSON blob instead of 30+ columns.
export type ProjectData = {
  shareStatus?: string;
  shareCreatedAt?: string;
  clientDecision?: string;
  clientDecisionAt?: string;
  clientDecisionName?: string;
  clientDecisionEmail?: string;
  clientDecisionNote?: string;
  clientSelectedScenario?: string;
  clientSelectedScenarioAt?: string;
  outcomeReason?: string;
  outcomeAt?: string;
  outcomeLearning?: Record<string, unknown>;
  nextBestAction?: string;
  dealStageUpdatedAt?: string;

  commercialLab?: Record<string, unknown>;
  commercialInputs?: Record<string, unknown>;
  commercialAutopilot?: Record<string, unknown>;
  commercialAutopilotAt?: string;
  dealOS?: Record<string, Record<string, unknown> | string | undefined> & { updatedAt?: string; lastAction?: string };
  proposalStudio?: Record<string, unknown>;
  proposalStudioAt?: string;
  winPlan?: Record<string, unknown>;
  winPlanUpdatedAt?: string;
  closeCoach?: Record<string, unknown>;

  estimateLines?: Array<{ name: string; role: string; qty: number; hours: number; costRate: number; sellRate: number; acceptance?: string }>;
  estimateSummary?: {
    estimatedHours: number;
    estimatedCost: number;
    estimatedPrice: number;
    estimatedMarginPct: number;
    baseCost?: number;
    floorPrice?: number;
    targetMargin?: number;
    floorMargin?: number;
    contingencyPct?: number;
  };
  dealScenarios?: Array<{ name: string; price: number; hours: number; marginPct: number; tradeoff: string }>;

  actualRevenue?: number;
  actualCost?: number;
  actualHours?: number;
  actualMarginPct?: number;
  clientRequestInbox?: string;

  scopeGraph?: Array<Record<string, unknown>>;
  scopeGraphUpdatedAt?: string;
  scopeBaseline?: Record<string, unknown>;

  changeOrderDraft?: string;
  changeOrderStatus?: string;
  changeOrderApprovedAt?: string;
  lastChangeOrderId?: string;
  lastChangeRequest?: string;
  lastNegotiationMessage?: string;

  clientDiscovery?: { name: string; email: string; answers: string[]; questions: string[]; submittedAt: string };
  discoveryShareStatus?: string;

  clarificationAnswers?: string[];

  closureDetails?: {
    contractStatus: string; finalPackage: string; finalPrice: number;
    depositRequired: boolean; depositReceived: boolean;
    kickoffDate: string; kickoffAuthorized: boolean; recordedAt: string;
  };
};

export function projectData(data: unknown): ProjectData {
  return (data && typeof data === "object" ? data : {}) as ProjectData;
}

const CONFIRMED_FACTS_LABEL =
  "CLIENT-CONFIRMED FACTS (explicitly provided by the client — treat these as verified, not assumptions, and do not ask the client to reconfirm them):";

function answerText(a: unknown): string {
  return typeof a === "string" && a.trim() ? a.trim() : "";
}

// Builds the "client-confirmed facts" prompt block from the two stored answer
// sources: clarificationAnswers (paired by index with the separate
// project.clarificationQuestions column) and clientDiscovery (self-contained).
// Returns "" when there is nothing to include. Never throws.
export function formatConfirmedFacts(p: { clarificationQuestions?: unknown }, d: ProjectData): string {
  try {
    const clarLines: string[] = [];
    const questions = Array.isArray(p?.clarificationQuestions) ? (p.clarificationQuestions as unknown[]) : [];
    const answers = Array.isArray(d?.clarificationAnswers) ? d.clarificationAnswers : [];
    answers.forEach((raw, i) => {
      const a = answerText(raw);
      const q = answerText(questions[i]);
      if (a && q) clarLines.push(`Q: ${q}\nA: ${a}`);
    });

    const discLines: string[] = [];
    const cd = d?.clientDiscovery;
    if (cd && typeof cd === "object") {
      const dq = Array.isArray(cd.questions) ? (cd.questions as unknown[]) : [];
      const da = Array.isArray(cd.answers) ? (cd.answers as unknown[]) : [];
      da.forEach((raw, i) => {
        const a = answerText(raw);
        if (!a) return;
        const item = dq[i];
        const q = answerText(typeof item === "string" ? item : (item as { question?: unknown } | null | undefined)?.question);
        if (q) discLines.push(`Q: ${q}\nA: ${a}`);
      });
      if (discLines.length) {
        discLines.unshift(`Discovery answers submitted by ${cd.name || "the client"} on ${cd.submittedAt || "an unknown date"}:`);
      }
    }

    const body = [...clarLines, ...discLines];
    return body.length ? [CONFIRMED_FACTS_LABEL, ...body].join("\n") : "";
  } catch {
    return "";
  }
}
