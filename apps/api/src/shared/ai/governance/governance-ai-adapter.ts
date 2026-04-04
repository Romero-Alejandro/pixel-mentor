import type { AIService, AIResponse } from '@/features/recipe/domain/ports/ai-service.port.js';
import type { GenerateResponseParams } from '@/shared/ai/base-llm-adapter.js';
import type { LLMGovernanceEngine } from '@/shared/ai/governance/llm-governance-engine.js';

/**
 * AI Service wrapper that enforces governance checks on every call.
 *
 * Wraps any AIService implementation and automatically:
 * 1. Runs preCallCheck() before each LLM call
 * 2. Rejects with GovernanceError if checks fail
 * 3. Runs postCallRecord() after each call to consume quota and track costs
 *
 * This eliminates the need to modify individual use cases — governance
 * is enforced at the adapter level.
 */
export class GovernanceAIAdapter implements AIService {
  constructor(
    private readonly wrapped: AIService,
    private readonly governance: LLMGovernanceEngine,
    private readonly userId: string | null,
    private readonly provider: string = 'unknown',
    private readonly model: string = 'unknown',
  ) {}

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    // Pre-call governance check
    const userInput = typeof params.studentInput === 'string' ? params.studentInput : undefined;
    const promptPreview = `[${params.recipe?.title ?? 'unknown'}] ${params.currentState ?? 'unknown'}`;

    const decision = await this.governance.preCallCheck(this.userId, promptPreview, userInput);

    if (!decision.allowed) {
      throw new GovernanceError(decision.rejectionReason ?? 'LLM request rejected by governance');
    }

    // Execute the actual LLM call
    try {
      const response = await this.wrapped.generateResponse(params);

      // Post-call recording
      this.governance.postCallRecord(
        this.userId,
        this.provider,
        this.model,
        'generateResponse',
        promptPreview,
        response.explanation ?? '',
        true,
      );

      return response;
    } catch (error) {
      // Post-call recording for failures too
      this.governance.postCallRecord(
        this.userId,
        this.provider,
        this.model,
        'generateResponse',
        promptPreview,
        '',
        false,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async *generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string> {
    // Pre-call governance check
    const userInput = typeof params.studentInput === 'string' ? params.studentInput : undefined;
    const promptPreview = `[${params.recipe?.title ?? 'unknown'}] ${params.currentState ?? 'unknown'}`;

    const decision = await this.governance.preCallCheck(this.userId, promptPreview, userInput);

    if (!decision.allowed) {
      throw new GovernanceError(decision.rejectionReason ?? 'LLM request rejected by governance');
    }

    // Execute the actual LLM stream
    let fullResponse = '';
    try {
      for await (const chunk of this.wrapped.generateResponseStream(params)) {
        fullResponse += chunk;
        yield chunk;
      }

      // Post-call recording
      this.governance.postCallRecord(
        this.userId,
        this.provider,
        this.model,
        'generateResponseStream',
        promptPreview,
        fullResponse,
        true,
      );
    } catch (error) {
      this.governance.postCallRecord(
        this.userId,
        this.provider,
        this.model,
        'generateResponseStream',
        promptPreview,
        fullResponse,
        false,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async generateExplanation(params: any): Promise<{ voiceText: string }> {
    return this.wrapped.generateExplanation(params);
  }

  async evaluateResponse(
    params: any,
  ): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    return this.wrapped.evaluateResponse(params);
  }

  async generateAnswer(params: any): Promise<{ answer: string }> {
    return this.wrapped.generateAnswer(params);
  }
}

/**
 * Error thrown when governance checks reject an LLM request.
 * Returns 429 Too Many Requests to the client.
 */
export class GovernanceError extends Error {
  public readonly httpStatus = 429;
  public readonly code = 'GOVERNANCE_REJECTED';

  constructor(message: string) {
    super(message);
    this.name = 'GovernanceError';
  }
}
