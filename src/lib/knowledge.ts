import { aiExtract } from "@/lib/ai";

// Translated verbatim from legacy/backend/index.ts (retrievalStopWords,
// retrievalTerms, rankKnowledge, knowledgeCategories, knowledgeSchema,
// structureKnowledge) — only the storage shape changes: legacy kept
// `fact`/`sourceFileName`/`documentType` as top-level KnowledgeRecord
// columns; here they live inside KnowledgeRecord.content (Json) because the
// Prisma model keeps category/isActive/knowledgeFileId as the queryable
// columns and treats the rest as an AI-shaped payload (see schema.prisma).

export type KnowledgeIntelligence = {
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

export type KnowledgeRecordContent = {
  fact: string;
  sourceFileName: string;
  documentType: string;
};

export type RankableRecord = {
  id: string;
  category: string;
  knowledgeFileId: string | null;
  content: KnowledgeRecordContent;
};

const retrievalStopWords = new Set([
  "about", "after", "also", "been", "being", "client", "could", "from",
  "have", "into", "more", "need", "project", "should", "that", "their",
  "there", "these", "they", "this", "with", "would", "your",
]);

export function retrievalTerms(value: string): string[] {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || []))
    .filter((v) => !retrievalStopWords.has(v))
    .slice(0, 80);
}

export function rankKnowledge(records: RankableRecord[], query: string): RankableRecord[] {
  const terms = retrievalTerms(query);
  const priority = new Set(["Pricing", "Constraint", "Exclusion", "Deliverable", "Timeline", "Proof point"]);
  const ranked = records
    .map((record, index) => {
      const haystack =
        `${record.category} ${record.content.fact} ${record.content.documentType} ${record.content.sourceFileName}`.toLowerCase();
      const overlap = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { record, score: overlap * 4 + (priority.has(record.category) ? 1 : 0), index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: RankableRecord[] = [];
  const perSource = new Map<string, number>();
  for (const item of ranked) {
    const source = item.record.knowledgeFileId || item.record.content.sourceFileName;
    const count = perSource.get(source) || 0;
    if (count >= 18) continue;
    selected.push(item.record);
    perSource.set(source, count + 1);
    if (selected.length >= 60) break;
  }
  return selected;
}

export const knowledgeCategories: [keyof KnowledgeIntelligence, string][] = [
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
    "documentType", "summary", "services", "differentiators", "deliverables",
    "pricingEvidence", "timelines", "processes", "constraints", "exclusions",
    "proofPoints", "clientFacts",
  ],
};

export async function structureKnowledge(text: string, name: string): Promise<KnowledgeIntelligence> {
  const r = await aiExtract<KnowledgeIntelligence>({
    system:
      "Extract only explicit facts from the supplied business document. Never infer missing capabilities, prices, credentials, outcomes, clients, quantities, dates or guarantees. Keep uncertain or absent categories empty. Preserve important numbers and qualifiers in the fact strings.",
    prompt: `Organize the factual business knowledge from ${name}. Summary must be factual and concise. documentType should describe the document based only on its contents. pricingEvidence includes only explicit prices, budgets, rates, fees or commercial terms. proofPoints includes only explicit credentials, case-study facts, measured results or named evidence. clientFacts includes only facts clearly about a client, prospect or project rather than the seller.`,
    content: text.slice(0, 30000),
    schema: knowledgeSchema,
    maxRetries: 2,
    maxTokens: 4200,
    temperature: 0,
  });
  return r.data;
}
