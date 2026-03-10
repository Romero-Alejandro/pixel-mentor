import type { SessionRepository } from '@/domain/ports/session-repository';

export class ListSessionsUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(studentId: string, activeOnly: boolean = false) {
    if (activeOnly) {
      return await this.sessionRepo.findActiveByStudent(studentId);
    }
    return await this.sessionRepo.findByStudent(studentId);
  }
}
