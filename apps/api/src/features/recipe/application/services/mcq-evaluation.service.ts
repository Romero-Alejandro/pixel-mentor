/**
 * MCQ Evaluation Service
 *
 * Pure, deterministic evaluation of multiple-choice question answers.
 * Extracted from OrchestrateRecipeUseCase to eliminate duplication across
 * interact() and interactStream() methods.
 *
 * This service does NOT call any LLM — it performs exact text matching
 * against the script's options, making it fast and predictable.
 */

import { createLogger } from '@/shared/logger/logger.js';

const mcqLogger = createLogger(undefined, { name: 'mcq-evaluation', level: 'info' });

// ---- Types ----

export interface ActivityOption {
  text: string;
  isCorrect: boolean;
}

export interface ActivityScript {
  instruction?: string;
  options?: ActivityOption[];
  feedback?: {
    correct: string;
    incorrect: string;
  };
}

export interface MCQEvaluationResult {
  /** Whether the student's answer matches the correct option */
  isCorrect: boolean;
  /** The feedback text to show the student */
  feedback: string;
  /** The text of the correct option (for showing the answer) */
  correctOptionText: string | undefined;
  /** The student's normalized input for logging */
  normalizedInput: string;
}

// ---- Evaluation ----

/**
 * Evaluates a student's answer against MCQ options using deterministic text matching.
 *
 * Comparison is case-insensitive and whitespace-trimmed.
 * Returns the evaluation result with feedback text.
 *
 * @param script - The activity script containing options and feedback
 * @param studentInput - The student's raw input text
 * @param context - Optional context for logging (step index, etc.)
 * @returns Evaluation result with isCorrect, feedback, and correctOptionText
 */
export function evaluateMCQ(
  script: ActivityScript,
  studentInput: string,
  context?: { stepIndex?: number; stateName?: string },
): MCQEvaluationResult {
  const normalizedInput = studentInput.trim().toLowerCase();
  const correctOption = script.options?.find((o) => o.isCorrect);
  const correctOptionText = correctOption?.text;

  const isCorrect = !!correctOption && normalizedInput === correctOption.text.trim().toLowerCase();

  const feedback = isCorrect
    ? (script.feedback?.correct ?? 'Correct!')
    : (script.feedback?.incorrect ?? 'Incorrect.');

  mcqLogger.info(
    {
      stepIndex: context?.stepIndex,
      state: context?.stateName,
      studentInput,
      normalizedInput,
      correctOption: correctOptionText,
      correctOptionNormalized: correctOptionText?.trim().toLowerCase(),
      isCorrect,
    },
    '[MCQ] Deterministic comparison result',
  );

  return {
    isCorrect,
    feedback,
    correctOptionText,
    normalizedInput,
  };
}

/**
 * Determines whether a step type represents an MCQ activity.
 * Accepts both lowercase and uppercase Prisma enum values.
 */
export function isMCQStepType(stepType?: string | null): boolean {
  if (!stepType) return false;
  const st = stepType.toUpperCase();
  return st === 'ACTIVITY' || st === 'EXAM';
}

/**
 * Determines whether a step type is a question (open-ended, not MCQ).
 */
export function isQuestionStepType(stepType?: string | null): boolean {
  if (!stepType) return false;
  return stepType.toUpperCase() === 'QUESTION';
}
