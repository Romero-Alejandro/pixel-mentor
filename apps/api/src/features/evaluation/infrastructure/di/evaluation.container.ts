import type pino from 'pino';
import type { Config } from '@/shared/config/index.js';

import { AIAdapterFactory } from '@/shared/ai/ai-adapter-factory.js';
import { LessonEvaluatorUseCase } from '@/features/evaluation/application/services/lesson.evaluator.js';
import { LLMClientAdapter } from '@/shared/ai/llm-client.adapter.js';
import { SafePromptBuilder } from '@/features/prompt/application/services/safe-prompt-builder.service.js';
import { SchemaValidator } from '@/features/prompt/infrastructure/persistence/schema-validator.js';

export interface EvaluationContainer {
  lessonEvaluator: LessonEvaluatorUseCase;
}

export function buildEvaluationContainer(config: Config, logger: pino.Logger): EvaluationContainer {
  const aiProvider = AIAdapterFactory.createResilient({
    provider: config.LLM_PROVIDER,
    geminiApiKey: config.GEMINI_API_KEY,
    openRouterApiKey: config.OPENROUTER_API_KEY,
    groqApiKey: config.GROQ_API_KEY,
    defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
    defaultModelGemini: config.DEFAULT_MODEL_GEMINI,
    defaultModelGroq: config.DEFAULT_MODEL_GROQ,
    promptRepo: null as any,
    knowledgeChunkRepository: null as any,
    logger,
  });

  const safePromptBuilder = new SafePromptBuilder();
  const schemaValidator = new SchemaValidator();

  const lessonEvaluator = new LessonEvaluatorUseCase(
    new LLMClientAdapter(aiProvider.aiModel),
    safePromptBuilder,
    schemaValidator,
  );

  return { lessonEvaluator };
}