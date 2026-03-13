import OpenAI from 'openai';
import type pino from 'pino';
import { z } from 'zod';

import { cleanJsonResponse, cosineSimilarity } from '@/utils/ai-utils.js';

import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier.js';
import type { QuestionClassification } from '@/domain/entities/question-classification.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import { RAG_CONFIG } from '@/domain/ports/rag-service.js';
import type { KnowledgeChunk } from '@/domain/entities/knowledge-chunk.js';
import type { KnowledgeChunkRepository } from '@/domain/ports/knowledge-chunk-repository.js';
import { config } from '@/config/index.js';
import {
  BaseGenerativeAdapter,
  GenerateResponseParams,
  BaseLLMAdapter,
} from '@/infrastructure/adapters/ai/base-llm-adapter.js';
import {
  AIResponseSchema,
  ClassificationSchema,
  ComprehensionSchema,
} from '@/infrastructure/adapters/ai/schemas.js';

export class OpenRouterAdapter extends BaseGenerativeAdapter implements AIService {
  private readonly client: OpenAI;

  constructor(
    promptRepo: PromptRepository,
    apiKey: string,
    logger?: pino.Logger,
    maxPromptLogLength = 500,
  ) {
    super(promptRepo, logger, maxPromptLogLength);
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:3001',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Pixel Mentor',
      },
    });
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    const prompt = this.buildPrompt(params.currentState, params);
    const model = config.DEFAULT_MODEL_OPENROUTER || 'stepfun/step-3.5-flash';

    this.logPromptDebug(params.currentState, prompt);

    try {
      const result = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const rawText = result.choices[0]?.message?.content || '{}';
      const validated = this.parseAndValidateResponse(
        rawText,
        AIResponseSchema,
        params.currentState,
      );

      if (!validated) {
        throw new Error('Validation failed for OpenRouter response');
      }

      return {
        ...validated,
        pedagogicalState: params.currentState,
      };
    } catch (error: unknown) {
      return this.handleError(params.currentState, error, {
        explanation: 'Tuve un problema técnico, ¿puedes intentarlo de nuevo?',
        supportQuotes: [],
        pedagogicalState: params.currentState,
      });
    }
  }

  async generateExplanation(params: {
    recipe: unknown;
    conceptIndex: number;
    segment: { chunkText: string; order: number };
  }): Promise<{ voiceText: string }> {
    return { voiceText: params.segment.chunkText || `Explaining concept ${params.conceptIndex}` };
  }

  async evaluateResponse(params: {
    studentAnswer: string;
    expectedAnswer: string;
    microQuestion: string;
  }): Promise<{ result: 'correct' | 'partial' | 'incorrect'; confidence: number; hint?: string }> {
    const isCorrect =
      params.studentAnswer.trim().toLowerCase() === params.expectedAnswer.trim().toLowerCase();

    return {
      result: isCorrect ? 'correct' : 'incorrect',
      confidence: isCorrect ? 0.9 : 0.5,
    };
  }
}

abstract class BaseOpenRouterFetchAdapter extends BaseLLMAdapter {
  protected readonly apiKey: string;
  protected readonly model: string;
  protected readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string, model: string, logger?: pino.Logger) {
    super(logger);
    this.apiKey = apiKey;
    this.model = model;
  }

  protected async executeFetch<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = new Error(`OpenRouter request failed: ${response.statusText}`);
      Object.assign(error, { status: response.status });
      throw error;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    const cleanedText = cleanJsonResponse(content);

    return schema.parse(JSON.parse(cleanedText));
  }
}

export class OpenRouterClassifierAdapter
  extends BaseOpenRouterFetchAdapter
  implements QuestionClassifier
{
  constructor(apiKey: string, model = 'openai/gpt-4o', logger?: pino.Logger) {
    super(apiKey, model, logger);
  }

  async classify(payload: ClassificationPayload): Promise<QuestionClassification> {
    const history = payload.lastTurns
      .map((t) => `${t.role === 'user' ? 'Estudiante' : 'Tutor'}: ${t.content}`)
      .join('\n');

    const meta = payload.lessonMetadata
      ? `Lección: ${payload.lessonMetadata.title}\nConceptos: ${payload.lessonMetadata.concepts.join(', ')}`
      : '';

    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"intent": "question" | "answer" | "statement" | "greeting" | "other","confidence": 0.9,"reasoning": "motivo"}`;
    const prompt = `Clasifica el texto del estudiante.\n\nHistorial:\n${history}\n\nTexto actual: "${payload.transcript}"\n\n${meta}${schemaInstruction}`;

    try {
      return await this.executeFetch(prompt, ClassificationSchema);
    } catch (error: unknown) {
      return this.handleError('CLASSIFY_OPENROUTER', error, {
        intent: 'other',
        confidence: 0.5,
        reasoning: 'Error en clasificación',
      });
    }
  }
}

export class OpenRouterComprehensionEvaluatorAdapter
  extends BaseOpenRouterFetchAdapter
  implements ComprehensionEvaluator
{
  constructor(apiKey: string, model = 'openai/gpt-4o', logger?: pino.Logger) {
    super(apiKey, model, logger);
  }

  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"result": "correct" | "partial" | "incorrect","confidence": 0.9,"hint": "pista","shouldEscalate": false}`;
    const prompt = `Evalúa la comprensión del estudiante.\n\nPregunta: ${payload.microQuestion}\nEsperada: ${payload.expectedAnswer}\nEstudiante: ${payload.studentAnswer}\nIntento: ${payload.attemptNumber}${schemaInstruction}`;

    try {
      return await this.executeFetch(prompt, ComprehensionSchema);
    } catch (error: unknown) {
      return this.handleError('EVALUATE_OPENROUTER', error, {
        result: 'incorrect',
        confidence: 0.5,
        shouldEscalate: false,
      });
    }
  }
}

export class OpenRouterRAGServiceAdapter implements RAGService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly embeddingModel: string;
  private readonly knowledgeChunkRepository: KnowledgeChunkRepository;

  constructor(
    apiKey: string,
    knowledgeChunkRepository: KnowledgeChunkRepository,
    embeddingModel = 'openai/text-embedding-3-small',
  ) {
    this.apiKey = apiKey;
    this.knowledgeChunkRepository = knowledgeChunkRepository;
    this.embeddingModel = embeddingModel;
  }

  async retrieveChunks(query: {
    atomId: string;
    queryText?: string;
    queryEmbedding?: number[];
    k?: number;
  }): Promise<{
    chunks: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[];
    totalAvailable: number;
    retrievalMethod: string;
  }> {
    const embedding = query.queryEmbedding ?? (await this.generateEmbedding(query.queryText ?? ''));

    const rawChunks = await this.knowledgeChunkRepository.findRelevantChunks(
      query.atomId,
      embedding,
      query.k ?? RAG_CONFIG.DEFAULT_K,
    );

    const retrieved: { chunk: KnowledgeChunk; similarityScore: number; citations?: any[] }[] = [];

    for (const item of rawChunks) {
      const chunk = item.chunk;
      if (!chunk.embedding) continue;

      const score = cosineSimilarity(embedding, chunk.embedding);
      if (score >= RAG_CONFIG.MIN_SIMILARITY_SCORE) {
        retrieved.push({
          chunk,
          similarityScore: score,
          citations: [],
        });
      }
    }

    retrieved.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      chunks: retrieved,
      totalAvailable: retrieved.length,
      retrievalMethod: 'embedding',
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = new Error(`OpenRouter embedding failed: ${response.statusText}`);
      Object.assign(error, { status: response.status });
      throw error;
    }

    const data = await response.json();
    return data.data[0].embedding;
  }
}
