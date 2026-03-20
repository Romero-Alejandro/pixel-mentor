/**
 * Lesson Evaluator Module
 *
 * Provides rubric-based evaluation of student answers using LLM with:
 * - Safe prompt construction with XML delimiters
 * - Zod schema validation for LLM responses
 * - Configurable teacher rubric (keywords, central truth, exemplars)
 * - Graceful error handling with fallback responses
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
 *   studentAnswer: 'La fotosíntesis es el proceso por el cual...',
 *   questionText: '¿Qué es la fotosíntesis?',
 *   teacherConfig: {
 *     centralTruth: 'La fotosíntesis es el proceso...',
 *     requiredKeywords: ['clorofila', 'luz solar', 'dióxido de carbono'],
 *     maxScore: 10
 *   },
 *   lessonContext: {
 *     subject: 'Ciencias Naturales',
 *     gradeLevel: '6to grado',
 *     topic: 'Fotosíntesis'
 *   },
 *   studentProfile: {
 *     name: 'María',
 *     learningStyle: 'visual'
 *   }
 * });
 * ```
 */

import { z } from 'zod';

import type { ILLMClient, LLMExecutionOptions } from '@/llm/client.interface.js';
import type {
  ISafePromptBuilder,
  PromptValues,
} from '@/prompt/interfaces/safe-prompt-builder.interface.js';
import { SchemaValidationError } from '@/validation/schema.validator.js';
import type { ISchemaValidator } from '@/validation/schema.validator.js';

// ============================================================
// DTOs and Types
// ============================================================

/**
 * Context about the lesson being evaluated.
 */
export interface LessonContext {
  /** Subject matter (e.g., 'Ciencias Naturales', 'Matemáticas') */
  readonly subject: string;

  /** Educational grade level (e.g., '6to grado', 'Secundaria') */
  readonly gradeLevel: string;

  /** Specific topic within the subject (e.g., 'Fotosíntesis', 'Ecuaciones lineales') */
  readonly topic: string;
}

/**
 * Optional profile information about the student.
 */
export interface StudentProfile {
  /** Student's name for personalized feedback */
  readonly name?: string;

  /** Student's preferred learning style for adaptive feedback */
  readonly learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
}

/**
 * Teacher's rubric configuration for evaluation.
 */
export interface TeacherConfig {
  /**
   * The central truth or correct answer that defines the expected understanding.
   * Student answers should substantially match this to receive high scores.
   */
  readonly centralTruth: string;

  /**
   * Required keywords that must be present in the student's answer.
   * Case-insensitive matching. Partial matches count.
   */
  readonly requiredKeywords: readonly string[];

  /**
   * Optional exemplars showing correct, partial, and incorrect answers.
   * Used to calibrate the LLM's evaluation criteria.
   */
  readonly exemplars?: Readonly<{
    correct: string[];
    partial: string[];
    incorrect: string[];
  }>;

  /**
   * Maximum achievable score for this evaluation.
   * @default 10
   */
  readonly maxScore?: number;
}

/**
 * Criterion for rubric-based evaluation.
 * Supports extensible evaluation rules beyond simple keyword matching.
 */
export interface RubricCriterion {
  /** Unique identifier for the criterion */
  readonly id: string;

  /** Human-readable description of what this criterion evaluates */
  readonly description: string;

  /** Whether this criterion is mandatory for a correct answer */
  readonly required: boolean;

  /** Weight of this criterion in the final score (0-1) */
  readonly weight: number;
}

/**
 * Request for evaluating a student's answer.
 */
export interface EvaluationRequest {
  /** The student's submitted answer */
  readonly studentAnswer: string;

  /** The original question that was answered */
  readonly questionText: string;

  /** Teacher's rubric configuration for evaluation */
  readonly teacherConfig: TeacherConfig;

  /** Context about the lesson */
  readonly lessonContext: LessonContext;

  /** Optional student profile for adaptive feedback */
  readonly studentProfile?: StudentProfile;
}

/**
 * Evaluation outcome classification.
 */
export type EvaluationOutcome = 'correct' | 'partial' | 'incorrect';

/**
 * Result of evaluating a student's answer.
 */
