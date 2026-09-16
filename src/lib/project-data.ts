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
};

export function projectData(data: unknown): ProjectData {
  return (data && typeof data === "object" ? data : {}) as ProjectData;
}
