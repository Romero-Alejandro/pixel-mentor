// ==================== LLM Governance Types ====================

/**
 * Token usage information returned by an LLM call.
 */
export interface TokenUsage {
  /** Estimated input tokens */
  inputTokens: number;
  /** Estimated output tokens */
  outputTokens: number;
  /** Total tokens consumed */
  totalTokens: number;
}

/**
 * Cost estimation for an LLM call.
 */
export interface CostEstimate {
  /** Cost in USD */
  costUsd: number;
  /** Input cost per 1M tokens */
  inputCostPerMillion: number;
  /** Output cost per 1M tokens */
  outputCostPerMillion: number;
}

/**
 * LLM usage log entry.
 */
export interface LLMUsageLog {
  userId: string | null;
  provider: string;
  model: string;
  operation: string;
  promptLength: number;
  responseLength: number;
  tokenUsage: TokenUsage | null;
  costEstimate: CostEstimate | null;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Quota check result.
 */
export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

/**
 * Rate limit check result.
 */
export interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs?: number;
  remaining?: number;
}

/**
 * Budget check result.
 */
export interface BudgetCheck {
  allowed: boolean;
  currentSpendUsd: number;
  budgetUsd: number;
  reason?: string;
}

/**
 * Governance decision after all checks.
 */
export interface GovernanceDecision {
  allowed: boolean;
  checks: {
    quota: QuotaCheck;
    rateLimit: RateLimitCheck;
    budget: BudgetCheck;
    promptValidation: PromptValidationResult;
  };
  rejectionReason?: string;
}

/**
 * Result of prompt validation.
 */
export interface PromptValidationResult {
  valid: boolean;
  sanitizedInput: string;
  reason?: string;
  originalLength: number;
  sanitizedLength: number;
}

/**
 * Provider pricing configuration (per 1M tokens, USD).
 */
export interface ProviderPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/**
 * Governance configuration.
 */
export interface GovernanceConfig {
  /** Maximum prompt length in characters */
  maxPromptLength: number;
  /** Maximum user input length in characters (student input) */
  maxUserInputLength: number;
  /** Default quota for new users (number of LLM interactions) */
  defaultUserQuota: number;
  /** Global daily budget in USD */
  dailyBudgetUsd: number;
  /** Maximum LLM requests per user per hour */
  maxRequestsPerUserPerHour: number;
  /** Provider pricing for cost estimation */
  pricing: Record<string, ProviderPricing>;
}

/**
 * Default governance configuration.
 * Values are conservative for a public-facing application.
 */
export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  maxPromptLength: 16000,
  maxUserInputLength: 2000,
  defaultUserQuota: 100,
  dailyBudgetUsd: 10,
  maxRequestsPerUserPerHour: 60,
  pricing: {
    groq: {
      inputPerMillion: 0.2,
      outputPerMillion: 0.6,
    },
    gemini: {
      inputPerMillion: 0.075,
      outputPerMillion: 0.3,
    },
    openrouter: {
      inputPerMillion: 0,
      outputPerMillion: 0,
    },
  },
};
