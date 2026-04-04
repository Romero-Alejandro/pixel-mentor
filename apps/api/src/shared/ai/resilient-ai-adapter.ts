import { createLogger } from '@/shared/logger/index.js';
import { config } from '@/shared/config/index.js';
import type { GenerateResponseParams } from './base-llm-adapter.js';

import type { AIService, AIResponse } from '@/features/recipe/domain/ports/ai-service.port.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/features/recipe/domain/ports/question-classifier.port.js';
import type { QuestionClassification } from '@/features/activity/domain/entities/question-classification.entity.js';
import type { RAGService } from '@/features/recipe/domain/ports/rag-service.port.js';
import type { KnowledgeChunk } from '@/features/knowledge/domain/entities/knowledge-chunk.entity.js';
import {
  getCircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitBreaker,
} from '@/shared/resilience/index.js';

// ==================== Logging ====================

const logger = createLogger();

interface OperationMetrics {
  operation: string;
  provider: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

function logMetrics(metrics: OperationMetrics): void {
  if (config.NODE_ENV === 'development') {
    logger.info(
      `[AI Metrics] ${metrics.operation} - ${metrics.provider}: ${metrics.latencyMs}ms - ${metrics.success ? 'OK' : 'FAIL'}`,
    );
  }
}

function logError(operation: string, provider: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`[AI Error] ${operation} - ${provider}: ${errorMessage}`);
}

// ==================== Generic Fallback Engine ====================

/**
 * Executes an operation across multiple provider instances with circuit breaker
 * protection and automatic fallback.
 *
 * Strategy:
 * 1. Try each instance in order
 * 2. If circuit breaker is open OR any error occurs → try next instance
 * 3. Log metrics for every attempt
 * 4. If all instances fail, throw the last error
 *
 * This ensures that transient errors (timeout, rate limit, auth) also trigger
 * fallback to the next provider, not just circuit breaker trips.
 */
