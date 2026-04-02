import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine';

import {
  validateSessionTransition,
  type ValidatedSessionStatus,
} from '@/shared/validators/index.js';

export type SessionStatus =
  | 'IDLE'
  | 'ACTIVE'
  | 'PAUSED_FOR_QUESTION'
  | 'AWAITING_CONFIRMATION'
  | 'PAUSED_IDLE'
  | 'COMPLETED'
  | 'ESCALATED';

/**
 * Determines if a session status is terminal (not resumable)
 * @param status - The session status to check
 * @returns true if status is COMPLETED or ESCALATED
 */
export function isTerminalStatus(status: SessionStatus): boolean {
  return status === 'COMPLETED' || status === 'ESCALATED';
}

export interface SessionCheckpoint {
  readonly currentState: PedagogicalState;
  readonly currentStepIndex: number;
  readonly savedStepIndex?: number | null;
  readonly doubtContext?: {
    readonly question: string;
    readonly stepIndex: number;
  } | null;
  // Nuevos campos para el flujo mejorado
  readonly questionCount?: number;
  readonly lastQuestionTime?: string | null;
  readonly skippedActivities?: string[];
  readonly failedAttempts?: number;
  readonly totalWrongAnswers?: number;
}

export interface Session {
  readonly id: string;
  readonly studentId: string;
  readonly recipeId: string;
  readonly status: SessionStatus;
  readonly stateCheckpoint: SessionCheckpoint;
  readonly safetyFlag?: string | null;
  readonly outOfScope?: boolean;
  readonly failedAttempts?: number;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly completedAt: Date | null;
  readonly escalatedAt: Date | null;
  readonly meta?: unknown;
}

export function createSession(parameters: {
  id: string;
  studentId: string;
  recipeId: string;
  stateCheckpoint?: SessionCheckpoint;
  meta?: unknown;
}): Session {
  const now = new Date();
  return {
    id: parameters.id,
    studentId: parameters.studentId,
    recipeId: parameters.recipeId,
    status: 'IDLE',
    stateCheckpoint: parameters.stateCheckpoint ?? {
      currentState: 'ACTIVE_CLASS',
      currentStepIndex: 0,
    },
    startedAt: now,
    lastActivityAt: now,
    completedAt: null,
    escalatedAt: null,
    meta: parameters.meta,
  };
}

export function startSession(session: Session): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'ACTIVE');
  return { ...session, status: 'ACTIVE', lastActivityAt: new Date() };
}

export function pauseForQuestion(session: Session, checkpoint: SessionCheckpoint): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'PAUSED_FOR_QUESTION');
  return {
    ...session,
    status: 'PAUSED_FOR_QUESTION',
    stateCheckpoint: checkpoint,
    lastActivityAt: new Date(),
  };
}

export function awaitConfirmation(session: Session): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'AWAITING_CONFIRMATION');
  return { ...session, status: 'AWAITING_CONFIRMATION', lastActivityAt: new Date() };
}

export function pauseIdle(session: Session): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'PAUSED_IDLE');
  return { ...session, status: 'PAUSED_IDLE', lastActivityAt: new Date() };
}

export function resumeSession(session: Session): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'ACTIVE');
  return { ...session, status: 'ACTIVE', lastActivityAt: new Date() };
}

export function completeSession(session: Session): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'COMPLETED');
  return { ...session, status: 'COMPLETED', completedAt: new Date(), lastActivityAt: new Date() };
}

export function escalateSession(session: Session): Session {
  validateSessionTransition(session.status as ValidatedSessionStatus, 'ESCALATED');
  return { ...session, status: 'ESCALATED', escalatedAt: new Date(), lastActivityAt: new Date() };
}
