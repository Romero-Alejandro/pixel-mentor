export type SessionStatus =
  | 'idle'
  | 'active'
  | 'paused_for_question'
  | 'awaiting_confirmation'
  | 'paused_idle'
  | 'completed'
  | 'escalated';

export interface Session {
  readonly id: string;
  readonly studentId: string;
  readonly lessonId: string;
  readonly status: SessionStatus;
  readonly stateCheckpoint: Record<string, unknown>;
  readonly currentInteractionId: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly completedAt: Date | null;
  readonly escalatedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createSession(parameters: {
  id: string;
  studentId: string;
  lessonId: string;
  stateCheckpoint?: Record<string, unknown>;
}): Session {
  const now = new Date();
  return {
    id: parameters.id,
    studentId: parameters.studentId,
    lessonId: parameters.lessonId,
    status: 'idle',
    stateCheckpoint: parameters.stateCheckpoint ?? {},
    currentInteractionId: null,
    startedAt: now,
    lastActivityAt: now,
    completedAt: null,
    escalatedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function startSession(session: Session): Session {
  return {
    ...session,
    status: 'active',
    updatedAt: new Date(),
  };
}

export function pauseForQuestion(session: Session, checkpoint: Record<string, unknown>): Session {
  return {
    ...session,
    status: 'paused_for_question',
    stateCheckpoint: checkpoint,
    updatedAt: new Date(),
  };
}

export function awaitConfirmation(session: Session): Session {
  return {
    ...session,
    status: 'awaiting_confirmation',
    updatedAt: new Date(),
  };
}

export function pauseIdle(session: Session): Session {
  return {
    ...session,
    status: 'paused_idle',
    updatedAt: new Date(),
  };
}

export function resumeSession(session: Session): Session {
  return {
    ...session,
    status: 'active',
    updatedAt: new Date(),
  };
}

export function completeSession(session: Session): Session {
  return {
    ...session,
    status: 'completed',
    completedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function escalateSession(session: Session): Session {
  return {
    ...session,
    status: 'escalated',
    escalatedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function setCurrentInteraction(session: Session, interactionId: string): Session {
  return {
    ...session,
    currentInteractionId: interactionId,
    lastActivityAt: new Date(),
    updatedAt: new Date(),
  };
}

export function incrementVersion(session: Session): Session {
  return {
    ...session,
    version: session.version + 1,
    updatedAt: new Date(),
  };
}
