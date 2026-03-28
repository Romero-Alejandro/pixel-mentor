import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { SessionNotFoundError } from '@/domain/ports/session-repository.js';

export class ResetSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    // Verify session exists
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Perform the reset
    const resetSession = await this.sessionRepo.resetProgress(sessionId);

    // Update status to ACTIVE so the session can be used after reset
    const activeSession = await this.sessionRepo.updateStatus(resetSession.id, 'ACTIVE');

    // Return the full session object for client compatibility
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
