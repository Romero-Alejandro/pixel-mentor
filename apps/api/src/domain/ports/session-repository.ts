import type { Session, SessionStatus } from '@/domain/entities/session';

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;

  findByStudentAndLesson(studentId: string, lessonId: string): Promise<Session | null>;

  findByStudent(studentId: string): Promise<Session[]>;

  findActiveByStudent(studentId: string): Promise<Session[]>;

  create(
    session: Omit<Session, 'startedAt' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<Session>;

  updateStatus(sessionId: string, status: SessionStatus): Promise<Session>;

  updateCheckpoint(sessionId: string, checkpoint: Record<string, unknown>): Promise<Session>;

  setCurrentInteraction(sessionId: string, interactionId: string | null): Promise<Session>;

  complete(sessionId: string): Promise<Session>;

  escalate(sessionId: string): Promise<Session>;

  incrementVersion(sessionId: string): Promise<Session>;
}

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
  readonly lessonId: string;

  constructor(studentId: string, lessonId: string) {
    super(`An active session already exists for student ${studentId} and lesson ${lessonId}`);
    this.name = 'ActiveSessionExistsError';
    this.studentId = studentId;
    this.lessonId = lessonId;
  }
}
