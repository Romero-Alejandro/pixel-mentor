import type pino from 'pino';
import type { z } from 'zod';

import type { PedagogicalState } from '@/domain/entities/pedagogical-state.js';
import type { PromptRepository, PromptParams } from '@/domain/ports/prompt-repository.js';
import type { GenerateResponseParams as DomainGenerateResponseParams } from '@/domain/ports/ai-service.js';
import { cleanJsonResponse } from '@/utils/ai-utils';

// Re-export the domain type for adapters
export type GenerateResponseParams = DomainGenerateResponseParams;

export abstract class BaseLLMAdapter {
  protected logger?: pino.Logger;
  protected readonly maxPromptLogLength: number;

  constructor(logger?: pino.Logger, maxPromptLogLength = 500) {
    this.logger = logger;
    this.maxPromptLogLength = maxPromptLogLength;
  }

  setLogger(logger: pino.Logger): void {
    this.logger = logger;
  }

  protected logPromptDebug(state: string, prompt: string): void {
    this.logger?.debug({
      msg: 'LLM prompt',
      state,
      promptLength: prompt.length,
      promptPreview:
        prompt.length > this.maxPromptLogLength
          ? prompt.substring(0, this.maxPromptLogLength) + '...'
          : prompt,
    });
  }

  protected handleError<T>(state: string, error: unknown, fallback: T): T {
    this.logger?.error({
      msg: 'LLM error',
      state,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

export abstract class BaseGenerativeAdapter extends BaseLLMAdapter {
  protected readonly promptRepo: PromptRepository;

  constructor(promptRepo: PromptRepository, logger?: pino.Logger, maxPromptLogLength = 500) {
    super(logger, maxPromptLogLength);
    this.promptRepo = promptRepo;
  }

  protected buildPrompt(state: PedagogicalState, params: Record<string, unknown>): string {
    const promptParams: PromptParams = {
      lesson: (params as DomainGenerateResponseParams).recipe,
      currentState: state,
      conversationHistory: params.conversationHistory as PromptParams['conversationHistory'],
      currentQuestion: params.currentQuestion as PromptParams['currentQuestion'],
      ragContext: params.ragContext,
      currentSegment: params.currentSegment as PromptParams['currentSegment'],
      totalSegments: params.totalSegments as number | undefined,
      persona: params.persona as string | undefined,
      historySummary: params.historySummary as string | undefined,
    };
    const basePrompt = this.promptRepo.getPrompt(state, promptParams);
    const hidden = this.getHiddenInstructions(
      state,
      params.nextState as PedagogicalState | undefined,
    );
    return `${basePrompt}\n\n${hidden}`;
  }

  private getHiddenInstructions(
    currentState: PedagogicalState,
    nextState?: PedagogicalState,
  ): string {
    const lines: string[] = ['[HIDDEN INSTRUCTIONS]', `Current state: ${currentState}`];

    if (nextState) {
      lines.push(`After this response, next state will be: ${nextState}`);
    }

    lines.push('If user asks a question with high confidence, suggest pausing.', '[/HIDDEN]');

    if (currentState === 'RESOLVING_DOUBT' && nextState === 'ACTIVE_CLASS') {
      lines.push('[HIDDEN] Return to ACTIVE_CLASS after answering. [/HIDDEN]');
    }

    return lines.join('\n');
  }

  protected parseAndValidateResponse<T>(
    rawText: string,
    schema: z.ZodType<T>,
    state: string,
  ): T | null {
    const cleanedText = cleanJsonResponse(rawText);
    try {
      const parsed = JSON.parse(cleanedText);
      const validation = schema.safeParse(parsed);
      if (!validation.success) {
        this.logger?.error({ msg: 'Validation error', state, errors: validation.error.issues });
        return null;
      }
      return validation.data;
    } catch (error: unknown) {
      this.logger?.error({
        msg: 'Parse error',
        state,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
