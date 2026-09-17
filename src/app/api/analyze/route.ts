import { prisma } from "@/lib/prisma";
import { requireWorkspaceAuth } from "@/lib/auth";
import { json, error, withErrors } from "@/lib/http";
import { aiGenerate, aiScrape, stripJsonFence } from "@/lib/ai";
import { rankKnowledge, type KnowledgeRecordContent } from "@/lib/knowledge";
import { PLAN_LIMITS, verifyEntitlement, billingDateAdvanced, hasDevEntitlementBypass } from "@/lib/square";

// POST /api/analyze — legacy/backend/index.ts:2130-2493. The AI system/user
// prompt text is preserved verbatim; only the plumbing (workspace-scoped
// Prisma instead of userId-keyed AppDeploy tables, BillingSubscription
// instead of Profile billing fields, Anthropic instead of ai.generate) is
// translated.

type ProposalOptions = { mode?: "Concise" | "Detailed" | "Premium"; sections?: string[]; includeSellerLogo?: boolean; includeClientLogo?: boolean; includeVisuals?: boolean };
type AnalyzeBody = { brief?: string; budget?: string; timeline?: string; client?: string; clientId?: string; proposalOptions?: ProposalOptions };

const ALLOWED_SECTIONS = [
  "Executive Summary", "Client Challenge & Desired Outcome", "Our Understanding", "Strategic Approach",
  "Detailed Scope of Work", "Deliverables & Acceptance Criteria", "Project Phases", "Timeline & Milestones",
  "Client Inputs & Responsibilities", "Team & Delivery Approach", "Revision & Feedback Process", "Quality Assurance",
  "Success Measures", "Investment & Payment", "Assumptions", "Exclusions", "Change Control", "Why Us", "Next Steps & Acceptance",
];

