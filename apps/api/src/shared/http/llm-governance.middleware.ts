import type { Request, Response, NextFunction } from 'express';
import { getAIServices, isAIServicesInitialized } from '@/shared/ai/ai-service.provider.js';
import { GovernanceError } from '@/shared/ai/governance/governance-ai-adapter.js';

/** Structural request type: accepts any request carrying (at most) these fields,
 * so both the shared AppRequest and feature-local request types are compatible. */
type GovernanceRequest = Request & {
  user?: { id?: string; role?: string };
  llmGovernance?: {
    userId: string | null;
    startTime: number;
    provider: string;
    postCallRecord: (
      userId: string | null,
      provider: string,
      model: string,
      path: string,
      prompt: string,
      response: string,
      success: boolean,
      error?: string,
    ) => unknown;
  };
};

/**
 * Navigation inputs that bypass LLM governance (fast path).
 * These are processed by the navigation fast path in the use case,
 * so they don't actually call the LLM and shouldn't count against rate limits.
 */
const NAVIGATION_INPUTS = [
  '__auto__', // Auto-advance trigger
  'listo', // Start lesson trigger
  'continuar',
  'siguiente',
  'next',
  'ok',
  'dale',
  'vamos',
  'adelante',
  'seguir',
  'avanzar',
  'proseguir',
  'forward',
  'sí',
  'si',
  'comenzar',
  'empezar',
  'start',
];

/**
 * Check if input is a navigation input (bypasses LLM).
 */
function isNavigationInput(input: string): boolean {
  const lower = input.toLowerCase().trim();
  return NAVIGATION_INPUTS.some((nav) => lower === nav || lower.includes(nav));
}

/**
 * Express middleware that enforces LLM governance checks on requests
 * that will trigger LLM calls.
 *
 * Must be placed BEFORE the route handler.
 * Uses the request's userId (from auth middleware) to check quota and rate limits.
 */
export function llmGovernanceMiddleware() {
  return async (req: GovernanceRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!isAIServicesInitialized()) {
      next();
      return;
    }

    // Skip governance for navigation inputs - these use the fast path and don't call LLM
    const studentInput = req.body?.studentInput;
    if (typeof studentInput === 'string' && isNavigationInput(studentInput)) {
      next();
      return;
    }

    const userId = req.user?.id ?? null;
    const governance = getAIServices().governance;

    // Pre-call check: validate prompt length, injection, quota, rate limit, budget
    const decision = await governance.preCallCheck(
      userId,
      `route:${req.path}`,
      typeof studentInput === 'string' ? studentInput : undefined,
    );

    if (!decision.allowed) {
      // GovernanceError already carries httpStatus=429 / code for the error handler
      next(new GovernanceError(decision.rejectionReason ?? 'LLM request rejected by governance'));
      return;
    }

    // Attach governance reference to request for post-call recording
    req.llmGovernance = {
      userId,
      startTime: Date.now(),
      provider: getAIServices().health().primaryProvider,
      postCallRecord: (...args: Parameters<typeof governance.postCallRecord>) =>
        governance.postCallRecord(...args),
    };

    next();
  };
}

/**
 * Helper to record LLM usage after a successful response.
 * Call this in route handlers after the LLM call completes.
 */
export function recordLLMUsage(
  req: GovernanceRequest,
  prompt: string,
  response: string,
  success: boolean,
  error?: string,
): void {
  const govData = req.llmGovernance;
  if (!govData) return;

  govData.postCallRecord(
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
