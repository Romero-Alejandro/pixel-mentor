import type pino from 'pino';

import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type {
  QuestionClassifier,
  ClassificationPayload,
  ComprehensionEvaluator,
  ComprehensionPayload,
  ComprehensionEvaluation,
} from '@/domain/ports/question-classifier.js';
import type { KnowledgeChunkRepository } from '@/domain/ports/knowledge-chunk-repository.js';
import type { PromptRepository } from '@/domain/ports/prompt-repository.js';
import { OpenAIBaseClientAdapter } from '../open-ai-base-adapter';
import { AIResponseSchema, ClassificationSchema, ComprehensionSchema } from '../schemas';
import { BaseRAGAdapter } from '../base-rag-adapter';
import { BaseGenerativeAdapter } from '../base-llm-adapter';

export class GroqAdapter extends BaseGenerativeAdapter implements AIService {
  private readonly client: any;
  constructor(
    promptRepo: PromptRepository,
    apiKey: string,
    private readonly model: string,
    logger?: pino.Logger,
  ) {
    super(promptRepo, logger);
    this.client = new (require('openai'))({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  }

  async generateResponse(params: any): Promise<AIResponse> {
    const prompt = this.buildPrompt(params.currentState, params);
    try {
      const result = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      const validated = this.parseAndValidateResponse(
        result.choices[0]?.message?.content || '{}',
        AIResponseSchema,
        params.currentState,
      );
      if (!validated) throw new Error('Invalid Groq Response');
      return { ...validated, pedagogicalState: params.currentState };
    } catch (e) {
      return this.handleError(params.currentState, e, {
        explanation: 'Error técnico',
        supportQuotes: [],
        pedagogicalState: params.currentState,
      });
    }
  }

  async *generateResponseStream(params: any): AsyncGenerator<string> {
    const prompt = this.buildPrompt(params.currentState, params);
    const stream = await this.client.chat.completions.create({
      model: this.model,
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
  async evaluateResponse(params: any) {
    return { result: 'correct', confidence: 1 };
  }
  async generateAnswer(params: any) {
    return { answer: 'Respuesta' };
  }
}

export class GroqClassifierAdapter extends OpenAIBaseClientAdapter implements QuestionClassifier {
  constructor(apiKey: string, model: string, logger?: pino.Logger) {
    super(apiKey, 'https://api.groq.com/openai/v1', model, logger);
  }
  async classify(p: ClassificationPayload) {
    return this.executeCall(p.transcript, ClassificationSchema);
  }
}

export class GroqComprehensionEvaluatorAdapter
  extends OpenAIBaseClientAdapter
  implements ComprehensionEvaluator
{
  constructor(apiKey: string, model: string, logger?: pino.Logger) {
    super(apiKey, 'https://api.groq.com/openai/v1', model, logger);
  }
  async evaluate(p: ComprehensionPayload) {
    return this.executeCall(p.studentAnswer, ComprehensionSchema);
  }
}

export class GroqRAGServiceAdapter extends BaseRAGAdapter {
  private client: any;
  constructor(apiKey: string, repo: KnowledgeChunkRepository) {
    super(repo);
    this.client = new (require('openai'))({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  }
  async generateEmbedding(text: string) {
    const res = await this.client.embeddings.create({
      model: 'nomic-embed-text-v1_5',
      input: text,
    });
    return res.data[0].embedding;
  }
}
