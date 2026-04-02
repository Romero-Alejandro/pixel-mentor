import { randomUUID } from 'node:crypto';

import type { ActivityAttemptRepository } from '../../domain/ports/activity-attempt.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';

export class AttemptActivityUseCase {
  constructor(
    private attemptRepo: ActivityAttemptRepository,
    private atomRepo: AtomRepository,
  ) {}

  async execute(
    userId: string,
    atomId: string,
    response: unknown,
    hintUsed?: number,
  ): Promise<{ attemptId: string; correct?: boolean }> {
    const atom = await this.atomRepo.findById(atomId);
    if (!atom) throw new Error(`Atom with ID ${atomId} not found`);

    let correct = false;
    if (atom.options && atom.options.length > 0) {
      const correctOption = atom.options.find((opt) => opt.isCorrect);
      if (correctOption) {
        correct = response === correctOption.text;
      }
    } else if (atom.content != null && typeof atom.content === 'string') {
      correct =
        typeof response === 'string' &&
        response.trim().toLowerCase() === atom.content.trim().toLowerCase();
    }

    const attemptId = randomUUID();
    await this.attemptRepo.create({
      id: attemptId,
      userId,
      atomId,
      response,
      correct,
      hintUsed: hintUsed ?? 0,
      attemptNo: 1,
    });

    return { attemptId, correct };
  }
}
