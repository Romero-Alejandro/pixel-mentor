import { createLogger } from '@/shared/logger/logger.js';

import { getEventBus } from '@/shared/events/event-bus.port';
import { GameDomainEvents } from '@/shared/events/game-events.port';
import type { LessonCompletedPayload } from '@/shared/events/game-events.port';
import {
  SessionNotFoundError,
  SessionAlreadyCompletedError,
} from '@/features/session/domain/ports/session.repository.port';
import type { SessionRepository } from '@/features/session/domain/ports/session.repository.port';

// Create a logger for complete session use case
const sessionLogger = createLogger(undefined, { name: 'complete-session', level: 'warn' });

export class CompleteSessionUseCase {
  constructor(private sessionRepository: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (session.status === 'COMPLETED') {
      throw new SessionAlreadyCompletedError(sessionId);
    }

    const completed = await this.sessionRepository.complete(sessionId);

    const result = {
      id: completed.id,
      studentId: completed.studentId,
      recipeId: completed.recipeId,
      status: completed.status,
    };

    try {
      const eventBus = getEventBus();
      const payload: LessonCompletedPayload = {
        userId: result.studentId,
        lessonId: result.recipeId,
        lessonTitle: result.recipeId,
        completedAt: new Date(),
      };
      await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, payload);
    } catch {
      sessionLogger.warn({ sessionId }, 'Failed to emit LESSON_COMPLETED event');
    }

    return result;
  }
}
