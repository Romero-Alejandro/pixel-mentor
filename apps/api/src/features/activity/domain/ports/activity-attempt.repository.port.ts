import type { ActivityAttempt } from '@/features/activity/domain/entities/activity-attempt.entity.js';

export interface ActivityAttemptByAtom {
  atomId: string;
  attemptNo: number;
  /** Undefined when the attempt has not been graded yet (DB null). */
  correct?: boolean;
  /** Fase 2: partial score 0..1 (multi-answer formats); undefined for binary. */
  score?: number;
  /** Fase 2: response time in ms; undefined when not measured. */
  elapsedMs?: number;
  /** Fase 2: 1 when the attempt consumed an adaptivity hint. */
  hintUsed?: number;
  /** Fase 2: plugin format of the graded step ('mcq_single', 'ordering', 'open_question'...). */
  format?: string;
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
  /**
   * Records a graded attempt, assigning the next monotonic attemptNo for
   * (userId, atomId). Retries on unique-constraint races; guaranteed to
   * persist exactly one row per call (or throw).
   */
  recordAttempt(
    attempt: Omit<ActivityAttempt, 'createdAt' | 'attemptNo'>,
  ): Promise<ActivityAttempt>;
  update(id: string, data: Partial<ActivityAttempt>): Promise<ActivityAttempt>;
  countCorrectFirstAttempts(userId: string): Promise<number>;
  /**
   * Fase 2: counts DISTINCT atoms whose FIRST attempt was correct AND
   * hint-free (hintUsed = 0). Basis for hint-free perfect badges.
   */
  countHintFreeCorrectFirstAttemptAtoms(userId: string): Promise<number>;
  /**
   * Fase 2: counts DISTINCT atoms whose LAST attempt has score >= the given
   * threshold (0..1). Basis for high-partial-credit badges.
   */
  countAtomsWithHighPartialCredit(userId: string, minScore: number): Promise<number>;
}
