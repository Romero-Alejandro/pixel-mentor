import type { SessionRepository } from '@/features/session/domain/ports/session.repository.port';
import { SessionNotFoundError } from '@/features/session/domain/ports/session.repository.port';

export class ResetSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const resetSession = await this.sessionRepo.resetProgress(sessionId);
    const activeSession = await this.sessionRepo.updateStatus(resetSession.id, 'ACTIVE');

    return {
      id: activeSession.id,
      studentId: activeSession.studentId,
      recipeId: activeSession.recipeId,
      status: activeSession.status,
      stateCheckpoint: activeSession.stateCheckpoint,
      startedAt: activeSession.startedAt?.toISOString(),
      lastActivityAt: activeSession.lastActivityAt?.toISOString(),
      completedAt: activeSession.completedAt?.toISOString() ?? null,
      escalatedAt: activeSession.escalatedAt?.toISOString() ?? null,
      safetyFlag: activeSession.safetyFlag,
      outOfScope: activeSession.outOfScope ?? false,
      failedAttempts: activeSession.failedAttempts ?? 0,
    };
  }
}
