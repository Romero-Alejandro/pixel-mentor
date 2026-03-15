import type { SessionRepository } from '@/domain/ports/session-repository.js';

export class CompleteSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const completed = await this.sessionRepo.complete(sessionId);
    return completed;
  }
}
