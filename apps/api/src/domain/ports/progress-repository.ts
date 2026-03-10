/**
 * @deprecated Use SessionRepository and InteractionRepository instead.
 * This port is kept for backward compatibility only.
 *
 * Migration:
 * - Use ISessionRepository for session management
 * - Use IInteractionRepository for interaction tracking
 *
 * @see @/domain/ports/session-repository
 * @see @/domain/ports/interaction-repository
 */
import type { StudentProgress, Exchange } from '@/domain/entities/student-progress';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state';

export interface ProgressRepository {
  findByUserAndLesson(userId: string, lessonId: string): Promise<StudentProgress | null>;

  findByUser(userId: string): Promise<StudentProgress[]>;
  findByLesson(lessonId: string): Promise<StudentProgress[]>;

  create(
    progress: Omit<StudentProgress, 'startDate' | 'lastActivityDate'>,
  ): Promise<StudentProgress>;

  updateState(progressId: string, newState: PedagogicalState): Promise<StudentProgress>;

  updateCurrentQuestion(progressId: string, newIndex: number): Promise<StudentProgress>;

  addExchange(progressId: string, exchange: Exchange): Promise<StudentProgress>;

  markCompleted(progressId: string, score: number): Promise<StudentProgress>;

  delete(progressId: string): Promise<void>;
}

export class ProgressNotFoundError extends Error {
  readonly code = 'PROGRESS_NOT_FOUND' as const;
  readonly progressId: string;

  constructor(progressId: string) {
    super(`Progress with ID ${progressId} not found`);
    this.name = 'ProgressNotFoundError';
    this.progressId = progressId;
  }
}

export class ProgressAlreadyCompletedError extends Error {
  readonly code = 'PROGRESS_ALREADY_COMPLETED' as const;
  readonly progressId: string;

  constructor(progressId: string) {
    super(`Progress ${progressId} is already completed`);
    this.name = 'ProgressAlreadyCompletedError';
    this.progressId = progressId;
  }
}

export async function getProgressOrError(
  repository: ProgressRepository,
  userId: string,
  lessonId: string,
): Promise<StudentProgress> {
  const progress = await repository.findByUserAndLesson(userId, lessonId);

  if (!progress) {
    throw new ProgressNotFoundError(`${userId}-${lessonId}`);
  }

  if (progress.completed) {
    throw new ProgressAlreadyCompletedError(progress.id);
  }

  return progress;
}
