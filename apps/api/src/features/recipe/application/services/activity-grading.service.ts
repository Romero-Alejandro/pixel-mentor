/**
 * Activity Grading Service (Fase 1)
 *
 * Format-agnostic entry point the orchestrator calls for activity steps.
 * It resolves the grader plugin from the shared registry (keyed by the
 * script's `format`), runs it, and adapts the result to the shape the
 * orchestrator already consumes. Deterministic, no LLM.
 *
 * Adding a new activity format = adding a grader to the shared registry +
 * a renderer on the web side. This service and the orchestrator never change.
 */

import { createLogger } from '@/shared/logger/logger.js';
import {
  detectScriptFormat,
  getGrader,
  LEGACY_FORMAT,
  type ActivityFormat,
  type ActivityResponse,
  type ActivityResponseContext,
} from '@pixel-mentor/shared/activities';

import { evaluateMCQ } from './mcq-evaluation.service.js';

const gradingLogger = createLogger(undefined, { name: 'activity-grading', level: 'info' });

/** Shape the orchestrator consumes today (superset of the MCQ result). */
export interface UnifiedGradingResult {
  format: ActivityFormat;
  isCorrect: boolean;
  feedback: string;
  /** ids/texts to reveal AFTER grading (format-specific). */
  correctAnswer: unknown;
  /** Partial score 0..1 when the format supports it. */
  score?: number;
  /** mcq_single only: id of the option the student picked. */
  selectedOptionId?: string;
  /** mcq_single only: legacy text-matching path was used. */
  matchedByText?: boolean;
}

/**
 * Grades an activity answer using the plugin for the script's format.
 * Unknown/malformed formats degrade to the legacy mcq_single path so a bad
 * script never breaks the lesson.
 */
export function gradeActivity(params: {
  script: unknown;
  studentInput: string;
  optionId?: string;
  structured?: ActivityResponse;
}): UnifiedGradingResult {
  const { script, studentInput, optionId, structured } = params;

  const format = detectScriptFormat(script);
  const grader = getGrader(format);

  const context: ActivityResponseContext = { studentInput, optionId, structured };

  if (grader && grader.matchesScript(script)) {
    const result = grader.grade(script, context);
    gradingLogger.info(
      { format, isCorrect: result.isCorrect, score: result.score },
      '[ActivityGrading] Graded with format plugin',
    );
    return {
      format,
      isCorrect: result.isCorrect,
      feedback: result.feedback,
      correctAnswer: result.correctAnswer,
      score: result.score,
    };
  }

  // ── Legacy fallback: mcq_single via the existing evaluateMCQ service ──
  // Covers legacy content (no ids, positional ids) and scripts the new
  // plugins don't recognize.
  const legacy = gradeLegacyMcq(script, studentInput, optionId);
  if (format !== LEGACY_FORMAT) {
    gradingLogger.warn(
      { format },
      '[ActivityGrading] Plugin did not match script; fell back to legacy mcq_single',
    );
  }
  return {
    format: LEGACY_FORMAT,
    ...legacy,
  };
}

/** mcq_single adapter (legacy content path — resolved ids/positional/text). */
function gradeLegacyMcq(
  script: unknown,
  studentInput: string,
  optionId?: string,
): Omit<UnifiedGradingResult, 'format'> {
  const mcq = evaluateMCQ(script as never, studentInput, { optionId });
  return {
    isCorrect: mcq.isCorrect,
    feedback: mcq.feedback,
    correctAnswer: mcq.correctOptionId,
    selectedOptionId: mcq.selectedOptionId,
    matchedByText: undefined,
  };
}