export const POST = withErrors(async (req: Request) => {
  const ctx = await requireWorkspaceAuth();
  const x = (await req.json().catch(() => ({}))) as AnalyzeBody;
  const brief = (x.brief || "").trim();
  const requested = x.proposalOptions || {};
  const proposalMode = ["Concise", "Detailed", "Premium"].includes(String(requested.mode)) ? String(requested.mode) : "Detailed";
  const proposalSections = (requested.sections || ALLOWED_SECTIONS).filter((v) => ALLOWED_SECTIONS.includes(String(v))).slice(0, ALLOWED_SECTIONS.length);
  if (!proposalSections.length) return error("Choose at least one proposal section.", 400);
  if (brief.length < 40) return error("Please provide a more detailed brief.", 400);
  if (brief.length > 12000) return error("Brief is too long.", 400);

  const profile = await prisma.companyProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!profile?.onboarded) return error("Complete account setup first.", 403);

  const devBypass = hasDevEntitlementBypass();
  let sub = await prisma.billingSubscription.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!devBypass && !sub?.checkoutStartedAt) return error("Start your Square subscription checkout to activate the trial.", 402);

  try {
    const lastVerified = sub?.verifiedAt ? sub.verifiedAt.getTime() : 0;
    const verificationStale = Date.now() - lastVerified > 15 * 60 * 1000;
    if (!devBypass && (sub?.status !== "verified_active" || verificationStale)) {
      const verified = await verifyEntitlement(ctx.workspaceId);
      const chargedThroughDateStr = String(verified?.charged_through_date || sub?.chargedThroughDate?.toISOString() || "");
      const paymentRecovery = sub?.status === "payment_failed" && billingDateAdvanced(sub?.chargedThroughDate, chargedThroughDateStr);
      if (!verified || verified.status !== "ACTIVE" || (sub?.status === "payment_failed" && !paymentRecovery)) {
        if (sub?.status === "verified_active") {
          await prisma.billingSubscription.update({
            where: { workspaceId: ctx.workspaceId },
            data: { status: verified ? `square_${verified.status.toLowerCase()}` : "square_not_found", verifiedAt: new Date() },
          });
        }
        return error("An active Square subscription is required before generating proposals. Open Plan & billing to verify your subscription.", 402);
      }
      const trialStart = sub?.trialStartedAt || (verified.start_date ? new Date(`${verified.start_date}T00:00:00.000Z`) : new Date());
      sub = await prisma.billingSubscription.upsert({
        where: { workspaceId: ctx.workspaceId },
        create: {
          workspaceId: ctx.workspaceId,
          plan: verified.plan as "Freelancer" | "Pro" | "Agency",
          status: "verified_active",
          trialStartedAt: trialStart,
          trialEndsAt: sub?.trialEndsAt || new Date(trialStart.getTime() + 30 * 86_400_000),
          squareSubscriptionId: verified.id,
          verifiedAt: new Date(),
          chargedThroughDate: chargedThroughDateStr ? new Date(chargedThroughDateStr) : null,
          billingAction: "",
        },
        update: {
          plan: verified.plan as "Freelancer" | "Pro" | "Agency",
          status: "verified_active",
          trialStartedAt: trialStart,
          trialEndsAt: sub?.trialEndsAt || new Date(trialStart.getTime() + 30 * 86_400_000),
          squareSubscriptionId: verified.id,
          verifiedAt: new Date(),
          chargedThroughDate: chargedThroughDateStr ? new Date(chargedThroughDateStr) : null,
          billingAction: "",
        },
      });
    }
  } catch {
    return error("Your Square subscription could not be verified. Use Plan & billing to sync it.", 402);
  }

  const cutoff = new Date();
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);
  const used = await prisma.project.count({ where: { workspaceId: ctx.workspaceId, createdAt: { gte: cutoff } } });
  const max = devBypass ? 1_000_000 : PLAN_LIMITS[(sub?.plan as "Freelancer" | "Pro" | "Agency") || "Freelancer"] || 10;
  if (used >= max) return error(`Your ${sub?.plan || "Freelancer"} monthly limit has been reached. Upgrade to continue.`, 402);

  let websiteContext = "";
  if (profile.website && /^https?:\/\//i.test(profile.website)) {
    try {
      const s = await aiScrape({ url: profile.website });
      if (s.status < 400) websiteContext = s.text.slice(0, 7000);
    } catch (e) {
      console.warn("Website context unavailable", e);
    }
  }

  let clientContext = "";
  if (x.clientId) {
    const savedClient = await prisma.client.findFirst({ where: { id: String(x.clientId), workspaceId: ctx.workspaceId } });
    if (savedClient) {
      clientContext = [
        `Contact: ${savedClient.name || ""}`,
        `Company: ${savedClient.company || ""}`,
        `Industry: ${savedClient.industry || ""}`,
        `Relationship status: ${savedClient.lifecycleStatus || ""}`,
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
  let proposalKnowledge: Array<{ id: string; category: string; knowledgeFileId: string | null; content: KnowledgeRecordContent }> = [];
  try {
    const knowledge = await prisma.knowledgeRecord.findMany({ where: { workspaceId: ctx.workspaceId }, take: 200 });
    const activeKnowledge = knowledge
      .filter((v) => v.isActive)
      .map((v) => ({ id: v.id, category: v.category, knowledgeFileId: v.knowledgeFileId, content: v.content as KnowledgeRecordContent }));
    const retrievalQuery = [brief, x.client || "", x.budget || "", x.timeline || "", clientContext].join(" ");
    const selectedKnowledge = rankKnowledge(activeKnowledge, retrievalQuery);
    proposalKnowledge = selectedKnowledge;
    if (selectedKnowledge.length) {
      fileContext = selectedKnowledge.map((v) => `[KNOWLEDGE_ID:${v.id}] [${v.category}] ${v.content.fact} (source: ${v.content.sourceFileName})`).join("\n");
    } else {
      const files = await prisma.knowledgeFile.findMany({ where: { workspaceId: ctx.workspaceId }, take: 12 });
      const ready = files.filter((f) => f.status === "READY" && String(f.extractedText || "").trim()).slice(0, 6);
      const contexts = ready.map((f) => {
        if (f.intelligenceStatus === "ready" && f.intelligence) {
          const k = f.intelligence as {
            documentType: string; summary: string; services: string[]; differentiators: string[]; deliverables: string[];
            pricingEvidence: string[]; timelines: string[]; processes: string[]; constraints: string[]; exclusions: string[];
            proofPoints: string[]; clientFacts: string[];
          };
          return `SOURCE FILE: ${f.fileName}\nDOCUMENT TYPE: ${k.documentType}\nSUMMARY: ${k.summary}\nSERVICES: ${k.services.join(" | ") || "None stated"}\nDIFFERENTIATORS: ${k.differentiators.join(" | ") || "None stated"}\nDELIVERABLES: ${k.deliverables.join(" | ") || "None stated"}\nPRICING EVIDENCE: ${k.pricingEvidence.join(" | ") || "None stated"}\nTIMELINES: ${k.timelines.join(" | ") || "None stated"}\nPROCESSES: ${k.processes.join(" | ") || "None stated"}\nCONSTRAINTS: ${k.constraints.join(" | ") || "None stated"}\nEXCLUSIONS: ${k.exclusions.join(" | ") || "None stated"}\nPROOF POINTS: ${k.proofPoints.join(" | ") || "None stated"}\nCLIENT/PROJECT FACTS: ${k.clientFacts.join(" | ") || "None stated"}`;
        }
        return `${f.fileName}: ${String(f.extractedText || "").slice(0, 5000)}`;
      });
      fileContext = contexts.join("\n\n");
    }
  } catch (e) {
    console.warn("Knowledge context unavailable", e);
  }

  try {
    const r = await aiGenerate({
      system:
        "You are ScopeVanta, an elite B2B sales strategist, scope architect, commercial proposal director and delivery-risk reviewer for service businesses. Your job is to help the seller win the right deal without winning unprofitable work. Diagnose buyer priorities, decision friction, scope ambiguity, delivery dependencies, margin exposure and negotiation leverage before writing. Never fabricate facts, credentials, testimonials, pricing, quantities or guarantees. Separate confirmed facts from assumptions. Unknown requirements must be explicitly marked To be confirmed. Prefer precise commitments, measurable acceptance criteria and buyer-friendly language over generic marketing copy. Every recommendation must improve win probability, commercial clarity or margin protection.",
      prompt: `SELLER: ${profile.businessName}\nEXPERTISE: ${profile.expertise}\nWEBSITE: ${websiteContext || "Not available"}\nKNOWLEDGE FILES: ${fileContext || "No readable text files supplied"}\nCLIENT: ${x.client || "Not provided"}\nSAVED CLIENT CONTEXT: ${clientContext || "No saved client context"}\nBUDGET: ${x.budget || "Not provided"}\nTIMELINE: ${x.timeline || "Not provided"}\nBRIEF: ${brief}\n\nPROPOSAL MODE: ${proposalMode}\nINCLUDE ONLY THESE CLIENT-FACING SECTIONS: ${proposalSections.join(" | ")}\nVISUALS REQUESTED: ${requested.includeVisuals ? "Yes" : "No"}\n\nReturn ONLY JSON: score integer 0-100 where higher means greater scope/commercial risk; summary 2 sentences that state the opportunity and the biggest commercial issue; risks 5-7 specific items prioritized by impact; questions 5-8 high-value clarification questions that materially change scope, price, timeline, acceptance or buying confidence; proposal client-ready plain text containing only the requested sections; grounding array; visuals array. Each grounding item must contain claim, kind, sourceRecordIds, confidence. kind must be seller_fact, client_fact, assumption, or strategy. For seller_fact, cite only KNOWLEDGE_ID values that directly support that exact claim; never cite a merely related fact. client_fact is information supplied in the client brief, client field, budget or timeline and uses no knowledge IDs. assumption is an explicit proposal assumption or To be confirmed item and uses no knowledge IDs. strategy is ScopeVanta advice/recommended framing rather than a factual claim and uses no knowledge IDs. confidence must respectively be grounded, client_supplied, assumption, or recommendation. Include the material factual/assumption/strategy claims used in the proposal, capped at 30 grounding items. Each visual object must contain type, title, labels string array and values number array. If visuals were not requested, return an empty visuals array. If visuals are requested, create at most 3 useful charts only from numeric facts actually supplied in the brief, budget or timeline; never invent chart data. If there is insufficient numeric data, return an empty visuals array. Before drafting, internally distinguish confirmed scope, assumptions, dependencies, exclusions, acceptance criteria, buyer outcomes and unresolved decisions. Do not expose chain-of-thought. Honor the requested section list exactly: omit unselected client-facing sections rather than silently adding them. In Concise mode keep selected sections tight and decision-oriented; Detailed mode should be operationally specific; Premium mode should be polished and executive-ready while remaining factual. Make the opening buyer-focused and specific to the stated problem. Translate deliverables into buyer outcomes without inventing ROI. Scope deliverables with enough specificity that a delivery team could understand what is included. Where quantities, platforms, revision counts, integrations, content responsibilities or approval timing are unknown, write To be confirmed instead of guessing. Investment must use the supplied budget only when it is clearly a confirmed project price; otherwise label pricing To be confirmed and explain the pricing basis needed. Timeline must distinguish target dates from dependencies. Acceptance criteria must be observable. Assumptions and exclusions must actively prevent scope creep. Change control must define how out-of-scope requests are identified, estimated and approved before work begins. WHY section may use only seller facts supplied in profile, website or knowledge context. Finish with a concrete, low-friction next step and acceptance path. Avoid filler, hype, repeated ideas and generic AI-sounding language.`,
      maxTokens: 7600,
      temperature: 0.2,
    });
    const out = JSON.parse(stripJsonFence(r.text)) as {
      score: number; summary: string; risks: string[]; questions: string[]; proposal: string;
      grounding?: Array<{ claim: string; kind: string; sourceRecordIds?: string[]; confidence?: string }>;
      visuals?: Array<{ type: string; title: string; labels: string[]; values: number[] }>;
    };
    if (typeof out.score !== "number" || !out.summary || !Array.isArray(out.risks) || !Array.isArray(out.questions) || !out.proposal) {
      return error("Incomplete analysis. Please retry.", 502);
    }

    const knowledgeById = new Map(proposalKnowledge.map((v) => [v.id, v]));
    const grounding = (Array.isArray(out.grounding) ? out.grounding : [])
      .slice(0, 30)
      .map((item) => {
        const kind = ["seller_fact", "client_fact", "assumption", "strategy"].includes(String(item.kind)) ? String(item.kind) : "strategy";
        const ids = kind === "seller_fact" ? (item.sourceRecordIds || []).map(String).filter((id) => knowledgeById.has(id)).slice(0, 8) : [];
        const files = Array.from(new Set(ids.map((id) => knowledgeById.get(id)?.content.sourceFileName || "").filter(Boolean)));
        const confidence = kind === "seller_fact" ? "grounded" : kind === "client_fact" ? "client_supplied" : kind === "assumption" ? "assumption" : "recommendation";
        return { claim: String(item.claim || "").trim().slice(0, 2000), kind, sourceRecordIds: ids, sourceFiles: files, confidence };
      })
      .filter((item) => item.claim && (item.kind !== "seller_fact" || item.sourceRecordIds.length > 0));

    const groundingSummary = {
      grounded: grounding.filter((v) => v.kind === "seller_fact").length,
      clientSupplied: grounding.filter((v) => v.kind === "client_fact").length,
      assumptions: grounding.filter((v) => v.kind === "assumption").length,
      recommendations: grounding.filter((v) => v.kind === "strategy").length,
    };

    const project = await prisma.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdByUserId: ctx.userId,
        clientId: x.clientId ? String(x.clientId) : null,
        name: String(x.client || "Untitled opportunity").slice(0, 200),
        clientLabel: String(x.client || "Untitled opportunity").slice(0, 200),
        brief,
        riskScore: Math.max(0, Math.min(100, Math.round(out.score))),
        summary: out.summary,
        risks: out.risks.slice(0, 7),
        clarificationQuestions: out.questions.slice(0, 8),
        proposal: out.proposal,
        evidence: grounding,
        groundingSummary,
        visuals: Array.isArray(out.visuals) ? out.visuals.slice(0, 3) : [],
        proposalOptions: { mode: proposalMode, sections: proposalSections, includeSellerLogo: Boolean(requested.includeSellerLogo), includeClientLogo: Boolean(requested.includeClientLogo), includeVisuals: Boolean(requested.includeVisuals) },
        budget: x.budget || "",
        timeline: x.timeline || "",
        status: "Draft",
        currentVersion: 1,
      },
    });

    return json({ ...project, projectId: project.id, usage: { used: used + 1, limit: max } });
  } catch (e: any) {
    console.error("ScopeVanta analysis failed", e);
    const detail = e?.message || e?.error?.message || String(e);
    return error(`Analysis service temporarily unavailable: ${detail}`, 502);
  }
});
