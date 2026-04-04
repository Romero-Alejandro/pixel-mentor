import type { Response, NextFunction } from 'express';
import type { AppRequest } from '@/features/recipe/infrastructure/http/recipe.routes.js';
import { getAIServices, isAIServicesInitialized } from '@/shared/ai/ai-service.provider.js';
import { GovernanceError } from '@/shared/ai/governance/governance-ai-adapter.js';

/**
 * Express middleware that enforces LLM governance checks on requests
 * that will trigger LLM calls.
 *
 * Must be placed BEFORE the route handler.
 * Uses the request's userId (from auth middleware) to check quota and rate limits.
 */
export function llmGovernanceMiddleware() {
  return async (req: AppRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!isAIServicesInitialized()) {
      next();
      return;
    }

    const userId = req.user?.id ?? null;
    const governance = getAIServices().governance;

    // Pre-call check: validate prompt length, injection, quota, rate limit, budget
    const decision = await governance.preCallCheck(
      userId,
      `route:${req.path}`,
      typeof req.body?.studentInput === 'string' ? req.body.studentInput : undefined,
    );

    if (!decision.allowed) {
      const error = new GovernanceError(
        decision.rejectionReason ?? 'LLM request rejected by governance',
      );
      // Attach error for Express error handler
      (error as any).httpStatus = 429;
      (error as any).code = 'GOVERNANCE_REJECTED';
      next(error);
      return;
    }

    // Attach governance reference to request for post-call recording
    (req as any).__llmGovernance = {
      governance,
      userId,
      startTime: Date.now(),
      provider: getAIServices().health().primaryProvider,
    };

    next();
  };
}

/**
 * Helper to record LLM usage after a successful response.
 * Call this in route handlers after the LLM call completes.
 */
export function recordLLMUsage(
  req: AppRequest,
  prompt: string,
  response: string,
  success: boolean,
  error?: string,
): void {
  const govData = (req as any).__llmGovernance;
  if (!govData) return;

  govData.governance.postCallRecord(
    govData.userId,
    govData.provider,
    'unknown',
    req.path,
    prompt,
    response,
    success,
    error,
  );
}
