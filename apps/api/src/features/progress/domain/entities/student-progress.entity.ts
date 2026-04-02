/**
 * @deprecated Use Session and Interaction entities instead.
 * This entity is kept for backward compatibility only.
 *
 * Migration:
 * - Use Session for lesson progress tracking
 * - Use Interaction for conversation turns
 *
 * @see @/domain/entities/session
 * @see @/domain/entities/interaction
 */

import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';

export type ExchangeRole = 'user' | 'assistant' | 'system';

export interface Exchange {
  readonly id: string;
  readonly role: ExchangeRole;
  readonly content: string;
  readonly pedagogicalState: PedagogicalState;
  readonly timestamp: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface StudentProgress {
  readonly id: string;
  readonly lessonId: string;
  readonly userId: string;
  readonly currentState: PedagogicalState;
  readonly currentQuestionIndex: number;
  readonly exchanges: readonly Exchange[];
  readonly startDate: Date;
  readonly lastActivityDate: Date;
  readonly score?: number;
  readonly completed: boolean;
}

export function createInitialProgress(parameters: {
  id: string;
  lessonId: string;
  userId: string;
}): StudentProgress {
  const now = new Date();
  return {
    id: parameters.id,
    lessonId: parameters.lessonId,
    userId: parameters.userId,
    currentState: 'EXPLANATION',
    currentQuestionIndex: 0,
    exchanges: Object.freeze([]),
    startDate: now,
    lastActivityDate: now,
    score: undefined,
    completed: false,
  };
}

export function addExchange(progress: StudentProgress, exchange: Exchange): StudentProgress {
  return {
    ...progress,
    exchanges: Object.freeze([...progress.exchanges, exchange]),
    lastActivityDate: new Date(),
  };
}

export function updateState(
  progress: StudentProgress,
  newState: PedagogicalState,
  newQuestionIndex?: number,
): StudentProgress {
  return {
    ...progress,
    currentState: newState,
    currentQuestionIndex: newQuestionIndex ?? progress.currentQuestionIndex,
    lastActivityDate: new Date(),
  };
}

export function markCompleted(progress: StudentProgress, finalScore: number): StudentProgress {
  return {
    ...progress,
    completed: true,
    score: finalScore,
    lastActivityDate: new Date(),
  };
}

export function getRecentExchanges(progress: StudentProgress, count: number): readonly Exchange[] {
  const total = progress.exchanges.length;
  if (total <= count) {
    return progress.exchanges;
  }
  return progress.exchanges.slice(total - count);
}

export function getLastExchange(progress: StudentProgress): Exchange | undefined {
  return progress.exchanges[progress.exchanges.length - 1];
}

export function getExchangeCount(progress: StudentProgress): number {
  return progress.exchanges.length;
}
