export type ProgressStatus =
  | 'LOCKED'
  | 'UNLOCKED'
  | 'IN_PROGRESS'
  | 'MASTERED'
  | 'NEEDS_REMEDIATION'
  | 'FAILED';

export interface UserProgress {
  readonly id: string;
  readonly userId: string;
  readonly recipeId?: string;
  readonly atomId?: string;
  readonly status: ProgressStatus;
  readonly score?: number;
  readonly attempts: number;
  readonly lastAttemptAt?: Date;
  readonly updatedAt: Date;
}

export function createUserProgress(parameters: {
  id: string;
  userId: string;
  recipeId?: string;
  atomId?: string;
  status?: ProgressStatus;
  score?: number;
  attempts?: number;
  lastAttemptAt?: Date;
}): UserProgress {
  return {
    id: parameters.id,
    userId: parameters.userId,
    recipeId: parameters.recipeId,
    atomId: parameters.atomId,
    status: parameters.status ?? 'LOCKED',
    score: parameters.score,
    attempts: parameters.attempts ?? 0,
    lastAttemptAt: parameters.lastAttemptAt,
    updatedAt: new Date(),
  };
}
