import { getEventBus } from '@/events/event-bus.js';
import { GameDomainEvents } from '@/events/game-events.js';
import type { LessonCompletedPayload } from '@/events/game-events.js';
import { getTransactionService } from '@/infrastructure/transactions/index.js';
import {
  SessionNotFoundError,
  SessionAlreadyCompletedError,
} from '@/domain/ports/session-repository.js';

export class CompleteSessionUseCase {
  async execute(sessionId: string) {
    // Use transaction to ensure atomicity
    const txService = getTransactionService();

    const result = await txService.execute(async (tx) => {
      // Find session within transaction
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) {
        throw new SessionNotFoundError(sessionId);
      }

      if (session.status === 'COMPLETED') {
        throw new SessionAlreadyCompletedError(sessionId);
      }

      // Complete session within transaction
      const completed = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        id: completed.id,
        studentId: completed.studentId,
        recipeId: completed.recipeId,
        status: completed.status,
      };
    });

    // Emit LESSON_COMPLETED event AFTER transaction commits
    // This ensures the DB state is consistent before emitting events
    try {
      const eventBus = getEventBus();
      const payload: LessonCompletedPayload = {
        userId: result.studentId,
        lessonId: result.recipeId,
        lessonTitle: result.recipeId, // Fallback; title would require recipe lookup
        completedAt: new Date(),
      };
      await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, payload);
    } catch {
      // Don't fail session completion if event emission fails
      // The session is already marked as completed in DB
      console.warn('Failed to emit LESSON_COMPLETED event for session:', sessionId);
    }

    return result;
  }
}
