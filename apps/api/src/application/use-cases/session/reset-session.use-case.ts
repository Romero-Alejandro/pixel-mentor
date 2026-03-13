import { randomUUID } from 'node:crypto';

import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { SessionNotFoundError } from '@/domain/ports/session-repository.js';
import type { InteractionRepository } from '@/domain/ports/interaction-repository.js';

export class ResetSessionUseCase {
  constructor(
    private sessionRepo: SessionRepository,
    private interactionRepo: InteractionRepository,
  ) {}

  async execute(sessionId: string): Promise<{
    message: string;
    sessionId: string;
    resetToSegment: number;
  }> {
    // Verify session exists
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Perform the reset
    const resetSession = await this.sessionRepo.resetProgress(sessionId);

    // Optional: Log the reset as an interaction for audit trail
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: 0, // Special marker for system event
      transcript: 'Session reset by user',
      aiResponse: null,
      pausedForQuestion: false,
    });

    return {
      message: 'Session reset to segment 1',
      sessionId: resetSession.id,
      resetToSegment: resetSession.stateCheckpoint.currentStepIndex + 1,
    };
  }
}
