import type { GenerateResponseParams } from './base-llm-adapter.js';

import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier.js';
import type { QuestionClassification } from '@/domain/entities/question-classification.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import type { KnowledgeChunk } from '@/domain/entities/knowledge-chunk.js';
import {
  getCircuitBreaker,
  CircuitBreakerOpenError,
  type CircuitBreaker,
} from '@/infrastructure/resilience/index.js';

// ==================== Logging ====================

interface OperationMetrics {
  operation: string;
  provider: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

function logMetrics(metrics: OperationMetrics): void {
  // In production, this would go to a metrics service (DataDog, Prometheus, etc.)
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[AI Metrics] ${metrics.operation} - ${metrics.provider}: ${metrics.latencyMs}ms - ${metrics.success ? 'OK' : 'FAIL'}`,
    );
  }
}

function logError(operation: string, provider: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[AI Error] ${operation} - ${provider}: ${errorMessage}`);
}

// ==================== Resilient AI Adapter ====================

export class ResilientAIAdapter implements AIService {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly instances: AIService[]) {
    if (instances.length === 0) throw new Error('No AI instances provided for resilience');

    // Create circuit breaker for each instance
    for (const [index, instance] of instances.entries()) {
      const name = `ai-${instance.constructor.name}-${index}`;
      this.breakers.set(
        name,
        getCircuitBreaker(name, {
          failureThreshold: 3,
          resetTimeout: 30000,
          onStateChange: (circuitName, from, to) => {
            console.log(`[Circuit Breaker] ${circuitName}: ${from} -> ${to}`);
          },
        }),
      );
    }
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    return this.executeWithResilience('generateResponse', (instance) =>
      instance.generateResponse(params),
    );
  }

  async *generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string> {
    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      const breakerName = `ai-${instance.constructor.name}-${i}`;
      const breaker = this.breakers.get(breakerName);

      try {
        const startTime = Date.now();
        // Execute with circuit breaker, then yield from the stream
        const stream = await breaker!.execute(async () => {
          return instance.generateResponseStream(params);
        });
        yield* stream;
        logMetrics({
          operation: 'generateResponseStream',
          provider: instance.constructor.name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return;
      } catch (error) {
        if (error instanceof CircuitBreakerOpenError) {
          logError('generateResponseStream', instance.constructor.name, error);
          continue; // Try next instance
        }

        logMetrics({
          operation: 'generateResponseStream',
          provider: instance.constructor.name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        if (i === this.instances.length - 1) throw error;
      }
    }
  }

  async generateExplanation(params: any): Promise<{ voiceText: string }> {
    return this.executeWithResilience('generateExplanation', (instance) =>
      instance.generateExplanation(params),
    );
  }

  async evaluateResponse(
    params: any,
  ): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    return this.executeWithResilience('evaluateResponse', (instance) =>
      instance.evaluateResponse(params),
    );
  }

  async generateAnswer(params: any): Promise<{ answer: string }> {
    return this.executeWithResilience('generateAnswer', (instance) =>
      instance.generateAnswer(params),
    );
  }

  /**
   * Execute an operation with circuit breaker protection and fallback
   */
  private async executeWithResilience<T>(
    operation: string,
    fn: (instance: AIService) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      const breakerName = `ai-${instance.constructor.name}-${i}`;
      const breaker = this.breakers.get(breakerName);

      if (!breaker) continue;

      try {
        const startTime = Date.now();
        const result = await breaker.execute(() => fn(instance));
        logMetrics({
          operation,
          provider: instance.constructor.name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof CircuitBreakerOpenError) {
          logError(operation, instance.constructor.name, error);
          continue; // Try next instance
        }

        logMetrics({
          operation,
          provider: instance.constructor.name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError;
  }
}

// ==================== Resilient Classifier Adapter ====================

export class ResilientClassifierAdapter implements QuestionClassifier {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly instances: QuestionClassifier[]) {
    for (const [index, instance] of instances.entries()) {
      const name = `classifier-${instance.constructor.name}-${index}`;
      this.breakers.set(
        name,
        getCircuitBreaker(name, {
          failureThreshold: 3,
          resetTimeout: 30000,
        }),
      );
    }
  }

  async classify(payload: ClassificationPayload): Promise<QuestionClassification> {
    let lastError: unknown;

    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      const breakerName = `classifier-${instance.constructor.name}-${i}`;
      const breaker = this.breakers.get(breakerName);

      if (!breaker) continue;

      try {
        const startTime = Date.now();
        const result = await breaker.execute(() => instance.classify(payload));
        logMetrics({
          operation: 'classify',
          provider: instance.constructor.name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof CircuitBreakerOpenError) {
          logError('classify', instance.constructor.name, error);
          continue;
        }

        logMetrics({
          operation: 'classify',
          provider: instance.constructor.name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError;
  }
}

// ==================== Resilient Evaluator Adapter ====================

export class ResilientEvaluatorAdapter implements ComprehensionEvaluator {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly instances: ComprehensionEvaluator[]) {
    for (const [index, instance] of instances.entries()) {
      const name = `evaluator-${instance.constructor.name}-${index}`;
      this.breakers.set(
        name,
        getCircuitBreaker(name, {
          failureThreshold: 3,
          resetTimeout: 30000,
        }),
      );
    }
  }

  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    let lastError: unknown;

    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      const breakerName = `evaluator-${instance.constructor.name}-${i}`;
      const breaker = this.breakers.get(breakerName);

      if (!breaker) continue;

      try {
        const startTime = Date.now();
        const result = await breaker.execute(() => instance.evaluate(payload));
        logMetrics({
          operation: 'evaluate',
          provider: instance.constructor.name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof CircuitBreakerOpenError) {
          logError('evaluate', instance.constructor.name, error);
          continue;
        }

        logMetrics({
          operation: 'evaluate',
          provider: instance.constructor.name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError;
  }
}

// ==================== Resilient RAG Adapter ====================

export class ResilientRAGAdapter implements RAGService {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly instances: RAGService[]) {
    for (const [index, instance] of instances.entries()) {
      const name = `rag-${instance.constructor.name}-${index}`;
      this.breakers.set(
        name,
        getCircuitBreaker(name, {
          failureThreshold: 3,
          resetTimeout: 30000,
        }),
      );
    }
  }

  async retrieveChunks(query: any): Promise<{
    chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[];
    totalAvailable: number;
    retrievalMethod: string;
  }> {
    let lastError: unknown;

    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      const breakerName = `rag-${instance.constructor.name}-${i}`;
      const breaker = this.breakers.get(breakerName);

      if (!breaker) continue;

      try {
        const startTime = Date.now();
        const result = await breaker.execute(() => instance.retrieveChunks(query));
        logMetrics({
          operation: 'retrieveChunks',
          provider: instance.constructor.name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof CircuitBreakerOpenError) {
          logError('retrieveChunks', instance.constructor.name, error);
          continue;
        }

        logMetrics({
          operation: 'retrieveChunks',
          provider: instance.constructor.name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    let lastError: unknown;

    for (let i = 0; i < this.instances.length; i++) {
      const instance = this.instances[i];
      const breakerName = `rag-${instance.constructor.name}-${i}`;
      const breaker = this.breakers.get(breakerName);

      if (!breaker) continue;

      try {
        const startTime = Date.now();
        const result = await breaker.execute(() => instance.generateEmbedding(text));
        logMetrics({
          operation: 'generateEmbedding',
          provider: instance.constructor.name,
          latencyMs: Date.now() - startTime,
          success: true,
        });
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof CircuitBreakerOpenError) {
          logError('generateEmbedding', instance.constructor.name, error);
          continue;
        }

        logMetrics({
          operation: 'generateEmbedding',
          provider: instance.constructor.name,
          latencyMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError;
  }
}
