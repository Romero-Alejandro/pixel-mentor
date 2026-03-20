/**
 * Events Module
 *
 * Exports the EventBus implementation and all game-related event types
 * for decoupling gamification logic from domain logic.
 */

export { InMemoryEventBus, getEventBus, resetEventBus } from './event-bus';

export type { EventBus, EventHandler } from './event-bus';

export { GameEvents, GameDomainEvents, GameEngineEvents } from './game-events';

export type {
  GameEvent,
  GameDomainEvent,
  GameEngineEvent,
  LessonCompletedPayload,
  ActivityAttemptPayload,
  DailyLoginPayload,
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedPayload,
} from './game-events';
