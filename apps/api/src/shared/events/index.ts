/**
 * Events Module
 *
 * Exports the EventBus implementation and all game-related event types
 * for decoupling gamification logic from domain logic.
 */

export { InMemoryEventBus, getEventBus, resetEventBus } from '@/shared/events/event-bus.js';

export type { EventBus, EventHandler } from '@/shared/events/event-bus.js';

export {
  InMemoryIdempotentEventBus,
  getIdempotentEventBus,
  resetIdempotentEventBus,
} from '@/shared/events/idempotent-event-bus.js';

export type {
  IdempotentEventBus,
  IdempotentEventOptions,
  ProcessedEvent,
} from '@/shared/events/idempotent-event-bus.js';

export { GameEvents, GameDomainEvents, GameEngineEvents } from '@/shared/events/game-events.js';

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
} from '@/shared/events/game-events.js';
