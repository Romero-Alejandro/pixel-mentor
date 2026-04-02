import type { SessionRepository } from '../../domain/ports/session.repository.port';
import { SessionNotFoundError } from '../../domain/ports/session.repository.port';

export class GetSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    return session;
  }
}
