/**
 * GameEngineCore - Central orchestrator for gamification.
 *
 * This class is the heart of the gamification system. It:
 * - Subscribes to domain events (lesson completion, daily login, etc.)
 * - Decides how much XP each event pays (via the domain XP policy)
 * - Writes XP through AwardXpService (idempotent ledger)
 * - Asks BadgeAwardService for the badges the user now qualifies for
 * - Emits game engine events for UI updates
 * - Logs all gamification events to audit trail
 *
 * There is no strategy registry: badges are declarative database rules and XP
 * amounts are policy functions. Order inside each handler matters and is fixed:
 * pay event XP → record the event's own state → evaluate badges, so a badge
 * rule always sees the state the event produced (not the previous one).
 */

import { createLogger } from '@/shared/logger/logger.js';

import type { StreakService } from '@/features/gamification/application/services/streak.service.js';
import type {
  AwardXpOutcome,
  AwardXpService,
} from '@/features/gamification/application/services/award-xp.service.js';
import type {
  BadgeAwardOutcome,
  BadgeAwardService,
} from '@/features/gamification/application/services/badge-award.service.js';
import { calculateLessonXp } from '@/features/gamification/domain/lesson-xp.policy.js';

import type { EventBus } from '@/shared/events/event-bus.port';
import { getEventBus } from '@/shared/events/event-bus.port';
import type {
  LessonCompletedPayload,
  DailyLoginPayload,
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedEvent,
} from '@/shared/events/game-events.port';
import { GameDomainEvents, GameEngineEvents } from '@/shared/events/game-events.port';
import type {
  IUserGamificationRepository,
  IGamificationAuditRepository,
  GamificationProfile,
  GamificationAuditLogEntry,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';

export class GameEngineCore {
  private eventBus: EventBus;
  private unsubscribers: Array<() => void> = [];
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private userGamificationRepo: IUserGamificationRepository,
    private streakService: StreakService,
    private progressRepo: ProgressRepository,
    private readonly awardXpService: AwardXpService,
    private readonly badgeAwardService: BadgeAwardService,
    eventBus?: EventBus,
    logger?: ReturnType<typeof createLogger>,
    private auditRepo?: IGamificationAuditRepository,
  ) {
    this.eventBus = eventBus ?? getEventBus();
    this.logger = logger ?? createLogger();
  }

  /**
   * Initialize the game engine by subscribing to domain events.
   * Call this method after constructing the engine.
   */
  initialize(): void {
    this.logger.info('[GameEngine] Initializing...');

    // Subscribe to lesson completion
    this.unsubscribers.push(
      this.eventBus.subscribe<LessonCompletedPayload>(
        GameDomainEvents.LESSON_COMPLETED,
        this.handleLessonCompleted.bind(this),
      ),
    );

    // Subscribe to daily login
    this.unsubscribers.push(
      this.eventBus.subscribe<DailyLoginPayload>(
        GameDomainEvents.DAILY_LOGIN,
        this.handleDailyLogin.bind(this),
      ),
    );

    this.logger.info('[GameEngine] Initialized and listening for events');
  }

  /**
   * Clean up subscriptions. Call when shutting down.
   */
  shutdown(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    this.logger.info('[GameEngine] Shutdown complete');
  }

  /**
   * Get a user's full gamification profile.
   */
  async getProfile(userId: string): Promise<GamificationProfile> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    if (!profile) {
      // Auto-create if doesn't exist
      return this.userGamificationRepo.getOrCreate(userId);
    }
    return profile;
  }

  /**
   * Handle lesson completion event.
   */
  private async handleLessonCompleted(payload: LessonCompletedPayload): Promise<void> {
    const userId = payload.userId;

    try {
      this.logger.info(`[GameEngine] Processing LESSON_COMPLETED for user ${userId}`);

      // XP is idempotent per lesson: a repeated LESSON_COMPLETED is a no-op even
      // though the lesson is no longer in the `not completed` set.
      const award = await this.awardXpService.award({
        userId,
        amount: calculateLessonXp(payload.accuracy),
        source: 'LESSON',
        sourceRef: payload.lessonId,
      });

      // Mark the lesson completed BEFORE badge evaluation, so a LESSON_COUNT
      // rule counts this lesson instead of the one before it.
      await this.markLessonAsMastered(userId, payload.lessonId);

      const badgeOutcome = await this.badgeAwardService.awardApplicable(userId);

      await this.emitXpAward(userId, award, 'LESSON');
      await this.emitBadges(userId, badgeOutcome);

      // Log to audit trail
      await this.logToAudit(
        userId,
        'LESSON_COMPLETED',
        {
          lessonId: payload.lessonId,
          xpAwarded: award.xpAwarded,
          duplicate: award.duplicate,
          badges: badgeOutcome.badges.map((badge) => badge.code),
          badgeXpAwarded: badgeOutcome.xp?.xpAwarded ?? 0,
        },
        award.xpAwarded,
        badgeOutcome.badges.map((badge) => badge.code),
        true,
      );

      this.logger.info(
        `[GameEngine] Lesson completion processed: +${award.xpAwarded} XP, ${badgeOutcome.badges.length} badges`,
      );
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error processing lesson completion');
      await this.logToAudit(
        userId,
        'LESSON_COMPLETED',
        {
          lessonId: payload.lessonId,
        },
        0,
        [],
        false,
        (error as Error).message,
      );
    }
  }

  /**
   * Mark a lesson as MASTERED in UserProgress.
   * This is used to track which lessons have been completed.
   */
  private async markLessonAsMastered(userId: string, recipeId: string): Promise<void> {
    try {
      await this.progressRepo.findOrCreateByUserAndRecipe(userId, recipeId, 'MASTERED');
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error marking lesson as MASTERED');
    }
  }

  /**
   * Handle daily login event.
   * Uses StreakService for accurate streak tracking with timezone handling.
   *
   * `StreakResult.bonusXP` is the one and only streak bonus: it used to be paid
   * twice (once by the service, once by a strategy with the same thresholds).
   */
  private async handleDailyLogin(payload: DailyLoginPayload): Promise<void> {
    const userId = payload.userId;

    try {
      this.logger.info(`[GameEngine] Processing DAILY_LOGIN for user ${userId}`);

      const streakResult = await this.streakService.recordDailyLogin(userId, payload.loginDate);

      // Emit streak update event with extended info
      await this.eventBus.emit<StreakUpdatedEvent>(GameEngineEvents.STREAK_UPDATED, {
        userId: payload.userId,
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        isNewRecord: streakResult.isNewRecord,
        streakBonusXP: streakResult.bonusXP,
        streakBroken: streakResult.streakWasBroken,
      });

      const award = await this.awardXpService.award({
        userId,
        amount: streakResult.bonusXP,
        source: 'STREAK_DAILY',
        // One streak bonus per calendar day, even if the event repeats.
        sourceRef: payload.loginDate.toISOString().slice(0, 10),
      });

      const badgeOutcome = await this.badgeAwardService.awardApplicable(userId);

      await this.emitXpAward(userId, award, 'DAILY_LOGIN');
      await this.emitBadges(userId, badgeOutcome);

      // Log to audit trail
      await this.logToAudit(
        userId,
        'DAILY_LOGIN',
        {
          loginDate: payload.loginDate,
          streak: streakResult.currentStreak,
          xpAwarded: award.xpAwarded,
          duplicate: award.duplicate,
          badges: badgeOutcome.badges.map((badge) => badge.code),
          badgeXpAwarded: badgeOutcome.xp?.xpAwarded ?? 0,
        },
        award.xpAwarded,
        badgeOutcome.badges.map((badge) => badge.code),
        true,
      );
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error processing daily login');
      await this.logToAudit(
        userId,
        'DAILY_LOGIN',
        {
          loginDate: payload.loginDate,
        },
        0,
        [],
        false,
        (error as Error).message,
      );
    }
  }

  /**
   * Log gamification event to audit trail.
   */
  private async logToAudit(
    userId: string,
    eventType: string,
    details: Record<string, unknown>,
    xpAwarded: number,
    badgesAwarded: string[],
    succeeded: boolean,
    errorMessage?: string,
  ): Promise<void> {
    if (!this.auditRepo) return;

    const entry: GamificationAuditLogEntry = {
      userId,
      eventType,
      details,
      xpAwarded,
      badgesAwarded,
      succeeded,
      errorMessage,
    };

    try {
      await this.auditRepo.logEvent(entry);
    } catch (err) {
      this.logger.error({ err }, '[GameEngine] Failed to log audit event');
    }
  }

  /**
   * Emit the XP movement of the triggering event.
   * Runs after the ledger transaction commits.
   */
  private async emitXpAward(
    userId: string,
    award: AwardXpOutcome,
    source: 'LESSON' | 'DAILY_LOGIN',
  ): Promise<void> {
    if (!award.awarded || award.xpAwarded <= 0) {
      return;
    }

    await this.emitXpChanged(userId, award, source);
  }

  /**
   * Emit badge rewards: one event per new badge, then the XP they paid.
   */
  private async emitBadges(userId: string, outcome: BadgeAwardOutcome): Promise<void> {
    if (outcome.badges.length > 0) {
      const totalBadges = (await this.userGamificationRepo.findByUserId(userId))?.totalBadges ?? 0;

      for (const badge of outcome.badges) {
        await this.eventBus.emit<BadgeEarnedPayload>(GameEngineEvents.BADGE_EARNED, {
          userId,
          badgeCode: badge.code,
          badgeName: badge.name,
          badgeIcon: badge.icon,
          xpReward: badge.xpReward,
          totalBadges,
        });
      }
    }

    if (!outcome.xp) {
      return;
    }

    await this.emitXpChanged(
      userId,
      {
        awarded: true,
        duplicate: false,
        xpAwarded: outcome.xp.xpAwarded,
        previousTotalXP: outcome.xp.previousTotalXP,
        newTotalXP: outcome.xp.newTotalXP,
        previousLevel: outcome.xp.previousLevel,
        newLevel: outcome.xp.newLevel,
        leveledUp: outcome.xp.leveledUp,
        newLevelTitle: outcome.xp.newLevelTitle,
        newLevelIcon: outcome.xp.newLevelIcon,
      },
      'BADGE',
    );
  }

  private async emitXpChanged(
    userId: string,
    award: AwardXpOutcome,
    source: string,
  ): Promise<void> {
    await this.eventBus.emit<XPChangedPayload>(GameEngineEvents.XP_CHANGED, {
      userId,
      previousXP: Math.max(0, award.previousTotalXP),
      newXP: award.newTotalXP,
      delta: award.xpAwarded,
      source,
    });

    if (award.leveledUp && award.newLevelTitle) {
      await this.eventBus.emit<LevelUpPayload>(GameEngineEvents.LEVEL_UP, {
        userId,
        previousLevel: award.previousLevel,
        newLevel: award.newLevel,
        newLevelTitle: award.newLevelTitle,
        newIcon: award.newLevelIcon ?? '🌟',
        newTotalXP: award.newTotalXP,
      });
    }
  }
}
