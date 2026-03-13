import type { ActivityAttempt } from '../entities/activity-attempt';

export interface ActivityAttemptRepository {
  findByUserIdAndAtomId(userId: string, atomId: string): Promise<ActivityAttempt[]>;
  findLatestByUserIdAndAtomId(userId: string, atomId: string): Promise<ActivityAttempt | null>;
  create(attempt: Omit<ActivityAttempt, 'createdAt'>): Promise<ActivityAttempt>;
  update(id: string, data: Partial<ActivityAttempt>): Promise<ActivityAttempt>;
}
