import type { AIService } from '@/features/recipe/domain/ports/ai-service.port.js';

import { LessonEvaluatorUseCase } from '@/features/evaluation/application/services/lesson.evaluator.js';
import { LLMClientAdapter } from '@/shared/ai/llm-client.adapter.js';
import { SafePromptBuilder } from '@/features/prompt/application/services/safe-prompt-builder.service.js';
import { SchemaValidator } from '@/features/prompt/infrastructure/persistence/schema-validator.js';

export interface EvaluationContainer {
  lessonEvaluator: LessonEvaluatorUseCase;
}

export function buildEvaluationContainer(aiModel: AIService): EvaluationContainer {
  const safePromptBuilder = new SafePromptBuilder();
  const schemaValidator = new SchemaValidator();

  const lessonEvaluator = new LessonEvaluatorUseCase(
    new LLMClientAdapter(aiModel),
    safePromptBuilder,
    schemaValidator,
  );

  return { lessonEvaluator };
}
