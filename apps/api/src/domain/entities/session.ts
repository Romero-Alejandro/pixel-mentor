import type { PedagogicalState } from './pedagogical-state';

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
  readonly savedStepIndex?: number;
  readonly doubtContext?: {
    readonly question: string;
    readonly stepIndex: number;
  };
  // Nuevos campos para el flujo mejorado
  readonly questionCount?: number;
  readonly lastQuestionTime?: string | null;
  readonly skippedActivities?: string[];
  readonly failedAttempts?: number;
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
  readonly meta?: any;
}

export function createSession(parameters: {
  id: string;
  studentId: string;
  recipeId: string;
  stateCheckpoint?: SessionCheckpoint;
  meta?: any;
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
  return { ...session, status: 'ACTIVE', lastActivityAt: new Date() };
}

export function pauseForQuestion(session: Session, checkpoint: SessionCheckpoint): Session {
  return {
    ...session,
    status: 'PAUSED_FOR_QUESTION',
    stateCheckpoint: checkpoint,
    lastActivityAt: new Date(),
  };
}

export function awaitConfirmation(session: Session): Session {
  return { ...session, status: 'AWAITING_CONFIRMATION', lastActivityAt: new Date() };
}

export function pauseIdle(session: Session): Session {
  return { ...session, status: 'PAUSED_IDLE', lastActivityAt: new Date() };
}

export function resumeSession(session: Session): Session {
  return { ...session, status: 'ACTIVE', lastActivityAt: new Date() };
}

export function completeSession(session: Session): Session {
  return { ...session, status: 'COMPLETED', completedAt: new Date(), lastActivityAt: new Date() };
}

export function escalateSession(session: Session): Session {
  return { ...session, status: 'ESCALATED', escalatedAt: new Date(), lastActivityAt: new Date() };
}
