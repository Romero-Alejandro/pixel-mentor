import type { SessionRepository } from '@/features/session/domain/ports/session.repository.port.js';

export class ListSessionsUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(studentId: string | undefined = undefined, activeOnly: boolean = false) {
    if (studentId === undefined) {
      return [];
    }
    if (activeOnly) {
      return await this.sessionRepo.findActiveByStudent(studentId);
    }
    return await this.sessionRepo.findByStudent(studentId);
  }
}
