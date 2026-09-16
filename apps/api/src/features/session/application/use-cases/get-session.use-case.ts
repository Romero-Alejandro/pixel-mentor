import type { SessionRepository } from '@/features/session/domain/ports/session.repository.port.js';
import { SessionNotFoundError } from '@/features/session/domain/ports/session.repository.port.js';

export class GetSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }
}
