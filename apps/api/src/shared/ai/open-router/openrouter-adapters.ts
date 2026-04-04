import OpenAI from 'openai';
import type pino from 'pino';
import { config } from '@/shared/config/index.js';

import type {
  AIService,
  AIResponse,
  GenerateResponseParams,
} from '@/features/recipe/domain/ports/ai-service.port.js';
import type { PromptRepository } from '@/features/recipe/domain/ports/prompt.repository.port.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/features/recipe/domain/ports/question-classifier.port.js';
import type { QuestionClassification } from '@/features/activity/domain/entities/question-classification.entity.js';
import type { KnowledgeChunkRepository } from '@/features/knowledge/domain/ports/knowledge-chunk.repository.port.js';
import { BaseGenerativeAdapter } from '@/shared/ai/base-llm-adapter.js';
import { BaseRAGAdapter } from '@/shared/ai/base-rag-adapter.js';
import { OpenAIBaseClientAdapter } from '@/shared/ai/open-ai-base-adapter.js';
import {
  AIResponseSchema,
  ClassificationSchema,
  ComprehensionSchema,
} from '@/shared/ai/schemas.js';

export class OpenRouterAdapter extends BaseGenerativeAdapter implements AIService {
  protected readonly client: OpenAI;
  protected readonly defaultModel: string;

  constructor(
    promptRepo: PromptRepository,
    apiKey: string,
    defaultModel: string,
    logger?: pino.Logger,
    maxPromptLogLength = 500,
  ) {
    super(promptRepo, logger, maxPromptLogLength);
    this.defaultModel = defaultModel;
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': config.OPENROUTER_APP_URL,
        'X-Title': config.OPENROUTER_APP_NAME,
      },
    });
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    const prompt = this.buildPrompt(params.currentState, params);
    this.logPromptDebug(params.currentState, prompt);
    try {
      const result = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      const validated = this.parseAndValidateResponse(
        result.choices[0]?.message?.content || '{}',
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

  async *generateResponseStream(params: GenerateResponseParams): AsyncGenerator<string> {
    const prompt = this.buildPrompt(params.currentState, params);
    const stream = await this.client.chat.completions.create({
      model: this.defaultModel,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  async generateExplanation(params: any) {
    return { voiceText: params.segment.chunkText };
  }
  async evaluateResponse(_params: {
    studentAnswer: string;
    expectedAnswer: string;
    microQuestion: string;
  }): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    return { result: 'incorrect', confidence: 0 };
  }

  async generateAnswer(params: any): Promise<{ answer: string }> {
    const prompt = `Contexto: ${params.context}\nPregunta: ${params.question}`;
    try {
      const result = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });
      return { answer: result.choices[0]?.message?.content || 'Error' };
    } catch {
      return { answer: 'Error' };
    }
  }
}

export class OpenRouterClassifierAdapter
  extends OpenAIBaseClientAdapter
  implements QuestionClassifier
{
  constructor(apiKey: string, model: string, logger?: pino.Logger) {
    super(apiKey, 'https://openrouter.ai/api/v1', model, logger);
  }
  async classify(payload: ClassificationPayload): Promise<QuestionClassification> {
    try {
      return await this.executeCall(payload.transcript, ClassificationSchema);
    } catch (error) {
      return this.handleError('CLASSIFY', error, {
        intent: 'other',
        confidence: 0.5,
      }) as QuestionClassification;
    }
  }
}

export class OpenRouterComprehensionEvaluatorAdapter
  extends OpenAIBaseClientAdapter
  implements ComprehensionEvaluator
{
  constructor(apiKey: string, model: string, logger?: pino.Logger) {
    super(apiKey, 'https://openrouter.ai/api/v1', model, logger);
  }
  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    try {
      return await this.executeCall(payload.studentAnswer, ComprehensionSchema);
    } catch (error) {
      return this.handleError('EVALUATE', error, {
        result: 'incorrect',
        confidence: 0.5,
        shouldEscalate: false,
      });
    }
  }
}

export class OpenRouterRAGServiceAdapter extends BaseRAGAdapter {
  private readonly client: OpenAI;
  constructor(
    apiKey: string,
    knowledgeChunkRepository: KnowledgeChunkRepository,
    private readonly embeddingModel = 'openai/text-embedding-3-small',
  ) {
    super(knowledgeChunkRepository);
    this.client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
  }
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  }
}
