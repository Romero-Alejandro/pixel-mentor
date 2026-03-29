/**
 * Lesson Evaluator Module
 *
 * Provides pedagogical evaluation of student answers using a 3-step LLM flow:
 * 1. Extract Concepts - Analyze student's answer to extract key ideas
 * 2. Classify - Classify into 6 pedagogical categories based on extracted concepts
 * 3. Generate Feedback - Produce positive, child-friendly feedback
 *
 * Key improvements over previous version:
 * - No rigid keyword penalties (conceptual evaluation only)
 * - 6-category classification (vs 3)
 * - Coherent feedback (always matches classification)
 * - Adapted for children's language and level
 *
 * @example
 * ```typescript
 * const evaluator = new LessonEvaluatorUseCase(
 *   llmClient,
 *   new SafePromptBuilder(),
 *   new SchemaValidator()
 * );
 *
 * const result = await evaluator.evaluate({
 *   studentAnswer: 'Las plantas usan el sol para comer',
 *   questionText: '¿Qué es la fotosíntesis?',
 *   teacherConfig: {
 *     centralTruth: 'La fotosíntesis es el proceso...',
 *     requiredKeywords: ['clorofila', 'luz solar'],
 *     maxScore: 10
 *   },
 *   lessonContext: {
 *     subject: 'Ciencias Naturales',
 *     gradeLevel: '3er grado',
 *     topic: 'Fotosíntesis'
 *   },
 *   studentProfile: {
 *     name: 'María'
 *   }
 * });
 *
 * console.log(result.outcome); // 'intuitive_correct'
 * console.log(result.score);    // 8
 * console.log(result.feedback); // '¡Muy bien! Has entendido...'
 * ```
 */

import { z } from 'zod';

import { EVALUATION_OUTCOME, type EvaluationResult, type EvaluationRequest } from './types';

import type { ILLMClient, LLMExecutionOptions } from '@/llm/client.interface';
import type {
  ISafePromptBuilder,
  PromptValues,
} from '@/prompt/interfaces/safe-prompt-builder.interface';
import { SchemaValidationError } from '@/validation/schema.validator';
import type { ISchemaValidator } from '@/validation/schema.validator';

import {
  EXTRACT_CONCEPTS_USER_TEMPLATE,
  CLASSIFY_USER_TEMPLATE,
  GENERATE_FEEDBACK_USER_TEMPLATE,
  buildExtractConceptsPrompt,
  buildClassifyPrompt,
  buildFeedbackPrompt,
} from './prompts';
import {
  ExtractConceptsResponseSchema,
  ClassificationResponseSchema,
  FeedbackResponseSchema,
  type ExtractConceptsResponse,
  type ClassificationResponse,
  type FeedbackResponse,
} from './schemas';

// Re-export types for external use
export type {
  EvaluationOutcome,
  ExtractedConcepts,
  LessonContext,
  StudentProfile,
  TeacherConfig,
  EvaluationRequest,
  EvaluationResult,
} from './types';

// ============================================================
// Fallback Response
// ============================================================

/**
 * Safe fallback result when LLM evaluation fails.
 * Always returns encouraging feedback to maintain student motivation.
 */
const FALLBACK_RESULT: EvaluationResult = {
  outcome: EVALUATION_OUTCOME.NO_RESPONSE,
  score: 0,
  feedback:
    '¡Sigue intentando! Cada respuesta es una oportunidad de aprendizaje. Revisa la pregunta e intenta nuevamente.',
  confidence: 0,
};

/**
 * Fallback feedback messages for positive encouragement.
 */
const ENCOURAGING_MESSAGES: readonly string[] = [
  '¡Buen esfuerzo! Sigue practicando y mejorarás cada vez más.',
  '¡Sigue adelante! El aprendizaje es un viaje y estás en el camino correcto.',
  '¡Excelente trabajo! Estás aprendiendo mucho.',
  '¡Muy bien! Cada intento te acerca más a dominar el tema.',
];

// ============================================================
// Lesson Evaluator Use Case
// ============================================================

/**
 * LessonEvaluatorUseCase
 *
 * Orchestrates the 3-step pedagogical evaluation of student answers.
 *
 * Design principles:
 * - Single Responsibility: orchestrates only the flow, delegates prompt building and validation
 * - Open/Closed: new classification categories can be added via schemas
 * - Dependency Inversion: depends on abstractions (interfaces), not concrete implementations
 */
export class LessonEvaluatorUseCase {
  /**
   * Execution options for LLM calls with retry logic.
   */
  private readonly defaultExecutionOptions: Required<LLMExecutionOptions> = {
    maxAttempts: 3,
    timeoutMs: 15000, // Increased timeout for 3-step flow
    backoffStrategy: 'exponential',
    backoffFactor: 2,
  };