export interface EvaluationResult {
  /**
   * Classification of the answer quality:
   * - 'correct': Answer meets all or most requirements
   * - 'partial': Answer shows understanding but misses key elements
   * - 'incorrect': Answer does not address the question or contains errors
   */
  readonly outcome: EvaluationOutcome;

  /**
   * Numeric score from 0 to maxScore (typically 10).
   * Represents the degree of correctness.
   */
  readonly score: number;

  /**
   * Constructive feedback for the student explaining the evaluation.
   * Always positive and encouraging, never empty.
   */
  readonly feedback: string;

  /**
   * Optional suggestion for how the student can improve their answer.
   */
  readonly improvementSuggestion?: string;

  /**
   * Confidence level of the evaluation (0-1).
   * Higher values indicate the evaluator is more certain about the evaluation.
   */
  readonly confidence: number;
}

// ============================================================
// Zod Schema for LLM Response Validation
// ============================================================

/**
 * Schema for validating LLM response structure.
 * Ensures the LLM returns a properly formatted evaluation.
 */
export const EvaluationResponseSchema = z.object({
  /**
   * The evaluation outcome classification.
   */
  outcome: z.enum(['correct', 'partial', 'incorrect']),

  /**
   * Numeric score from 0 to 10.
   */
  score: z.number().min(0).max(10),

  /**
   * Feedback message for the student.
   */
  feedback: z.string(),

  /**
   * Optional suggestion for improvement.
   */
  improvementSuggestion: z.string().optional(),

  /**
   * Confidence level (0-1) of the evaluation.
   */
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Type inferred from the evaluation response schema.
 */
export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;

// ============================================================
// Fallback Response
// ============================================================

/**
 * Safe fallback result when LLM evaluation fails.
 * Always returns encouraging feedback to maintain student motivation.
 */
const FALLBACK_RESULT: EvaluationResult = {
  outcome: 'incorrect',
  score: 0,
  feedback:
    '¡Sigue intentando! Cada respuesta es una oportunidad de aprendizaje. Revisa la pregunta e intenta novamente.',
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
// Prompt Template (Spanish)
// ============================================================

/**
 * System prompt for the evaluation LLM.
 * Instructs the LLM to evaluate conceptually, not just keyword matching.
 */
const EVALUATION_SYSTEM_PROMPT = `Eres un evaluador pedagógico experto. Tu tarea es evaluar las respuestas de estudiantes de manera justa, constructiva y motivadora.

INSTRUCCIONES DE EVALUACIÓN:
1. Evalúa la respuesta del estudiante CONCEPTUALMENTE, no solo por palabras clave
2. Busca la comprensión real del tema, no la memorización
3. Considera el contexto educativo (nivel, materia, tema)
4. Proporciona retroalimentación POSITIVA y CONSTRUCTIVA
5. Si la respuesta tiene errores, sé amable y ofrece sugerencias útiles

CRITERIOS DE CALIFICACIÓN:
- 'correct': La respuesta demuestra comprensión del concepto
- 'partial': La respuesta muestra ideas relacionadas pero incomplete
- 'incorrect': La respuesta no aborda la pregunta o contiene conceptos erróneos

IMPORTANTE:
- La puntuación maxima es 10 puntos
- Nunca digas que la respuesta está "completamente equivocada"
- Siempre ofrece al menos una observación positiva
- Si hay errores conceptuales, explica gentilmente el concepto correcto`;

/**
 * User prompt template for evaluation.
 * Uses safe XML delimiters for untrusted student input.
 */
const EVALUATION_USER_TEMPLATE = `PREGUNTA:
{{questionText}}

RESPUESTA DEL ESTUDIANTE:
{{studentAnswer}}

CONTEXTO DE LA LECCIÓN:
- Materia: {{subject}}
- Nivel: {{gradeLevel}}
- Tema: {{tema}}

RÚBRICA DEL DOCENTE:
Verdad Central: {{centralTruth}}
{{#if requiredKeywords}}
Palabras Clave Requeridas: {{requiredKeywords}}
{{/if}}
{{exemplarsSection}}
{{#if studentName}}
NOMBRE DEL ESTUDIANTE: {{studentName}}
{{/if}}

INSTRUCCIONES ESPECÍFICAS:
- Evalúa si la respuesta captura la verdad central de manera conceptual
- Verifica la presencia de las palabras clave requeridas (si se especificaron)
- Considera el nivel educativo del estudiante
- Usa los ejemplos como referencia para calibrar tu evaluación

RESPUESTA EN FORMATO JSON:
Devuelve SOLO un objeto JSON válido con esta estructura exacta:
{
  "outcome": "correct" | "partial" | "incorrect",
  "score": número_del_0_al_10,
  "feedback": "retroalimentación constructiva y positiva",
  "improvementSuggestion": "sugerencia opcional de mejora",
  "confidence": número_del_0_al_1
}`;

// ============================================================
// Lesson Evaluator Use Case
// ============================================================

/**
 * LessonEvaluatorUseCase
 *
 * Orchestrates the evaluation of student answers using LLM with rubric-based scoring.
 *
 * Design principles:
 * - Single Responsibility: only orchestrates evaluation flow, delegates prompt building and validation
 * - Open/Closed: rubric logic can be extended via custom implementations
 * - Dependency Inversion: depends on abstractions (interfaces), not concrete implementations
 *
 * @example
 * ```typescript
 * // With dependency injection
 * const evaluator = new LessonEvaluatorUseCase(
 *   llmClient,           // ILLMClient
 *   promptBuilder,       // ISafePromptBuilder
 *   schemaValidator      // ISchemaValidator<EvaluationResponse>
 * );
 *
 * const result = await evaluator.evaluate(request);
 * ```
 */
export class LessonEvaluatorUseCase {
  /**
   * Execution options for LLM calls with retry logic.
   */
  private readonly defaultExecutionOptions: Required<LLMExecutionOptions> = {
    maxAttempts: 3,
    timeoutMs: 10000,
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
    private readonly promptBuilder: ISafePromptBuilder,
    private readonly schemaValidator: ISchemaValidator<EvaluationResponse>,
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
   * Evaluates a student's answer against the teacher's rubric.
   *
   * Process:
   * 1. Builds safe prompt with rubric configuration
   * 2. Executes LLM call with retry logic
   * 3. Validates LLM response against Zod schema
   * 4. Applies rubric adjustments (keywords, central truth)
   * 5. Returns structured evaluation result
   *
   * @param request - The evaluation request containing student answer and rubric
   * @returns Promise resolving to the evaluation result
   *
   * @example
   * ```typescript
   * const result = await evaluator.evaluate({
   *   studentAnswer: 'La fotosíntesis usa luz solar...',
   *   questionText: '¿Qué es la fotosíntesis?',
   *   teacherConfig: {
   *     centralTruth: 'La fotosíntesis es...',
   *     requiredKeywords: ['clorofila', 'luz'],
   *   },
   *   lessonContext: {
   *     subject: 'Ciencias',
   *     gradeLevel: '6to',
   *     topic: 'Plantas'
   *   }
   * });
   *
   * console.log(result.outcome); // 'correct' | 'partial' | 'incorrect'
   * console.log(result.score);    // 0-10
   * console.log(result.feedback); // Feedback message
   * ```
   */
  async evaluate(request: EvaluationRequest): Promise<EvaluationResult> {
    try {
      // Step 1: Build the safe prompt
      const prompt = this.buildEvaluationPrompt(request);

      // Step 2: Execute LLM call with retry
      const rawResponse = await this.executeWithRetry(prompt);

      // Step 3: Validate and parse the response
      const validatedResponse = this.validateAndParseResponse(rawResponse);

      // Step 4: Apply rubric adjustments
      const adjustedResult = this.applyRubricAdjustments(validatedResponse, request);

      // Step 5: Ensure positive feedback
      return this.ensurePositiveFeedback(adjustedResult);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Builds a safe evaluation prompt from the request.
   *
   * @param request - The evaluation request
   * @returns The constructed prompt string
   */
  private buildEvaluationPrompt(request: EvaluationRequest): string {
    const { studentAnswer, questionText, teacherConfig, lessonContext, studentProfile } = request;
    const maxScore = teacherConfig.maxScore ?? 10;

    // Format required keywords as comma-separated string
    const keywordsStr =
      teacherConfig.requiredKeywords.length > 0
        ? teacherConfig.requiredKeywords.join(', ')
        : 'Ninguna específica';

    // Pre-process exemplars into formatted markdown sections
    const exemplarsSection = this.buildExemplarsSection(teacherConfig.exemplars);

    // Build base values for the template
    const baseValues: PromptValues = {
      questionText: questionText,
      studentAnswer: studentAnswer,
      subject: lessonContext.subject,
      gradeLevel: lessonContext.gradeLevel,
      tema: lessonContext.topic,
      centralTruth: teacherConfig.centralTruth,
      requiredKeywords: keywordsStr,
      maxScore: String(maxScore),
      studentName: studentProfile?.name ?? '',
      exemplarsSection: exemplarsSection,
    };

    // Handle exemplars if present - create extended values
    const values: PromptValues = baseValues;

    // Build the full prompt with system and user messages
    const userPrompt = this.promptBuilder
      .setTemplate(EVALUATION_USER_TEMPLATE)
      .setValues(values)
      .build();

    return `${EVALUATION_SYSTEM_PROMPT}\n\n${userPrompt}`;
  }

  /**
   * Builds the exemplars section for the prompt.
   * Pre-processes exemplars arrays into formatted markdown strings.
   *
   * @param exemplars - The exemplars from teacher config
   * @returns Formatted markdown section, or empty string if no exemplars
   */
  private buildExemplarsSection(
    exemplars?: Readonly<{
      correct?: readonly string[];
      partial?: readonly string[];
      incorrect?: readonly string[];
    }>,
  ): string {
    if (!exemplars) {
      return '';
    }

    const sections: string[] = [];

    // Build correct exemplars section
    if (exemplars.correct && exemplars.correct.length > 0) {
      const correctFormatted = exemplars.correct.map((item) => `- ${item}`).join('\n');
      sections.push(
        `### Ejemplos de Respuestas

#### Respuestas Correctas
${correctFormatted}`,
      );
    }

    // Build partial exemplars section
    if (exemplars.partial && exemplars.partial.length > 0) {
      const partialFormatted = exemplars.partial.map((item) => `- ${item}`).join('\n');
      sections.push(`#### Respuestas Parciales
${partialFormatted}`);
    }

    // Build incorrect exemplars section
    if (exemplars.incorrect && exemplars.incorrect.length > 0) {
      const incorrectFormatted = exemplars.incorrect.map((item) => `- ${item}`).join('\n');
      sections.push(`#### Respuestas Incorrectas
${incorrectFormatted}`);
    }

    // If no sections were built, return empty string
    if (sections.length === 0) {
      return '';
    }

    return `\n${sections.join('\n\n')}\n`;
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
   * Validates and parses the LLM response against the schema.
   *
   * @param rawResponse - Raw text response from LLM
   * @returns Validated evaluation response
   * @throws {Error} When validation fails
   */
  private validateAndParseResponse(rawResponse: string): EvaluationResponse {
    try {
      return this.schemaValidator.validate(rawResponse, EvaluationResponseSchema);
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new Error(
        `Failed to validate LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Applies rubric-based adjustments to the evaluation.
   *
   * Logic:
   * - Check required keywords presence (case-insensitive)
   * - Check central truth match (case-insensitive, trimmed)
   * - Adjust outcome, score, and confidence based on rubric rules
   *
   * @param response - The validated LLM response
   * @param request - The original evaluation request
   * @returns Adjusted evaluation result
   */
  private applyRubricAdjustments(
    response: EvaluationResponse,
    request: EvaluationRequest,
  ): EvaluationResult {
    const { teacherConfig, studentAnswer } = request;
    const normalizedAnswer = studentAnswer.toLowerCase().trim();

    // Check keyword presence
    const keywordMatches = this.countKeywordMatches(
      teacherConfig.requiredKeywords,
      normalizedAnswer,
    );
    const keywordRatio =
      teacherConfig.requiredKeywords.length > 0
        ? keywordMatches / teacherConfig.requiredKeywords.length
        : 1;

    // Check central truth match
    const truthMatchRatio = this.calculateTruthMatch(teacherConfig.centralTruth, normalizedAnswer);

    // Calculate adjusted score based on rubric rules
    const maxScore = teacherConfig.maxScore ?? 10;
    let adjustedScore = response.score;

    // Apply keyword penalty (reduce score if key keywords missing)
    if (keywordRatio < 1 && teacherConfig.requiredKeywords.length > 0) {
      const keywordPenalty = (1 - keywordRatio) * 3; // Up to 3 point penalty
      adjustedScore = Math.max(0, adjustedScore - keywordPenalty);
    }

    // Adjust based on truth match
    if (truthMatchRatio < 0.3 && response.outcome === 'correct') {
      // Override if LLM marked correct but answer doesn't match truth
      return {
        ...response,
        score: Math.min(adjustedScore, maxScore * 0.5),
        outcome: 'partial',
        confidence: Math.min(response.confidence ?? 0.8, 0.7),
      };
    }

    // Calculate confidence adjustment
    const confidenceAdjustment = Math.min(keywordRatio, truthMatchRatio);
    const adjustedConfidence = Math.min(
      (response.confidence ?? 0.8) * confidenceAdjustment + 0.2,
      1,
    );

    // Adjust outcome based on combined rubric score
    let adjustedOutcome = response.outcome;
    const combinedScore = adjustedScore / maxScore;

    if (combinedScore >= 0.8 && keywordRatio >= 0.7 && truthMatchRatio >= 0.5) {
      adjustedOutcome = 'correct';
    } else if (combinedScore >= 0.4 || keywordRatio >= 0.5 || truthMatchRatio >= 0.3) {
      adjustedOutcome = 'partial';
    } else {
      adjustedOutcome = 'incorrect';
    }

    return {
      outcome: adjustedOutcome,
      score: Math.round(adjustedScore * 10) / 10, // Round to 1 decimal
      feedback: response.feedback,
      improvementSuggestion: response.improvementSuggestion,
      confidence: Math.round(adjustedConfidence * 100) / 100, // Round to 2 decimals
    };
  }

  /**
   * Counts how many required keywords are present in the answer.
   *
   * @param keywords - Required keywords to check
   * @param answer - Normalized student answer
   * @returns Number of matching keywords
   */
  private countKeywordMatches(keywords: readonly string[], answer: string): number {
    let matches = 0;
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      if (answer.includes(normalizedKeyword)) {
        matches++;
      }
    }
    return matches;
  }

  /**
   * Calculates how well the answer matches the central truth.
   *
   * Uses simple word overlap ratio as a heuristic.
   * In production, this could use embeddings or more sophisticated matching.
   *
   * @param centralTruth - The expected correct answer
   * @param answer - Normalized student answer
   * @returns Match ratio from 0 to 1
   */
  private calculateTruthMatch(centralTruth: string, answer: string): number {
    // Extract key words from central truth (words longer than 4 characters)
    const truthWords = centralTruth
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4 && !this.isStopWord(word));

    if (truthWords.length === 0) {
      return 0.5; // Default if no significant words
    }

    // Count matching words
    let matchCount = 0;
    for (const word of truthWords) {
      if (answer.includes(word)) {
        matchCount++;
      }
    }

    return matchCount / truthWords.length;
  }

  /**
   * Checks if a word is a common Spanish stop word.
   *
   * @param word - Word to check
   * @returns True if the word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'que',
      'del',
      'los',
      'las',
      'para',
      'con',
      'por',
      'una',
      'uno',
      'este',
      'esta',
      'como',
      'pero',
      'más',
      'muy',
      'sobre',
      'entre',
      'cuando',
      'donde',
      'porque',
      'aunque',
      'también',
      'puede',
      'ser',
      'está',
      'hay',
      'hace',
      'hacer',
      'tiene',
      'tener',
      'esto',
      'estos',
      'estas',
      'ese',
      'esa',
      'esos',
      'esas',
    ]);
    return stopWords.has(word);
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
