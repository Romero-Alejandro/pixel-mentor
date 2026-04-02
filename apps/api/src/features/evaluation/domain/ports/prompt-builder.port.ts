/**
 * Prompt Builder Port
 *
 * Interface for building evaluation prompts.
 * Allows dependency injection of different prompt building strategies.
 */

/**
 * Template identifiers for evaluation prompts.
 */
export type EvaluationPromptTemplate = 'extract-concepts' | 'classify' | 'feedback';

/**
 * Flexible prompt values type that allows null/undefined.
 * Used for evaluation prompt construction.
 */
export type EvaluationPromptValues = Readonly<Record<string, string | null | undefined>>;

/**
 * Interface for building evaluation prompts.
 * Abstracts the prompt building logic from the evaluator service.
 */
export interface IPromptBuilderPort {
  /**
   * Builds the extract concepts prompt.
   *
   * @param questionText - The original question
   * @param studentAnswer - The student's answer
   * @param template - The user template to use
   * @param values - Additional values for the template
   * @returns The constructed prompt string
   */
  buildExtractConceptsPrompt(
    questionText: string,
    studentAnswer: string,
    template: string,
    values: EvaluationPromptValues,
  ): string;

  /**
   * Builds the classification prompt.
   *
   * @param template - The user template to use
   * @param values - Values for the template including all evaluation context
   * @param maxScore - Maximum score for the evaluation
   * @returns The constructed prompt string
   */
  buildClassifyPrompt(template: string, values: EvaluationPromptValues, maxScore: number): string;

  /**
   * Builds the feedback generation prompt.
   *
   * @param template - The user template to use
   * @param values - Values for the template including classification result
   * @param maxScore - Maximum score for the evaluation
   * @returns The constructed prompt string
   */
  buildFeedbackPrompt(template: string, values: EvaluationPromptValues, maxScore: number): string;
}
