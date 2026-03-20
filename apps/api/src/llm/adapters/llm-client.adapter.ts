/**
 * LLM Client Adapter
 *
 * Bridges the existing AIService infrastructure with the ILLMClient interface
 * required by LessonEvaluatorUseCase.
 *
 * This allows the LessonEvaluatorUseCase to use the same resilient AI providers
 * (Gemini, Groq, OpenRouter) that are already configured in the application.
 */

import type { AIService } from '@/domain/ports/ai-service.js';
import type { ILLMClient, LLMExecutionOptions } from '@/llm/client.interface.js';
import { LLMError } from '@/llm/client.interface.js';

/**
 * Adapter that wraps an AIService to implement ILLMClient.
 *
 * Note: This is a simplified implementation that uses the AIService.generateResponse
 * method. For production, you may want to use a dedicated LLM client directly.
 */
export class LLMClientAdapter implements ILLMClient {
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly aiService: AIService,
    options?: { maxAttempts?: number; timeoutMs?: number },
  ) {
    this.maxAttempts = options?.maxAttempts ?? 3;
    this.timeoutMs = options?.timeoutMs ?? 30000;
  }

  async executePrompt(prompt: string, options?: LLMExecutionOptions): Promise<string> {
    const maxRetries = options?.maxAttempts ?? this.maxAttempts;
    const timeout = options?.timeoutMs ?? this.timeoutMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(prompt, timeout);
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable (rate limit, timeout)
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const backoffMs = this.calculateBackoff(attempt, options?.backoffFactor ?? 2);
          await this.sleep(backoffMs);
          continue;
        }

        // Non-retryable error or max retries reached
        throw this.createError(error, attempt);
      }
    }

    throw this.createError(lastError, maxRetries);
  }

  private async executeWithTimeout(prompt: string, timeoutMs: number): Promise<string> {
    // Build a minimal recipe context for evaluation
    const mockRecipe = {
      id: 'eval',
      title: 'Lesson Evaluation',
      description: 'Context for answer evaluation',
      canonicalId: 'eval',
      version: '1.0',
      published: true,
      steps: [] as any[],
      concepts: [] as any[],
      tags: [] as any[],
      progressEntries: [] as any[],
      attachments: [] as any[],
      sessions: [] as any[],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return Promise.race([
      this.aiService.generateResponse({
        recipe: mockRecipe as any,
        currentState: 'EXPLANATION',
        conversationHistory: [],
        ragContext: undefined,
        currentSegment: { chunkText: prompt, order: 0 },
        totalSegments: 1,
        historySummary: undefined,
      }),
      this.timeoutPromise(timeoutMs),
    ]).then((result) => {
      if (result instanceof Error) throw result;
      return result.explanation;
    });
  }

  private timeoutPromise(ms: number): Promise<Error> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number, factor: number): number {
    return Math.min(1000 * Math.pow(factor, attempt - 1), 10000);
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Check for common retryable error patterns
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('timeout') ||
        message.includes('temporarily unavailable') ||
        message.includes('503')
      );
    }
    return false;
  }

  private createError(error: unknown, attempts: number): LLMError {
    const message = error instanceof Error ? error.message : 'Unknown error during LLM execution';
    return new LLMError({
      message,
      code: 'API_ERROR',
      originalError: error,
      attemptsMade: attempts,
    });
  }
}

/**
 * Creates a configured LLMClientAdapter for use with LessonEvaluatorUseCase.
 */
export function createLLMClientAdapter(aiService: AIService): ILLMClient {
  return new LLMClientAdapter(aiService);
}