  /**
   * Creates a new LessonEvaluatorUseCase instance.
   *
   * @param llmClient - LLM client for executing evaluation prompts
   * @param promptBuilder - Safe prompt builder with delimiter escaping
   * @param schemaValidator - Zod schema validator for LLM responses
   */
  constructor(
    private readonly llmClient: ILLMClient,
    promptBuilder: ISafePromptBuilder,
    private readonly schemaValidator: ISchemaValidator<unknown>,
  ) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    if (!promptBuilder) {
      throw new Error('Prompt builder is required');
    }
    if (!schemaValidator) {
      throw new Error('Schema validator is required');
    }
  }

  /**
   * Evaluates a student's answer using the 3-step pedagogical flow.
   *
   * Process:
   * 1. Normalize input (clean text, handle children's language)
   * 2. Extract concepts from student's answer (LLM)
   * 3. Classify based on extracted concepts (LLM)
   * 4. Generate coherent feedback (LLM)
   * 5. Return structured evaluation result
   *
   * @param request - The evaluation request containing student answer and rubric
   * @returns Promise resolving to the evaluation result
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    try {
      // Step 1: Normalize input
      const normalizedAnswer = this.normalizeInput(request.studentAnswer);

      // Step 2: Extract concepts (LLM Step 1)
      const extractedConcepts = await this.extractConcepts(request.questionText, normalizedAnswer);

      // Step 3: Classify response (LLM Step 2)
      const classification = await this.classifyResponse(request, extractedConcepts);

      // Step 4: Generate feedback (LLM Step 3)
      const feedbackResult = await this.generateFeedback(request, classification);

      // Step 5: Ensure positive feedback
      return this.ensurePositiveFeedback({
        outcome: classification.outcome,
        score: classification.score,
        feedback: feedbackResult.feedback,
        improvementSuggestion: classification.improvementSuggestion,
        confidence: classification.confidence ?? 0.8,
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Normalizes the student's input for processing.
   * Handles common children's writing patterns without penalizing.
   *
   * @param input - Raw student answer
   * @returns Normalized answer
   */
  private normalizeInput(input: string): string {
    // Basic normalization: trim and remove excessive whitespace
    return input.trim().replace(/\s+/g, ' ');
  }

  /**
   * Step 1: Extract concepts from the student's answer.
   * Uses LLM to understand the ideas expressed, regardless of terminology.
   *
   * @param questionText - The original question
   * @param studentAnswer - The student's answer
   * @returns Extracted concepts
   */
  private async extractConcepts(
    questionText: string,
    studentAnswer: string,
  ): Promise<ExtractConceptsResponse> {
    const prompt = buildExtractConceptsPrompt(
      questionText,
      studentAnswer,
      EXTRACT_CONCEPTS_USER_TEMPLATE,
      {},
    );

    const rawResponse = await this.executeWithRetry(prompt);
    return this.validateSchema(rawResponse, ExtractConceptsResponseSchema);
  }

  /**
   * Step 2: Classify the response using the 6-category pedagogical system.
   * Uses the extracted concepts and teacher rubric for classification.
   *
   * @param request - The original evaluation request
   * @param concepts - Extracted concepts from step 1
   * @returns Classification result
   */
  private async classifyResponse(
    request: EvaluationRequest,
    concepts: ExtractConceptsResponse,
  ): Promise<ClassificationResponse> {
    const { teacherConfig, questionText, lessonContext, studentProfile } = request;
    const maxScore = teacherConfig.maxScore ?? 10;

    // Build concepts string for the prompt
    const conceptsStr = concepts.ideas.join('; ');

    // Pre-process exemplars
    const exemplarsSection = this.buildExemplarsSection(teacherConfig.exemplars);

    const values: PromptValues = {
      questionText: questionText,
      studentAnswer: request.studentAnswer,
      subject: lessonContext.subject,
      gradeLevel: lessonContext.gradeLevel,
      topic: lessonContext.topic,
      centralTruth: teacherConfig.centralTruth,
      requiredKeywords:
        teacherConfig.requiredKeywords.length > 0
          ? teacherConfig.requiredKeywords.join(', ')
          : 'Ninguna específica',
      extractedConcepts: conceptsStr,
      exemplarsSection: exemplarsSection,
      studentName: studentProfile?.name ?? 'Estudiante',
      maxScore: String(maxScore),
    };

    const prompt = buildClassifyPrompt(CLASSIFY_USER_TEMPLATE, values, maxScore);

    const rawResponse = await this.executeWithRetry(prompt);
    return this.validateSchema(rawResponse, ClassificationResponseSchema);
  }

  /**
   * Step 3: Generate pedagogical feedback based on classification.
   * Ensures feedback is always positive and matches the classification.
   *
   * @param request - The original evaluation request
   * @param classification - The classification from step 2
   * @returns Generated feedback
   */
  private async generateFeedback(
    request: EvaluationRequest,
    classification: ClassificationResponse,
  ): Promise<FeedbackResponse> {
    const maxScore = request.teacherConfig.maxScore ?? 10;

    const values: PromptValues = {
      questionText: request.questionText,
      studentAnswer: request.studentAnswer,
      outcome: classification.outcome,
      score: String(classification.score),
      maxScore: String(maxScore),
      justification: classification.justification,
      studentName: request.studentProfile?.name ?? 'Estudiante',
    };

    const prompt = buildFeedbackPrompt(GENERATE_FEEDBACK_USER_TEMPLATE, values, maxScore);

    const rawResponse = await this.executeWithRetry(prompt);
    return this.validateSchema(rawResponse, FeedbackResponseSchema);
  }

  /**
   * Builds the exemplars section for the classification prompt.
   *
   * @param exemplars - The exemplars from teacher config
   * @returns Formatted markdown section
   */
  private buildExemplarsSection(
    exemplars?: Readonly<{
      correct?: readonly string[];
      partial?: readonly string[];
      incorrect?: readonly string[];
    }>,
  ): string {
    if (!exemplars) {
      return 'Sin ejemplos disponibles';
    }

    const sections: string[] = [];

    if (exemplars.correct && exemplars.correct.length > 0) {
      sections.push(`Correctas:\n${exemplars.correct.map((i) => `- ${i}`).join('\n')}`);
    }
    if (exemplars.partial && exemplars.partial.length > 0) {
      sections.push(`Parciales:\n${exemplars.partial.map((i) => `- ${i}`).join('\n')}`);
    }
    if (exemplars.incorrect && exemplars.incorrect.length > 0) {
      sections.push(`Incorrectas:\n${exemplars.incorrect.map((i) => `- ${i}`).join('\n')}`);
    }

    return sections.length > 0 ? sections.join('\n\n') : 'Sin ejemplos disponibles';
  }

  /**
   * Executes the LLM call with retry logic.
   *
   * @param prompt - The prompt to execute
   * @returns The raw LLM response text
   */
  private async executeWithRetry(prompt: string): Promise<string> {
    return this.llmClient.executePrompt(prompt, this.defaultExecutionOptions);
  }

  /**
   * Validates and parses the LLM response against a Zod schema.
   *
   * @param rawResponse - Raw text response from LLM
   * @param schema - Zod schema to validate against
   * @returns Validated response
   * @throws {Error} When validation fails
   */
  private validateSchema<T>(rawResponse: string, schema: z.ZodSchema<T>): T {
    try {
      return this.schemaValidator.validate(rawResponse, schema) as T;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw error;
      }
      throw new Error(
        `Failed to validate LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Ensures the feedback is always positive and non-empty.
   *
   * @param result - The evaluation result to check
   * @returns Result with guaranteed positive feedback
   */
  private ensurePositiveFeedback(result: EvaluationResult): EvaluationResult {
    let { feedback } = result;

    // Ensure feedback is not empty
    if (!feedback || feedback.trim() === '') {
      feedback = this.getRandomEncouragement();
    }

    // Ensure feedback starts positively
    const positiveStarters = ['¡', 'Bien', 'Buen', 'Excelente', 'Muy bien', 'Genial', 'Sigue'];
    const startsPositive = positiveStarters.some((starter) => feedback.startsWith(starter));

    if (!startsPositive) {
      feedback = `¡Buen esfuerzo! ${feedback}`;
    }

    return {
      ...result,
      feedback,
    };
  }

  /**
   * Gets a random encouraging message.
   *
   * @returns A random positive message
   */
  private getRandomEncouragement(): string {
    const index = Math.floor(Math.random() * ENCOURAGING_MESSAGES.length);
    return ENCOURAGING_MESSAGES[index];
  }

  /**
   * Handles errors gracefully, returning a safe fallback result.
   *
   * @param error - The error that occurred
   * @returns Safe fallback evaluation result
   */
  private handleError(error: unknown): EvaluationResult {
    // Log the error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during evaluation';

    // In production, this would log to a proper logging system
    console.error('Evaluation error:', errorMessage);

    // Return encouraging fallback
    return {
      ...FALLBACK_RESULT,
      feedback: `¡Sigue intentando! Hubo un pequeño problema al evaluar, pero no te preocupes: ${this.getRandomEncouragement()}`,
    };
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Creates a new LessonEvaluatorUseCase with default implementations.
 *
 * @param llmClient - LLM client for evaluation
 * @returns Configured LessonEvaluatorUseCase instance
 *
 * @example
 * ```typescript
 * const evaluator = createLessonEvaluator(llmClient);
 * ```
 */
export function createLessonEvaluator(llmClient: ILLMClient): LessonEvaluatorUseCase {
  // Note: This factory uses dynamic imports to avoid circular dependencies
  // In production, prefer dependency injection via the container
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SafePromptBuilder } = require('@/prompt/safe-prompt-builder');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SchemaValidator } = require('@/validation/schema-validator');

  return new LessonEvaluatorUseCase(llmClient, new SafePromptBuilder(), new SchemaValidator());
}
