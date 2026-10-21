/**
 * MCQ Evaluation Service
 *
 * Pure, deterministic evaluation of multiple-choice question answers.
 * Extracted from OrchestrateRecipeUseCase to eliminate duplication across
 * interact() and interactStream() methods.
 *
 * This service does NOT call any LLM — it performs exact matching
 * against the script's options, making it fast and predictable.
 *
 * Fase 0: answers are graded by option id first (authoritative), falling back
 * to positional ids (`opt-<index>` for legacy content) and finally to the
 * legacy exact text match (voice/free-text answers). This removes the old
 * fragility where two options with similar text could break grading.
 */

import { createLogger } from '@/shared/logger/logger.js';

const mcqLogger = createLogger(undefined, { name: 'mcq-evaluation', level: 'info' });

// ---- Types ----

export interface ActivityOption {
  /** Stable option id (Fase 0 content). Absent in legacy scripts. */
  id?: string;
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
  /** The id of the correct option, when resolvable */
  correctOptionId: string | undefined;
  /** The id of the option the student selected, when resolvable */
  selectedOptionId: string | undefined;
  /** The student's normalized input for logging */
  normalizedInput: string;
}

// ---- Evaluation ----

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolves the selected option: by explicit id, then by the positional id
 * (`opt-<index>`) synthesized for legacy content, then falls back to text.
 */
function resolveSelectedOption(
  options: readonly ActivityOption[],
  optionId: string | undefined,
  normalizedInput: string,
): { selected: ActivityOption | undefined; byId: boolean } {
  if (optionId) {
    const byId = options.find((o) => o.id !== undefined && o.id === optionId);
    if (byId) return { selected: byId, byId: true };

    const positional = /^opt-(\d+)$/.exec(optionId);
    if (positional) {
      const index = Number(positional[1]);
      const byIndex = Number.isInteger(index) && index >= 0 ? options[index] : undefined;
      if (byIndex) return { selected: byIndex, byId: true };
    }
  }
  const byText = options.find((o) => normalize(o.text) === normalizedInput);
  return { selected: byText, byId: false };
}

/**
 * Evaluates a student's answer against MCQ options using deterministic matching.
 *
 * @param script - The activity script containing options and feedback
 * @param studentInput - The student's raw input text
 * @param context - Optional context (step index, state name, selected option id)
 * @returns Evaluation result with isCorrect, feedback, and correct option data
 */
export function evaluateMCQ(
  script: ActivityScript,
  studentInput: string,
  context?: { stepIndex?: number; stateName?: string; optionId?: string },
): MCQEvaluationResult {
  const normalizedInput = studentInput.trim().toLowerCase();
  const options = script.options ?? [];

  const { selected, byId } = resolveSelectedOption(options, context?.optionId, normalizedInput);
  const correctOption = options.find((o) => o.isCorrect);
  const correctOptionText = correctOption?.text;
  const correctOptionId = correctOption?.id;

  const isCorrect = !!selected?.isCorrect;

  const feedback = isCorrect
    ? (script.feedback?.correct ?? 'Correct!')
    : (script.feedback?.incorrect ?? 'Incorrect.');

  mcqLogger.info(
    {
      stepIndex: context?.stepIndex,
      state: context?.stateName,
      studentInput,
      normalizedInput,
      optionId: context?.optionId,
      selectedOptionId: selected?.id,
      resolvedById: byId,
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
    correctOptionId,
    selectedOptionId: selected?.id,
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
