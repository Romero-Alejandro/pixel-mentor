/**
 * Prompt Builder Adapter
 *
 * Implementation of IPromptBuilderPort that uses the existing
 * evaluation prompts infrastructure.
 */

import type {
  IPromptBuilderPort,
  EvaluationPromptValues,
} from '../../domain/ports/prompt-builder.port';
import {
  EXTRACT_CONCEPTS_USER_TEMPLATE,
  CLASSIFY_USER_TEMPLATE,
  GENERATE_FEEDBACK_USER_TEMPLATE,
  buildExtractConceptsPrompt,
  buildClassifyPrompt,
  buildFeedbackPrompt,
} from '../prompts/evaluation.prompts';

/**
 * Adapter that implements IPromptBuilderPort using the existing
 * evaluation prompts module.
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
    template: string,
    values: EvaluationPromptValues,
  ): string {
    return buildExtractConceptsPrompt(
      questionText,
      studentAnswer,
      template || EXTRACT_CONCEPTS_USER_TEMPLATE,
      values as Record<string, string>,
    );
  }

  /**
   * @inheritdoc
   */
  buildClassifyPrompt(template: string, values: EvaluationPromptValues, maxScore: number): string {
    return buildClassifyPrompt(
      template || CLASSIFY_USER_TEMPLATE,
      values as Record<string, string | null | undefined>,
      maxScore,
    );
  }

  /**
   * @inheritdoc
   */
  buildFeedbackPrompt(template: string, values: EvaluationPromptValues, maxScore: number): string {
    return buildFeedbackPrompt(
      template || GENERATE_FEEDBACK_USER_TEMPLATE,
      values as Record<string, string | null | undefined>,
      maxScore,
    );
  }
}

/**
 * Creates a new EvaluationPromptBuilderAdapter instance.
 */
export function createEvaluationPromptBuilder(): IPromptBuilderPort {
  return new EvaluationPromptBuilderAdapter();
}
