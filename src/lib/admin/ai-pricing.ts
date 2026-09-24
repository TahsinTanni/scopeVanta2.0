// USD per million tokens, Anthropic first-party API rates. Cache writes use
// the 5-minute TTL multiplier (1.25x input) and cache reads 0.1x input, which
// is what lib/ai.ts's `cache_control: ephemeral` system prompts incur.
// Update this table if ANTHROPIC_MODEL changes to a model not listed here.
const PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

export type TokenCounts = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

/** Estimated USD cost of the given token counts, or null for an unpriced model. */
export function estimateCostUsd(model: string, t: TokenCounts): number | null {
  const p = PRICES_PER_MTOK[model];
  if (!p) return null;
  return (
    (t.inputTokens * p.input + t.cacheWriteTokens * p.input * 1.25 + t.cacheReadTokens * p.input * 0.1 + t.outputTokens * p.output) /
    1_000_000
  );
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return n < 1 && n > 0 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}
