import { useEffect, useState } from "react";
import { api, auth, image } from "@appdeploy/client";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Sparkles,
  LayoutDashboard,
  FileText,
  Building2,
  CreditCard,
  MessageCircle,
  LogOut,
  Upload,
  Globe,
  Plus,
  Menu,
  X,
  Users,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Image as ImageIcon,
  Save,
  Printer,
  History,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Target } from "lucide-react";
import { Send } from "lucide-react";

type GroundingItem = {
  claim: string;
  kind: "seller_fact" | "client_fact" | "assumption" | "strategy";
  sourceRecordIds: string[];
  sourceFiles: string[];
  confidence: "grounded" | "client_supplied" | "assumption" | "recommendation";
};
type GroundingSummary = {
  grounded: number;
  clientSupplied: number;
  assumptions: number;
  recommendations: number;
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
type Report = {
  score: number;
  summary: string;
  risks: string[];
  questions: string[];
  proposal: string;
  projectId?: string;
  version?: number;
  grounding?: GroundingItem[];
  groundingSummary?: GroundingSummary;
  visuals?: Array<{
    type: string;
    title: string;
    labels: string[];
    values: number[];
  }>;
  winPlan?: WinPlan;
  evidenceStatus?: string;
};
type ProposalVersion = {
  version: number;
  proposal: string;
  savedAt: string;
  status: string;
};
type ProposalOptions = {
  mode: "Concise" | "Detailed" | "Premium";
  sections: string[];
  includeSellerLogo: boolean;
  includeClientLogo: boolean;
  includeVisuals: boolean;
};
type Profile = {
  name: string;
  email: string;
  address: string;
  company: string;
  expertise: string;
  website: string;
  plan: string;
  logoUrl?: string;
  onboarded?: boolean;
};
type CloseCoach = {
  nextBestAction: string;
  why: string;
  followUp: string;
  discoveryQuestions: string[];
  risk: string;
  generatedAt: string;
};
type DealStage =
  | "Draft"
  | "Proposal Ready"
  | "Sent"
  | "Follow-up"
  | "Negotiation"
  | "Won"
  | "Lost";
type CommercialLab = {
  pricing: {
    estimatedHours: number;
    estimatedCost: number;
    recommendedPrice: number;
    minimumSafePrice: number;
    expectedMarginPct: number;
    contingencyPct: number;
    basis: string[];
  };
  coverage?: { covered: number; ambiguous: number; unanswered: number };
  scope: {
    phases: Array<{
      name: string;
      deliverables: string[];
      tasks: string[];
      acceptanceCriteria: string[];
    }>;
    assumptions: string[];
    dependencies: string[];
    clientResponsibilities: string[];
    exclusions: string[];
  };
  changeDetection: {
    classification: string;
    reason: string;
    estimatedExtraHours: number;
    changeOrderRecommendation: string;
  };
  simulator: {
    scenarioPrice: number;
    scenarioHours: number;
    marginPct: number;
    riskImpact: string;
    tradeoffs: string[];
  };
  historical: { signals: string[]; sampleSize: number };
  intake: {
    requirements: string[];
    contradictions: string[];
    deadlines: string[];
    openQuestions: string[];
  };
  traceability: Array<{
    requirement: string;
    coverage: string;
    proposalSection: string;
    evidence: string;
    acceptanceCriterion: string;
  }>;
  feasibility: {
    status: string;
    estimatedHours: number;
    capacityHours: number;
    bottlenecks: string[];
  };
  negotiation: {
    recommendedApproach: string;
    protect: string[];
    giveGetTrades: string[];
    responseDraft: string;
  };
  memory: {
    estimatedVsActual: string;
    lessons: string[];
    futurePricingAdjustment: string;
  };
};
type Project = {
  id: string;
  client: string;
  brief: string;
  score: number;
  summary: string;
  proposal: string;
  createdAt: string;
  version?: number;
  risks?: string[];
  questions?: string[];
  grounding?: GroundingItem[];
  groundingSummary?: GroundingSummary;
  visuals?: Report["visuals"];
  proposalOptions?: ProposalOptions;
  winPlan?: WinPlan;
  dealStage?: DealStage;
  dealValue?: number;
  outcomeReason?: string;
  nextBestAction?: string;
  closeCoach?: CloseCoach;
  shareToken?: string;
  shareStatus?: string;
  clientDecision?: string;
  clientDecisionAt?: string;
  clientDecisionName?: string;
  clientDecisionEmail?: string;
  clientDecisionNote?: string;
  commercialLab?: CommercialLab;
  commercialInputs?: {
    internalRate: number;
    targetMargin: number;
    teamCapacityHours: number;
    scenarioPrice: number;
    scenarioHours: number;
  };
  actualHours?: number;
  actualCost?: number;
  changeOrderDraft?: string;
  changeOrderStatus?: string;
  commercialLabStale?: boolean;
  scopeBaseline?: {
    version: number;
    createdAt: string;
    proposalVersion: number;
  };
  commercialAudit?: Array<{ at: string; type: string; detail: string }>;
  estimateLines?: Array<{
    name: string;
    role: string;
    qty: number;
    hours: number;
    costRate: number;
    sellRate: number;
    acceptance?: string;
  }>;
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
  dealScenarios?: Array<{
    name: string;
    price: number;
    hours: number;
    marginPct: number;
    tradeoff: string;
  }>;
  actualRevenue?: number;
  actualMarginPct?: number;
  clientRequestInbox?: string;
  commercialAutopilot?: any;
  proposalStudio?: any;
  outcomeLearning?: any;
  dealOS?: any;
};
type PublicShare = {
  client: string;
  seller: string;
  proposal: string;
  version: number;
  dealValue: number;
  status: string;
  decision: string;
  decidedAt: string;
  scopeSummary?: Array<{
    name: string;
    qty: number;
    hours: number;
    acceptance: string;
  }>;
  scenarios?: Array<{
    name: string;
    price: number;
    hours: number;
    marginPct: number;
    tradeoff: string;
  }>;
  timeline?: string;
  proposalAuditScore?: number;
};
type ChatMsg = { role: "user" | "assistant"; text: string };
type Billing = {
  status: string;
  daysLeft: number;
  limit: number;
  checkoutStarted?: boolean;
};
type SquareStatus = {
  squareConfigured: boolean;
  connected: boolean;
  webhookConfigured?: boolean;
  mode: string;
  verification: string;
  locations?: Array<{
    id: string;
    name: string;
    status: string;
    currency: string;
    country: string;
  }>;
};
type BillingDetail = {
  billing: Billing;
  plan: string;
  subscriptionId: string;
  verifiedAt: string;
  checkoutStartedAt: string;
  trialStartedAt: string;
  trialEndsAt: string;
  chargedThroughDate: string;
  requiresAction: boolean;
  action: string;
  lastBillingEvent: string;
  lifecycle: string;
};
type Client = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  status?: "Prospect" | "Active" | "Won" | "Dormant" | "Lost";
  notes?: string;
  goals?: string;
  preferences?: string;
  decisionMakers?: string;
  painPoints?: string;
  buyingCriteria?: string;
  knownObjections?: string;
  nextStep?: string;
  followUpDate?: string;
  createdAt?: string;
  updatedAt?: string;
  proposalCount?: number;
  averageRisk?: number | null;
  lastOpportunityAt?: string;
  logoUrl?: string;
};
type KnowledgeFile = {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  status?: "ready" | "stored" | "failed";
  extractedChars?: number;
  error?: string;
  intelligenceStatus?: "ready" | "failed";
  intelligenceError?: string;
  documentType?: string;
  summary?: string;
  knowledgeCounts?: {
    services: number;
    differentiators: number;
    deliverables: number;
    pricing: number;
    proof: number;
    constraints: number;
  };
};
type KnowledgeRecord = {
  id: string;
  category: string;
  fact: string;
  sourceFileId: string;
  sourceFileName: string;
  documentType: string;
  createdAt: string;
  active: boolean;
};
type KnowledgeHealth = {
  healthy: boolean;
  checkedAt: string;
  files: number;
  facts: number;
  activeFacts: number;
  issues: {
    orphanFacts: number;
    duplicateFacts: number;
    failedFiles: number;
    missingOriginals: number;
  };
  missingOriginalFiles: string[];
  recommendation: string;
};
type DashboardIntelligence = {
  generatedAt: string;
  totals: {
    proposals: number;
    clients: number;
    linkedClients: number;
    averageRisk: number | null;
    highRisk: number;
    controlled: number;
    dueFollowUps: number;
    groundedClaims: number;
    assumptions: number;
  };
  month: {
    proposals: number;
    previousProposals: number;
    averageRisk: number | null;
    previousAverageRisk: number | null;
  };
  riskDistribution: { high: number; medium: number; low: number };
  statusCounts: Record<string, number>;
  trend: Array<{
    label: string;
    proposals: number;
    averageRisk: number | null;
  }>;
  topRisk: Array<{
    id: string;
    client: string;
    score: number;
    summary: string;
    createdAt: string;
  }>;
  commercialPerformance?: {
    closedDeals: number;
    wonDeals: number;
    lostDeals: number;
    winRate: number | null;
    wonValue: number;
    lostValue: number;
    averageWonDealSize: number | null;
    openPipelineValue: number;
    pipelineByStage: Array<{ stage: string; count: number; value: number }>;
    proposalDecisions: {
      shared: number;
      accepted: number;
      changesRequested: number;
      acceptanceRate: number | null;
      averageDecisionHours: number | null;
    };
  };
};
const plans = [
  {
    name: "Freelancer",
    price: "$19/mo",
    usage: "10 active deals / month",
    url: "https://square.link/u/NWh67o0Q?src=embed",
  },
  {
    name: "Pro",
    price: "$49/mo",
    usage: "40 active deals / month",
    url: "https://square.link/u/OTNXWzlA?src=embed",
    featured: true,
  },
  {
    name: "Agency",
    price: "$99/mo",
    usage: "150 active deals / month",
    url: "https://square.link/u/mQRs7BcJ?src=embed",
  },
];
const emptyProfile: Profile = {
  name: "",
  email: "",
  address: "",
  company: "",
  expertise: "",
  website: "",
  plan: "Freelancer",
};
const proposalSectionChoices = [
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
const defaultProposalOptions: ProposalOptions = {
  mode: "Detailed",
  sections: [...proposalSectionChoices],
  includeSellerLogo: true,
  includeClientLogo: false,
  includeVisuals: true,
};
function App() {
  const [squareStatus, setSquareStatus] = useState<SquareStatus | null>(null);
  const [billing, setBilling] = useState<Billing>({
    status: "setup",
    daysLeft: 30,
    limit: 10,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [knowledgeRecords, setKnowledgeRecords] = useState<KnowledgeRecord[]>(
    [],
  );
  const [knowledgeHealth, setKnowledgeHealth] =
    useState<KnowledgeHealth | null>(null);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeCategory, setKnowledgeCategory] = useState("All");
  const [knowledgeSource, setKnowledgeSource] = useState("All");
  const [knowledgeStatus, setKnowledgeStatus] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [selectedKnowledge, setSelectedKnowledge] =
    useState<KnowledgeRecord | null>(null);
  const emptyClientDraft = {
    name: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    status: "Prospect" as const,
    notes: "",
    goals: "",
    preferences: "",
    decisionMakers: "",
    painPoints: "",
    buyingCriteria: "",
    knownObjections: "",
    nextStep: "",
    followUpDate: "",
  };
  const [newClient, setNewClient] = useState({ ...emptyClientDraft });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDraft, setClientDraft] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [signed, setSigned] = useState(auth.isSignedIn());
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [mobile, setMobile] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [client, setClient] = useState("");
  const [result, setResult] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: "Hi! I’m the ScopeVanta guide. I can help you choose a plan, set up your account, or get more value from your proposals. What can I help with?",
    },
  ]);
  const [chatText, setChatText] = useState("");
  const [clarificationAnswers, setClarificationAnswers] = useState<string[]>(
    [],
  );
  const [proposalOptions, setProposalOptions] = useState<ProposalOptions>(
    defaultProposalOptions,
  );
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientLogoUrl, setClientLogoUrl] = useState("");
  const [editingProposal, setEditingProposal] = useState(false);
  const [proposalDraft, setProposalDraft] = useState("");
  const [proposalVersions, setProposalVersions] = useState<ProposalVersion[]>(
    [],
  );
  const [showVersions, setShowVersions] = useState(false);
  const [dashboardIntelligence, setDashboardIntelligence] =
    useState<DashboardIntelligence | null>(null);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [commercialBusy, setCommercialBusy] = useState(false);
  const [dealWorkspaceMode, setDealWorkspaceMode] = useState<"guide" | "full">(
    "guide",
  );
  const [dealWorkspaceStep, setDealWorkspaceStep] = useState<
    "understand" | "scope" | "price" | "propose" | "win" | "protect"
  >("understand");
  const [rateLibrary, setRateLibrary] = useState<
    Array<{
      id: string;
      name: string;
      costRate: number;
      sellRate: number;
      overheadPct: number;
    }>
  >([]);
  const [newRate, setNewRate] = useState({
    name: "",
    costRate: 0,
    sellRate: 0,
    overheadPct: 0,
  });
  const [estimateLines, setEstimateLines] = useState<
    Array<{
      name: string;
      role: string;
      qty: number;
      hours: number;
      costRate: number;
      sellRate: number;
      acceptance?: string;
    }>
  >([]);
  const [economics, setEconomics] = useState({
    floorMargin: 20,
    contingencyPct: 10,
    syncProposal: true,
  });
  const [actualRevenue, setActualRevenue] = useState(0);
  const [commercialInputs, setCommercialInputs] = useState({
    internalRate: 0,
    targetMargin: 35,
    teamCapacityHours: 0,
    actualHours: 0,
    actualCost: 0,
    changeRequest: "",
    negotiationMessage: "",
    scenarioPrice: 0,
    scenarioHours: 0,
  });
  const [winPlanBusy, setWinPlanBusy] = useState(false);
  const [closeCoachBusy, setCloseCoachBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [proposalStudioBusy, setProposalStudioBusy] = useState(false);
  const [proposalStudioInput, setProposalStudioInput] = useState("");
  const [dealReadiness, setDealReadiness] = useState<{
    checks: Array<{ key: string; label: string; pass: boolean }>;
    passed: number;
    total: number;
    readyToShare: boolean;
    next: string;
  } | null>(null);
  const [dealOSBusy, setDealOSBusy] = useState(false);
  const [dealOSInput, setDealOSInput] = useState("");
  const [dealOSTarget, setDealOSTarget] = useState(0);
  const [publicShare, setPublicShare] = useState<PublicShare | null>(null);
  const [publicDecision, setPublicDecision] = useState({
    name: "",
    email: "",
    note: "",
  });
  const [pricingBrain, setPricingBrain] = useState<any>(null);
  const [commercialHistory, setCommercialHistory] = useState<{
    baselines: any[];
    changeOrders: any[];
  }>({ baselines: [], changeOrders: [] });
  const [shareAnalytics, setShareAnalytics] = useState<any>(null);
  const [scopeGraph, setScopeGraph] = useState<any[]>([]);
  const [billingDetail, setBillingDetail] = useState<BillingDetail | null>(
    null,
  );
  const [analyticsSummary, setAnalyticsSummary] = useState<{
    counts: Record<string, number>;
    lastEventAt: string;
    eventsTracked: number;
  } | null>(null);
  useEffect(() => {
    const match = window.location.hash.match(/^#share=([a-zA-Z0-9_-]+)$/);
    if (match) {
      api
        .get(`/api/proposal-share/${match[1]}`)
        .then((r) => {
          setPublicShare(r.data.share);
          setLoading(false);
        })
        .catch(() => {
          setMsg("This proposal link is unavailable.");
          setLoading(false);
        });
      return;
    }
    void boot();
  }, []);
  useEffect(() => {
    if (
      profile.onboarded &&
      projects.length === 0 &&
      typeof window !== "undefined" &&
      window.localStorage.getItem("scopevanta_getting_started") !== "done"
    )
      setShowGettingStarted(true);
  }, [profile.onboarded, projects.length]);
  async function track(
    name: string,
    context: Record<string, string | number | boolean> = {},
  ) {
    try {
      await api.post("/api/analytics/event", { name, context });
    } catch {}
  }
  async function boot() {
    if (!auth.isSignedIn()) {
      setLoading(false);
      return;
    }
    try {
      const u = await auth.getUser();
      const r = await api.get("/api/profile");
      const p = r.data?.profile as Profile | undefined;
      setProfile(
        p || { ...emptyProfile, name: u?.name || "", email: u?.email || "" },
      );
      setBilling(
        r.data?.billing || { status: "setup", daysLeft: 30, limit: 10 },
      );
      setSigned(true);
      if (p?.onboarded) {
        const [q, c, f, k, s, d, a] = await Promise.all([
          api.get("/api/projects"),
          api.get("/api/clients"),
          api.get("/api/files"),
          api.get("/api/knowledge"),
          api.get("/api/billing/integration-status"),
          api.get("/api/dashboard/intelligence"),
          api.get("/api/analytics/summary"),
        ]);
        setProjects(q.data.projects || []);
        setClients(c.data.clients || []);
        setFiles(f.data.files || []);
        setKnowledgeRecords(k.data.records || []);
        setSquareStatus(s.data);
        setDashboardIntelligence(d.data);
        setAnalyticsSummary(a.data);
        void track("workspace_loaded", {
          proposals: (q.data.projects || []).length,
          clients: (c.data.clients || []).length,
        });
      }
    } catch {
      setMsg("We could not load your account. Please refresh.");
    } finally {
      setLoading(false);
    }
  }
  async function signIn() {
    setMsg("");
    try {
      await auth.signIn({ scope: "openid email profile offline_access" });
      setSigned(true);
      setLoading(true);
      await boot();
    } catch (e) {
      const c = (e as { code?: string }).code;
      setMsg(
        c === "popup_blocked"
          ? "Your browser blocked the secure sign-in window. Allow pop-ups for ScopeVanta and tap Log in again."
          : c === "popup_closed"
            ? "Sign-in was cancelled. Tap Log in when you are ready."
            : "Sign-in could not be completed. Please try again.",
      );
    }
  }
  async function signOut() {
    await auth.signOut();
    setSigned(false);
    setProfile(emptyProfile);
    setProjects([]);
    setView("dashboard");
  }
  async function saveProfile(next?: Profile) {
    const p = next || profile;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim());
    if (
      !p.name.trim() ||
      !validEmail ||
      !p.address.trim() ||
      !p.company.trim() ||
      !p.expertise.trim()
    ) {
      setMsg(
        "Enter your full name, a valid email address, business address, company and expertise.",
      );
      return null;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await api.put("/api/profile", p);
      setProfile(r.data.profile);
      setBilling(r.data.billing || billing);
      return r.data;
    } catch {
      setMsg("Profile could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function startPlan(p: (typeof plans)[number]) {
    const next = { ...profile, plan: p.name };
    const ok = await saveProfile(next);
    if (ok) {
      setBusy(true);
      try {
        const r = await api.post("/api/billing/checkout-started", {
          plan: p.name,
        });
        setBilling(r.data.billing);
        if (r.data.checkoutUrl) {
          void track("checkout_started", { plan: p.name });
          window.open(r.data.checkoutUrl, "_blank", "noopener,noreferrer");
        } else setMsg("Square checkout could not be opened.");
      } catch {
        setMsg("Square checkout could not be prepared. Please try again.");
      } finally {
        setBusy(false);
      }
    }
  }
  async function loadBillingDetail() {
    try {
      const r = await api.get("/api/billing/status");
      setBillingDetail(r.data);
    } catch {
      setBillingDetail(null);
    }
  }
  async function syncBilling() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.post("/api/billing/sync", {});
      setBilling(r.data.billing);
      setProfile((v) => ({ ...v, plan: r.data.plan || v.plan }));
      await loadBillingDetail();
      if (r.data.verified)
        void track("billing_verified", { plan: r.data.plan || profile.plan });
      setMsg(
        r.data.verified
          ? "Square subscription verified. Your ScopeVanta access is active."
          : "We have not found an active ScopeVanta subscription yet. Finish or restore Square checkout, then try again.",
      );
    } catch {
      setMsg("Square subscription verification is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function refreshClients() {
    const r = await api.get("/api/clients");
    setClients(r.data.clients || []);
  }
  async function addClient() {
    if (!newClient.name.trim()) {
      setMsg("Client name is required.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post("/api/clients", newClient);
      await refreshClients();
      setNewClient({ ...emptyClientDraft });
      setSelectedClient(r.data.client);
      setClientDraft(r.data.client);
      void track("client_created", {
        hasCompany: Boolean(newClient.company),
        hasGoals: Boolean(newClient.goals),
      });
      setMsg("Client intelligence profile created.");
    } catch {
      setMsg(
        "Client could not be added. Check the required fields and email format.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveClient() {
    if (!clientDraft?.id) return;
    setBusy(true);
    try {
      const r = await api.put(`/api/clients/${clientDraft.id}`, clientDraft);
      await refreshClients();
      setSelectedClient(r.data.client);
      setClientDraft(r.data.client);
      setMsg("Client intelligence updated.");
    } catch {
      setMsg("Client changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteClient(c: Client) {
    if (
      !window.confirm(
        `Delete ${c.company || c.name}? Clients with linked proposals cannot be deleted so deal history stays intact.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api.delete(`/api/clients/${c.id}`);
      await refreshClients();
      setSelectedClient(null);
      setClientDraft(null);
      setMsg("Client deleted.");
    } catch {
      setMsg(
        "This client could not be deleted. If proposals are linked, keep the client record to preserve history.",
      );
    } finally {
      setBusy(false);
    }
  }
  function useClientForProposal(c: Client) {
    setSelectedClientId(c.id);
    setClient(c.company || c.name);
    setSelectedClient(null);
    setClientDraft(null);
    setView("new");
  }
  async function refreshKnowledge() {
    const [f, k] = await Promise.all([
      api.get("/api/files"),
      api.get("/api/knowledge"),
    ]);
    setFiles(f.data.files || []);
    setKnowledgeRecords(k.data.records || []);
    setKnowledgeHealth(null);
  }
  async function checkKnowledgeHealth() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.get("/api/knowledge/health");
      setKnowledgeHealth(r.data as KnowledgeHealth);
      setMsg(
        r.data.healthy
          ? "Knowledge integrity checks passed."
          : "Knowledge integrity check found items that need attention.",
      );
    } catch {
      setMsg("Knowledge integrity check could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  async function reprocessKnowledgeFile(file: KnowledgeFile) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.post(`/api/files/${file.id}/reprocess`, {});
      await refreshKnowledge();
      setSelectedKnowledge(null);
      setMsg(
        `${file.name} reprocessed successfully · ${r.data.facts || 0} reusable facts rebuilt.`,
      );
    } catch {
      setMsg(
        `${file.name} could not be reprocessed. Existing knowledge was kept where possible.`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteKnowledgeFile(file: KnowledgeFile) {
    if (
      !window.confirm(
        `Delete ${file.name}? This removes the stored original and its reusable knowledge facts. Existing saved proposals and their historical evidence text are preserved.`,
      )
    )
      return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api.delete(`/api/files/${file.id}`);
      await refreshKnowledge();
      setSelectedKnowledge(null);
      setMsg(
        `${file.name} deleted · ${r.data.removedFacts || 0} derived facts removed. Existing proposals were preserved.`,
      );
    } catch {
      setMsg(`${file.name} could not be fully deleted. Please retry.`);
    } finally {
      setBusy(false);
    }
  }
  async function toggleKnowledge(record: KnowledgeRecord) {
    setBusy(true);
    try {
      const r = await api.put(`/api/knowledge/${record.id}`, {
        active: record.active === false,
      });
      const updated = r.data.record as KnowledgeRecord;
      setKnowledgeRecords((v) =>
        v.map((x) => (x.id === record.id ? updated : x)),
      );
      setSelectedKnowledge((v) => (v?.id === record.id ? updated : v));
      setMsg(
        updated.active
          ? "Knowledge fact activated for future proposals."
          : "Knowledge fact paused and excluded from future proposals.",
      );
    } catch {
      setMsg("Knowledge status could not be changed.");
    } finally {
      setBusy(false);
    }
  }
  async function uploadFile(
    file: File,
    kind: "logo" | "reference" | "client_logo",
    targetClientId = "",
  ) {
    if (file.size > 5 * 1024 * 1024) {
      setMsg("Files must be 5 MB or smaller.");
      return;
    }
    let uploadFile = file;
    let uploadType = file.type || "application/octet-stream";
    let uploadName = file.name;
    if (kind === "reference" && file.type.startsWith("image/")) {
      try {
        const prepared = await image.resizeIfNeeded(file, {
          maxDimension: 1600,
          maxPixels: 2000000,
          quality: 0.82,
          mimeType: "image/jpeg",
        });
        uploadFile = new File(
          [Uint8Array.from(atob(prepared.data), (c) => c.charCodeAt(0))],
          file.name.replace(/\.[^.]+$/, ".jpg"),
          { type: prepared.mimeType },
        );
        uploadType = prepared.mimeType;
        uploadName = uploadFile.name;
      } catch {
        setMsg("Image preparation failed. Please try another image.");
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || "");
      const content = raw.includes(",") ? raw.split(",")[1] : raw;
      setBusy(true);
      try {
        const r = await api.post("/api/upload", {
          name: uploadName,
          type: uploadType,
          content,
          kind,
          clientId:
            kind === "client_logo"
              ? targetClientId || selectedClientId
              : undefined,
        });
        if (kind === "logo") setProfile((v) => ({ ...v, logoUrl: r.data.url }));
        if (kind === "client_logo") {
          setClientLogoUrl(r.data.url);
          setProposalOptions((v) => ({ ...v, includeClientLogo: true }));
          await refreshClients();
          if (targetClientId) {
            setSelectedClient((v) =>
              v?.id === targetClientId ? { ...v, logoUrl: r.data.url } : v,
            );
            setClientDraft((v) =>
              v?.id === targetClientId ? { ...v, logoUrl: r.data.url } : v,
            );
          }
        }
        if (kind === "reference") {
          try {
            const k = await api.get("/api/knowledge");
            setKnowledgeRecords(k.data.records || []);
          } catch {}
        }
        if (kind === "reference" && r.data.status === "ready")
          void track("knowledge_ready", { type: uploadType });
        setMsg(
          kind === "logo"
            ? "Company logo saved."
            : kind === "client_logo"
              ? "Client logo ready for this proposal."
              : r.data.status === "ready"
                ? `Knowledge extracted from ${file.name} and ready for proposals.`
                : r.data.status === "failed"
                  ? `${file.name} was stored, but its text could not be extracted yet.`
                  : "Reference file stored. File intelligence support for this format is coming next.",
        );
      } catch {
        setMsg("Upload failed. Please try again.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(uploadFile);
  }
  async function analyze() {
    if (brief.trim().length < 40) {
      setMsg("Add at least a few sentences from the client brief.");
      return;
    }
    setBusy(true);
    setMsg("");
    setResult(null);
    setClarificationAnswers([]);
    try {
      const r = await api.post("/api/analyze", {
        brief,
        budget,
        timeline,
        client,
        clientId: selectedClientId,
        proposalOptions,
      });
      setResult(r.data);
      setProposalDraft(r.data.proposal || "");
      setEditingProposal(false);
      setShowVersions(false);
      setClarificationAnswers((r.data.questions || []).map(() => ""));
      const q = await api.get("/api/projects");
      setProjects(q.data.projects || []);
      void track("proposal_generated", {
        mode: proposalOptions.mode,
        risk: Number(r.data.score || 0),
        clientLinked: Boolean(selectedClientId),
      });
    } catch {
      setMsg("Analysis could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function loadRates() {
    try {
      const r = await api.get("/api/commercial/rates");
      setRateLibrary(r.data.rates || []);
    } catch {}
  }
  async function loadDurableCommercial(id: string) {
    try {
      const [h, b, a] = await Promise.all([
        api.get(`/api/projects/${id}/commercial-history`),
        api.get("/api/pricing-brain"),
        api.get(`/api/projects/${id}/share-analytics`),
      ]);
      setCommercialHistory(h.data || { baselines: [], changeOrders: [] });
      setPricingBrain(b.data);
      setShareAnalytics(a.data);
    } catch {}
  }
  async function saveScopeGraph() {
    if (!result?.projectId || !scopeGraph.length) return;
    setCommercialBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/scope-graph`,
        { nodes: scopeGraph },
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(
        "Editable scope graph saved. Pricing and proposal guidance are marked for recalculation.",
      );
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Scope graph could not be saved.");
    } finally {
      setCommercialBusy(false);
    }
  }
  async function createDiscoveryLink() {
    if (!result?.projectId) return;
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/discovery-share`,
        {},
      );
      const url = `${window.location.origin}${window.location.pathname}#discovery=${r.data.token}`;
      await navigator.clipboard.writeText(url);
      setMsg("Client discovery link created and copied.");
    } catch (e: any) {
      setMsg(
        e?.response?.data?.error ||
          "Run Discovery Agent first, then create the client link.",
      );
    }
  }
  async function addRate() {
    if (!newRate.name.trim()) return;
    try {
      const r = await api.post("/api/commercial/rates", newRate);
      setRateLibrary((v) => [...v, r.data.rate]);
      setNewRate({ name: "", costRate: 0, sellRate: 0, overheadPct: 0 });
    } catch {
      setMsg("Rate could not be saved.");
    }
  }
  async function saveScopeEconomics() {
    if (!result?.projectId) return;
    setCommercialBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/scope-economics`,
        {
          lines: estimateLines,
          targetMargin: commercialInputs.targetMargin,
          floorMargin: economics.floorMargin,
          contingencyPct: economics.contingencyPct,
          syncProposal: economics.syncProposal,
        },
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      if (economics.syncProposal && p.proposal) {
        setResult((v) => (v ? { ...v, proposal: p.proposal } : v));
        setProposalDraft(p.proposal);
      }
      setMsg("Scope economics recalculated and saved.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Scope economics could not be saved.");
    } finally {
      setCommercialBusy(false);
    }
  }
  async function saveCommercialState() {
    if (!result?.projectId) return;
    setCommercialBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/commercial-state`,
        {
          estimateLines,
          actualRevenue,
          actualHours: commercialInputs.actualHours,
          actualCost: commercialInputs.actualCost,
          clientRequest: commercialInputs.changeRequest,
        },
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(
        "Estimate, actuals and client request saved. Downstream intelligence is ready to recalculate.",
      );
    } catch {
      setMsg("Commercial state could not be saved.");
    } finally {
      setCommercialBusy(false);
    }
  }
  async function runCommercialAutopilot() {
    if (!result?.projectId) return;
    setCommercialBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/commercial-autopilot`,
        {},
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(
        "Commercial Autopilot refreshed from current opportunity evidence.",
      );
    } catch {
      setMsg("Commercial Autopilot could not be refreshed.");
    } finally {
      setCommercialBusy(false);
    }
  }
  async function buildCommercialLab() {
    if (!result?.projectId) return;
    setCommercialBusy(true);
    setMsg("");
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/commercial-lab`,
        commercialInputs,
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(
        "Commercial intelligence rebuilt across pricing, scope, delivery and negotiation.",
      );
    } catch (e: any) {
      setMsg(
        e?.response?.data?.error ||
          "Commercial intelligence could not be built.",
      );
    } finally {
      setCommercialBusy(false);
    }
  }
  async function establishBaseline() {
    if (!result?.projectId) return;
    setCommercialBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/scope-baseline`,
        {},
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(`Scope baseline ${p.scopeBaseline?.version || 1} established.`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Could not establish scope baseline.");
    } finally {
      setCommercialBusy(false);
    }
  }
  async function approveChangeOrder() {
    if (!result?.projectId) return;
    setCommercialBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/change-order/approve`,
        {},
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg("Change order approved and recorded in commercial history.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Could not approve change order.");
    } finally {
      setCommercialBusy(false);
    }
  }
  async function runDealOS(action: string) {
    if (!result?.projectId) return;
    setDealOSBusy(true);
    setMsg("");
    try {
      const r = await api.post(`/api/projects/${result.projectId}/deal-os`, {
        action,
        input: dealOSInput,
        targetPrice: dealOSTarget,
        targetMargin: commercialInputs.targetMargin,
      });
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(`Deal OS ${action} intelligence refreshed.`);
    } catch (e: any) {
      setMsg(
        e?.response?.data?.error || "Deal OS could not complete this analysis.",
      );
    } finally {
      setDealOSBusy(false);
    }
  }
  async function loadDealReadiness(projectId?: string) {
    const id = projectId || result?.projectId;
    if (!id) return;
    try {
      const r = await api.get(`/api/projects/${id}/readiness`);
      setDealReadiness(r.data);
    } catch {
      setDealReadiness(null);
    }
  }
  async function revokeProposalShare() {
    if (!result?.projectId) return;
    setShareBusy(true);
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/share/revoke`,
        {},
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg("Client review link revoked.");
      void loadDealReadiness();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Could not revoke client review.");
    } finally {
      setShareBusy(false);
    }
  }
  async function runProposalStudio(
    action: "audit" | "meeting" | "objection" | "followup" = "audit",
  ) {
    if (!result?.projectId) return;
    setProposalStudioBusy(true);
    setMsg("");
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/proposal-studio`,
        { action, input: proposalStudioInput },
      );
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(`Proposal Studio ${action} intelligence refreshed.`);
    } catch (e: any) {
      setMsg(
        e?.response?.data?.error || "Proposal Studio could not be refreshed.",
      );
    } finally {
      setProposalStudioBusy(false);
    }
  }
  async function shareProposal() {
    if (!result?.projectId) return;
    setShareBusy(true);
    setMsg("");
    try {
      const r = await api.post(`/api/projects/${result.projectId}/share`, {});
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      const url = `${window.location.origin}${window.location.pathname}#share=${r.data.token}`;
      await navigator.clipboard.writeText(url);
      setMsg("Secure proposal link created and copied.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Could not create proposal link.");
    } finally {
      setShareBusy(false);
    }
  }
  async function saveDeal(stage: DealStage, value?: number, reason?: string) {
    if (!result?.projectId) return;
    try {
      const r = await api.put(`/api/projects/${result.projectId}/deal`, {
        dealStage: stage,
        dealValue: value,
        outcomeReason: reason,
      });
      const p = r.data.project as Project;
      setProjects((v) => v.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      setMsg(`Deal moved to ${stage}.`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Could not update the deal.");
    }
  }
  async function buildCloseCoach() {
    if (!result?.projectId) return;
    setCloseCoachBusy(true);
    setMsg("");
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/close-coach`,
        {},
      );
      setProjects((v) =>
        v.map((p) =>
          p.id === result.projectId
            ? {
                ...p,
                closeCoach: r.data.closeCoach,
                nextBestAction: r.data.closeCoach.nextBestAction,
              }
            : p,
        ),
      );
      setMsg("Next best action and follow-up are ready.");
    } catch {
      setMsg("Closing guidance could not be built. Please try again.");
    } finally {
      setCloseCoachBusy(false);
    }
  }
  async function buildWinPlan() {
    if (!result?.projectId) return;
    setWinPlanBusy(true);
    setMsg("");
    try {
      const r = await api.post(
        `/api/projects/${result.projectId}/win-plan`,
        {},
      );
      setResult((v) => (v ? { ...v, winPlan: r.data.winPlan } : v));
      setProjects((v) =>
        v.map((p) =>
          p.id === result.projectId ? { ...p, winPlan: r.data.winPlan } : p,
        ),
      );
      setMsg("Win strategy built from this opportunity and proposal.");
    } catch {
      setMsg("Win strategy could not be built. Please try again.");
    } finally {
      setWinPlanBusy(false);
    }
  }
  async function refineProposal() {
    if (!result?.projectId) return;
    if (!clarificationAnswers.some((v) => v.trim())) {
      setMsg("Answer at least one clarification question first.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await api.post(`/api/projects/${result.projectId}/refine`, {
        answers: clarificationAnswers,
        proposalOptions,
      });
      setResult((v) =>
        v
          ? {
              ...v,
              summary: r.data.summary,
              risks: r.data.risks || [],
              proposal: r.data.proposal,
              version: r.data.version,
              visuals: r.data.visuals || v.visuals,
              grounding: r.data.grounding || [],
              groundingSummary: r.data.groundingSummary,
              winPlan: undefined,
              evidenceStatus: "current",
            }
          : v,
      );
      setProposalDraft(r.data.proposal || "");
      setEditingProposal(false);
      setShowVersions(false);
      const q = await api.get("/api/projects");
      setProjects(q.data.projects || []);
      void track("proposal_refined", {
        version: Number(r.data.version || 0),
        answers: clarificationAnswers.filter((v) => v.trim()).length,
      });
      setMsg("Proposal refined with your clarification answers.");
    } catch {
      setMsg("Proposal refinement could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function openProject(p: Project) {
    void loadRates();
    void loadDealReadiness(p.id);
    void loadDurableCommercial(p.id);
    setScopeGraph((p as any).scopeGraph || []);
    setDealWorkspaceMode("guide");
    setDealWorkspaceStep(
      p.changeOrderStatus === "draft" || p.changeOrderStatus === "approved"
        ? "protect"
        : p.scopeBaseline
          ? "win"
          : p.commercialLab
            ? "price"
            : "understand",
    );
    setEstimateLines(p.estimateLines || []);
    setActualRevenue(p.actualRevenue || 0);
    setCommercialInputs({
      internalRate: p.commercialInputs?.internalRate || 0,
      targetMargin: p.commercialInputs?.targetMargin || 35,
      teamCapacityHours: p.commercialInputs?.teamCapacityHours || 0,
      actualHours: p.actualHours || 0,
      actualCost: p.actualCost || 0,
      changeRequest: "",
      negotiationMessage: "",
      scenarioPrice: p.commercialInputs?.scenarioPrice || 0,
      scenarioHours: p.commercialInputs?.scenarioHours || 0,
    });
    setClient(p.client || "");
    setBrief(p.brief || "");
    setSelectedClientId((p as Project & { clientId?: string }).clientId || "");
    const linkedClient = clients.find(
      (c) => c.id === (p as Project & { clientId?: string }).clientId,
    );
    setClientLogoUrl(linkedClient?.logoUrl || "");
    setResult({
      score: p.score,
      summary: p.summary,
      risks: p.risks || [],
      questions: p.questions || [],
      proposal: p.proposal,
      projectId: p.id,
      version: p.version,
      grounding: p.grounding || [],
      groundingSummary: p.groundingSummary,
      visuals: p.visuals || [],
      winPlan: p.winPlan,
    });
    setProposalDraft(p.proposal || "");
    setClarificationAnswers((p.questions || []).map(() => ""));
    if (p.proposalOptions) setProposalOptions(p.proposalOptions);
    setEditingProposal(false);
    setShowVersions(false);
    setView("new");
  }
  async function saveProposal() {
    if (!result?.projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api.put(`/api/projects/${result.projectId}/proposal`, {
        proposal: proposalDraft,
        proposalOptions,
      });
      setResult((v) =>
        v
          ? {
              ...v,
              proposal: r.data.proposal,
              version: r.data.version,
              grounding: r.data.grounding || [],
              groundingSummary: r.data.groundingSummary,
              winPlan: r.data.winPlan,
              evidenceStatus: r.data.evidenceStatus,
            }
          : v,
      );
      setProposalDraft(r.data.proposal);
      setEditingProposal(false);
      const q = await api.get("/api/projects");
      setProjects(q.data.projects || []);
      void track("proposal_edited", { version: Number(r.data.version || 0) });
      setMsg(`Proposal version ${r.data.version} saved.`);
    } catch {
      setMsg("Proposal changes could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function loadVersions() {
    if (!result?.projectId) return;
    try {
      const r = await api.get(`/api/projects/${result.projectId}/versions`);
      setProposalVersions(r.data.versions || []);
      setShowVersions(true);
    } catch {
      setMsg("Version history could not be loaded.");
    }
  }
  function printProposal() {
    void track("proposal_printed", { version: Number(result?.version || 1) });
    window.print();
  }
  async function sendChat() {
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    setChat((v) => [...v, { role: "user", text }]);
    try {
      const r = await api.post("/api/support", {
        message: text,
        history: chat.slice(-6),
      });
      setChat((v) => [...v, { role: "assistant", text: r.data.reply }]);
    } catch {
      setChat((v) => [
        ...v,
        {
          role: "assistant",
          text: "I hit a temporary issue. Please try that question again.",
        },
      ]);
    }
  }
  if (loading) return <div className="loading">Loading ScopeVanta…</div>;
  if (publicShare)
    return (
      <div className="publicProposal">
        <header>
          <b>ScopeVanta</b>
          <span>Proposal review</span>
        </header>
        <main>
          <div className="publicProposalHead">
            <span className="eyebrow">
              PROPOSAL FROM {publicShare.seller.toUpperCase()}
            </span>
            <h1>{publicShare.client}</h1>
            <p>
              Version {publicShare.version}
              {publicShare.dealValue
                ? ` · ${publicShare.dealValue.toLocaleString()}`
                : ""}
            </p>
          </div>
          {publicShare.scenarios?.length ? (
            <section className="buyerPackages">
              <span className="eyebrow">CHOOSE THE APPROACH THAT FITS</span>
              <div className="scenarioCards">
                {publicShare.scenarios.map((s: any) => (
                  <article
                    key={s.name}
                    className={
                      (publicShare as any).selectedScenario === s.name
                        ? "selected"
                        : ""
                    }
                  >
                    <small>{s.name}</small>
                    <b>${Number(s.price || 0).toLocaleString()}</b>
                    <span>
                      {Number(s.hours || 0)}h
                      {s.marginPct ? ` · ${s.marginPct}% modeled margin` : ""}
                    </span>
                    <p>{s.bestFor || s.tradeoff || ""}</p>
                    <button
                      disabled={Boolean(publicShare.decision)}
                      onClick={async () => {
                        try {
                          await api.post(
                            `/api/proposal-share/${window.location.hash.slice(7)}/scenario`,
                            { name: s.name },
                          );
                          setPublicShare({
                            ...publicShare,
                            selectedScenario: s.name,
                          } as any);
                        } catch {
                          setMsg("Package selection could not be saved.");
                        }
                      }}
                    >
                      {(publicShare as any).selectedScenario === s.name
                        ? "Selected"
                        : "Select package"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <pre className="publicProposalDoc">{publicShare.proposal}</pre>
          {publicShare.decision ? (
            <div className="publicDecisionDone">
              <CheckCircle2 />
              <h2>Decision recorded</h2>
              <p>
                This proposal was marked{" "}
                <b>
                  {publicShare.decision === "accepted"
                    ? "accepted"
                    : "changes requested"}
                </b>
                {publicShare.decidedAt
                  ? ` on ${new Date(publicShare.decidedAt).toLocaleDateString()}`
                  : ""}
                .
              </p>
            </div>
          ) : (
            <section className="publicDecision">
              <span className="eyebrow">YOUR DECISION</span>
              <h2>Ready to move forward?</h2>
              <p>
                Acceptance records your decision in ScopeVanta. It is not a
                substitute for any separate legal contract, signature or payment
                your seller requires.
              </p>
              <div className="two">
                <label>
                  Name
                  <input
                    value={publicDecision.name}
                    onChange={(e) =>
                      setPublicDecision({
                        ...publicDecision,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={publicDecision.email}
                    onChange={(e) =>
                      setPublicDecision({
                        ...publicDecision,
                        email: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Note or requested changes
                <textarea
                  value={publicDecision.note}
                  onChange={(e) =>
                    setPublicDecision({
                      ...publicDecision,
                      note: e.target.value,
                    })
                  }
                  placeholder="Optional when accepting; required when requesting changes."
                />
              </label>
              <div className="publicDecisionActions">
                <button
                  onClick={async () => {
                    try {
                      await api.post(
                        `/api/proposal-share/${window.location.hash.slice(7)}/decision`,
                        { ...publicDecision, decision: "changes_requested" },
                      );
                      setPublicShare({
                        ...publicShare,
                        decision: "changes_requested",
                        decidedAt: new Date().toISOString(),
                      });
                    } catch (e: any) {
                      setMsg(
                        e?.response?.data?.error ||
                          "Could not record decision.",
                      );
                    }
                  }}
                >
                  Request changes
                </button>
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      await api.post(
                        `/api/proposal-share/${window.location.hash.slice(7)}/decision`,
                        { ...publicDecision, decision: "accepted" },
                      );
                      setPublicShare({
                        ...publicShare,
                        decision: "accepted",
                        decidedAt: new Date().toISOString(),
                      });
                    } catch (e: any) {
                      setMsg(
                        e?.response?.data?.error ||
                          "Could not record decision.",
                      );
                    }
                  }}
                >
                  <CheckCircle2 size={15} /> Accept proposal
                </button>
              </div>
              {msg && <div className="error">{msg}</div>}
            </section>
          )}
        </main>
      </div>
    );
  if (!signed)
    return (
      <main className="public">
        <nav>
          <div className="brand">
            <img src="./resources/scopevanta-logo.png" alt="ScopeVanta" />
          </div>
          <button className="login" type="button" onClick={() => void signIn()}>
            Log in
          </button>
        </nav>
        <section className="hero">
          <div className="pill">
            <Sparkles size={14} /> AI deal intelligence for service businesses
          </div>
          <h1>
            Turn client requests into <span>deals you can win</span>.
          </h1>
          <p>
            Scope smarter, build stronger proposals and protect your margin from
            the first conversation through delivery.
          </p>
          <button
            className="primary"
            type="button"
            onClick={() => void signIn()}
          >
            Start your 30-day trial <ArrowRight size={17} />
          </button>
          <small>
            No permanent free plan. Choose a subscription during setup.
          </small>
          {msg && <div className="error">{msg}</div>}
        </section>
        <section className="pricing publicPricing">
          <h2>Choose the plan that grows with you.</h2>
          <div className="plans">
            {plans.map((p) => (
              <article className={p.featured ? "featured" : ""} key={p.name}>
                {p.featured && <em>Most popular</em>}
                <h3>{p.name}</h3>
                <strong>{p.price}</strong>
                <p>{p.usage}</p>
                <p className="trial">30-day introductory trial</p>
                <button type="button" onClick={() => void signIn()}>
                  Start trial
                </button>
              </article>
            ))}
          </div>
          <p className="billingNote">
            A real name, valid account email and Square payment method are
            required to activate the trial. Card details are entered only on
            Square and never stored by ScopeVanta. The introductory month is $0,
            then monthly billing begins unless cancelled.
          </p>
        </section>
      </main>
    );
  if (!profile.onboarded)
    return (
      <main className="onboard">
        <div className="onboardCard">
          <div className="brand">
            <img src="./resources/scopevanta-logo.png" alt="ScopeVanta" />
          </div>
          <div className="progress">
            <i />
            <i />
            <i />
          </div>
          <h1>Set up your ScopeVanta workspace</h1>
          <p>
            We use this context to make every proposal sound like your business,
            not a generic AI template.
          </p>
          <div className="formGrid">
            <label>
              Full name
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                placeholder="you@company.com"
              />
            </label>
            <label className="wide">
              Business address
              <input
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
                placeholder="Street, city, province/state, country"
              />
            </label>
            <label>
              Company name
              <input
                value={profile.company}
                onChange={(e) =>
                  setProfile({ ...profile, company: e.target.value })
                }
              />
            </label>
            <label>
              Website
              <input
                value={profile.website}
                onChange={(e) =>
                  setProfile({ ...profile, website: e.target.value })
                }
                placeholder="https://…"
              />
            </label>
            <label className="wide">
              Expertise & services
              <textarea
                value={profile.expertise}
                onChange={(e) =>
                  setProfile({ ...profile, expertise: e.target.value })
                }
                placeholder="Tell ScopeVanta what your team is great at, typical services, industries and differentiators."
              />
            </label>
          </div>
          <div className="uploadRow">
            <label className="uploadBox">
              <Upload size={20} />
              <b>Add company logo</b>
              <span>PNG/JPG, up to 5 MB</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  e.target.files?.[0] && uploadFile(e.target.files[0], "logo")
                }
              />
            </label>
            <label className="uploadBox">
              <FileText size={20} />
              <b>Add company reference file</b>
              <span>Capability deck, service sheet or text/PDF</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx,image/*"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  uploadFile(e.target.files[0], "reference")
                }
              />
            </label>
          </div>
          <h2>Choose your plan</h2>
          <div className="plans compact">
            {plans.map((p) => (
              <article
                className={profile.plan === p.name ? "selected" : ""}
                key={p.name}
                onClick={() => setProfile({ ...profile, plan: p.name })}
              >
                <h3>{p.name}</h3>
                <strong>{p.price}</strong>
                <p>{p.usage}</p>
                <span>30-day introductory trial</span>
              </article>
            ))}
          </div>
          {msg && <div className="error">{msg}</div>}
          <button
            className="primary full"
            disabled={busy}
            onClick={async () => {
              const saved = await saveProfile({ ...profile, onboarded: true });
              if (!saved) return;
              setProfile((v) => ({ ...v, onboarded: true }));
              if (saved.billing?.status === "owner_test") {
                setBilling(saved.billing);
                setMsg(
                  "Owner access activated. Full ScopeVanta capability is available without a subscription.",
                );
                await boot();
                return;
              }
              const p = plans.find((x) => x.name === profile.plan);
              if (p) {
                setBusy(true);
                try {
                  const r = await api.post("/api/billing/checkout-started", {
                    plan: p.name,
                  });
                  setBilling(r.data.billing);
                  if (r.data.checkoutUrl)
                    window.open(
                      r.data.checkoutUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  else setMsg("Square checkout could not be opened.");
                } catch {
                  setMsg(
                    "Square checkout could not be prepared. Please try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }
            }}
          >
            {busy
              ? "Saving…"
              : billing.status === "owner_test"
                ? "Enter owner workspace"
                : "Continue to Square & activate"}{" "}
            <ArrowRight size={17} />
          </button>
          <p className="billingNote">
            Your workspace is saved before checkout. Your account name and valid
            email are required, and Square securely collects the payment method.
            ScopeVanta never receives the full card number. The introductory
            month is $0, then the selected monthly price begins unless
            cancelled.
          </p>
        </div>
      </main>
    );
  const nav = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["new", "New proposal", Plus],
    ["projects", "Proposals", FileText],
    ["clients", "Clients", Users],
    ["files", "Knowledge", FolderOpen],
    ["company", "Company profile", Building2],
    ["billing", "Plan & billing", CreditCard],
  ] as const;
  const setupSteps = [
    {
      label: "Company profile",
      done: Boolean(profile.company && profile.expertise),
      action: () => setView("company"),
    },
    {
      label: "Knowledge source",
      done: files.some((f) => f.status === "ready"),
      action: () => setView("files"),
    },
    {
      label: "Client context",
      done: clients.length > 0,
      action: () => setView("clients"),
    },
    {
      label: "First proposal",
      done: projects.length > 0,
      action: () => setView("new"),
    },
    {
      label: billing.status === "owner_test" ? "Owner access" : "Subscription",
      done:
        billing.status === "owner_test" || billing.status === "verified_active",
      action: () => setView("billing"),
    },
  ];
  const setupDone = setupSteps.filter((s) => s.done).length;
  const nextSetup = setupSteps.find((s) => !s.done);
  return (
    <main className="portal">
      <aside className={mobile ? "open" : ""}>
        <div className="brand">
          <img src="./resources/scopevanta-logo.png" alt="ScopeVanta" />
        </div>
        <button className="close" onClick={() => setMobile(false)}>
          <X />
        </button>
        <div className="companyMini">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt="Company logo" />
          ) : (
            <div>{profile.company.slice(0, 2).toUpperCase()}</div>
          )}
          <span>
            <b>{profile.company}</b>
            <small>
              {profile.plan} ·{" "}
              {billing.checkoutStarted
                ? billing.daysLeft + " trial days left"
                : "activation required"}
            </small>
          </span>
        </div>
        {nav.map(([id, label, Icon]) => (
          <button
            className={view === id ? "active" : ""}
            key={id}
            onClick={() => {
              setView(id);
              setMobile(false);
              if (id === "billing") void loadBillingDetail();
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <div className="navProgress">
          <small>WORKSPACE READINESS</small>
          <div>
            <span
              style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}
            />
          </div>
          <b>
            {setupDone}/{setupSteps.length} complete
          </b>
        </div>
        <button className="logout" onClick={signOut}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <section className="portalMain">
        <header>
          <button className="menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div>
            <b>
              {view === "dashboard"
                ? "Good to see you, " + profile.name.split(" ")[0]
                : nav.find((n) => n[0] === view)?.[1]}
            </b>
            <small>Turn opportunities into winning deals.</small>
          </div>
          <button className="supportTop" onClick={() => setChatOpen(true)}>
            <MessageCircle size={17} /> Support
          </button>
        </header>
        {msg && (
          <div className="toast">
            {msg}
            <button onClick={() => setMsg("")}>×</button>
          </div>
        )}
        {showGettingStarted && (
          <div className="gettingStarted">
            <div>
              <span className="eyebrow">QUICK START</span>
              <h2>Get to your first protected proposal</h2>
              <p>
                ScopeVanta gets stronger as you add company knowledge and client
                context. Complete the essentials, then analyze a real
                opportunity.
              </p>
              <div className="setupSteps">
                {setupSteps.map((step, i) => (
                  <button
                    key={step.label}
                    className={step.done ? "done" : ""}
                    onClick={() => {
                      step.action();
                      setShowGettingStarted(false);
                    }}
                  >
                    <span>
                      {step.done ? <CheckCircle2 size={16} /> : i + 1}
                    </span>
                    <b>{step.label}</b>
                    <small>{step.done ? "Ready" : "Set up"}</small>
                  </button>
                ))}
              </div>
            </div>
            <button
              className="dismissGuide"
              onClick={() => {
                setShowGettingStarted(false);
                window.localStorage.setItem(
                  "scopevanta_getting_started",
                  "done",
                );
              }}
            >
              ×
            </button>
          </div>
        )}
        {view === "dashboard" && (
          <div className="page dashboardPage">
            <div className="dashTitle">
              <div>
                <span className="eyebrow">COMMERCIAL INTELLIGENCE</span>
                <h1>Business command center</h1>
                <p>
                  See pipeline velocity, scope exposure, client health and
                  proposal quality from live ScopeVanta records.
                </p>
              </div>
              <button className="primary" onClick={() => setView("new")}>
                <Plus size={15} /> New opportunity
              </button>
            </div>
            {nextSetup && (
              <div className="nextAction">
                <div>
                  <span className="eyebrow">RECOMMENDED NEXT ACTION</span>
                  <b>
                    {nextSetup.label === "Knowledge source"
                      ? "Teach ScopeVanta how your business sells"
                      : nextSetup.label === "Client context"
                        ? "Add a real buyer before your first proposal"
                        : nextSetup.label === "First proposal"
                          ? "Analyze your first live opportunity"
                          : nextSetup.label === "Subscription"
                            ? "Activate your workspace"
                            : "Finish your company intelligence"}
                  </b>
                  <small>
                    {setupDone}/{setupSteps.length} activation milestones
                    complete
                  </small>
                </div>
                <button onClick={nextSetup.action}>
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="kpiGrid">
              <article>
                <small>THIS MONTH</small>
                <strong>
                  {dashboardIntelligence?.month.proposals ?? projects.length}
                </strong>
                <span>
                  {dashboardIntelligence
                    ? `${dashboardIntelligence.month.proposals - dashboardIntelligence.month.previousProposals >= 0 ? "+" : ""}${dashboardIntelligence.month.proposals - dashboardIntelligence.month.previousProposals} vs last month`
                    : "Proposal activity"}
                </span>
              </article>
              <article>
                <small>AVG SCOPE RISK</small>
                <strong>
                  {dashboardIntelligence?.totals.averageRisk ?? "—"}
                </strong>
                <span>
                  {dashboardIntelligence
                    ? `${dashboardIntelligence.totals.highRisk} high-risk opportunities`
                    : "No analyzed deals yet"}
                </span>
              </article>
              <article>
                <small>CLIENT COVERAGE</small>
                <strong>
                  {dashboardIntelligence?.totals.linkedClients ?? 0}
                  <i>
                    /{dashboardIntelligence?.totals.clients ?? clients.length}
                  </i>
                </strong>
                <span>
                  {dashboardIntelligence?.totals.dueFollowUps
                    ? `${dashboardIntelligence.totals.dueFollowUps} follow-ups due`
                    : "No overdue follow-ups"}
                </span>
              </article>
              <article>
                <small>PROPOSAL EVIDENCE</small>
                <strong>
                  {dashboardIntelligence?.totals.groundedClaims ?? 0}
                </strong>
                <span>
                  {dashboardIntelligence
                    ? `${dashboardIntelligence.totals.assumptions} assumptions tracked`
                    : "Grounded claims across proposals"}
                </span>
              </article>
            </div>
            {dashboardIntelligence && (
              <div className="biGrid">
                <section className="dashPanel">
                  <div className="panelHead">
                    <div>
                      <span className="eyebrow">6-MONTH ACTIVITY</span>
                      <h2>Proposal velocity & risk</h2>
                    </div>
                  </div>
                  <div className="trendChart">
                    {dashboardIntelligence.trend.map((point) => {
                      const max = Math.max(
                        1,
                        ...dashboardIntelligence.trend.map((v) => v.proposals),
                      );
                      return (
                        <div key={point.label}>
                          <div className="trendBars">
                            <i
                              style={{
                                height: `${Math.max(5, (point.proposals / max) * 100)}%`,
                              }}
                            />
                            <em
                              style={{
                                bottom: `${Math.min(92, point.averageRisk ?? 0)}%`,
                              }}
                            />
                          </div>
                          <b>{point.proposals}</b>
                          <small>
                            {point.label} · risk {point.averageRisk ?? "—"}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="dashPanel">
                  <div className="panelHead">
                    <div>
                      <span className="eyebrow">RISK MIX</span>
                      <h2>Scope exposure</h2>
                    </div>
                  </div>
                  <div className="riskMix">
                    <div>
                      <strong className="high">
                        {dashboardIntelligence.riskDistribution.high}
                      </strong>
                      <span>High</span>
                    </div>
                    <div>
                      <strong className="medium">
                        {dashboardIntelligence.riskDistribution.medium}
                      </strong>
                      <span>Review</span>
                    </div>
                    <div>
                      <strong className="low">
                        {dashboardIntelligence.riskDistribution.low}
                      </strong>
                      <span>Controlled</span>
                    </div>
                  </div>
                  <div className="riskMixBar">
                    <i
                      style={{
                        width: `${dashboardIntelligence.totals.proposals ? (dashboardIntelligence.riskDistribution.high / dashboardIntelligence.totals.proposals) * 100 : 0}%`,
                      }}
                    />
                    <em
                      style={{
                        width: `${dashboardIntelligence.totals.proposals ? (dashboardIntelligence.riskDistribution.medium / dashboardIntelligence.totals.proposals) * 100 : 0}%`,
                      }}
                    />
                    <span />
                  </div>
                </section>
              </div>
            )}
            {dashboardIntelligence?.commercialPerformance && (
              <section className="commercialPerformance">
                <div className="panelHead">
                  <div>
                    <span className="eyebrow">
                      RECORDED COMMERCIAL OUTCOMES
                    </span>
                    <h2>Performance intelligence</h2>
                    <p>
                      Descriptive metrics from your actual ScopeVanta deal
                      records. No forecast or fabricated win probability.
                    </p>
                  </div>
                </div>
                <div className="performanceKpis">
                  <article>
                    <small>HISTORICAL WIN RATE</small>
                    <b>
                      {dashboardIntelligence.commercialPerformance.winRate ===
                      null
                        ? "—"
                        : `${dashboardIntelligence.commercialPerformance.winRate}%`}
                    </b>
                    <span>
                      {dashboardIntelligence.commercialPerformance.closedDeals}{" "}
                      closed deals recorded
                    </span>
                  </article>
                  <article>
                    <small>OPEN PIPELINE VALUE</small>
                    <b>
                      $
                      {dashboardIntelligence.commercialPerformance.openPipelineValue.toLocaleString()}
                    </b>
                    <span>Recorded deal values only</span>
                  </article>
                  <article>
                    <small>WON VALUE</small>
                    <b>
                      $
                      {dashboardIntelligence.commercialPerformance.wonValue.toLocaleString()}
                    </b>
                    <span>
                      {dashboardIntelligence.commercialPerformance.wonDeals} won
                      deals
                    </span>
                  </article>
                  <article>
                    <small>AVG WON DEAL</small>
                    <b>
                      {dashboardIntelligence.commercialPerformance
                        .averageWonDealSize === null
                        ? "—"
                        : `${dashboardIntelligence.commercialPerformance.averageWonDealSize.toLocaleString()}`}
                    </b>
                    <span>Based on recorded wins</span>
                  </article>
                  <article>
                    <small>PROPOSAL ACCEPTANCE</small>
                    <b>
                      {dashboardIntelligence.commercialPerformance
                        .proposalDecisions.acceptanceRate === null
                        ? "—"
                        : `${dashboardIntelligence.commercialPerformance.proposalDecisions.acceptanceRate}%`}
                    </b>
                    <span>
                      {
                        dashboardIntelligence.commercialPerformance
                          .proposalDecisions.accepted
                      }
                      /
                      {
                        dashboardIntelligence.commercialPerformance
                          .proposalDecisions.shared
                      }{" "}
                      shared proposals accepted
                    </span>
                  </article>
                  <article>
                    <small>AVG DECISION TIME</small>
                    <b>
                      {dashboardIntelligence.commercialPerformance
                        .proposalDecisions.averageDecisionHours === null
                        ? "—"
                        : `${dashboardIntelligence.commercialPerformance.proposalDecisions.averageDecisionHours}h`}
                    </b>
                    <span>Share to recorded client decision</span>
                  </article>
                </div>
                <div className="pipelineStages">
                  {dashboardIntelligence.commercialPerformance.pipelineByStage.map(
                    (stage) => (
                      <div key={stage.stage}>
                        <span>
                          <b>{stage.stage}</b>
                          <small>
                            {stage.count} deal{stage.count === 1 ? "" : "s"}
                          </small>
                        </span>
                        <strong>${stage.value.toLocaleString()}</strong>
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}
            {analyticsSummary && (
              <div className="activationSignals">
                <span>
                  <small>FIRST-PARTY PRODUCT SIGNALS</small>
                  <b>
                    {analyticsSummary.counts.proposal_generated || 0} generated
                  </b>
                </span>
                <span>
                  <small>REFINEMENT</small>
                  <b>{analyticsSummary.counts.proposal_refined || 0} refined</b>
                </span>
                <span>
                  <small>CLIENT SETUP</small>
                  <b>{analyticsSummary.counts.client_created || 0} created</b>
                </span>
                <span>
                  <small>CHECKOUT INTENT</small>
                  <b>{analyticsSummary.counts.checkout_started || 0} started</b>
                </span>
              </div>
            )}
            <div className="dashboardGrid">
              <section className="dashPanel">
                <div className="panelHead">
                  <div>
                    <span className="eyebrow">PRIORITY PIPELINE</span>
                    <h2>Highest scope exposure</h2>
                  </div>
                  <button onClick={() => setView("projects")}>
                    View all <ArrowRight size={13} />
                  </button>
                </div>
                <div className="dealTable">
                  <div className="dealTableHead">
                    <span>Opportunity</span>
                    <span>Created</span>
                    <span>Risk</span>
                    <span>Signal</span>
                  </div>
                  {projects.length ? (
                    [...projects]
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 6)
                      .map((p) => (
                        <button key={p.id} onClick={() => openProject(p)}>
                          <span>
                            <b>{p.client || "Untitled opportunity"}</b>
                            <small>{p.summary}</small>
                          </span>
                          <span>
                            {new Date(p.createdAt).toLocaleDateString()}
                          </span>
                          <span>
                            <b
                              className={`riskNumber ${p.score >= 70 ? "high" : p.score >= 40 ? "medium" : "low"}`}
                            >
                              {p.score}
                            </b>
                            /100
                          </span>
                          <span
                            className={`riskTag ${p.score >= 70 ? "high" : p.score >= 40 ? "medium" : "low"}`}
                          >
                            {p.score >= 70
                              ? "High exposure"
                              : p.score >= 40
                                ? "Needs review"
                                : "Controlled"}
                          </span>
                        </button>
                      ))
                  ) : (
                    <div className="zero">No analyzed opportunities yet.</div>
                  )}
                </div>
              </section>
              <aside className="dashPanel intelligencePanel">
                <span className="eyebrow">CLIENT PIPELINE</span>
                <h2>
                  {dashboardIntelligence?.statusCounts.Active || 0} active
                  accounts
                </h2>
                <p>
                  {dashboardIntelligence
                    ? `${dashboardIntelligence.statusCounts.Prospect || 0} prospects · ${dashboardIntelligence.statusCounts.Won || 0} won · ${dashboardIntelligence.statusCounts.Dormant || 0} dormant · ${dashboardIntelligence.statusCounts.Lost || 0} lost. ${dashboardIntelligence.totals.dueFollowUps} follow-up${dashboardIntelligence.totals.dueFollowUps === 1 ? "" : "s"} currently due.`
                    : "Client intelligence will appear as your relationship database grows."}
                </p>
                <div className="capacityLine">
                  <span>Plan usage</span>
                  <b>
                    {Math.min(
                      100,
                      Math.round(
                        (projects.length / Math.max(1, billing.limit)) * 100,
                      ),
                    )}
                    %
                  </b>
                </div>
                <div className="usageTrack">
                  <span
                    style={{
                      width: `${Math.min(100, (projects.length / Math.max(1, billing.limit)) * 100)}%`,
                    }}
                  />
                </div>
                <button onClick={() => setView("clients")}>
                  Open client intelligence <ArrowRight size={13} />
                </button>
              </aside>
            </div>
          </div>
        )}
        {view === "new" && (
          <div className="page dealPage">
            <div className="form">
              <span className="eyebrow">NEW OPPORTUNITY</span>
              <h1>What does the client need?</h1>
              <label>
                Saved client
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedClientId(id);
                    const c = clients.find((v) => v.id === id);
                    if (c) {
                      setClient(c.company || c.name);
                      setClientLogoUrl(c.logoUrl || "");
                    } else setClientLogoUrl("");
                  }}
                >
                  <option value="">No saved client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Client / opportunity
                <input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Acme website redesign"
                />
              </label>
              <label>
                Client brief
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Paste an email, RFP, call notes or project request…"
                />
              </label>
              <div className="two">
                <label>
                  Budget
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="$8,000"
                  />
                </label>
                <label>
                  Timeline
                  <input
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="6 weeks"
                  />
                </label>
              </div>
              <label className="uploadInline">
                <Upload size={17} /> Attach reference file
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx,image/*"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    uploadFile(e.target.files[0], "reference")
                  }
                />
              </label>
              <div className="proposalBuilder">
                <h3>Proposal design</h3>
                <label>
                  Proposal style
                  <select
                    value={proposalOptions.mode}
                    onChange={(e) =>
                      setProposalOptions((v) => ({
                        ...v,
                        mode: e.target.value as ProposalOptions["mode"],
                      }))
                    }
                  >
                    <option>Concise</option>
                    <option>Detailed</option>
                    <option>Premium</option>
                  </select>
                </label>
                <div className="toggleRow">
                  <label>
                    <input
                      type="checkbox"
                      checked={proposalOptions.includeSellerLogo}
                      onChange={(e) =>
                        setProposalOptions((v) => ({
                          ...v,
                          includeSellerLogo: e.target.checked,
                        }))
                      }
                    />{" "}
                    Your logo
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={proposalOptions.includeClientLogo}
                      onChange={(e) =>
                        setProposalOptions((v) => ({
                          ...v,
                          includeClientLogo: e.target.checked,
                        }))
                      }
                    />{" "}
                    Client logo
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={proposalOptions.includeVisuals}
                      onChange={(e) =>
                        setProposalOptions((v) => ({
                          ...v,
                          includeVisuals: e.target.checked,
                        }))
                      }
                    />
                    <BarChart3 size={15} /> Charts & visuals
                  </label>
                </div>
                {proposalOptions.includeClientLogo && (
                  <label className="uploadInline">
                    <ImageIcon size={17} />{" "}
                    {clientLogoUrl
                      ? "Replace client logo"
                      : "Upload client logo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        uploadFile(e.target.files[0], "client_logo")
                      }
                    />
                  </label>
                )}
                <details>
                  <summary>
                    Choose proposal sections ({proposalOptions.sections.length}/
                    {proposalSectionChoices.length})
                  </summary>
                  <div className="sectionPicker">
                    {proposalSectionChoices.map((section) => (
                      <label key={section}>
                        <input
                          type="checkbox"
                          checked={proposalOptions.sections.includes(section)}
                          onChange={(e) =>
                            setProposalOptions((v) => ({
                              ...v,
                              sections: e.target.checked
                                ? [...v.sections, section]
                                : v.sections.filter((x) => x !== section),
                            }))
                          }
                        />
                        {section}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
              <div className="generationTrust">
                <CheckCircle2 size={15} />
                <span>
                  <b>Grounded by your workspace</b>
                  <small>
                    ScopeVanta uses your active company knowledge and client
                    context, then flags assumptions instead of inventing missing
                    details.
                  </small>
                </span>
              </div>
              <button
                className="primary full"
                onClick={analyze}
                disabled={busy}
              >
                {busy
                  ? "Forging deal intelligence…"
                  : "Analyze & build proposal"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="report">
              {result && (
                <div className="dealWorkspaceNav">
                  <div className="dealWorkspaceTop">
                    <span>
                      <small>GUIDED COMMERCIAL WORKSPACE</small>
                      <b>{client || "Current opportunity"}</b>
                    </span>
                    <button
                      onClick={() =>
                        setDealWorkspaceMode((v) =>
                          v === "guide" ? "full" : "guide",
                        )
                      }
                    >
                      {dealWorkspaceMode === "guide"
                        ? "Show full intelligence"
                        : "Use guided view"}
                    </button>
                  </div>
                  {dealReadiness && (
                    <div className="realDealReadiness">
                      <span>
                        <small>REAL DEAL READINESS</small>
                        <b>
                          {dealReadiness.passed}/{dealReadiness.total} checks
                          complete
                        </b>
                      </span>
                      <div className="readinessBar">
                        <i
                          style={{
                            width: `${Math.round((dealReadiness.passed / dealReadiness.total) * 100)}%`,
                          }}
                        />
                      </div>
                      <span>
                        <small>NEXT GAP</small>
                        <b>{dealReadiness.next}</b>
                      </span>
                    </div>
                  )}
                  <div className="dealStepRail">
                    {(
                      [
                        "understand",
                        "scope",
                        "price",
                        "propose",
                        "win",
                        "protect",
                      ] as const
                    ).map((s, i) => (
                      <button
                        key={s}
                        className={dealWorkspaceStep === s ? "active" : ""}
                        onClick={() => setDealWorkspaceStep(s)}
                      >
                        <em>{i + 1}</em>
                        <span>
                          {s === "understand"
                            ? "Understand"
                            : s === "scope"
                              ? "Scope"
                              : s === "price"
                                ? "Price"
                                : s === "propose"
                                  ? "Propose"
                                  : s === "win"
                                    ? "Win"
                                    : "Protect"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const p = projects.find((x) => x.id === result.projectId);
                    const lab = p?.commercialLab;
                    const next =
                      dealWorkspaceStep === "understand"
                        ? {
                            title: result.questions.length
                              ? "Resolve the open questions"
                              : "Review the opportunity risks",
                            detail: result.questions.length
                              ? `${result.questions.length} clarification question${result.questions.length === 1 ? "" : "s"} still need seller or client input.`
                              : `${result.risks.length} scope risk${result.risks.length === 1 ? "" : "s"} identified from the brief.`,
                            action: () => setDealWorkspaceStep("scope"),
                            label: "Continue to scope",
                          }
                        : dealWorkspaceStep === "scope"
                          ? {
                              title: lab
                                ? "Review the engineered scope"
                                : "Build the commercial scope",
                              detail: lab
                                ? `${lab.scope.phases.length} delivery phase${lab.scope.phases.length === 1 ? "" : "s"} structured. Check assumptions and exclusions before pricing.`
                                : "Generate structured scope, requirements and delivery feasibility from the current opportunity.",
                              action: () =>
                                lab
                                  ? setDealWorkspaceStep("price")
                                  : void buildCommercialLab(),
                              label: lab
                                ? "Continue to pricing"
                                : "Build Opportunity Lab",
                            }
                          : dealWorkspaceStep === "price"
                            ? {
                                title: p?.estimateSummary
                                  ? "Validate the deal economics"
                                  : "Build the estimate",
                                detail: p?.estimateSummary
                                  ? `${p.estimateSummary.estimatedHours}h · ${p.estimateSummary.estimatedPrice.toLocaleString()} modeled price · ${p.estimateSummary.estimatedMarginPct}% margin.`
                                  : "Use your rate library and estimate lines to model delivery economics before sending the proposal.",
                                action: () => setDealWorkspaceStep("propose"),
                                label: "Continue to proposal",
                              }
                            : dealWorkspaceStep === "propose"
                              ? {
                                  title: "Prepare the client-ready proposal",
                                  detail: `Proposal version ${result.version || 1} is available. Review evidence, edit if needed, then share when ready.`,
                                  action: () => setDealWorkspaceStep("win"),
                                  label: "Continue to win strategy",
                                }
                              : dealWorkspaceStep === "win"
                                ? {
                                    title:
                                      p?.nextBestAction ||
                                      "Build the next best action",
                                    detail: p?.dealStage
                                      ? `Current deal stage: ${p.dealStage}. Use buyer strategy and closing guidance only when you need them.`
                                      : "Move the opportunity forward with buyer strategy, follow-up and deal-stage guidance.",
                                    action: () =>
                                      setDealWorkspaceStep("protect"),
                                    label: "Continue to protect",
                                  }
                                : {
                                    title: p?.scopeBaseline
                                      ? "Protect the active scope"
                                      : "Establish the delivery baseline",
                                    detail:
                                      p?.changeOrderStatus === "draft"
                                        ? "A client request has been classified into the change-control workflow."
                                        : p?.scopeBaseline
                                          ? `Baseline v${p.scopeBaseline.version} is active. New requests can now be compared against it.`
                                          : "Create a baseline after scope and commercial terms are ready so future requests can be checked for scope creep.",
                                    action: () =>
                                      p?.commercialLab && !p.scopeBaseline
                                        ? void establishBaseline()
                                        : void runCommercialAutopilot(),
                                    label:
                                      p?.commercialLab && !p.scopeBaseline
                                        ? "Establish baseline"
                                        : "Refresh protection intelligence",
                                  };
                    return (
                      <div className="dealCommand">
                        <span>
                          <small>NEXT BEST STEP</small>
                          <b>{next.title}</b>
                          <p>{next.detail}</p>
                        </span>
                        <button className="primary" onClick={next.action}>
                          {next.label}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
              {!result ? (
                <div className="empty">
                  <div className="orb">SV</div>
                  <h3>Your deal intelligence will appear here</h3>
                  <p>
                    Scope risk, clarification questions and a detailed
                    client-ready proposal.
                  </p>
                </div>
              ) : (
                <div className="intelligenceResult">
                  <div className="resultHeader">
                    <div>
                      <span className="eyebrow">
                        SCOPE INTELLIGENCE RESULTS
                      </span>
                      <h2>{client || "Analyzed opportunity"}</h2>
                      <p>{result.summary}</p>
                    </div>
                    <div
                      className={`riskGauge ${result.score >= 70 ? "high" : result.score >= 40 ? "medium" : "low"}`}
                    >
                      <strong>{result.score}</strong>
                      <span>RISK / 100</span>
                    </div>
                  </div>
                  <div className="resultStats">
                    <div>
                      <small>RISK LEVEL</small>
                      <b>
                        {result.score >= 70
                          ? "HIGH"
                          : result.score >= 40
                            ? "MEDIUM"
                            : "LOW"}
                      </b>
                    </div>
                    <div>
                      <small>RISKS FOUND</small>
                      <b>{result.risks.length}</b>
                    </div>
                    <div>
                      <small>OPEN QUESTIONS</small>
                      <b>{result.questions.length}</b>
                    </div>
                    <div>
                      <small>PROPOSAL VERSION</small>
                      <b>{result.version || 1}</b>
                    </div>
                  </div>
                  {result.risks.length > 0 && (
                    <section
                      className={`riskSection guidedModule ${dealWorkspaceMode === "guide" && dealWorkspaceStep !== "understand" ? "guidedHidden" : ""}`}
                    >
                      <div className="sectionTitle">
                        <AlertTriangle size={15} />
                        <div>
                          <span className="eyebrow">SCOPE EXPOSURE</span>
                          <h3>Risks to resolve</h3>
                        </div>
                      </div>
                      <div className="riskRows">
                        {result.risks.map((x, i) => (
                          <article key={i}>
                            <span>{String(i + 1).padStart(2, "0")}</span>
                            <p>{x}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
                  {result.questions.length > 0 && (
                    <>
                      <h3>
                        <CheckCircle2 size={18} /> Clarify before committing
                      </h3>
                      <div className="clarifyList">
                        {result.questions.map((x, i) => (
                          <label key={i}>
                            <b>
                              {i + 1}. {x}
                            </b>
                            <textarea
                              value={clarificationAnswers[i] || ""}
                              onChange={(e) =>
                                setClarificationAnswers((v) => {
                                  const next = [...v];
                                  next[i] = e.target.value;
                                  return next;
                                })
                              }
                              placeholder="Add the seller/client answer, or leave blank to keep this item To be confirmed."
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        className="primary refine"
                        onClick={refineProposal}
                        disabled={busy || !result.projectId}
                      >
                        {busy
                          ? "Refining proposal…"
                          : "Apply answers & refine proposal"}
                      </button>
                    </>
                  )}
                  {result.evidenceStatus === "needs_review" && (
                    <div className="error">
                      <b>Evidence review required.</b> This proposal was
                      manually changed, so previous source attribution and win
                      strategy were cleared rather than shown as current.
                      Regenerate from clarification answers or review the edited
                      copy before sending.
                    </div>
                  )}
                  {result.grounding?.length ? (
                    <section
                      className={`evidencePanel guidedModule ${dealWorkspaceMode === "guide" && dealWorkspaceStep !== "propose" ? "guidedHidden" : ""}`}
                    >
                      <div className="sectionTitle">
                        <CheckCircle2 size={15} />
                        <div>
                          <span className="eyebrow">PROPOSAL EVIDENCE</span>
                          <h3>Grounding & source attribution</h3>
                        </div>
                      </div>
                      <div className="evidenceStats">
                        <span>
                          <b>{result.groundingSummary?.grounded || 0}</b>{" "}
                          sourced seller facts
                        </span>
                        <span>
                          <b>{result.groundingSummary?.clientSupplied || 0}</b>{" "}
                          client facts
                        </span>
                        <span>
                          <b>{result.groundingSummary?.assumptions || 0}</b>{" "}
                          assumptions
                        </span>
                        <span>
                          <b>{result.groundingSummary?.recommendations || 0}</b>{" "}
                          recommendations
                        </span>
                      </div>
                      <div className="evidenceRows">
                        {result.grounding.map((item, i) => (
                          <article key={`${item.kind}-${i}`}>
                            <span className={`evidenceKind ${item.kind}`}>
                              {item.kind === "seller_fact"
                                ? "Sourced"
                                : item.kind === "client_fact"
                                  ? "Client"
                                  : item.kind === "assumption"
                                    ? "Assumption"
                                    : "Strategy"}
                            </span>
                            <div>
                              <p>{item.claim}</p>
                              {item.sourceFiles.length > 0 && (
                                <small>
                                  Source: {item.sourceFiles.join(", ")}
                                </small>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <section
                    className={`commercialLab guidedModule ${dealWorkspaceMode === "guide" && !["scope", "price", "protect"].includes(dealWorkspaceStep) ? "guidedHidden" : ""}`}
                  >
                    <div className="sectionTitle">
                      <BarChart3 size={16} />
                      <div>
                        <span className="eyebrow">
                          COMMERCIAL OPERATING SYSTEM
                        </span>
                        <h3>Opportunity Lab</h3>
                      </div>
                    </div>
                    {(() => {
                      const p = projects.find((x) => x.id === result.projectId);
                      if (!p) return null;
                      const lab = p.commercialLab;
                      return (
                        <>
                          <div className="dealOSConsole">
                            <div className="commercialModuleHead">
                              <span>
                                <small>DEAL-TO-PROFIT OS</small>
                                <b>
                                  One commercial brain from first message to
                                  final margin
                                </b>
                              </span>
                              <em>
                                {p.dealOS?.lastAction
                                  ? `Last: ${p.dealOS.lastAction}`
                                  : "Ready for a real opportunity"}
                              </em>
                            </div>
                            <textarea
                              value={dealOSInput}
                              onChange={(e) => setDealOSInput(e.target.value)}
                              placeholder="Paste a client email, discovery notes, objection, new request, meeting transcript, or ask the Commercial Copilot a question…"
                            />
                            <div className="dealOSControls">
                              <label>
                                Target price
                                <input
                                  type="number"
                                  min="0"
                                  value={dealOSTarget || ""}
                                  onChange={(e) =>
                                    setDealOSTarget(Number(e.target.value))
                                  }
                                  placeholder="Optional"
                                />
                              </label>
                              <div>
                                {[
                                  ["discovery", "Discovery Agent"],
                                  ["compile", "Scope Compiler"],
                                  ["margin", "Margin Firewall"],
                                  ["choices", "Buyer Choices"],
                                  ["negotiation", "Negotiation Simulator"],
                                  ["change", "Scope Creep Firewall"],
                                  ["meeting", "Meeting Delta"],
                                  [
                                    "responsibilities",
                                    "Client Responsibilities",
                                  ],
                                  ["premortem", "Pre-Mortem"],
                                  ["redteam", "Red-Team Proposal"],
                                  ["personalize", "Personalize"],
                                  ["handoff", "Handoff Pack"],
                                  ["autopsy", "Profitability Autopsy"],
                                  ["copilot", "Commercial Copilot"],
                                ].map(([a, l]) => (
                                  <button
                                    key={a}
                                    disabled={dealOSBusy}
                                    onClick={() => void runDealOS(a)}
                                  >
                                    {l}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {p.dealOS && (
                              <div className="dealOSResults">
                                {p.dealOS.margin?.marginFirewall && (
                                  <article>
                                    <small>MARGIN FIREWALL</small>
                                    <b>
                                      {p.dealOS.margin.marginFirewall.status}
                                    </b>
                                    <p>
                                      {p.dealOS.margin.marginFirewall.summary}
                                    </p>
                                    {p.dealOS.margin.marginFirewall.risks?.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          {x.issue} · {x.impact}
                                          <small>Fix: {x.fix}</small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                )}
                                {p.dealOS.discovery?.discovery?.questions
                                  ?.length ? (
                                  <article>
                                    <small>DISCOVERY AGENT</small>
                                    {p.dealOS.discovery.discovery.questions.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          <b>{x.question}</b>
                                          <small>{x.why}</small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                ) : null}
                                {p.dealOS.compile?.compiler && (
                                  <article>
                                    <small>SCOPE COMPILER</small>
                                    <b>
                                      {p.dealOS.compile.compiler.targetPrice
                                        ? `Target ${Number(p.dealOS.compile.compiler.targetPrice).toLocaleString()}`
                                        : "No target price supplied"}
                                    </b>
                                    {p.dealOS.compile.compiler.changes?.map(
                                      (x: string, i: number) => (
                                        <p key={i}>{x}</p>
                                      ),
                                    )}
                                    {p.dealOS.compile.compiler.warnings?.map(
                                      (x: string, i: number) => (
                                        <p key={`w${i}`}>Warning: {x}</p>
                                      ),
                                    )}
                                  </article>
                                )}
                                {p.dealOS.choices?.buyerChoices?.length ? (
                                  <article>
                                    <small>BUYER CHOICE ARCHITECTURE</small>
                                    {p.dealOS.choices.buyerChoices.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          <b>
                                            {x.name} · $
                                            {Number(
                                              x.price || 0,
                                            ).toLocaleString()}
                                          </b>
                                          <small>
                                            {x.hours}h · {x.marginPct}% margin ·{" "}
                                            {x.bestFor}
                                          </small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                ) : null}
                                {p.dealOS.change?.changeFirewall && (
                                  <article>
                                    <small>SCOPE CREEP FIREWALL</small>
                                    <b>
                                      {
                                        p.dealOS.change.changeFirewall
                                          .classification
                                      }
                                    </b>
                                    <p>
                                      {p.dealOS.change.changeFirewall.request}
                                    </p>
                                    <p>
                                      {
                                        p.dealOS.change.changeFirewall
                                          .commercialImpact
                                      }
                                    </p>
                                    <small>
                                      {
                                        p.dealOS.change.changeFirewall
                                          .recommendedAction
                                      }
                                    </small>
                                  </article>
                                )}
                                {p.dealOS.negotiation?.negotiation && (
                                  <article>
                                    <small>NEGOTIATION SIMULATOR</small>
                                    <b>
                                      {
                                        p.dealOS.negotiation.negotiation
                                          .position
                                      }
                                    </b>
                                    {p.dealOS.negotiation.negotiation.options?.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          {x.approach} · $
                                          {Number(
                                            x.price || 0,
                                          ).toLocaleString()}
                                          <small>
                                            {x.scopeChange} · {x.marginImpact}
                                          </small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                )}
                                {p.dealOS.meeting?.meetingDelta && (
                                  <article>
                                    <small>MEETING → DEAL DELTA</small>
                                    {p.dealOS.meeting.meetingDelta.newRequirements?.map(
                                      (x: string, i: number) => (
                                        <p key={i}>New: {x}</p>
                                      ),
                                    )}
                                    {p.dealOS.meeting.meetingDelta.changedRequirements?.map(
                                      (x: string, i: number) => (
                                        <p key={`c${i}`}>Changed: {x}</p>
                                      ),
                                    )}
                                    {p.dealOS.meeting.meetingDelta.approveBeforeApplying?.map(
                                      (x: string, i: number) => (
                                        <p key={`a${i}`}>Approve first: {x}</p>
                                      ),
                                    )}
                                  </article>
                                )}
                                {p.dealOS.responsibilities?.responsibilities
                                  ?.length ? (
                                  <article>
                                    <small>CLIENT RESPONSIBILITY TRACKER</small>
                                    {p.dealOS.responsibilities.responsibilities.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          <b>
                                            {x.owner}: {x.item}
                                          </b>
                                          <small>
                                            {x.dependency} · Delay impact:{" "}
                                            {x.delayImpact}
                                          </small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                ) : null}
                                {p.dealOS.premortem?.premortem?.length ? (
                                  <article>
                                    <small>PRE-MORTEM</small>
                                    {p.dealOS.premortem.premortem.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          <b>{x.failureMode}</b>
                                          <small>
                                            {x.evidence} · Prevent:{" "}
                                            {x.prevention}
                                          </small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                ) : null}
                                {p.dealOS.redteam?.redteam?.length ? (
                                  <article>
                                    <small>RED-TEAM PROPOSAL</small>
                                    {p.dealOS.redteam.redteam.map(
                                      (x: any, i: number) => (
                                        <p key={i}>
                                          <b>
                                            {x.persona}: {x.challenge}
                                          </b>
                                          <small>Fix: {x.fix}</small>
                                        </p>
                                      ),
                                    )}
                                  </article>
                                ) : null}
                                {p.dealOS.handoff?.handoff && (
                                  <article>
                                    <small>PROJECT HANDOFF PACK</small>
                                    {p.dealOS.handoff.handoff.finalScope?.map(
                                      (x: string, i: number) => (
                                        <p key={i}>{x}</p>
                                      ),
                                    )}
                                    <b>Change control</b>
                                    <p>
                                      {p.dealOS.handoff.handoff.changeControl}
                                    </p>
                                  </article>
                                )}
                                {p.dealOS.autopsy?.autopsy && (
                                  <article>
                                    <small>
                                      PROFITABILITY AUTOPSY + PRICING BRAIN
                                    </small>
                                    {p.dealOS.autopsy.autopsy.estimateVsActual?.map(
                                      (x: string, i: number) => (
                                        <p key={i}>{x}</p>
                                      ),
                                    )}
                                    {p.dealOS.autopsy.autopsy.pricingBrainUpdates?.map(
                                      (x: string, i: number) => (
                                        <p key={`p${i}`}>Learn: {x}</p>
                                      ),
                                    )}
                                  </article>
                                )}
                                {p.dealOS.copilot?.copilot && (
                                  <article className="wideLab">
                                    <small>COMMERCIAL COPILOT</small>
                                    <b>{p.dealOS.copilot.copilot.answer}</b>
                                    {p.dealOS.copilot.copilot.evidence?.map(
                                      (x: string, i: number) => (
                                        <p key={i}>Evidence: {x}</p>
                                      ),
                                    )}
                                    {p.dealOS.copilot.copilot.recommendedActions?.map(
                                      (x: string, i: number) => (
                                        <p key={`a${i}`}>Next: {x}</p>
                                      ),
                                    )}
                                  </article>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="nextGenCommercial">
                            <div className="commercialModuleHead">
                              <span>
                                <small>NEXT-GENERATION COMMERCIAL LAYER</small>
                                <b>Scope & Economics Engine</b>
                              </span>
                              <button
                                onClick={() => void runCommercialAutopilot()}
                                disabled={commercialBusy}
                              >
                                <Sparkles size={13} /> Run Commercial Autopilot
                              </button>
                            </div>
                            <div className="durableDealLayer">
                              <details open>
                                <summary>Editable Scope Graph</summary>
                                <p className="labCaveat">
                                  Connect requirements → deliverables → tasks →
                                  economics → acceptance. Saving a graph marks
                                  downstream guidance stale until recalculated.
                                </p>
                                {scopeGraph.map((n: any, i: number) => (
                                  <div
                                    className="scopeGraphRow"
                                    key={n.id || i}
                                  >
                                    <select
                                      value={n.type || "deliverable"}
                                      onChange={(e) =>
                                        setScopeGraph((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? { ...x, type: e.target.value }
                                              : x,
                                          ),
                                        )
                                      }
                                    >
                                      <option>requirement</option>
                                      <option>phase</option>
                                      <option>deliverable</option>
                                      <option>task</option>
                                      <option>economics</option>
                                      <option>acceptance</option>
                                    </select>
                                    <input
                                      value={n.label || ""}
                                      onChange={(e) =>
                                        setScopeGraph((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? { ...x, label: e.target.value }
                                              : x,
                                          ),
                                        )
                                      }
                                      placeholder="Scope item"
                                    />
                                    <select
                                      value={n.parentId || ""}
                                      onChange={(e) =>
                                        setScopeGraph((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  parentId: e.target.value,
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    >
                                      <option value="">No parent</option>
                                      {scopeGraph
                                        .filter((_: any, j: number) => j !== i)
                                        .map((x: any, j: number) => (
                                          <option key={x.id || j} value={x.id}>
                                            {x.label || x.id}
                                          </option>
                                        ))}
                                    </select>
                                    <input
                                      type="number"
                                      value={n.hours || ""}
                                      onChange={(e) =>
                                        setScopeGraph((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  hours: Number(e.target.value),
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                      placeholder="Hours"
                                    />
                                    <input
                                      value={n.acceptance || ""}
                                      onChange={(e) =>
                                        setScopeGraph((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  acceptance: e.target.value,
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                      placeholder="Acceptance"
                                    />
                                    <button
                                      onClick={() =>
                                        setScopeGraph((v) =>
                                          v.filter((_, j) => j !== i),
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                                <div className="studioActions">
                                  <button
                                    onClick={() =>
                                      setScopeGraph((v) => [
                                        ...v,
                                        {
                                          id: `node-${Date.now()}`,
                                          type: "deliverable",
                                          label: "",
                                          parentId: "",
                                          hours: 0,
                                          cost: 0,
                                          price: 0,
                                          acceptance: "",
                                          dependency: "",
                                        },
                                      ])
                                    }
                                  >
                                    <Plus size={12} /> Add node
                                  </button>
                                  <button
                                    className="primary"
                                    disabled={
                                      !scopeGraph.length || commercialBusy
                                    }
                                    onClick={() => void saveScopeGraph()}
                                  >
                                    <Save size={12} /> Save graph
                                  </button>
                                </div>
                              </details>
                              <details>
                                <summary>Durable commercial history</summary>
                                <p>
                                  <b>{commercialHistory.baselines.length}</b>{" "}
                                  preserved scope baselines ·{" "}
                                  <b>{commercialHistory.changeOrders.length}</b>{" "}
                                  approved change orders
                                </p>
                                {commercialHistory.baselines
                                  .slice(0, 5)
                                  .map((b: any) => (
                                    <p key={b.id}>
                                      <b>Baseline v{b.version}</b> · proposal v
                                      {b.proposalVersion} ·{" "}
                                      {new Date(b.createdAt).toLocaleString()}
                                    </p>
                                  ))}
                                {commercialHistory.changeOrders
                                  .slice(0, 5)
                                  .map((c: any) => (
                                    <p key={c.id}>
                                      <b>Change order</b> · baseline v
                                      {c.baselineVersion} ·{" "}
                                      {c.estimatedExtraHours || 0}h · {c.status}
                                    </p>
                                  ))}
                              </details>
                              <details>
                                <summary>Company Pricing Brain</summary>
                                {pricingBrain ? (
                                  <>
                                    <p>
                                      <b>{pricingBrain.sampleSize}</b> completed
                                      records · avg hours variance{" "}
                                      {pricingBrain.averageHoursVariancePct ??
                                        "—"}
                                      % · avg cost variance{" "}
                                      {pricingBrain.averageCostVariancePct ??
                                        "—"}
                                      % · avg actual margin{" "}
                                      {pricingBrain.averageActualMarginPct ??
                                        "—"}
                                      %
                                    </p>
                                    <small>{pricingBrain.guidance}</small>
                                  </>
                                ) : (
                                  <p>
                                    No completed-record calibration loaded yet.
                                  </p>
                                )}
                              </details>
                              <details>
                                <summary>
                                  Client discovery & Deal Room engagement
                                </summary>
                                <div className="studioActions">
                                  <button
                                    onClick={() => void createDiscoveryLink()}
                                  >
                                    Create client discovery link
                                  </button>
                                </div>
                                {shareAnalytics && (
                                  <p>
                                    {shareAnalytics.views || 0} proposal view
                                    {shareAnalytics.views === 1 ? "" : "s"}
                                    {shareAnalytics.lastViewedAt
                                      ? ` · last ${new Date(shareAnalytics.lastViewedAt).toLocaleString()}`
                                      : ""}
                                    {shareAnalytics.selectedScenario
                                      ? ` · selected ${shareAnalytics.selectedScenario}`
                                      : ""}
                                  </p>
                                )}
                              </details>
                            </div>
                            <div className="autopilotGrid">
                              {p.commercialAutopilot?.autopilot?.actions?.map(
                                (a: any, i: number) => (
                                  <article key={i}>
                                    <b>
                                      #{a.priority} · {a.action}
                                    </b>
                                    <p>{a.why}</p>
                                    <small>
                                      {a.module} · Evidence: {a.evidence}
                                    </small>
                                  </article>
                                ),
                              ) || (
                                <p className="labCaveat">
                                  Run Autopilot to turn the opportunity into
                                  prioritized evidence-backed actions.
                                </p>
                              )}
                            </div>
                            <details open>
                              <summary>Rate & cost library</summary>
                              <div className="rateRows">
                                {rateLibrary.map((r) => (
                                  <span key={r.id}>
                                    <b>{r.name}</b>
                                    <small>
                                      ${r.costRate}/h cost · ${r.sellRate}/h
                                      sell · {r.overheadPct}% overhead
                                    </small>
                                  </span>
                                ))}
                              </div>
                              <div className="rateForm">
                                <input
                                  placeholder="Role / service"
                                  value={newRate.name}
                                  onChange={(e) =>
                                    setNewRate((v) => ({
                                      ...v,
                                      name: e.target.value,
                                    }))
                                  }
                                />
                                <input
                                  type="number"
                                  placeholder="Cost/h"
                                  value={newRate.costRate || ""}
                                  onChange={(e) =>
                                    setNewRate((v) => ({
                                      ...v,
                                      costRate: Number(e.target.value),
                                    }))
                                  }
                                />
                                <input
                                  type="number"
                                  placeholder="Sell/h"
                                  value={newRate.sellRate || ""}
                                  onChange={(e) =>
                                    setNewRate((v) => ({
                                      ...v,
                                      sellRate: Number(e.target.value),
                                    }))
                                  }
                                />
                                <button onClick={() => void addRate()}>
                                  <Plus size={12} /> Add
                                </button>
                              </div>
                            </details>
                            <details open>
                              <summary>Editable scope & live economics</summary>
                              <div className="economicsControls">
                                <label>
                                  Floor margin %
                                  <input
                                    type="number"
                                    min="0"
                                    max="90"
                                    value={economics.floorMargin}
                                    onChange={(e) =>
                                      setEconomics((v) => ({
                                        ...v,
                                        floorMargin: Number(e.target.value),
                                      }))
                                    }
                                  />
                                </label>
                                <label>
                                  Contingency %
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={economics.contingencyPct}
                                    onChange={(e) =>
                                      setEconomics((v) => ({
                                        ...v,
                                        contingencyPct: Number(e.target.value),
                                      }))
                                    }
                                  />
                                </label>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={economics.syncProposal}
                                    onChange={(e) =>
                                      setEconomics((v) => ({
                                        ...v,
                                        syncProposal: e.target.checked,
                                      }))
                                    }
                                  />{" "}
                                  Sync commercial summary to proposal
                                </label>
                              </div>
                              <div className="estimateTable">
                                {estimateLines.map((line, i) => (
                                  <div key={i}>
                                    <input
                                      value={line.name}
                                      onChange={(e) =>
                                        setEstimateLines((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? { ...x, name: e.target.value }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                    <select
                                      value={line.role}
                                      onChange={(e) => {
                                        const r = rateLibrary.find(
                                          (x) => x.name === e.target.value,
                                        );
                                        setEstimateLines((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  role: e.target.value,
                                                  costRate:
                                                    r?.costRate || x.costRate,
                                                  sellRate:
                                                    r?.sellRate || x.sellRate,
                                                }
                                              : x,
                                          ),
                                        );
                                      }}
                                    >
                                      <option value="">Role</option>
                                      {rateLibrary.map((r) => (
                                        <option key={r.id}>{r.name}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      value={line.qty}
                                      onChange={(e) =>
                                        setEstimateLines((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  qty: Number(e.target.value),
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                    <input
                                      type="number"
                                      value={line.hours}
                                      onChange={(e) =>
                                        setEstimateLines((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  hours: Number(e.target.value),
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                    <span>
                                      $
                                      {(
                                        line.qty *
                                        line.hours *
                                        line.costRate
                                      ).toLocaleString()}{" "}
                                      cost
                                    </span>
                                    <span>
                                      $
                                      {(
                                        line.qty *
                                        line.hours *
                                        line.sellRate
                                      ).toLocaleString()}{" "}
                                      sell
                                    </span>
                                    <input
                                      placeholder="Acceptance criteria"
                                      value={line.acceptance || ""}
                                      onChange={(e) =>
                                        setEstimateLines((v) =>
                                          v.map((x, j) =>
                                            j === i
                                              ? {
                                                  ...x,
                                                  acceptance: e.target.value,
                                                }
                                              : x,
                                          ),
                                        )
                                      }
                                    />
                                    <button
                                      onClick={() =>
                                        setEstimateLines((v) =>
                                          v.filter((_, j) => j !== i),
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() =>
                                  setEstimateLines((v) => [
                                    ...v,
                                    {
                                      name: "New deliverable",
                                      role: "",
                                      qty: 1,
                                      hours: 1,
                                      costRate: 0,
                                      sellRate: 0,
                                    },
                                  ])
                                }
                              >
                                <Plus size={12} /> Add estimate line
                              </button>
                              {p.estimateSummary && (
                                <div className="estimateSummary">
                                  <b>{p.estimateSummary.estimatedHours}h</b>
                                  <span>
                                    $
                                    {p.estimateSummary.baseCost?.toLocaleString() ||
                                      "—"}{" "}
                                    base cost
                                  </span>
                                  <span>
                                    $
                                    {p.estimateSummary.estimatedCost.toLocaleString()}{" "}
                                    risk-adjusted cost
                                  </span>
                                  <span>
                                    $
                                    {p.estimateSummary.floorPrice?.toLocaleString() ||
                                      "—"}{" "}
                                    floor
                                  </span>
                                  <span>
                                    $
                                    {p.estimateSummary.estimatedPrice.toLocaleString()}{" "}
                                    recommended
                                  </span>
                                  <strong>
                                    {p.estimateSummary.estimatedMarginPct}%
                                    margin
                                  </strong>
                                </div>
                              )}
                              <button
                                className="primary"
                                disabled={
                                  commercialBusy || !estimateLines.length
                                }
                                onClick={() => void saveScopeEconomics()}
                              >
                                <Save size={12} /> Recalculate & save economics
                              </button>
                              {p.dealScenarios?.length ? (
                                <div className="scenarioCards">
                                  {p.dealScenarios.map((s) => (
                                    <article key={s.name}>
                                      <small>{s.name.toUpperCase()}</small>
                                      <b>${s.price.toLocaleString()}</b>
                                      <span>
                                        {s.hours}h · {s.marginPct}% margin
                                      </span>
                                      <p>{s.tradeoff}</p>
                                    </article>
                                  ))}
                                </div>
                              ) : null}
                            </details>
                            <details>
                              <summary>
                                Client request inbox & profitability actuals
                              </summary>
                              <div className="commercialTextInputs">
                                <label>
                                  Latest client request
                                  <textarea
                                    value={commercialInputs.changeRequest}
                                    onChange={(e) =>
                                      setCommercialInputs((v) => ({
                                        ...v,
                                        changeRequest: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <label>
                                  Actual revenue
                                  <input
                                    type="number"
                                    value={actualRevenue || ""}
                                    onChange={(e) =>
                                      setActualRevenue(Number(e.target.value))
                                    }
                                  />
                                </label>
                              </div>
                              <button
                                onClick={() => void saveCommercialState()}
                                disabled={commercialBusy}
                              >
                                <Save size={12} /> Save commercial state
                              </button>
                            </details>
                            {p.commercialAutopilot && (
                              <div className="nextGenGrid">
                                <article>
                                  <small>ESTIMATE CALIBRATION</small>
                                  {p.commercialAutopilot.calibration?.estimatedVsActualSignals?.map(
                                    (x: string, i: number) => (
                                      <p key={i}>{x}</p>
                                    ),
                                  )}
                                  <b>
                                    {
                                      p.commercialAutopilot.calibration
                                        ?.suggestedAdjustment
                                    }
                                  </b>
                                </article>
                                <article>
                                  <small>COMMERCIAL REDLINE</small>
                                  <b>Baseline</b>
                                  {p.commercialAutopilot.redline?.baseline?.map(
                                    (x: string, i: number) => (
                                      <p key={i}>{x}</p>
                                    ),
                                  )}
                                  <b>Requested</b>
                                  {p.commercialAutopilot.redline?.requested?.map(
                                    (x: string, i: number) => (
                                      <p key={i}>{x}</p>
                                    ),
                                  )}
                                  {p.commercialAutopilot.redline?.commercialImpact?.map(
                                    (x: string, i: number) => (
                                      <p key={i}>{x}</p>
                                    ),
                                  )}
                                </article>
                                <article>
                                  <small>NEGOTIATION SANDBOX</small>
                                  {p.commercialAutopilot.negotiationScenarios?.map(
                                    (x: any, i: number) => (
                                      <p key={i}>
                                        <b>{x.name}</b> · $
                                        {Number(x.price || 0).toLocaleString()}{" "}
                                        · {x.scopeTrade} · {x.marginImpact}
                                      </p>
                                    ),
                                  )}
                                </article>
                                <article>
                                  <small>PROPOSAL → CONTRACT HANDOFF</small>
                                  <b>{p.commercialAutopilot.handoff?.status}</b>
                                  {p.commercialAutopilot.handoff?.agreedScope?.map(
                                    (x: string, i: number) => (
                                      <p key={i}>{x}</p>
                                    ),
                                  )}
                                  {p.commercialAutopilot.handoff?.openItems?.map(
                                    (x: string, i: number) => (
                                      <p key={i}>Open: {x}</p>
                                    ),
                                  )}
                                </article>
                                <article>
                                  <small>SIMILARITY ENGINE</small>
                                  {p.commercialAutopilot.similarity?.map(
                                    (x: any, i: number) => (
                                      <p key={i}>
                                        <b>{x.label}</b> · {x.reason} ·{" "}
                                        {x.estimatedVsActual}
                                      </p>
                                    ),
                                  )}
                                </article>
                                <article>
                                  <small>PROFITABILITY CONTROL</small>
                                  <div className="profitKpis">
                                    <span>
                                      Quoted{" "}
                                      <b>
                                        $
                                        {Number(
                                          p.commercialAutopilot.profitability
                                            ?.quotedValue || 0,
                                        ).toLocaleString()}
                                      </b>
                                    </span>
                                    <span>
                                      Est. cost{" "}
                                      <b>
                                        $
                                        {Number(
                                          p.commercialAutopilot.profitability
                                            ?.estimatedCost || 0,
                                        ).toLocaleString()}
                                      </b>
                                    </span>
                                    <span>
                                      Actual cost{" "}
                                      <b>
                                        $
                                        {Number(
                                          p.commercialAutopilot.profitability
                                            ?.actualCost || 0,
                                        ).toLocaleString()}
                                      </b>
                                    </span>
                                    <span>
                                      Forecast{" "}
                                      <b>
                                        $
                                        {Number(
                                          p.commercialAutopilot.profitability
                                            ?.forecastCost || 0,
                                        ).toLocaleString()}
                                      </b>
                                    </span>
                                  </div>
                                </article>
                              </div>
                            )}
                            <div className="opportunityTimeline">
                              <small>OPPORTUNITY TIMELINE</small>
                              {p.commercialAudit
                                ?.slice()
                                .reverse()
                                .slice(0, 15)
                                .map((a, i) => (
                                  <span key={i}>
                                    <b>{a.type.replaceAll("_", " ")}</b>
                                    <em>{a.detail}</em>
                                    <small>
                                      {new Date(a.at).toLocaleString()}
                                    </small>
                                  </span>
                                ))}
                            </div>
                          </div>
                          <div className="commercialInputs">
                            <label>
                              Internal $ / hour
                              <input
                                type="number"
                                min="0"
                                value={commercialInputs.internalRate || ""}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    internalRate: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Target margin %
                              <input
                                type="number"
                                min="0"
                                max="90"
                                value={commercialInputs.targetMargin}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    targetMargin: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Capacity hours
                              <input
                                type="number"
                                min="0"
                                value={commercialInputs.teamCapacityHours || ""}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    teamCapacityHours: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Scenario price
                              <input
                                type="number"
                                min="0"
                                value={commercialInputs.scenarioPrice || ""}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    scenarioPrice: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Scenario hours
                              <input
                                type="number"
                                min="0"
                                value={commercialInputs.scenarioHours || ""}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    scenarioHours: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Actual hours
                              <input
                                type="number"
                                min="0"
                                value={commercialInputs.actualHours || ""}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    actualHours: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Actual cost
                              <input
                                type="number"
                                min="0"
                                value={commercialInputs.actualCost || ""}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    actualCost: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                          </div>
                          <div className="commercialTextInputs">
                            <label>
                              New client request / scope change
                              <textarea
                                value={commercialInputs.changeRequest}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    changeRequest: e.target.value,
                                  }))
                                }
                                placeholder="Paste a new email, request or meeting note to compare against the agreed scope."
                              />
                            </label>
                            <label>
                              Negotiation message
                              <textarea
                                value={commercialInputs.negotiationMessage}
                                onChange={(e) =>
                                  setCommercialInputs((v) => ({
                                    ...v,
                                    negotiationMessage: e.target.value,
                                  }))
                                }
                                placeholder="Paste the client objection, price pushback or negotiation request."
                              />
                            </label>
                          </div>
                          <div className="workflowRail">
                            <span className={lab ? "done" : ""}>1 Analyze</span>
                            <span className={lab ? "done" : ""}>
                              2 Engineer scope
                            </span>
                            <span className={p.scopeBaseline ? "done" : ""}>
                              3 Baseline
                            </span>
                            <span
                              className={
                                p.changeOrderStatus === "draft" ||
                                p.changeOrderStatus === "approved"
                                  ? "done"
                                  : ""
                              }
                            >
                              4 Detect change
                            </span>
                            <span
                              className={
                                p.changeOrderStatus === "approved" ? "done" : ""
                              }
                            >
                              5 Approve change
                            </span>
                            <span>6 Rebaseline</span>
                          </div>
                          {p.commercialLabStale && (
                            <div className="error">
                              <b>Commercial intelligence is stale.</b> The
                              proposal changed after this analysis. Recalculate
                              before relying on pricing, scope, negotiation or
                              closing guidance.
                            </div>
                          )}
                          <div className="commercialActions">
                            <button
                              className="primary"
                              disabled={commercialBusy}
                              onClick={() => void buildCommercialLab()}
                            >
                              {commercialBusy
                                ? "Engineering commercial intelligence…"
                                : lab
                                  ? "Recalculate all downstream intelligence"
                                  : "Build Opportunity Lab"}{" "}
                              <ArrowRight size={14} />
                            </button>
                            {lab && (
                              <button
                                disabled={commercialBusy}
                                onClick={() => void establishBaseline()}
                              >
                                <Save size={14} />{" "}
                                {p.scopeBaseline
                                  ? `Replace baseline v${p.scopeBaseline.version}`
                                  : "Establish scope baseline"}
                              </button>
                            )}
                          </div>
                          {p.scopeBaseline && (
                            <div className="baselineBanner">
                              <span>
                                <small>ACTIVE SCOPE BASELINE</small>
                                <b>Baseline v{p.scopeBaseline.version}</b>
                              </span>
                              <span>
                                Proposal v{p.scopeBaseline.proposalVersion} ·{" "}
                                {new Date(
                                  p.scopeBaseline.createdAt,
                                ).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {lab && (
                            <>
                              <div className="commercialKpis">
                                <article>
                                  <small>EST. HOURS</small>
                                  <b>{lab.pricing.estimatedHours || "—"}</b>
                                </article>
                                <article>
                                  <small>RECOMMENDED PRICE</small>
                                  <b>
                                    {lab.pricing.recommendedPrice
                                      ? `${lab.pricing.recommendedPrice.toLocaleString()}`
                                      : "To confirm"}
                                  </b>
                                </article>
                                <article>
                                  <small>SAFE FLOOR</small>
                                  <b>
                                    {lab.pricing.minimumSafePrice
                                      ? `${lab.pricing.minimumSafePrice.toLocaleString()}`
                                      : "To confirm"}
                                  </b>
                                </article>
                                <article>
                                  <small>EXPECTED MARGIN</small>
                                  <b>{lab.pricing.expectedMarginPct || 0}%</b>
                                </article>
                                <article>
                                  <small>FEASIBILITY</small>
                                  <b>{lab.feasibility.status}</b>
                                </article>
                                <article>
                                  <small>REQUIREMENTS</small>
                                  <b>{lab.traceability.length}</b>
                                </article>
                              </div>
                              <div className="labGrid">
                                <article>
                                  <small>1 · AI PRICING INTELLIGENCE</small>
                                  <div className="economics">
                                    <span>
                                      <b>
                                        $
                                        {lab.pricing.estimatedCost.toLocaleString()}
                                      </b>
                                      <small>estimated delivery cost</small>
                                    </span>
                                    <span>
                                      <b>{lab.pricing.contingencyPct || 0}%</b>
                                      <small>contingency</small>
                                    </span>
                                  </div>
                                  {lab.pricing.basis.map((x, i) => (
                                    <p key={i}>{x}</p>
                                  ))}
                                </article>
                                <article>
                                  <small>2 · STRUCTURED SCOPE BUILDER</small>
                                  {lab.scope.phases.map((x, i) => (
                                    <details key={i}>
                                      <summary>
                                        {x.name} · {x.deliverables.length}{" "}
                                        deliverables
                                      </summary>
                                      <b>Deliverables</b>
                                      {x.deliverables.map((v, j) => (
                                        <p key={`d${j}`}>• {v}</p>
                                      ))}
                                      <b>Tasks</b>
                                      {x.tasks.map((v, j) => (
                                        <p key={`t${j}`}>• {v}</p>
                                      ))}
                                      <b>Acceptance</b>
                                      {x.acceptanceCriteria.map((v, j) => (
                                        <p key={`a${j}`}>• {v}</p>
                                      ))}
                                    </details>
                                  ))}
                                  <p>
                                    <b>Assumptions:</b>{" "}
                                    {lab.scope.assumptions.join(" · ") ||
                                      "None stated"}
                                  </p>
                                  <p>
                                    <b>Exclusions:</b>{" "}
                                    {lab.scope.exclusions.join(" · ") ||
                                      "None stated"}
                                  </p>
                                </article>
                                <article>
                                  <small>3 · SCOPE CREEP DETECTOR</small>
                                  <b
                                    className={`changeClass ${lab.changeDetection.classification.replaceAll(" ", "").toLowerCase()}`}
                                  >
                                    {lab.changeDetection.classification}
                                  </b>
                                  <p>{lab.changeDetection.reason}</p>
                                  <p>
                                    <b>Extra effort:</b>{" "}
                                    {lab.changeDetection.estimatedExtraHours ||
                                      "To confirm"}{" "}
                                    hours
                                  </p>
                                  <p>
                                    {
                                      lab.changeDetection
                                        .changeOrderRecommendation
                                    }
                                  </p>
                                  {p.changeOrderDraft && (
                                    <div className="changeActions">
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(
                                            p.changeOrderDraft || "",
                                          )
                                        }
                                      >
                                        <Copy size={13} /> Copy change order
                                      </button>
                                      {p.changeOrderStatus !== "approved" && (
                                        <button
                                          onClick={() =>
                                            void approveChangeOrder()
                                          }
                                        >
                                          <CheckCircle2 size={13} /> Record
                                          approved change
                                        </button>
                                      )}{" "}
                                      {p.changeOrderStatus === "approved" && (
                                        <b>
                                          Approved · rebuild and establish a new
                                          baseline
                                        </b>
                                      )}
                                    </div>
                                  )}
                                </article>
                                <article>
                                  <small>4 · DEAL SIMULATOR</small>
                                  <div className="scenarioMeter">
                                    <b>{lab.simulator.marginPct}%</b>
                                    <span>
                                      scenario margin vs{" "}
                                      {commercialInputs.targetMargin}% target
                                    </span>
                                    <i>
                                      <em
                                        style={{
                                          width: `${Math.max(0, Math.min(100, lab.simulator.marginPct))}%`,
                                        }}
                                      />
                                    </i>
                                  </div>
                                  <p>{lab.simulator.riskImpact}</p>
                                  {lab.simulator.tradeoffs.map((x, i) => (
                                    <p key={i}>{x}</p>
                                  ))}
                                </article>
                                <article>
                                  <small>5 · HISTORICAL INTELLIGENCE</small>
                                  <b>
                                    {lab.historical.sampleSize} prior
                                    opportunities sampled
                                  </b>
                                  <p className="labCaveat">
                                    Patterns are descriptive learning, not a
                                    prediction of this deal.
                                  </p>
                                  {lab.historical.signals.map((x, i) => (
                                    <p key={i}>{x}</p>
                                  ))}
                                </article>
                                <article>
                                  <small>6 · BRIEF / RFP INTELLIGENCE</small>
                                  <p>
                                    {lab.intake.requirements.length}{" "}
                                    requirements ·{" "}
                                    {lab.intake.contradictions.length}{" "}
                                    contradictions ·{" "}
                                    {lab.intake.openQuestions.length} open
                                    questions
                                  </p>
                                  <b>Contradictions</b>
                                  {lab.intake.contradictions.map((x, i) => (
                                    <p key={`c${i}`}>{x}</p>
                                  ))}
                                  <b>Deadlines</b>
                                  {lab.intake.deadlines.map((x, i) => (
                                    <p key={`d${i}`}>{x}</p>
                                  ))}
                                  <b>Unresolved</b>
                                  {lab.intake.openQuestions.map((x, i) => (
                                    <p key={`q${i}`}>{x}</p>
                                  ))}
                                </article>
                                <article className="wideLab">
                                  <small>7 · REQUIREMENT TRACEABILITY</small>
                                  {lab.coverage && (
                                    <div className="coverageStrip">
                                      <span>
                                        <b>{lab.coverage.covered}</b> covered
                                      </span>
                                      <span>
                                        <b>{lab.coverage.ambiguous}</b>{" "}
                                        ambiguous
                                      </span>
                                      <span>
                                        <b>{lab.coverage.unanswered}</b>{" "}
                                        unanswered
                                      </span>
                                    </div>
                                  )}
                                  <div className="traceTable">
                                    {lab.traceability.map((x, i) => (
                                      <div key={i}>
                                        <b>{x.coverage}</b>
                                        <span>{x.requirement}</span>
                                        <small>
                                          {x.proposalSection ||
                                            "No mapped section"}{" "}
                                          ·{" "}
                                          {x.acceptanceCriterion ||
                                            "Acceptance to confirm"}
                                        </small>
                                      </div>
                                    ))}
                                  </div>
                                </article>
                                <article>
                                  <small>8 · DELIVERY FEASIBILITY</small>
                                  <b>{lab.feasibility.status}</b>
                                  <p>
                                    {lab.feasibility.estimatedHours} estimated
                                    hours vs{" "}
                                    {lab.feasibility.capacityHours || "unknown"}{" "}
                                    capacity
                                  </p>
                                  {lab.feasibility.bottlenecks.map((x, i) => (
                                    <p key={i}>{x}</p>
                                  ))}
                                </article>
                                <article>
                                  <small>9 · NEGOTIATION COPILOT</small>
                                  <b>
                                    {lab.negotiation.recommendedApproach ||
                                      "Add a negotiation message to assess."}
                                  </b>
                                  <p>
                                    <b>Protect:</b>{" "}
                                    {lab.negotiation.protect.join(" · ") ||
                                      "Add a negotiation message to assess."}
                                  </p>
                                  {p.dealScenarios?.length ? (
                                    <div className="negotiationEconomics">
                                      {p.dealScenarios.map((s) => (
                                        <p key={s.name}>
                                          <b>
                                            {s.name}: $
                                            {s.price.toLocaleString()}
                                          </b>{" "}
                                          · {s.marginPct}% margin · {s.tradeoff}
                                        </p>
                                      ))}
                                    </div>
                                  ) : null}
                                  {lab.negotiation.giveGetTrades.map((x, i) => (
                                    <p key={i}>{x}</p>
                                  ))}
                                  {lab.negotiation.responseDraft && (
                                    <>
                                      <pre>{lab.negotiation.responseDraft}</pre>
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(
                                            lab.negotiation.responseDraft,
                                          )
                                        }
                                      >
                                        <Copy size={13} /> Copy response
                                      </button>
                                    </>
                                  )}
                                </article>
                                <article>
                                  <small>10 · COMMERCIAL MEMORY</small>
                                  <p>{lab.memory.estimatedVsActual}</p>
                                  {lab.memory.lessons.map((x, i) => (
                                    <p key={i}>{x}</p>
                                  ))}
                                  <p>
                                    <b>Next pricing:</b>{" "}
                                    {lab.memory.futurePricingAdjustment}
                                  </p>
                                  <p className="labCaveat">
                                    Record actual hours and cost after delivery
                                    to turn estimates into reusable commercial
                                    learning.
                                  </p>
                                </article>
                                {p.commercialAudit?.length ? (
                                  <article className="wideLab">
                                    <small>COMMERCIAL AUDIT TRAIL</small>
                                    <div className="auditTrail">
                                      {[...p.commercialAudit]
                                        .reverse()
                                        .slice(0, 12)
                                        .map((a, i) => (
                                          <div key={i}>
                                            <b>{a.type.replaceAll("_", " ")}</b>
                                            <span>{a.detail}</span>
                                            <small>
                                              {new Date(a.at).toLocaleString()}
                                            </small>
                                          </div>
                                        ))}
                                    </div>
                                  </article>
                                ) : null}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </section>
                  <section
                    className={`dealClosingPanel guidedModule ${dealWorkspaceMode === "guide" && dealWorkspaceStep !== "win" ? "guidedHidden" : ""}`}
                  >
                    <div className="sectionTitle">
                      <Target size={16} />
                      <div>
                        <span className="eyebrow">MOVE THE DEAL FORWARD</span>
                        <h3>Closing command center</h3>
                      </div>
                    </div>
                    {(() => {
                      const p = projects.find((x) => x.id === result.projectId);
                      if (!p) return null;
                      const stages: DealStage[] = [
                        "Draft",
                        "Proposal Ready",
                        "Sent",
                        "Follow-up",
                        "Negotiation",
                        "Won",
                        "Lost",
                      ];
                      return (
                        <>
                          <div className="dealStageRow">
                            {stages.map((s) => (
                              <button
                                key={s}
                                className={p.dealStage === s ? "active" : ""}
                                onClick={() => {
                                  if (s === "Won" || s === "Lost") {
                                    const reason = window.prompt(
                                      `Why was this deal ${s.toLowerCase()}? This becomes learning for future opportunities.`,
                                    );
                                    if (!reason) return;
                                    void saveDeal(s, p.dealValue, reason);
                                  } else
                                    void saveDeal(
                                      s,
                                      p.dealValue,
                                      p.outcomeReason,
                                    );
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          {p.shareStatus && (
                            <div className={`shareStatus ${p.shareStatus}`}>
                              <small>CLIENT REVIEW</small>
                              <b>
                                {p.shareStatus === "accepted"
                                  ? "Proposal accepted"
                                  : p.shareStatus === "changes_requested"
                                    ? "Changes requested"
                                    : "Proposal shared"}
                              </b>
                              {p.clientDecisionName && (
                                <span>
                                  {p.clientDecisionName}
                                  {p.clientDecisionAt
                                    ? ` · ${new Date(p.clientDecisionAt).toLocaleString()}`
                                    : ""}
                                </span>
                              )}
                              {p.clientDecisionNote && (
                                <p>{p.clientDecisionNote}</p>
                              )}
                            </div>
                          )}
                          <div className="dealMeta">
                            <label>
                              Deal value
                              <input
                                type="number"
                                min="0"
                                value={p.dealValue || ""}
                                placeholder="0"
                                onChange={(e) =>
                                  setProjects((v) =>
                                    v.map((x) =>
                                      x.id === p.id
                                        ? {
                                            ...x,
                                            dealValue: Number(e.target.value),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                onBlur={() =>
                                  void saveDeal(
                                    p.dealStage || "Draft",
                                    p.dealValue,
                                    p.outcomeReason,
                                  )
                                }
                              />
                            </label>
                            <span>
                              <small>NEXT BEST ACTION</small>
                              <b>
                                {p.nextBestAction ||
                                  "Generate closing guidance for the highest-leverage next move."}
                              </b>
                            </span>
                          </div>
                          {p.outcomeReason && (
                            <div className="outcomeLearning">
                              <small>{p.dealStage} LEARNING</small>
                              <p>{p.outcomeReason}</p>
                            </div>
                          )}
                          {p.closeCoach && (
                            <div className="closeCoach">
                              <article>
                                <small>WHY THIS ACTION</small>
                                <p>{p.closeCoach.why}</p>
                              </article>
                              <article>
                                <small>CLOSING RISK</small>
                                <p>{p.closeCoach.risk}</p>
                              </article>
                              <article>
                                <small>DISCOVERY TO UNBLOCK THE DEAL</small>
                                {p.closeCoach.discoveryQuestions.map((q, i) => (
                                  <p key={i}>
                                    {i + 1}. {q}
                                  </p>
                                ))}
                              </article>
                              <div className="followUpDraft">
                                <div>
                                  <small>STAGE-AWARE FOLLOW-UP</small>
                                  <button
                                    onClick={() =>
                                      navigator.clipboard.writeText(
                                        p.closeCoach?.followUp || "",
                                      )
                                    }
                                  >
                                    <Copy size={13} /> Copy
                                  </button>
                                </div>
                                <pre>{p.closeCoach.followUp}</pre>
                              </div>
                            </div>
                          )}
                          <button
                            className="primary closeCoachButton"
                            disabled={closeCoachBusy}
                            onClick={() => void buildCloseCoach()}
                          >
                            {closeCoachBusy
                              ? "Building closing guidance…"
                              : p.closeCoach
                                ? "Refresh closing guidance"
                                : "Generate next best action"}{" "}
                            <ArrowRight size={14} />
                          </button>
                        </>
                      );
                    })()}
                  </section>
                  <section
                    className={`winPlanPanel guidedModule ${dealWorkspaceMode === "guide" && dealWorkspaceStep !== "win" ? "guidedHidden" : ""}`}
                  >
                    <div className="sectionTitle">
                      <TrendingUp size={16} />
                      <div>
                        <span className="eyebrow">WIN THE BUSINESS</span>
                        <h3>Buyer decision strategy</h3>
                      </div>
                    </div>
                    {!result.winPlan ? (
                      <div className="winPlanIntro">
                        <p>
                          Turn the scope analysis into a practical sales plan:
                          what matters to the buyer, what may block the
                          decision, how to handle objections and what to do
                          next.
                        </p>
                        <button
                          className="primary"
                          disabled={winPlanBusy || !result.projectId}
                          onClick={() => void buildWinPlan()}
                        >
                          {winPlanBusy
                            ? "Building win strategy…"
                            : "Build win strategy"}{" "}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="winPlanGrid">
                          <article>
                            <small>BUYER PRIORITIES</small>
                            {result.winPlan.buyerPriorities.map((v, i) => (
                              <p key={i}>{v}</p>
                            ))}
                          </article>
                          <article>
                            <small>DECISION FRICTION</small>
                            {result.winPlan.decisionFriction.map((v, i) => (
                              <p key={i}>{v}</p>
                            ))}
                          </article>
                          <article>
                            <small>DECISION MAP</small>
                            {(result.winPlan.decisionMakers || []).map(
                              (v, i) => (
                                <p key={i}>{v}</p>
                              ),
                            )}
                          </article>
                          <article>
                            <small>DEAL SIGNALS</small>
                            {(result.winPlan.dealSignals || []).map((v, i) => (
                              <p key={i}>{v}</p>
                            ))}
                          </article>
                          <article>
                            <small>WHY THIS PROPOSAL CAN WIN</small>
                            {result.winPlan.differentiators.map((v, i) => (
                              <p key={i}>{v}</p>
                            ))}
                          </article>
                          <article>
                            <small>NEXT BEST ACTIONS</small>
                            {result.winPlan.nextActions.map((v, i) => (
                              <p key={i}>
                                {i + 1}. {v}
                              </p>
                            ))}
                          </article>
                        </div>
                        <div className="objectionList">
                          <small>OBJECTION PLAYBOOK</small>
                          {result.winPlan.objections.map((v, i) => (
                            <article key={i}>
                              <b>{v.objection}</b>
                              <p>{v.response}</p>
                            </article>
                          ))}
                        </div>
                        <div className="followUpDraft">
                          <div>
                            <small>FOLLOW-UP DRAFT</small>
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  result.winPlan?.followUp || "",
                                )
                              }
                            >
                              <Copy size={13} /> Copy
                            </button>
                          </div>
                          <pre>{result.winPlan.followUp}</pre>
                        </div>
                        <button
                          className="secondaryWin"
                          disabled={winPlanBusy}
                          onClick={() => void buildWinPlan()}
                        >
                          {winPlanBusy
                            ? "Refreshing…"
                            : "Refresh strategy after proposal changes"}
                        </button>
                      </>
                    )}
                  </section>
                  {(() => {
                    const p = projects.find((x) => x.id === result.projectId);
                    if (!p) return null;
                    const studio = p.proposalStudio;
                    return (
                      <section
                        className={`proposalStudio guidedModule ${dealWorkspaceMode === "guide" && dealWorkspaceStep !== "propose" && dealWorkspaceStep !== "win" ? "guidedHidden" : ""}`}
                      >
                        <div className="sectionTitle">
                          <Sparkles size={16} />
                          <div>
                            <span className="eyebrow">PROPOSAL STUDIO 3.0</span>
                            <h3>Build, audit and move the proposal forward</h3>
                          </div>
                        </div>
                        <div className="studioActions">
                          <button
                            className="primary"
                            disabled={proposalStudioBusy}
                            onClick={() => void runProposalStudio("audit")}
                          >
                            {proposalStudioBusy
                              ? "Analyzing…"
                              : "Audit proposal"}
                          </button>
                          <button
                            disabled={proposalStudioBusy}
                            onClick={() => void runProposalStudio("followup")}
                          >
                            Stage-aware follow-up
                          </button>
                        </div>
                        <textarea
                          className="studioInput"
                          value={proposalStudioInput}
                          onChange={(e) =>
                            setProposalStudioInput(e.target.value)
                          }
                          placeholder="Paste discovery-call notes, meeting transcript, buyer objection or new decision context…"
                        />
                        <div className="studioActions">
                          <button
                            disabled={
                              proposalStudioBusy || !proposalStudioInput.trim()
                            }
                            onClick={() => void runProposalStudio("meeting")}
                          >
                            Analyze meeting changes
                          </button>
                          <button
                            disabled={
                              proposalStudioBusy || !proposalStudioInput.trim()
                            }
                            onClick={() => void runProposalStudio("objection")}
                          >
                            Work buyer objection
                          </button>
                        </div>
                        {studio && (
                          <>
                            <div className="studioKpis">
                              <span>
                                <small>QUALITY SCORE</small>
                                <b>{studio.audit?.score ?? "—"}/100</b>
                              </span>
                              <span>
                                <small>SEND READINESS</small>
                                <b>
                                  {studio.audit?.ready ? "Ready" : "Review"}
                                </b>
                              </span>
                              <span>
                                <small>REQUIREMENTS</small>
                                <b>{studio.coverage?.covered || 0} covered</b>
                              </span>
                              <span>
                                <small>GAPS</small>
                                <b>
                                  {(studio.coverage?.ambiguous || 0) +
                                    (studio.coverage?.unanswered || 0)}
                                </b>
                              </span>
                            </div>
                            <div className="studioGrid">
                              <article>
                                <small>QUALITY AUDITOR</small>
                                {studio.audit?.issues?.map(
                                  (x: any, i: number) => (
                                    <div
                                      className={`studioIssue ${String(x.severity).toLowerCase()}`}
                                      key={i}
                                    >
                                      <b>
                                        {x.severity} · {x.type}
                                      </b>
                                      <p>{x.issue}</p>
                                      <small>Fix: {x.fix}</small>
                                    </div>
                                  ),
                                )}
                                {!studio.audit?.issues?.length && (
                                  <p>
                                    No material issues returned by the latest
                                    audit.
                                  </p>
                                )}
                              </article>
                              <article>
                                <small>REQUIREMENT → PROPOSAL COVERAGE</small>
                                {studio.coverage?.items?.map(
                                  (x: any, i: number) => (
                                    <p key={i}>
                                      <b>{x.status}</b> · {x.requirement}
                                      <small>
                                        {x.section || "No mapped section"}
                                        {x.gap ? ` · ${x.gap}` : ""}
                                      </small>
                                    </p>
                                  ),
                                )}
                              </article>
                              <article className="wideLab">
                                <small>MODULAR PROPOSAL BUILDER</small>
                                <div className="proposalModules">
                                  {studio.sections?.map((x: any, i: number) => (
                                    <details key={i} open={i < 2}>
                                      <summary>{x.title}</summary>
                                      <small>{x.purpose}</small>
                                      <p>{x.content}</p>
                                      <button
                                        onClick={() =>
                                          navigator.clipboard.writeText(
                                            x.content,
                                          )
                                        }
                                      >
                                        Copy section
                                      </button>
                                    </details>
                                  ))}
                                </div>
                              </article>
                              <article>
                                <small>PROPOSAL APPROACHES</small>
                                {studio.approaches?.map((x: any, i: number) => (
                                  <p key={i}>
                                    <b>{x.name}</b> · {x.positioning}
                                    <small>Best when: {x.bestWhen}</small>
                                  </p>
                                ))}
                              </article>
                              <article>
                                <small>MEETING → DEAL INTELLIGENCE</small>
                                {studio.meeting?.newRequirements?.map(
                                  (x: string, i: number) => (
                                    <p key={`n${i}`}>New: {x}</p>
                                  ),
                                )}
                                {studio.meeting?.changedRequirements?.map(
                                  (x: string, i: number) => (
                                    <p key={`c${i}`}>Changed: {x}</p>
                                  ),
                                )}
                                {studio.meeting?.openQuestions?.map(
                                  (x: string, i: number) => (
                                    <p key={`q${i}`}>Open: {x}</p>
                                  ),
                                )}
                              </article>
                              <article>
                                <small>BUYER OBJECTION WORKSPACE</small>
                                {studio.objection?.objection && (
                                  <>
                                    <b>{studio.objection.objection}</b>
                                    <p>{studio.objection.diagnosis}</p>
                                  </>
                                )}
                                {studio.objection?.options?.map(
                                  (x: any, i: number) => (
                                    <p key={i}>
                                      <b>{x.approach}</b> ·{" "}
                                      {x.commercialTradeoff}
                                      <small>{x.response}</small>
                                    </p>
                                  ),
                                )}
                              </article>
                              <article>
                                <small>STAGE-AWARE FOLLOW-UP</small>
                                {studio.followUp?.subject && (
                                  <>
                                    <b>{studio.followUp.subject}</b>
                                    <pre>{studio.followUp.body}</pre>
                                    <small>
                                      Next: {studio.followUp.nextStep}
                                    </small>
                                    <button
                                      onClick={() =>
                                        navigator.clipboard.writeText(
                                          studio.followUp.body,
                                        )
                                      }
                                    >
                                      Copy follow-up
                                    </button>
                                  </>
                                )}
                              </article>
                              <article>
                                <small>DEAL ACTIVITY TIMELINE</small>
                                {p.commercialAudit
                                  ?.slice()
                                  .reverse()
                                  .slice(0, 12)
                                  .map((a, i) => (
                                    <p key={i}>
                                      <b>{a.type.replaceAll("_", " ")}</b> ·{" "}
                                      {a.detail}
                                      <small>
                                        {new Date(a.at).toLocaleString()}
                                      </small>
                                    </p>
                                  ))}
                              </article>
                            </div>
                          </>
                        )}
                      </section>
                    );
                  })()}
                  <div
                    className={`proposalHead guidedModule ${dealWorkspaceMode === "guide" && dealWorkspaceStep !== "propose" ? "guidedHidden" : ""}`}
                  >
                    <div>
                      <h3>Client-ready proposal</h3>
                      {result.version && (
                        <small>
                          Version {result.version} · {proposalOptions.mode}
                        </small>
                      )}
                    </div>
                    <div className="proposalActions">
                      <button
                        onClick={() => {
                          setProposalDraft(result.proposal);
                          setEditingProposal(!editingProposal);
                        }}
                      >
                        <Pencil size={15} />{" "}
                        {editingProposal ? "Preview" : "Edit"}
                      </button>
                      <button
                        onClick={() => void loadVersions()}
                        disabled={!result.projectId}
                      >
                        <History size={15} /> Versions
                      </button>
                      <button onClick={printProposal}>
                        <Printer size={15} /> PDF / Print
                      </button>
                      <button
                        disabled={shareBusy || !result.projectId}
                        onClick={() => void shareProposal()}
                      >
                        <Send size={15} />{" "}
                        {shareBusy ? "Creating link…" : "Share for approval"}
                      </button>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            editingProposal ? proposalDraft : result.proposal,
                          )
                        }
                      >
                        <Copy size={15} /> Copy
                      </button>
                    </div>
                  </div>
                  <div className="proposalPreview">
                    {proposalOptions.includeSellerLogo && profile.logoUrl && (
                      <img
                        src={profile.logoUrl}
                        alt={`${profile.company} logo`}
                      />
                    )}{" "}
                    {proposalOptions.includeClientLogo && clientLogoUrl && (
                      <img src={clientLogoUrl} alt="Client logo" />
                    )}
                  </div>
                  {proposalOptions.includeVisuals && result.visuals?.length ? (
                    <div className="visualGrid">
                      {result.visuals.map((v, i) => (
                        <article key={`${v.title}-${i}`}>
                          <b>{v.title}</b>
                          <div className="bars">
                            {v.values.map((value, j) => {
                              const max = Math.max(...v.values, 1);
                              return (
                                <div key={j}>
                                  <span>{v.labels[j] || `Item ${j + 1}`}</span>
                                  <i>
                                    <em
                                      style={{
                                        width: `${Math.max(4, (value / max) * 100)}%`,
                                      }}
                                    />
                                  </i>
                                  <small>{value}</small>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {editingProposal ? (
                    <div className="proposalEditor">
                      <textarea
                        value={proposalDraft}
                        onChange={(e) => setProposalDraft(e.target.value)}
                      />
                      <button
                        className="primary"
                        onClick={saveProposal}
                        disabled={busy || proposalDraft.trim().length < 80}
                      >
                        <Save size={16} />{" "}
                        {busy ? "Saving…" : "Save as new version"}
                      </button>
                    </div>
                  ) : (
                    <pre className="proposalDocument">{result.proposal}</pre>
                  )}
                  {showVersions && (
                    <div className="versionPanel">
                      <div>
                        <h3>Proposal history</h3>
                        <button onClick={() => setShowVersions(false)}>
                          ×
                        </button>
                      </div>
                      {proposalVersions.map((v) => (
                        <button
                          key={v.version}
                          onClick={() => {
                            setProposalDraft(v.proposal);
                            setEditingProposal(true);
                            setShowVersions(false);
                          }}
                        >
                          <span>
                            <b>Version {v.version}</b>
                            <small>
                              {v.savedAt
                                ? new Date(v.savedAt).toLocaleString()
                                : v.status}
                            </small>
                          </span>
                          <em>{v.status}</em>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {view === "projects" && (
          <div className="page">
            <h1>Your deal library</h1>
            <p className="sub">
              Every analyzed opportunity is saved to your private workspace.
            </p>
            <div className="projectCards">
              {projects.map((p) => (
                <article key={p.id} onClick={() => openProject(p)}>
                  <div>
                    <span>{p.score}/100 risk</span>
                    <small>{new Date(p.createdAt).toLocaleDateString()}</small>
                  </div>
                  <h3>{p.client || "Untitled opportunity"}</h3>
                  <p>{p.summary}</p>
                  <div className="projectDealMeta">
                    <span>{p.dealStage || "Draft"}</span>
                    {p.dealValue ? ` · ${p.dealValue.toLocaleString()}` : ""}
                    {p.nextBestAction && (
                      <small>Next: {p.nextBestAction}</small>
                    )}
                  </div>
                  <button>
                    Open intelligence <ArrowRight size={13} />
                  </button>
                </article>
              ))}
              {!projects.length && (
                <div className="zero">No saved deals yet.</div>
              )}
            </div>
          </div>
        )}
        {view === "clients" && (
          <div className="page clientPage">
            <div className="clientPageHead">
              <div>
                <span className="eyebrow">CLIENT INTELLIGENCE</span>
                <h1>Relationship command center</h1>
                <p className="sub">
                  Keep buyer context, commercial history and next actions
                  connected to every proposal.
                </p>
              </div>
              <div className="clientKpis">
                <span>
                  <b>{clients.length}</b> accounts
                </span>
                <span>
                  <b>{clients.filter((c) => c.status === "Active").length}</b>{" "}
                  active
                </span>
                <span>
                  <b>
                    {clients.reduce(
                      (sum, c) => sum + (c.proposalCount || 0),
                      0,
                    )}
                  </b>{" "}
                  linked proposals
                </span>
              </div>
            </div>
            <div className="clientWorkspace">
              <section className="clientDirectory">
                <div className="clientDirectoryHead">
                  <input
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search clients, companies or industries…"
                  />
                </div>
                <div className="clientRows">
                  {clients
                    .filter(
                      (c) =>
                        !clientSearch.trim() ||
                        `${c.name} ${c.company || ""} ${c.industry || ""} ${c.email || ""}`
                          .toLowerCase()
                          .includes(clientSearch.trim().toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className={
                          selectedClient?.id === c.id ? "selected" : ""
                        }
                        onClick={() => {
                          setSelectedClient(c);
                          setClientDraft({ ...c });
                        }}
                      >
                        <div className="clientIdentity">
                          <i>
                            {(c.company || c.name).slice(0, 2).toUpperCase()}
                          </i>
                          <span>
                            <b>{c.company || c.name}</b>
                            <small>
                              {c.name}
                              {c.industry ? ` · ${c.industry}` : ""}
                            </small>
                          </span>
                        </div>
                        <span
                          className={`clientStatus ${(c.status || "Prospect").toLowerCase()}`}
                        >
                          {c.status || "Prospect"}
                        </span>
                        <span>
                          <b>{c.proposalCount || 0}</b>
                          <small>proposals</small>
                        </span>
                        <span>
                          <b>{c.averageRisk ?? "—"}</b>
                          <small>avg risk</small>
                        </span>
                        <span>
                          <small>
                            {c.followUpDate
                              ? `Follow up ${c.followUpDate}`
                              : c.nextStep || "No next step"}
                          </small>
                        </span>
                      </button>
                    ))}
                  {!clients.length && (
                    <div className="zero">
                      No clients yet. Create the first reusable buyer profile.
                    </div>
                  )}
                </div>
              </section>
              <aside className="clientCreate">
                <span className="eyebrow">NEW CLIENT</span>
                <h3>Create buyer profile</h3>
                <label>
                  Contact name
                  <input
                    value={newClient.name}
                    onChange={(e) =>
                      setNewClient({ ...newClient, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Company
                  <input
                    value={newClient.company}
                    onChange={(e) =>
                      setNewClient({ ...newClient, company: e.target.value })
                    }
                  />
                </label>
                <div className="two">
                  <label>
                    Email
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={(e) =>
                        setNewClient({ ...newClient, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      value={newClient.phone}
                      onChange={(e) =>
                        setNewClient({ ...newClient, phone: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="two">
                  <label>
                    Industry
                    <input
                      value={newClient.industry}
                      onChange={(e) =>
                        setNewClient({ ...newClient, industry: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={newClient.status}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          status: e.target.value as "Prospect",
                        })
                      }
                    >
                      <option>Prospect</option>
                      <option>Active</option>
                      <option>Won</option>
                      <option>Dormant</option>
                      <option>Lost</option>
                    </select>
                  </label>
                </div>
                <label>
                  Goals
                  <textarea
                    value={newClient.goals}
                    onChange={(e) =>
                      setNewClient({ ...newClient, goals: e.target.value })
                    }
                    placeholder="What are they trying to achieve?"
                  />
                </label>
                <label>
                  Relationship notes
                  <textarea
                    value={newClient.notes}
                    onChange={(e) =>
                      setNewClient({ ...newClient, notes: e.target.value })
                    }
                    placeholder="Context, history, sensitivities…"
                  />
                </label>
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={addClient}
                >
                  <Plus size={14} /> Create client
                </button>
              </aside>
            </div>
            {selectedClient && clientDraft && (
              <div className="clientDrawer">
                <div className="clientDrawerHead">
                  <div>
                    <span className="eyebrow">CLIENT 360</span>
                    <h2>{clientDraft.company || clientDraft.name}</h2>
                    <small>
                      {clientDraft.name} · {clientDraft.status || "Prospect"}
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedClient(null);
                      setClientDraft(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="clientDrawerStats">
                  <span>
                    <b>{selectedClient.proposalCount || 0}</b> proposals
                  </span>
                  <span>
                    <b>{selectedClient.averageRisk ?? "—"}</b> avg risk
                  </span>
                  <span>
                    <b>
                      {selectedClient.lastOpportunityAt
                        ? new Date(
                            selectedClient.lastOpportunityAt,
                          ).toLocaleDateString()
                        : "—"}
                    </b>{" "}
                    last opportunity
                  </span>
                </div>
                <div className="clientDrawerForm">
                  {clientDraft.logoUrl && (
                    <img
                      className="profileLogo"
                      src={clientDraft.logoUrl}
                      alt={`${clientDraft.company || clientDraft.name} logo`}
                    />
                  )}
                  <label className="uploadBox">
                    <ImageIcon size={17} />
                    <b>
                      {clientDraft.logoUrl
                        ? "Replace client logo"
                        : "Add client logo"}
                    </b>
                    <span>
                      Saved to this client and reused on future proposals
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        uploadFile(
                          e.target.files[0],
                          "client_logo",
                          clientDraft.id,
                        )
                      }
                    />
                  </label>
                  <div className="two">
                    <label>
                      Contact
                      <input
                        value={clientDraft.name}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            name: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Company
                      <input
                        value={clientDraft.company || ""}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            company: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="two">
                    <label>
                      Email
                      <input
                        type="email"
                        value={clientDraft.email || ""}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            email: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        value={clientDraft.phone || ""}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            phone: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="two">
                    <label>
                      Website
                      <input
                        value={clientDraft.website || ""}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            website: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Industry
                      <input
                        value={clientDraft.industry || ""}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            industry: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="two">
                    <label>
                      Status
                      <select
                        value={clientDraft.status || "Prospect"}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            status: e.target.value as Client["status"],
                          })
                        }
                      >
                        <option>Prospect</option>
                        <option>Active</option>
                        <option>Won</option>
                        <option>Dormant</option>
                        <option>Lost</option>
                      </select>
                    </label>
                    <label>
                      Follow-up date
                      <input
                        type="date"
                        value={clientDraft.followUpDate || ""}
                        onChange={(e) =>
                          setClientDraft({
                            ...clientDraft,
                            followUpDate: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Buyer goals
                    <textarea
                      value={clientDraft.goals || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          goals: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Preferences & working style
                    <textarea
                      value={clientDraft.preferences || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          preferences: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Decision makers
                    <textarea
                      value={clientDraft.decisionMakers || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          decisionMakers: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Buyer pain points
                    <textarea
                      value={clientDraft.painPoints || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          painPoints: e.target.value,
                        })
                      }
                      placeholder="Problems, urgency or commercial pressure explicitly shared by the buyer."
                    />
                  </label>
                  <label>
                    Buying criteria
                    <textarea
                      value={clientDraft.buyingCriteria || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          buyingCriteria: e.target.value,
                        })
                      }
                      placeholder="What matters in the decision: price, speed, proof, process, risk…"
                    />
                  </label>
                  <label>
                    Known objections
                    <textarea
                      value={clientDraft.knownObjections || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          knownObjections: e.target.value,
                        })
                      }
                      placeholder="Concerns already raised by the buyer or procurement."
                    />
                  </label>
                  <label>
                    Relationship notes
                    <textarea
                      value={clientDraft.notes || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          notes: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Next best action
                    <textarea
                      value={clientDraft.nextStep || ""}
                      onChange={(e) =>
                        setClientDraft({
                          ...clientDraft,
                          nextStep: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="clientDrawerActions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void saveClient()}
                  >
                    <Save size={14} /> Save client
                  </button>
                  <button onClick={() => useClientForProposal(clientDraft)}>
                    <ArrowRight size={14} /> Start proposal
                  </button>
                  <button
                    className="dangerAction"
                    disabled={busy}
                    onClick={() => void deleteClient(clientDraft)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {view === "files" && (
          <div className="page settings">
            <h1>Knowledge base</h1>
            <p className="sub">
              Add service sheets, capability notes and company knowledge.
              Search, inspect and control exactly which reusable facts
              ScopeVanta may use in future proposals.
            </p>
            <div className="knowledgeSummary">
              <div>
                <span className="eyebrow">REUSABLE KNOWLEDGE</span>
                <strong>
                  {knowledgeRecords.filter((v) => v.active !== false).length}
                </strong>
                <small>active facts</small>
              </div>
              <div>
                {Array.from(new Set(knowledgeRecords.map((v) => v.category)))
                  .slice(0, 8)
                  .map((category) => (
                    <span key={category}>
                      <b>
                        {
                          knowledgeRecords.filter(
                            (v) =>
                              v.category === category && v.active !== false,
                          ).length
                        }
                      </b>{" "}
                      {category}
                    </span>
                  ))}
              </div>
            </div>
            <div
              className={
                knowledgeHealth
                  ? knowledgeHealth.healthy
                    ? "notice"
                    : "error"
                  : "notice"
              }
            >
              <b>
                {knowledgeHealth
                  ? knowledgeHealth.healthy
                    ? "Knowledge integrity healthy"
                    : "Knowledge integrity needs attention"
                  : "File Intelligence health check"}
              </b>
              <p>
                {knowledgeHealth
                  ? `${knowledgeHealth.files} sources · ${knowledgeHealth.activeFacts} active facts · ${knowledgeHealth.issues.orphanFacts} orphan facts · ${knowledgeHealth.issues.duplicateFacts} duplicates · ${knowledgeHealth.issues.failedFiles} failed sources · ${knowledgeHealth.issues.missingOriginals} missing originals. ${knowledgeHealth.recommendation}`
                  : "Run a live integrity check across source files, reusable facts, duplicates, failed processing and stored originals."}
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void checkKnowledgeHealth()}
              >
                {busy ? "Checking…" : "Run integrity check"}
              </button>
            </div>
            <label className="uploadBox knowledgeUpload">
              <Upload />
              <b>Add knowledge file</b>
              <span>
                PDF, DOC, DOCX, TXT, MD or image · 5 MB max · images are
                OCR-read
              </span>
              <input
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx,image/*"
                onChange={async (e) => {
                  if (e.target.files?.[0]) {
                    await uploadFile(e.target.files[0], "reference");
                    const r = await api.get("/api/files");
                    setFiles(r.data.files || []);
                  }
                }}
              />
            </label>
            <div className="fileList">
              {files.map((f) => (
                <article key={f.id}>
                  <FileText />
                  <span>
                    <b>{f.name}</b>
                    <small>
                      {f.type || "Document"} ·{" "}
                      {new Date(f.createdAt).toLocaleDateString()} ·{" "}
                      {f.status === "ready"
                        ? `Ready${f.extractedChars ? ` · ${f.extractedChars.toLocaleString()} chars` : ""}`
                        : f.status === "failed"
                          ? "Extraction failed"
                          : "Stored"}
                    </small>
                    {f.error && <small>{f.error}</small>}
                    {f.intelligenceStatus === "ready" && (
                      <>
                        <small>
                          <b>{f.documentType || "Structured knowledge"}</b> ·
                          AI-organized facts ready
                        </small>
                        {f.summary && <small>{f.summary}</small>}
                        {f.knowledgeCounts && (
                          <small>
                            {f.knowledgeCounts.services} services ·{" "}
                            {f.knowledgeCounts.deliverables} deliverables ·{" "}
                            {f.knowledgeCounts.differentiators} differentiators
                            · {f.knowledgeCounts.proof} proof points ·{" "}
                            {f.knowledgeCounts.pricing} pricing facts ·{" "}
                            {f.knowledgeCounts.constraints} constraints
                          </small>
                        )}
                      </>
                    )}
                    {f.intelligenceStatus === "failed" && (
                      <small>
                        {f.intelligenceError ||
                          "Structured knowledge unavailable; extracted text remains usable."}
                      </small>
                    )}
                  </span>
                  <div className="knowledgeFileActions">
                    <button
                      disabled={busy}
                      onClick={() => void reprocessKnowledgeFile(f)}
                      title="Reprocess from stored original"
                    >
                      <RefreshCw size={14} /> Reprocess
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void deleteKnowledgeFile(f)}
                      title="Delete source and derived knowledge"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              ))}
              {!files.length && (
                <div className="zero">No company knowledge uploaded yet.</div>
              )}
            </div>
            {knowledgeRecords.length > 0 && (
              <>
                <div className="knowledgeLibraryHead">
                  <div>
                    <span className="eyebrow">
                      PERSISTENT KNOWLEDGE RECORDS
                    </span>
                    <h2>Reusable company facts</h2>
                  </div>
                  <small>
                    Only active facts are eligible to ground new proposals
                  </small>
                </div>
                <div className="knowledgeControls">
                  <input
                    value={knowledgeSearch}
                    onChange={(e) => setKnowledgeSearch(e.target.value)}
                    placeholder="Search facts, categories or source files…"
                  />
                  <select
                    value={knowledgeCategory}
                    onChange={(e) => setKnowledgeCategory(e.target.value)}
                  >
                    <option>All</option>
                    {Array.from(
                      new Set(knowledgeRecords.map((v) => v.category)),
                    )
                      .sort()
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                  <select
                    value={knowledgeSource}
                    onChange={(e) => setKnowledgeSource(e.target.value)}
                  >
                    <option>All</option>
                    {Array.from(
                      new Set(knowledgeRecords.map((v) => v.sourceFileName)),
                    )
                      .sort()
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                  <select
                    value={knowledgeStatus}
                    onChange={(e) =>
                      setKnowledgeStatus(
                        e.target.value as "all" | "active" | "inactive",
                      )
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Paused</option>
                    <option value="all">All statuses</option>
                  </select>
                </div>
                {(() => {
                  const query = knowledgeSearch.trim().toLowerCase();
                  const visible = knowledgeRecords.filter(
                    (record) =>
                      (knowledgeCategory === "All" ||
                        record.category === knowledgeCategory) &&
                      (knowledgeSource === "All" ||
                        record.sourceFileName === knowledgeSource) &&
                      (knowledgeStatus === "all" ||
                        (knowledgeStatus === "active"
                          ? record.active !== false
                          : record.active === false)) &&
                      (!query ||
                        `${record.fact} ${record.category} ${record.sourceFileName} ${record.documentType}`
                          .toLowerCase()
                          .includes(query)),
                  );
                  return (
                    <>
                      <div className="knowledgeResultMeta">
                        <b>{visible.length}</b> matching fact
                        {visible.length === 1 ? "" : "s"}
                        <button
                          onClick={() => {
                            setKnowledgeSearch("");
                            setKnowledgeCategory("All");
                            setKnowledgeSource("All");
                            setKnowledgeStatus("active");
                          }}
                        >
                          Reset filters
                        </button>
                      </div>
                      <div className="knowledgeRecordList managed">
                        {visible.slice(0, 120).map((record) => (
                          <article
                            className={record.active === false ? "paused" : ""}
                            key={record.id}
                          >
                            <button
                              className="knowledgeInspect"
                              onClick={() => setSelectedKnowledge(record)}
                            >
                              <div>
                                <span>{record.category}</span>
                                <small>{record.sourceFileName}</small>
                              </div>
                              <p>{record.fact}</p>
                            </button>
                            <button
                              className="knowledgeToggle"
                              disabled={busy}
                              onClick={() => void toggleKnowledge(record)}
                            >
                              {record.active === false ? "Activate" : "Pause"}
                            </button>
                          </article>
                        ))}
                        {!visible.length && (
                          <div className="zero">
                            No knowledge facts match these filters.
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
                {selectedKnowledge && (
                  <div className="knowledgeDrawer">
                    <div className="knowledgeDrawerHead">
                      <div>
                        <span className="eyebrow">KNOWLEDGE INSPECTOR</span>
                        <h3>{selectedKnowledge.category}</h3>
                      </div>
                      <button onClick={() => setSelectedKnowledge(null)}>
                        ×
                      </button>
                    </div>
                    <p>{selectedKnowledge.fact}</p>
                    <dl>
                      <div>
                        <dt>Source file</dt>
                        <dd>{selectedKnowledge.sourceFileName}</dd>
                      </div>
                      <div>
                        <dt>Document type</dt>
                        <dd>{selectedKnowledge.documentType || "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>
                          {new Date(
                            selectedKnowledge.createdAt,
                          ).toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt>Proposal eligibility</dt>
                        <dd>
                          {selectedKnowledge.active === false
                            ? "Paused"
                            : "Active"}
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void toggleKnowledge(selectedKnowledge)}
                    >
                      {selectedKnowledge.active === false
                        ? "Activate for future proposals"
                        : "Pause from future proposals"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {view === "company" && (
          <div className="page settings">
            <h1>Company intelligence</h1>
            <p className="sub">
              ScopeVanta uses this information to tailor positioning, scope and
              proposals to your team.
            </p>
            {profile.logoUrl && (
              <img
                className="profileLogo"
                src={profile.logoUrl}
                alt="Company logo"
              />
            )}
            <div className="formGrid">
              <label>
                Full name
                <input
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                  placeholder="you@company.com"
                />
              </label>
              <label className="wide">
                Business address
                <input
                  value={profile.address}
                  onChange={(e) =>
                    setProfile({ ...profile, address: e.target.value })
                  }
                />
              </label>
              <label>
                Company
                <input
                  value={profile.company}
                  onChange={(e) =>
                    setProfile({ ...profile, company: e.target.value })
                  }
                />
              </label>
              <label>
                Website
                <div className="inputIcon">
                  <Globe size={16} />
                  <input
                    value={profile.website}
                    onChange={(e) =>
                      setProfile({ ...profile, website: e.target.value })
                    }
                  />
                </div>
              </label>
              <label className="wide">
                Expertise & differentiators
                <textarea
                  value={profile.expertise}
                  onChange={(e) =>
                    setProfile({ ...profile, expertise: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="uploadRow">
              <label className="uploadBox">
                <Upload />
                <b>Replace company logo</b>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && uploadFile(e.target.files[0], "logo")
                  }
                />
              </label>
              <label className="uploadBox">
                <FileText />
                <b>Add knowledge file</b>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx,image/*"
                  onChange={(e) =>
                    e.target.files?.[0] &&
                    uploadFile(e.target.files[0], "reference")
                  }
                />
              </label>
            </div>
            <button
              className="primary"
              onClick={() => saveProfile()}
              disabled={busy}
            >
              Save company profile
            </button>
          </div>
        )}
        {view === "billing" && (
          <div className="page">
            <h1>Plan & billing</h1>
            <p className="sub">
              Switch plans whenever your pipeline changes. Square handles
              subscription checkout.
            </p>
            {squareStatus && (
              <div
                className={
                  squareStatus.connected && squareStatus.webhookConfigured
                    ? "notice"
                    : "error"
                }
              >
                <b>
                  {squareStatus.connected && squareStatus.webhookConfigured
                    ? "Square billing infrastructure ready"
                    : "Square billing needs attention"}
                </b>
                <p>
                  {squareStatus.connected
                    ? `Production API verified${squareStatus.locations?.length ? ` · ${squareStatus.locations.length} Square location${squareStatus.locations.length === 1 ? "" : "s"} detected` : ""}. ${squareStatus.webhookConfigured ? "Signed webhook verification is configured for lifecycle updates." : "Webhook signature verification is not configured, so automatic cancellation/payment lifecycle updates are not launch-ready."}`
                    : "ScopeVanta could not verify the Square production connection. Billing remains gated until the connection is healthy."}
                </p>
              </div>
            )}
            {billingDetail && (
              <div className="billingAudit">
                <span className="eyebrow">ENTITLEMENT AUDIT</span>
                <div>
                  <span>
                    <small>Lifecycle</small>
                    <b>
                      {billingDetail.lifecycle
                        .replace(/^square_/, "")
                        .replaceAll("_", " ")}
                    </b>
                  </span>
                  <span>
                    <small>Plan</small>
                    <b>{billingDetail.plan}</b>
                  </span>
                  <span>
                    <small>Trial ends</small>
                    <b>
                      {billingDetail.trialEndsAt
                        ? new Date(
                            billingDetail.trialEndsAt,
                          ).toLocaleDateString()
                        : "Not established"}
                    </b>
                  </span>
                  <span>
                    <small>Charged through</small>
                    <b>
                      {billingDetail.chargedThroughDate
                        ? new Date(
                            `${billingDetail.chargedThroughDate}T00:00:00`,
                          ).toLocaleDateString()
                        : "Not reported"}
                    </b>
                  </span>
                  <span>
                    <small>Last verified</small>
                    <b>
                      {billingDetail.verifiedAt
                        ? new Date(billingDetail.verifiedAt).toLocaleString()
                        : "Not verified"}
                    </b>
                  </span>
                  <span>
                    <small>Subscription</small>
                    <b>{billingDetail.subscriptionId || "Not bound"}</b>
                  </span>
                  <span>
                    <small>Required action</small>
                    <b>
                      {billingDetail.action
                        ? billingDetail.action.replaceAll("_", " ")
                        : "None"}
                    </b>
                  </span>
                  <span>
                    <small>Last Square event</small>
                    <b>
                      {billingDetail.lastBillingEvent
                        ? billingDetail.lastBillingEvent.replaceAll("_", " ")
                        : "No webhook event recorded"}
                    </b>
                  </span>
                </div>
                <p>
                  {billingDetail.lifecycle === "payment_failed"
                    ? "Payment recovery is required. Proposal generation stays locked until Square confirms the subscription is active and the paid-through date advances."
                    : billingDetail.lifecycle === "square_canceled"
                      ? "This subscription is canceled. Resubscribe in Square, then verify the new active subscription here."
                      : billingDetail.lifecycle === "square_paused"
                        ? "This subscription is paused. Resume it in Square, then verify access here."
                        : billingDetail.requiresAction
                          ? "Proposal generation remains locked until Square confirms an eligible active subscription."
                          : "Entitlement is currently permitted. ScopeVanta continues to enforce lifecycle state before paid generation."}
                </p>
              </div>
            )}
            <div className="plans portalPlans">
              {plans.map((p) => (
                <article
                  className={profile.plan === p.name ? "selected" : ""}
                  key={p.name}
                >
                  <h3>{p.name}</h3>
                  <strong>{p.price}</strong>
                  <p>{p.usage}</p>
                  {profile.plan === p.name ? (
                    <span className="current">Current selection</span>
                  ) : (
                    <button onClick={() => startPlan(p)}>
                      Switch to {p.name}
                    </button>
                  )}
                </article>
              ))}
            </div>
            <div className="notice">
              <b>
                {billing.status === "verified_active"
                  ? `Square subscription verified · ${billing.daysLeft} introductory days remaining`
                  : billing.status === "payment_failed"
                    ? "Payment issue requires attention"
                    : billing.status === "square_canceled"
                      ? "Subscription canceled"
                      : billing.status === "square_paused"
                        ? "Subscription paused"
                        : billing.checkoutStarted
                          ? "Waiting for Square confirmation"
                          : "Trial activation required"}
              </b>
              <p>
                {billing.status === "verified_active"
                  ? "Your subscription is verified directly with Square. Access and plan limits are enforced from your subscription status."
                  : billing.status === "payment_failed"
                    ? "Update the payment method in Square. ScopeVanta keeps paid generation locked until Square provides billing-recovery evidence."
                    : billing.status === "square_canceled"
                      ? "Resubscribe through Square to restore paid generation."
                      : billing.status === "square_paused"
                        ? "Resume the subscription in Square to restore paid generation."
                        : billing.checkoutStarted
                          ? "Complete the Square checkout, then verify your subscription here. Your card is stored by Square and the first month is $0."
                          : "Choose a plan and continue to Square. Proposal generation stays locked until Square confirms the subscription."}
              </p>
              {billing.checkoutStarted &&
                billing.status !== "verified_active" && (
                  <button
                    className="primary"
                    onClick={syncBilling}
                    disabled={busy}
                  >
                    {busy
                      ? "Checking Square…"
                      : billing.status === "payment_failed"
                        ? "Check payment recovery"
                        : billing.status === "square_canceled"
                          ? "Check resubscription"
                          : billing.status === "square_paused"
                            ? "Check resumed subscription"
                            : "I completed checkout · Verify subscription"}
                  </button>
                )}
              <div className="usageTrack">
                <span
                  style={{
                    width: `${Math.min(100, (projects.length / Math.max(1, billing.limit)) * 100)}%`,
                  }}
                />
              </div>
              <small>
                {projects.length} of {billing.limit} monthly proposal slots used
                in the current workspace view.
              </small>
            </div>
          </div>
        )}
      </section>
      <button className="chatFab" onClick={() => setChatOpen(!chatOpen)}>
        <MessageCircle />
      </button>
      {chatOpen && (
        <div className="chat">
          <div className="chatHead">
            <div>
              <b>ScopeVanta Guide</b>
              <small>AI sales & support</small>
            </div>
            <button onClick={() => setChatOpen(false)}>×</button>
          </div>
          <div className="chatBody">
            {chat.map((m, i) => (
              <div className={m.role} key={i}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="chatInput">
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Ask about plans or ScopeVanta…"
            />
            <button onClick={sendChat}>
              <ArrowRight />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
export default App;
