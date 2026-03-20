import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { getEventBus } from '@/events/event-bus.js';
import { GameDomainEvents } from '@/events/game-events.js';
import type { LessonCompletedPayload } from '@/events/game-events.js';

export class CompleteSessionUseCase {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const completed = await this.sessionRepo.complete(sessionId);

    // Emit LESSON_COMPLETED event to trigger gamification processing
    try {
      const eventBus = getEventBus();
      const payload: LessonCompletedPayload = {
        userId: session.studentId,
        lessonId: session.recipeId,
        lessonTitle: session.recipeId, // Fallback; title would require recipe lookup
        completedAt: new Date(),
      };
      await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, payload);
    } catch {
      // Don't fail session completion if event emission fails
    }

    return completed;
  }
}
