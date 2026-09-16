import type { ActivityAttempt } from '@/features/activity/domain/entities/activity-attempt.entity.js';

export interface ActivityAttemptByAtom {
  atomId: string;
  attemptNo: number;
  /** Undefined when the attempt has not been graded yet (DB null). */
  correct?: boolean;
}

export interface ActivityAttemptRepository {
  findByUserIdAndAtomId(userId: string, atomId: string): Promise<ActivityAttempt[]>;
  findByUserIdAndAtomIds(
    userId: string,
    atomIds: readonly string[],
  ): Promise<ActivityAttemptByAtom[]>;
  findLatestByUserIdAndAtomId(userId: string, atomId: string): Promise<ActivityAttempt | null>;
  /** Returns the current max attemptNo for (userId, atomId), or 0 when none exist. */
  getMaxAttemptNoByUserIdAndAtomId(userId: string, atomId: string): Promise<number>;
  create(attempt: Omit<ActivityAttempt, 'createdAt'>): Promise<ActivityAttempt>;
  update(id: string, data: Partial<ActivityAttempt>): Promise<ActivityAttempt>;
  countCorrectFirstAttempts(userId: string): Promise<number>;
}
