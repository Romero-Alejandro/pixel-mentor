import { GoogleGenerativeAI } from '@google/generative-ai';
import type pino from 'pino';
import type { z } from 'zod';

import { cleanJsonResponse } from '@/utils/ai-utils.js';
import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type { QuestionClassification } from '@/domain/entities/question-classification.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';
import type { KnowledgeChunkRepository } from '@/domain/ports/knowledge-chunk-repository.js';
import type { GenerateResponseParams } from '@/infrastructure/adapters/ai/base-llm-adapter.js';
import {
  BaseGenerativeAdapter,
  BaseLLMAdapter,
} from '@/infrastructure/adapters/ai/base-llm-adapter.js';
import { BaseRAGAdapter } from '@/infrastructure/adapters/ai/base-rag-adapter.js';
import {
  AIResponseSchema,
  ClassificationSchema,
  ComprehensionSchema,
} from '@/infrastructure/adapters/ai/schemas.js';

export class GeminiAIModelAdapter extends BaseGenerativeAdapter implements AIService {
  private readonly client: GoogleGenerativeAI;
  private readonly defaultModel: string;

  constructor(
    promptRepo: PromptRepository,
    apiKey: string,
    defaultModel: string,
    logger?: pino.Logger,
    maxPromptLogLength = 500,
  ) {
    super(promptRepo, logger, maxPromptLogLength);
    this.client = new GoogleGenerativeAI(apiKey);
    this.defaultModel = defaultModel;
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    const prompt = this.buildPrompt(params.currentState, params);
    const model = this.client.getGenerativeModel({
      model: this.defaultModel,
      generationConfig: { responseMimeType: 'application/json' },
    });
    this.logPromptDebug(params.currentState, prompt);

    try {
      const result = await model.generateContent(prompt);
      const validated = this.parseAndValidateResponse(
        result.response.text(),
        AIResponseSchema,
        params.currentState,
      );
      if (!validated) throw new Error('Validation failed');
      return { ...validated, pedagogicalState: params.currentState };
    } catch (error: unknown) {
      return this.handleError(params.currentState, error, {
        explanation: 'Error técnico',
        supportQuotes: [],
        pedagogicalState: params.currentState,
      });
    }
  }

  async generateExplanation(params: any): Promise<{ voiceText: string }> {
    return { voiceText: params.segment.chunkText || `Explaining concept ${params.conceptIndex}` };
  }

  async evaluateResponse(
    params: any,
  ): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    const isCorrect =
      params.studentAnswer.trim().toLowerCase() === params.expectedAnswer.trim().toLowerCase();
    return { result: isCorrect ? 'correct' : 'incorrect', confidence: isCorrect ? 0.9 : 0.5 };
  }

  async generateAnswer(params: any): Promise<{ answer: string }> {
    // Use question as prompt, context is optional extra info
    let prompt = params.question;
    if (params.context && params.context.trim()) {
      prompt = `${params.context}\n\n${prompt}`;
    }

    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });
      const result = await model.generateContent(prompt);
      const text = result.response?.text();
      if (text && text.trim()) {
        return { answer: text.trim() };
      }
      return { answer: 'No se pudo generar contenido.' };
    } catch (error) {
      console.error('[Gemini] generateAnswer error:', error);
      return { answer: 'Error al generar contenido.' };
    }
  }

  async *generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string> {
    const prompt = this.buildPrompt(params.currentState, params);
    const model = this.client.getGenerativeModel({
      model: this.defaultModel,
      generationConfig: { responseMimeType: 'text/plain' },
    });
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}

abstract class BaseGeminiClassifierAdapter extends BaseLLMAdapter {
  protected readonly client: GoogleGenerativeAI;
  protected readonly fallbackModels = [
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
  ];

  constructor(apiKey: string, logger?: pino.Logger) {
    super(logger);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  protected async executeWithFallback<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    let lastError: unknown;
    for (const modelId of this.fallbackModels) {
      try {
        const model = this.client.getGenerativeModel({
          model: modelId,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        const cleanedText = cleanJsonResponse(result.response.text());
        const validation = schema.safeParse(JSON.parse(cleanedText));
        if (validation.success) return validation.data;
        throw new Error('Schema validation failed');
      } catch (error: unknown) {
        lastError = error;
        if (
          error instanceof Error &&
          'status' in error &&
          [429, 503, 500].includes((error as any).status)
        )
          continue;
        throw error;
      }
    }
    throw lastError;
  }
}

export class GeminiClassifierAdapter
  extends BaseGeminiClassifierAdapter
  implements QuestionClassifier
{
  async classify(payload: ClassificationPayload): Promise<QuestionClassification> {
    const history = payload.lastTurns.map((t) => `${t.role}: ${t.content}`).join('\n');
    const prompt = `Clasifica el texto.\nHistorial:\n${history}\nTexto actual: "${payload.transcript}"`;
    try {
      return await this.executeWithFallback(prompt, ClassificationSchema);
    } catch (error: unknown) {
      return this.handleError('CLASSIFY', error, {
        intent: 'other',
        confidence: 0.5,
      }) as QuestionClassification;
    }
  }
}

export class GeminiComprehensionEvaluatorAdapter
  extends BaseGeminiClassifierAdapter
  implements ComprehensionEvaluator
{
  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    const prompt = `Evalúa.\nPregunta: ${payload.microQuestion}\nEsperada: ${payload.expectedAnswer}\nEstudiante: ${payload.studentAnswer}`;
    try {
      return await this.executeWithFallback(prompt, ComprehensionSchema);
    } catch (error: unknown) {
      return this.handleError('EVALUATE', error, {
        result: 'incorrect',
        confidence: 0.5,
        shouldEscalate: false,
      });
    }
  }
}

export class GeminiRAGServiceAdapter extends BaseRAGAdapter {
  private readonly client: GoogleGenerativeAI;
  constructor(apiKey: string, knowledgeChunkRepo: KnowledgeChunkRepository) {
    super(knowledgeChunkRepo);
    this.client = new GoogleGenerativeAI(apiKey);
  }
  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}
