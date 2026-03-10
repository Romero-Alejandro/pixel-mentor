import type { SessionRepository } from '@/domain/ports/session-repository';
import { SessionNotFoundError } from '@/domain/ports/session-repository';

export class GetSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }
}
