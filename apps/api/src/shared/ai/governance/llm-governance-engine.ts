import type {
  GovernanceConfig,
  GovernanceDecision,
  LLMUsageLog,
  TokenUsage,
  CostEstimate,
} from './governance.types.js';
import { QuotaService } from './quota-service.js';
import { LLMRateLimiter } from './llm-rate-limiter.js';
import { PromptValidator } from './prompt-validator.js';
import { BudgetGuard } from './budget-guard.js';
import { estimateTokenUsage, estimateCost } from './token-tracker.js';
import { createLogger } from '@/shared/logger/index.js';

const logger = createLogger(undefined, { name: 'llm-governance', level: 'info' });

/**
 * LLM Governance Engine.
 *
 * Centralized gatekeeper that enforces all cost-protection policies
 * before any LLM call is made.
 *
 * Checks performed (in order):
 * 1. Prompt validation (length, injection detection, sanitization)
 * 2. User quota (per-user LLM interaction limit)
 * 3. Rate limiting (per-user requests per time window)
 * 4. Budget guard (global daily spending limit)
 *
 * If any check fails, the request is rejected with a specific reason.
 */
export class LLMGovernanceEngine {
  private quotaService: QuotaService;
  private rateLimiter: LLMRateLimiter;
  private promptValidator: PromptValidator;
  private budgetGuard: BudgetGuard;
  private usageLogs: LLMUsageLog[] = [];
  private readonly maxLogSize = 1000; // Keep last 1000 entries in memory
  private readonly pricing: GovernanceConfig['pricing'];

  constructor(config: GovernanceConfig) {
    this.quotaService = new QuotaService(config.defaultUserQuota);
    this.rateLimiter = new LLMRateLimiter(config.maxRequestsPerUserPerHour);
    this.promptValidator = new PromptValidator(config.maxPromptLength, config.maxUserInputLength);
    this.budgetGuard = new BudgetGuard(config.dailyBudgetUsd);
    this.pricing = config.pricing;
  }

  /**
   * Run all governance checks before making an LLM call.
   *
   * @param userId - User making the request (null for system calls)
   * @param prompt - The prompt to validate
   * @param userInput - The raw user input (for injection detection)
   */
  async preCallCheck(
    userId: string | null,
    prompt: string,
    userInput?: string,
  ): Promise<GovernanceDecision> {
    // 1. Prompt validation
    const promptValidation = this.promptValidator.validatePrompt(prompt);
    if (!promptValidation.valid) {
      logger.warn(
        { userId, reason: promptValidation.reason, promptLength: promptValidation.originalLength },
        'LLM governance: prompt validation failed',
      );
    }

    // 2. User input validation (if provided)
    if (userInput) {
      const inputValidation = this.promptValidator.validateUserInput(userInput);
      if (!inputValidation.valid) {
        logger.warn(
          { userId, reason: inputValidation.reason, inputLength: inputValidation.originalLength },
          'LLM governance: user input validation failed',
        );
        return {
          allowed: false,
          checks: {
            quota: { allowed: true, remaining: 0 },
            rateLimit: { allowed: true },
            budget: { allowed: true, currentSpendUsd: 0, budgetUsd: 0 },
            promptValidation: inputValidation,
          },
          rejectionReason: `User input rejected: ${inputValidation.reason}`,
        };
      }
    }

    // 3. Quota check (skip for system calls)
    const quota = userId ? this.quotaService.checkQuota(userId) : { allowed: true, remaining: -1 };

    // 4. Rate limit check (skip for system calls)
    const rateLimit = userId ? this.rateLimiter.check(userId) : { allowed: true };

    // 5. Budget check
    const budget = this.budgetGuard.checkBudget();

    const allowed = promptValidation.valid && quota.allowed && rateLimit.allowed && budget.allowed;
    let rejectionReason: string | undefined;

    if (!allowed) {
      if (!promptValidation.valid) {
        rejectionReason = `Prompt validation failed: ${promptValidation.reason}`;
      } else if (!quota.allowed) {
        rejectionReason = `Quota exhausted: ${quota.reason}`;
      } else if (!rateLimit.allowed) {
        rejectionReason = `Rate limit exceeded. Retry after ${rateLimit.retryAfterMs}ms`;
      } else if (!budget.allowed) {
        rejectionReason = `Daily budget exceeded: ${budget.reason}`;
      }

      logger.warn({ userId, rejectionReason }, 'LLM governance: request rejected');
    }

    return {
      allowed,
      checks: {
        promptValidation,
        quota,
        rateLimit,
        budget,
      },
      rejectionReason,
    };
  }

  /**
   * Record a successful LLM call (consumes quota, rate limit, budget).
   */
  postCallRecord(
    userId: string | null,
    provider: string,
    model: string,
    operation: string,
    prompt: string,
    response: string,
    success: boolean,
    error?: string,
  ): { tokenUsage: TokenUsage; costEstimate: CostEstimate | null } {
    const tokenUsage = estimateTokenUsage(prompt, response);
    const pricing = this.getPricing(provider);
    const costEstimate = pricing ? estimateCost(tokenUsage, pricing) : null;

    // Consume quota for successful user calls
    if (userId && success) {
      const remaining = this.quotaService.consumeQuota(userId);
      this.rateLimiter.recordRequest(userId);

      if (remaining <= 5) {
        logger.warn({ userId, remaining }, 'LLM governance: user quota running low');
      }
    }

    // Record cost against budget
    if (costEstimate && costEstimate.costUsd > 0) {
      this.budgetGuard.recordCost(costEstimate.costUsd);
    }

    // Log usage
    this.logUsage({
      userId,
      provider,
      model,
      operation,
      promptLength: prompt.length,
      responseLength: response.length,
      tokenUsage,
      costEstimate,
      success,
      error,
      timestamp: new Date(),
    });

    return { tokenUsage, costEstimate };
  }

  // ==================== Quota Management ====================

  /**
   * Set a user's quota explicitly.
   */
  setUserQuota(userId: string, quota: number): void {
    this.quotaService.setQuota(userId, quota);
  }

  /**
   * Get a user's remaining quota.
   */
  getUserQuota(userId: string): number {
    return this.quotaService.getRemaining(userId);
  }

  /**
   * Reset a user's quota.
   */
  resetUserQuota(userId: string): void {
    this.quotaService.resetQuota(userId);
  }

  // ==================== Metrics ====================

  /**
   * Get comprehensive governance metrics.
   */
  getMetrics() {
    return {
      quota: this.quotaService.getMetrics(),
      rateLimit: this.rateLimiter.getMetrics(),
      budget: this.budgetGuard.getMetrics(),
      recentLogs: this.usageLogs.slice(-10),
    };
  }

  /**
   * Get recent usage logs.
   */
  getUsageLogs(limit = 50): LLMUsageLog[] {
    return this.usageLogs.slice(-limit);
  }

  // ==================== Internal ====================

  private logUsage(log: LLMUsageLog): void {
    this.usageLogs.push(log);
    if (this.usageLogs.length > this.maxLogSize) {
      this.usageLogs = this.usageLogs.slice(-this.maxLogSize);
    }

    // Log at debug level for monitoring
    if (!log.success) {
      logger.warn(
        {
          userId: log.userId,
          provider: log.provider,
          operation: log.operation,
          error: log.error,
          costUsd: log.costEstimate?.costUsd,
        },
        'LLM call failed',
      );
    }
  }

  private getPricing(provider: string) {
    return this.pricing[provider] ?? null;
  }
}
