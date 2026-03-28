/**
 * Example of how to use the EventBus for game events.
 * This shows the decoupling between domain and game engine.
 */
import { getEventBus, GameDomainEvents } from '../index';
import type {
  LessonCompletedPayload,
  ActivityAttemptPayload,
  DailyLoginPayload,
} from '../game-events';

interface GameEngine {
  handleLessonCompleted: (userId: string, payload: LessonCompletedPayload) => Promise<void>;
  handlePerfectAttempt: (userId: string, payload: ActivityAttemptPayload) => Promise<void>;
  handleDailyLogin: (userId: string) => Promise<void>;
}

export function setupGameEventListeners(gameEngine: GameEngine): void {
  const bus = getEventBus();

  // Listen for lesson completion → trigger game rewards
  bus.subscribe(GameDomainEvents.LESSON_COMPLETED, async (payload: unknown) => {
    const typedPayload = payload as LessonCompletedPayload;
    console.log('[Game] Lesson completed:', typedPayload.lessonTitle);
    await gameEngine.handleLessonCompleted(typedPayload.userId, typedPayload);
  });

  // Listen for activity attempts → check for perfect scores
  bus.subscribe(GameDomainEvents.ACTIVITY_ATTEMPT, async (payload: unknown) => {
    const typedPayload = payload as ActivityAttemptPayload;
    if (typedPayload.correct && typedPayload.attemptNumber === 1) {
      console.log('[Game] Perfect score on:', typedPayload.activityId);
      await gameEngine.handlePerfectAttempt(typedPayload.userId, typedPayload);
    }
  });

  // Listen for daily login → update streak
  bus.subscribe(GameDomainEvents.DAILY_LOGIN, async (payload: unknown) => {
    const typedPayload = payload as DailyLoginPayload;
    console.log('[Game] Daily login for user:', typedPayload.userId);
    await gameEngine.handleDailyLogin(typedPayload.userId);
  });
}

export function emitLessonCompleted(userId: string, lessonId: string, lessonTitle: string): void {
  const bus = getEventBus();
  bus.emit(GameDomainEvents.LESSON_COMPLETED, {
    userId,
    lessonId,
    lessonTitle,
    completedAt: new Date(),
  });
}