async function executeWithFallback<T>(
  instances: { instance: T; breaker: CircuitBreaker; name: string }[],
  operation: string,
  fn: (instance: T) => Promise<unknown>,
): Promise<unknown> {
  let lastError: unknown;

  for (const { instance, breaker, name } of instances) {
    try {
      const startTime = Date.now();
      const result = await breaker.execute(() => fn(instance));
      logMetrics({
        operation,
        provider: name,
        latencyMs: Date.now() - startTime,
        success: true,
      });
      return result;
    } catch (error) {
      lastError = error;

      // Always try next provider on any error
      // CircuitBreakerOpenError means the provider is known-failing
      // Other errors (timeout, rate limit, auth) should also trigger fallback
      if (error instanceof CircuitBreakerOpenError) {
        logError(operation, name, error);
      } else {
        logMetrics({
          operation,
          provider: name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  throw lastError;
}

/**
 * Extracts a readable provider name from an instance's constructor.
 */
function getProviderName(instance: unknown): string {
  const name = (instance as object).constructor.name;
  // Strip common suffixes to get the provider name
  // e.g. "GroqAdapter" -> "Groq", "GeminiAIModelAdapter" -> "Gemini"
  return name.replace(/(AI)?(Model)?(Adapter|Service)$/, '');
}

/**
 * Creates a breaker wrapper for an instance with a unique name.
 */
function wrapWithBreaker<T>(
  instance: T,
  prefix: string,
  index: number,
  options?: { failureThreshold?: number; resetTimeout?: number },
): { instance: T; breaker: CircuitBreaker; name: string } {
  const providerName = getProviderName(instance);
  const name = `${prefix}-${providerName}-${index}`;
  return {
    instance,
    breaker: getCircuitBreaker(name, {
      failureThreshold: options?.failureThreshold ?? 3,
      resetTimeout: options?.resetTimeout ?? 30000,
      onStateChange: (circuitName, from, to) => {
        logger.info(`[Circuit Breaker] ${circuitName}: ${from} -> ${to}`);
      },
    }),
    name,
  };
}

// ==================== Resilient AI Adapter ====================

export class ResilientAIAdapter implements AIService {
  private readonly instances: { instance: AIService; breaker: CircuitBreaker; name: string }[];

  constructor(instances: AIService[]) {
    if (instances.length === 0) throw new Error('No AI instances provided for resilience');
    this.instances = instances.map((instance, i) => wrapWithBreaker(instance, 'ai', i));
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    return executeWithFallback(this.instances, 'generateResponse', (instance) =>
      instance.generateResponse(params),
    ) as Promise<AIResponse>;
  }

  async *generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string> {
    for (const { instance, breaker, name } of this.instances) {
      try {
        const startTime = Date.now();
        const stream = await breaker.execute(async () => {
          return instance.generateResponseStream(params);
        });
        yield* stream;
        logMetrics({
          operation: 'generateResponseStream',
          provider: name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return;
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError) {
          logError('generateResponseStream', name, error);
        } else {
          logMetrics({
            operation: 'generateResponseStream',
            provider: name,
            latencyMs: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        // Continue to next provider
      }
    }
    throw new Error('All AI providers failed to generate response stream');
  }

  async generateExplanation(params: any): Promise<{ voiceText: string }> {
    return executeWithFallback(this.instances, 'generateExplanation', (instance) =>
      instance.generateExplanation(params),
    ) as Promise<{ voiceText: string }>;
  }

  async evaluateResponse(
    params: any,
  ): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    return executeWithFallback(this.instances, 'evaluateResponse', (instance) =>
      instance.evaluateResponse(params),
    ) as Promise<{
      result: 'correct' | 'partial' | 'incorrect';
      confidence: number;
      hint?: string;
    }>;
  }

  async generateAnswer(params: any): Promise<{ answer: string }> {
    return executeWithFallback(this.instances, 'generateAnswer', (instance) =>
      instance.generateAnswer(params),
    ) as Promise<{ answer: string }>;
  }
}

// ==================== Resilient Classifier Adapter ====================

export class ResilientClassifierAdapter implements QuestionClassifier {
  private readonly instances: {
    instance: QuestionClassifier;
    breaker: CircuitBreaker;
    name: string;
  }[];

  constructor(instances: QuestionClassifier[]) {
    if (instances.length === 0) throw new Error('No classifier instances provided for resilience');
    this.instances = instances.map((instance, i) => wrapWithBreaker(instance, 'classifier', i));
  }

  async classify(payload: ClassificationPayload): Promise<QuestionClassification> {
    return executeWithFallback(this.instances, 'classify', (instance) =>
      instance.classify(payload),
    ) as Promise<QuestionClassification>;
  }
}

// ==================== Resilient Evaluator Adapter ====================

export class ResilientEvaluatorAdapter implements ComprehensionEvaluator {
  private readonly instances: {
    instance: ComprehensionEvaluator;
    breaker: CircuitBreaker;
    name: string;
  }[];

  constructor(instances: ComprehensionEvaluator[]) {
    if (instances.length === 0) throw new Error('No evaluator instances provided for resilience');
    this.instances = instances.map((instance, i) => wrapWithBreaker(instance, 'evaluator', i));
  }

  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    return executeWithFallback(this.instances, 'evaluate', (instance) =>
      instance.evaluate(payload),
    ) as Promise<ComprehensionEvaluation>;
  }
}

// ==================== Resilient RAG Adapter ====================

export class ResilientRAGAdapter implements RAGService {
  private readonly instances: { instance: RAGService; breaker: CircuitBreaker; name: string }[];

  constructor(instances: RAGService[]) {
    if (instances.length === 0) throw new Error('No RAG instances provided for resilience');
    this.instances = instances.map((instance, i) => wrapWithBreaker(instance, 'rag', i));
  }

  async retrieveChunks(query: any): Promise<{
    chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[];
    totalAvailable: number;
    retrievalMethod: string;
  }> {
    return executeWithFallback(this.instances, 'retrieveChunks', (instance) =>
      instance.retrieveChunks(query),
    ) as Promise<{
      chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[];
      totalAvailable: number;
      retrievalMethod: string;
    }>;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return executeWithFallback(this.instances, 'generateEmbedding', (instance) =>
      instance.generateEmbedding(text),
    ) as Promise<number[]>;
  }
}
