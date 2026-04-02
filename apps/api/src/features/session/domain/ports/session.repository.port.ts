import type { Session, SessionStatus, SessionCheckpoint } from '../entities/session.entity';

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;

  findByStudentAndRecipe(studentId: string, recipeId: string): Promise<Session | null>;

  findByStudent(studentId: string): Promise<Session[]>;

  findActiveByStudent(studentId: string): Promise<Session[]>;

  create(
    session: Omit<Session, 'startedAt' | 'lastActivityAt' | 'completedAt' | 'escalatedAt' | 'meta'>,
  ): Promise<Session>;

  updateStatus(sessionId: string, status: SessionStatus): Promise<Session>;

  updateCheckpoint(sessionId: string, checkpoint: SessionCheckpoint): Promise<Session>;

  complete(sessionId: string): Promise<Session>;

  resetProgress(sessionId: string): Promise<Session>;

  escalate(sessionId: string): Promise<Session>;

  incrementFailedAttempts(sessionId: string): Promise<Session>;
}

// Errors remain the same but note that findByStudentAndLesson is now findByStudentAndRecipe
export class SessionNotFoundError extends Error {
  readonly code = 'SESSION_NOT_FOUND' as const;
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session with ID ${sessionId} not found`);
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

export class SessionAlreadyCompletedError extends Error {
  readonly code = 'SESSION_ALREADY_COMPLETED' as const;
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session ${sessionId} is already completed`);
    this.name = 'SessionAlreadyCompletedError';
    this.sessionId = sessionId;
  }
}

export class ActiveSessionExistsError extends Error {
  readonly code = 'ACTIVE_SESSION_EXISTS' as const;
  readonly studentId: string;
  readonly recipeId: string;

  constructor(studentId: string, recipeId: string) {
    super(`An active session already exists for student ${studentId} and recipe ${recipeId}`);
    this.name = 'ActiveSessionExistsError';
    this.studentId = studentId;
    this.recipeId = recipeId;
  }
}
