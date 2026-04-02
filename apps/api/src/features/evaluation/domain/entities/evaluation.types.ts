/**
 * Evaluation Types Module
 *
 * Contains types and interfaces for the pedagogical evaluation system.
 * Supports 6-category classification for better pedagogical intervention.
 */

// ============================================================
// Evaluation Outcome (6 Categories)
// ============================================================

/**
 * Extended evaluation outcomes for pedagogical classification.
 * Replaces the old 3-category system with more nuanced categorization.
 */
export const EVALUATION_OUTCOME = {
  /** Complete and accurate answer with proper terminology */
  CONCEPTUALLY_CORRECT: 'conceptually_correct',
  /** Correct idea but expressed simply or with analogies */
  INTUITIVE_CORRECT: 'intuitive_correct',
  /** Some correct ideas but incomplete */
  PARTIALLY_CORRECT: 'partially_correct',
  /** Related but doesn't directly answer the question */
  RELEVANT_BUT_INCOMPLETE: 'relevant_but_incomplete',
  /** Real misunderstanding of the concept */
  CONCEPTUAL_ERROR: 'conceptual_error',
  /** No response or unintelligible */
  NO_RESPONSE: 'no_response',
} as const;

export type EvaluationOutcome = (typeof EVALUATION_OUTCOME)[keyof typeof EVALUATION_OUTCOME];

// ============================================================
// Extracted Concepts
// ============================================================

/**
 * Represents concepts extracted from a student's answer.
 * Used for classification in step 2 of the evaluation flow.
 */
export interface ExtractedConcepts {
  /** Key ideas expressed by the student */
  readonly ideas: readonly string[];

  /** Complexity level of the student's language */
  readonly languageComplexity: 'simple' | 'moderate' | 'advanced';

  /** Whether the student used analogies or metaphors */
  readonly hasAnalogies: boolean;
}

// ============================================================
// Context Types
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

// ============================================================
// Result Types
// ============================================================

/**
 * Result of evaluating a student's answer.
 */
export interface EvaluationResult {
  /**
   * Classification of the answer quality using 6-category system.
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
