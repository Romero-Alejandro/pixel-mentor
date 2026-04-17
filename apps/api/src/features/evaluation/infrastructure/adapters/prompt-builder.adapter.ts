/**
 * Prompt Builder Adapter
 *
 * Implementation of IPromptBuilderPort that uses the new
 * EvaluationPromptRepository with SafePromptBuilder security.
 */

import type {
  IPromptBuilderPort,
  EvaluationPromptValues,
} from '../../domain/ports/prompt-builder.port';
import { getEvaluationPromptRepository } from '../prompts/evaluation-prompt-repository';
import type { PromptValues } from '@/features/prompt/domain/ports/safe-prompt-builder.interface';

/**
 * Adapter that implements IPromptBuilderPort using the new
 * EvaluationPromptRepository with security pipeline.
 */
export class EvaluationPromptBuilderAdapter implements IPromptBuilderPort {
  /**
   * Creates a new EvaluationPromptBuilderAdapter instance.
   */
  constructor() {}

  /**
   * @inheritdoc
   */
  buildExtractConceptsPrompt(
    questionText: string,
    studentAnswer: string,
    _template: string,
    values: EvaluationPromptValues,
  ): string {
    const repo = getEvaluationPromptRepository();
    const promptValues: PromptValues = {
      questionText: questionText,
      studentAnswer: studentAnswer,
      ...(values as PromptValues),
    };

    return repo.buildExtractConceptsPrompt(promptValues);
  }

  /**
   * @inheritdoc
   */
  buildClassifyPrompt(_template: string, values: EvaluationPromptValues, maxScore: number): string {
    const repo = getEvaluationPromptRepository();
    const promptValues: PromptValues = {
      ...(values as PromptValues),
    };

    return repo.buildClassifyPrompt(promptValues, maxScore);
  }

  /**
   * @inheritdoc
   */
  buildFeedbackPrompt(_template: string, values: EvaluationPromptValues, maxScore: number): string {
    const repo = getEvaluationPromptRepository();
    const promptValues: PromptValues = {
      ...(values as PromptValues),
      maxScore: String(maxScore),
    };

    return repo.buildFeedbackPrompt(promptValues);
  }
}

/**
 * Creates a new EvaluationPromptBuilderAdapter instance.
 */
export function createEvaluationPromptBuilder(): IPromptBuilderPort {
  return new EvaluationPromptBuilderAdapter();
}
