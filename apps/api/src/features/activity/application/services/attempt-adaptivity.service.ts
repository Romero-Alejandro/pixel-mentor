/**
 * Attempt Adaptivity Service (Fase 2)
 *
 * Turns per-attempt telemetry (partial score, response time, hint usage)
 * into concrete orchestration decisions. Pure and deterministic: no LLM, no
 * I/O — the orchestrator stays in charge of applying them.
 *
 * Inputs:
 *   - graded result of the current attempt (format, score, elapsedMs)
 *   - checkpoint (failedAttempts, activityHints)
 *   - attempt history for the atom (first-try stats, prior hint use)
 *
 * Outputs (see AdaptivityDecision):
 *   - feedbackText   → enriches the grader feedback (partial-credit hints,
 *                      time-based encouragement)
 *   - showHint       → one-time nudge for near-miss multi-answer formats
 *   - autoAdvanceDelayMs → reading-pace delay before auto-advance
 */

import type { ActivityAttemptByAtom } from '@/features/activity/domain/ports/activity-attempt.repository.port.js';

// ─── Config ───────────────────────────────────────────────────────────────

/** Formats with partial credit; near-miss answers get a targeted nudge. */
const PARTIAL_CREDIT_FORMATS: ReadonlySet<string> = new Set(['mcq_multi', 'ordering']);

/** Score at/above which a near-miss nudge fires (one-time per atom). */
const NEAR_MISS_THRESHOLD = 0.5;

/** Response-time bands (ms) used for pacing and encouragement. */
const FAST_ANSWER_MS = 5_000;
const SLOW_ANSWER_MS = 25_000;

/** Feedback reading pace: 280 ms per word, clamped to sane bounds. */
const MS_PER_WORD = 280;
const MIN_DELAY_MS = 1_200;
const MAX_DELAY_MS = 8_000;

// ─── Types ────────────────────────────────────────────────────────────────

export interface AdaptivityInput {
  /** Plugin format of the graded step ('mcq_single', 'ordering', 'open_question'...). */
  format: string;
  isCorrect: boolean;
  /** Partial score 0..1 (undefined for binary formats). */
  score?: number;
  /** Response time of the current attempt (undefined when not measured). */
  elapsedMs?: number;
  /** Whether this atom already consumed its one-time hint. */
  hintAlreadyUsed: boolean;
  /** Student's current consecutive-failure counter for this step. */
  failedAttempts: number;
  /** Prior attempts for this atom (any order). */
  atomHistory: readonly ActivityAttemptByAtom[];
}

export interface AdaptivityDecision {
  /** Final feedback text (grader feedback + adaptivity enrichment). */
  feedbackText: string;
  /** Whether to append the one-time near-miss nudge to the feedback. */
  showHint: boolean;
  /** ms the client should wait before auto-advancing after this feedback. */
  autoAdvanceDelayMs: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

export class AttemptAdaptivityService {
  /** Stats over an atom's attempt history. */
  private summarizeHistory(history: readonly ActivityAttemptByAtom[]): {
    firstAttemptNo: number;
    anyHintUsed: boolean;
  } {
    if (history.length === 0) {
      return { firstAttemptNo: 0, anyHintUsed: false };
    }
    let firstAttemptNo = Number.POSITIVE_INFINITY;
    let anyHintUsed = false;
    for (const attempt of history) {
      if (attempt.attemptNo < firstAttemptNo) {
        firstAttemptNo = attempt.attemptNo;
      }
      if ((attempt.hintUsed ?? 0) > 0) anyHintUsed = true;
    }
    return { firstAttemptNo, anyHintUsed };
  }

  /**
   * Computes the adaptivity decision for a just-graded attempt.
   * Never throws: any malformed input degrades to the grader's own feedback.
   */
  decide(input: AdaptivityInput): AdaptivityDecision {
    const { format, isCorrect, score, elapsedMs, hintAlreadyUsed, failedAttempts } = input;
    const { firstAttemptNo, anyHintUsed } = this.summarizeHistory(input.atomHistory);

    const isPartialCredit = PARTIAL_CREDIT_FORMATS.has(format);
    const nextAttemptNo =
      firstAttemptNo === 0
        ? 1
        : firstAttemptNo + Math.max(failedAttempts, 0) + (failedAttempts > 0 ? 0 : 1);

    // ── 1. Base feedback + partial-credit enrichment ─────────────────────
    let feedbackText = '';
    let showHint = false;

    if (isPartialCredit && !isCorrect && typeof score === 'number') {
      if (score >= NEAR_MISS_THRESHOLD && !hintAlreadyUsed && !anyHintUsed) {
        showHint = true;
        feedbackText =
          score >= 0.75
            ? '¡Muy cerca! Te falta ajustar un detalle: revisá lo que marcaste una vez más.'
            : 'Vas por buen camino. Revisá los elementos que te falten o te sobren.';
      } else if (score > 0) {
        feedbackText = 'Algunos elementos van bien. Revisá el resto con calma.';
      }
    }

    // ── 2. Time-based encouragement (correct answers, both bands) ────────
    if (isCorrect) {
      const attemptNo = Math.max(firstAttemptNo, nextAttemptNo);
      if (typeof elapsedMs === 'number' && elapsedMs < FAST_ANSWER_MS && attemptNo <= 1) {
        feedbackText = feedbackText || '¡Respuesta rápida y correcta!';
      } else if (typeof elapsedMs === 'number' && elapsedMs > SLOW_ANSWER_MS) {
        feedbackText = feedbackText || 'Tomaste tu tiempo y lo resolviste. ¡Bien pensado!';
      }
    }

    // ── 3. Pacing: reading-pace delay for the feedback text ──────────────
    const autoAdvanceDelayMs = this.readingPaceDelayMs(feedbackText);

    return { feedbackText, showHint, autoAdvanceDelayMs };
  }

  /** Reading-pace delay: long feedback gets proportionally more time. */
  private readingPaceDelayMs(feedbackText: string): number {
    const words = feedbackText.trim().length > 0 ? feedbackText.trim().split(/\s+/).length : 0;
    if (words === 0) return 0;
    return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, words * MS_PER_WORD));
  }
}
