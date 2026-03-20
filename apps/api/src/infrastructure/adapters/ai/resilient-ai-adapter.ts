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

export class ResilientAIAdapter implements AIService {
  constructor(private readonly instances: AIService[]) {
    if (instances.length === 0) throw new Error('No AI instances provided for resilience');
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    let lastError: unknown;
    for (const instance of this.instances) {
      try {
        return await instance.generateResponse(params);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async *generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string> {
    for (let i = 0; i < this.instances.length; i++) {
      try {
        yield* this.instances[i].generateResponseStream(params);
        return;
      } catch (error) {
        if (i === this.instances.length - 1) throw error;
      }
    }
  }

  async generateExplanation(params: any): Promise<{ voiceText: string }> {
    return this.instances[0].generateExplanation(params);
  }

  async evaluateResponse(
    params: any,
  ): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    return this.instances[0].evaluateResponse(params);
  }

  async generateAnswer(params: any): Promise<{ answer: string }> {
    let lastError: unknown;
    for (const instance of this.instances) {
      try {
        return await instance.generateAnswer(params);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}

export class ResilientClassifierAdapter implements QuestionClassifier {
  constructor(private readonly instances: QuestionClassifier[]) {}

  async classify(payload: ClassificationPayload): Promise<QuestionClassification> {
    let lastError: unknown;
    for (const instance of this.instances) {
      try {
        return await instance.classify(payload);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}

export class ResilientEvaluatorAdapter implements ComprehensionEvaluator {
  constructor(private readonly instances: ComprehensionEvaluator[]) {}

  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    let lastError: unknown;
    for (const instance of this.instances) {
      try {
        return await instance.evaluate(payload);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}

export class ResilientRAGAdapter implements RAGService {
  constructor(private readonly instances: RAGService[]) {}

  async retrieveChunks(query: any): Promise<{
    chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[];
    totalAvailable: number;
    retrievalMethod: string;
  }> {
    let lastError: unknown;
    for (const instance of this.instances) {
      try {
        return await instance.retrieveChunks(query);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    let lastError: unknown;
    for (const instance of this.instances) {
      try {
        return await instance.generateEmbedding(text);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
}
