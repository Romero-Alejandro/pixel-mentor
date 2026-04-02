/**
 * Game-related event types and payloads.
 */

/**
 * Events emitted by the domain (lesson completion, activity attempts, etc.)
 */
export const GameDomainEvents = {
  LESSON_COMPLETED: 'game:LESSON_COMPLETED',
  ACTIVITY_ATTEMPT: 'game:ACTIVITY_ATTEMPT',
  DAILY_LOGIN: 'game:DAILY_LOGIN',
} as const;

export type GameDomainEvent = (typeof GameDomainEvents)[keyof typeof GameDomainEvents];

/**
 * Events emitted by the game engine (rewards, achievements, etc.)
 */
export const GameEngineEvents = {
  XP_CHANGED: 'game:XP_CHANGED',
  BADGE_EARNED: 'game:BADGE_EARNED',
  LEVEL_UP: 'game:LEVEL_UP',
  STREAK_UPDATED: 'game:STREAK_UPDATED',
} as const;

export type GameEngineEvent = (typeof GameEngineEvents)[keyof typeof GameEngineEvents];

/**
 * All game-related events
 */
export const GameEvents = {
  ...GameDomainEvents,
  ...GameEngineEvents,
} as const;

export type GameEvent = GameDomainEvent | GameEngineEvent;

/**
 * Payload for LESSON_COMPLETED event
 */
export interface LessonCompletedPayload {
  userId: string;
  lessonId: string;
  lessonTitle: string;
  durationSeconds?: number;
  completedAt: Date;
  /** Accuracy data for XP scaling */
  accuracy?: {
    correctFirstAttempts: number;
    correctLastAttempts: number;
    totalActivities: number;
    skippedActivities: number;
    accuracyPercent: number;
    allCorrectOnFirstAttempt: boolean;
  };
}

/**
 * Payload for ACTIVITY_ATTEMPT event
 */
export interface ActivityAttemptPayload {
  userId: string;
  activityId: string;
  correct: boolean;
  attemptNumber: number;
  hintUsed: boolean;
  completedAt: Date;
}

/**
 * Payload for DAILY_LOGIN event
 */
export interface DailyLoginPayload {
  userId: string;
  loginDate: Date;
}

/**
 * Payload for XP_CHANGED event
 */
export interface XPChangedPayload {
  userId: string;
  previousXP: number;
  newXP: number;
  delta: number;
  source: string;
}

/**
 * Payload for BADGE_EARNED event
 */
export interface BadgeEarnedPayload {
  userId: string;
  badgeCode: string;
  badgeName: string;
  badgeIcon: string;
  totalBadges: number;
}

/**
 * Payload for LEVEL_UP event
 */
export interface LevelUpPayload {
  userId: string;
  previousLevel: number;
  newLevel: number;
  /** The title for the new level (e.g., "Brote", "Flor") */
  newLevelTitle: string;
  newIcon: string;
}

/**
 * Payload for STREAK_UPDATED event
 */
export interface StreakUpdatedPayload {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
}

/**
 * Extended StreakUpdatedEvent with additional streak info
 */
export interface StreakUpdatedEvent {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  isNewRecord: boolean;
  streakBonusXP: number;
  streakBroken: boolean;
}
