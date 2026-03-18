import { GoogleGenerativeAI } from '@google/generative-ai';
import type pino from 'pino';
import { z } from 'zod';

import { cleanJsonResponse, cosineSimilarity } from '@/utils/ai-utils.js';
import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type { QuestionClassification } from '@/domain/entities/question-classification.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';
import type { KnowledgeChunkRepository } from '@/domain/ports/knowledge-chunk-repository.js';
import { RAG_CONFIG } from '@/domain/ports/rag-service.js';
import type { KnowledgeChunk } from '@/domain/entities/knowledge-chunk.js';
import type { GenerateResponseParams } from '@/infrastructure/adapters/ai/base-llm-adapter.js';
import {
  BaseGenerativeAdapter,
  BaseLLMAdapter,
} from '@/infrastructure/adapters/ai/base-llm-adapter.js';
import {
  AIResponseSchema,
  ClassificationSchema,
  ComprehensionSchema,
} from '@/infrastructure/adapters/ai/schemas.js';

export class GeminiAIModelAdapter extends BaseGenerativeAdapter implements AIService {
  private readonly client: GoogleGenerativeAI;

  constructor(
    promptRepo: PromptRepository,
    apiKey: string,
    logger?: pino.Logger,
    maxPromptLogLength = 500,
  ) {
    super(promptRepo, logger, maxPromptLogLength);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    const prompt = this.buildPrompt(params.currentState, params);

    const model = this.client.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      generationConfig: { responseMimeType: 'application/json' },
    });

    this.logPromptDebug(params.currentState, prompt);

    try {
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();

      const validated = this.parseAndValidateResponse(
        rawText,
        AIResponseSchema,
        params.currentState,
      );

      if (!validated) {
        throw new Error('Validation failed');
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

  async generateAnswer(params: {
    question: string;
    context: string;
    recipeTitle: string;
  }): Promise<{ answer: string }> {
    const prompt = `Eres un tutor infantil amigable y paciente.
TEMA DE LA CLASE: ${params.recipeTitle}
CONTENIDO RELACIONADO:
${params.context}

INSTRUCCIONES:
1. Responde solo usando el contenido proporcionado
2. Si no tienes información suficiente, dice "Buena pregunta, ahora mismo te explico más sobre eso usando lo que aprendimos"
3. Usa ejemplos del contenido para explicar
4. Sé encouraging y positivo
5. Lenguaje simple para niños de 6-8 años
6. Máximo 2-3 oraciones

PREGUNTA DEL ESTUDIANTE: ${params.question}`;

    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);

      const answer =
        result.response?.text() ||
        '¡Muy buena pregunta! ¿Qué te parece si lo practicamos un poco más?';
      return { answer };
    } catch (error) {
      this.logger?.error(error, 'Error generating answer');
      return { answer: '¡Muy buena pregunta! ¿Qué te parece si lo practicamos un poco más?' };
    }
  }
}

abstract class BaseGeminiClassifierAdapter extends BaseLLMAdapter {
  protected readonly client: GoogleGenerativeAI;
  protected readonly fastModels = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
  ];

  constructor(apiKey: string, logger?: pino.Logger) {
    super(logger);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  protected async executeWithFallback<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    let lastError: unknown;

    for (const modelId of this.fastModels) {
      try {
        const model = this.client.getGenerativeModel({
          model: modelId,
          generationConfig: { responseMimeType: 'application/json' },
        });

        const result = await model.generateContent(prompt);
        const cleanedText = cleanJsonResponse(result.response.text());

        return schema.parse(JSON.parse(cleanedText));
      } catch (error: unknown) {
        lastError = error;

        const isNetworkOrApiError =
          error instanceof Error &&
          'status' in error &&
          [429, 503, 500, 404].includes((error as any).status);
        const isParsingError = error instanceof SyntaxError || error instanceof z.ZodError;

        if (isNetworkOrApiError || isParsingError) {
          continue;
        }

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
  constructor(apiKey: string, logger?: pino.Logger) {
    super(apiKey, logger);
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
      return await this.executeWithFallback(prompt, ClassificationSchema);
    } catch (error: unknown) {
      return this.handleError('CLASSIFY', error, {
        intent: 'other',
        confidence: 0.5,
        reasoning: 'Error de contingencia en clasificación',
      }) as QuestionClassification;
    }
  }
}

export class GeminiComprehensionEvaluatorAdapter
  extends BaseGeminiClassifierAdapter
  implements ComprehensionEvaluator
{
  constructor(apiKey: string, logger?: pino.Logger) {
    super(apiKey, logger);
  }

  async evaluate(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"result": "correct" | "partial" | "incorrect","confidence": 0.9,"hint": "pista","shouldEscalate": false}`;
    const prompt = `Evalúa la comprensión del estudiante.\n\nPregunta: ${payload.microQuestion}\nEsperada: ${payload.expectedAnswer}\nEstudiante: ${payload.studentAnswer}\nIntento: ${payload.attemptNumber}${schemaInstruction}`;

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

export class GeminiRAGServiceAdapter implements RAGService {
  private readonly client: GoogleGenerativeAI;
  private readonly knowledgeChunkRepo: KnowledgeChunkRepository;

  constructor(apiKey: string, knowledgeChunkRepo: KnowledgeChunkRepository) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.knowledgeChunkRepo = knowledgeChunkRepo;
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

    const rawChunks = await this.knowledgeChunkRepo.findRelevantChunks(
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
        retrieved.push({ chunk, similarityScore: score, citations: [] });
      }
    }

    retrieved.sort((a, b) => b.similarityScore - a.similarityScore);

    return { chunks: retrieved, totalAvailable: retrieved.length, retrievalMethod: 'embedding' };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}
