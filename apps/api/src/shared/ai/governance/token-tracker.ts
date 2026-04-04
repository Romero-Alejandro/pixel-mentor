import type { TokenUsage, CostEstimate, ProviderPricing } from './governance.types.js';

// ==================== Token Estimation ====================

/**
 * Estimates tokens from text using a character-to-token ratio.
 *
 * This is a heuristic: ~4 characters per token for English, ~3 for Spanish.
 * For production accuracy, use tiktoken or the provider's token counting API.
 */
const CHARS_PER_TOKEN = 3.5; // Conservative average for Spanish

/**
 * Estimates token count from a text string.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimates token usage for an LLM call given prompt and response.
 */
export function estimateTokenUsage(prompt: string, response: string): TokenUsage {
  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(response);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

// ==================== Cost Estimation ====================

/**
 * Estimates cost in USD for a token usage given provider pricing.
 */
export function estimateCost(usage: TokenUsage, pricing: ProviderPricing): CostEstimate {
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return {
    costUsd: inputCost + outputCost,
    inputCostPerMillion: pricing.inputPerMillion,
    outputCostPerMillion: pricing.outputPerMillion,
  };
}

/**
 * Estimates cost directly from text strings.
 */
export function estimateCostFromText(
  prompt: string,
  response: string,
  pricing: ProviderPricing,
): CostEstimate {
  const usage = estimateTokenUsage(prompt, response);
  return estimateCost(usage, pricing);
}
