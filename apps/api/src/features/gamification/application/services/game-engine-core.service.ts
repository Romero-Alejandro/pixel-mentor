/**
 * GameEngineCore - Central orchestrator for gamification.
 *
 * This class is the heart of the gamification system. It:
 * - Subscribes to domain events (lesson completion, activity attempts, etc.)
 * - Processes those events through reward strategies
 * - Updates user gamification state
 * - Emits game engine events for UI updates
 * - Uses MutexManager for atomic per-user operations
 * - Logs all gamification events to audit trail
 */

import { createLogger } from '@/shared/logger/logger.js';
import { GamificationConfig } from '@/features/gamification/config/gamification.config.js';

import type { RewardContext } from '@/features/gamification/application/strategies/reward.types.js';
import type { StrategyRegistry } from '@/features/gamification/application/strategies/strategy-registry.js';
import type { StreakService } from '@/features/gamification/application/services/streak.service.js';
import { mutexManager } from '@/features/gamification/application/services/mutex-manager.service.js';

import type { EventBus } from '@/shared/events/event-bus.port';
import { getEventBus } from '@/shared/events/event-bus.port';
import type {
  LessonCompletedPayload,
  ActivityAttemptPayload,
  DailyLoginPayload,
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedPayload,
  StreakUpdatedEvent,
} from '@/shared/events/game-events.port';
import { GameDomainEvents, GameEngineEvents } from '@/shared/events/game-events.port';
import type {
  GamificationTxClient,
  IGamificationTransactionService,
} from '@/features/gamification/domain/ports/gamification-transaction.port.js';
import type {
  IUserGamificationRepository,
  IBadgeRepository,
  IGamificationAuditRepository,
  RewardResult,
  GamificationProfile,
  GamificationAuditLogEntry,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';

/**
 * Level titles (Spanish) for level-up events.
 */
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Semilla',
  2: 'Brote',
  3: 'Flor',
  4: 'Árbol',
  5: 'Bosque',
  6: 'Montaña',
};

/** XP-award outcome returned by {@link GameEngineCore.applyXPInTx}. */
interface XpUpdateResult {
  newTotalXP: number;
  leveledUp: boolean;
  newLevel?: number;
  newLevelTitle?: string;
}

export class GameEngineCore {
  private eventBus: EventBus;
  private unsubscribers: Array<() => void> = [];
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    private userGamificationRepo: IUserGamificationRepository,
    private badgeRepo: IBadgeRepository,
    private strategyRegistry: StrategyRegistry,
    private streakService: StreakService,
    private progressRepo: ProgressRepository,
    private readonly transactionService: IGamificationTransactionService,
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

    // Subscribe to activity attempts
    this.unsubscribers.push(
      this.eventBus.subscribe<ActivityAttemptPayload>(
        GameDomainEvents.ACTIVITY_ATTEMPT,
        this.handleActivityAttempt.bind(this),
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
   * Build reward context for strategy execution.
   */
  private async buildRewardContext(
    userId: string,
    eventType: string,
    payload: LessonCompletedPayload | ActivityAttemptPayload | DailyLoginPayload,
  ): Promise<RewardContext> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    const earnedBadges = await this.badgeRepo.getUserBadges(userId);

    const completedProgress = await this.progressRepo.findMasteredByUser(userId);
    const completedLessonIds = completedProgress
      .map((p) => p.recipeId)
      .filter((id): id is string => id !== null);

    return {
      userId,
      event: {
        type: eventType,
        payload,
      },
      metadata: {
        profile: profile
          ? {
              level: profile.level,
              totalXP: profile.currentXP,
              streak: profile.streak,
              longestStreak: profile.longestStreak,
              totalBadges: profile.totalBadges,
              completedLessons: completedLessonIds.length,
            }
          : undefined,
        earnedBadgeCodes: earnedBadges.map((b) => b.code),
        completedLessonIds,
      },
    };
  }

  /**
   * Handle lesson completion event.
   */
  private async handleLessonCompleted(payload: LessonCompletedPayload): Promise<void> {
    const userId = payload.userId;
    const release = mutexManager.acquireLock(userId);

    try {
      this.logger.info(`[GameEngine] Processing LESSON_COMPLETED for user ${userId}`);

      // Build context for strategy execution
      const context = await this.buildRewardContext(
        userId,
        GameDomainEvents.LESSON_COMPLETED,
        payload,
      );

      // Execute strategies (LessonCompletionStrategy, FirstLessonBadgeStrategy)
      const strategyResult = await this.strategyRegistry.execute(context);

      const xpToAward = strategyResult.totalXP + strategyResult.totalStreakBonus;
      const newBadges: Array<{ code: string; name: string; icon: string }> = [];

      // Use atomic transaction for all state changes
      if (xpToAward > 0 || strategyResult.badgesToAward.length > 0) {
        await this.transactionService.execute(async (tx) => {
          // Apply XP rewards atomically (single update; level is derived,
          // not stored, so no second write is needed unless leveling up)
          const xpResult =
            xpToAward > 0
              ? await this.applyXPInTx(tx, userId, xpToAward)
              : { newTotalXP: 0, leveledUp: false, newLevel: undefined, newLevelTitle: undefined };

          // Award badges within the same transaction (batched)
          const badgesEarned = await this.awardBadgesInTx(tx, userId, strategyResult.badgesToAward);
          newBadges.push(...badgesEarned);

          const result: RewardResult = {
            xpAwarded: xpToAward,
            newTotalXP: xpResult.newTotalXP,
            leveledUp: xpResult.leveledUp,
            newLevel: xpResult.newLevel,
            newLevelTitle: xpResult.newLevelTitle,
            badgesEarned: newBadges,
            streakUpdated: false,
          };

          // Emit game engine events for UI
          await this.emitRewardsEarned(userId, result);
        });
      }

      // Mark lesson as MASTERED in UserProgress (if not already)
      await this.markLessonAsMastered(userId, payload.lessonId);

      // Log to audit trail
      await this.logToAudit(
        userId,
        'LESSON_COMPLETED',
        {
          lessonId: payload.lessonId,
          xpAwarded: xpToAward,
          badges: newBadges.map((b) => b.code),
        },
        xpToAward,
        newBadges.map((b) => b.code),
        true,
      );

      this.logger.info(
        `[GameEngine] Lesson completion processed: +${xpToAward} XP, ${newBadges.length} badges`,
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
    } finally {
      release();
    }
  }

  private getLevelTitle(level: number): string {
    return LEVEL_TITLES[level] ?? `Nivel ${level}`;
  }

  /**
   * Apply an XP increment inside an active reward transaction.
   *
   * Single `update` (the redundant `level` write is gone: `level` is derived
   * from totalXP on read, so writing it back is a no-op). Detects level-up by
   * comparing the previous level (read from the repository) with the row
   * returned by the update.
   */
  private async applyXPInTx(
    tx: GamificationTxClient,
    userId: string,
    xpToAward: number,
  ): Promise<XpUpdateResult> {
    const profile = await this.userGamificationRepo.findByUserId(userId);
    const previousLevel = profile?.level ?? 1;

    const updated = await tx.userGamification.update({
      where: { userId },
      data: { totalXP: { increment: xpToAward } },
    });

    const leveledUp = updated.level > previousLevel;
    if (leveledUp) {
      // Level-up only: persist the new level so profile reads stay consistent
      await tx.userGamification.update({ where: { userId }, data: { level: updated.level } });
    }

    return {
      newTotalXP: updated.totalXP,
      leveledUp,
      newLevel: leveledUp ? updated.level : undefined,
      newLevelTitle: leveledUp ? this.getLevelTitle(updated.level) : undefined,
    };
  }

  /**
   * Award badges inside an active reward transaction.
   *
   * Single round-trip per concern (no per-badge sequential lookups):
   * - One `userGamification.findUnique` for the whole batch
   * - Resolves all badge codes at once via `findMany({ code: { in } })`
   * - Resolves existing user-badges at once via `findMany({ userId, badgeId: { in } })`
   *
   * Returns the newly created badges (code/name/icon) for UI events.
   */
  private async awardBadgesInTx(
    tx: GamificationTxClient,
    userId: string,
    badgesToAward: ReadonlyArray<{ code: string }>,
  ): Promise<Array<{ code: string; name: string; icon: string }>> {
    if (badgesToAward.length === 0) return [];

    const newBadges: Array<{ code: string; name: string; icon: string }> = [];

    let userGamification = await tx.userGamification.findUnique({ where: { userId } });
    if (!userGamification) {
      userGamification = await tx.userGamification.create({
        data: { userId, totalXP: 0, currentStreak: 0, longestStreak: 0, level: 1 },
      });
    }

    const badgeRecords = await tx.badge.findMany({
      where: { code: { in: badgesToAward.map((b) => b.code) } },
    });
    if (badgeRecords.length === 0) return [];

    const existing = await tx.userBadge.findMany({
      where: { userId, badgeId: { in: badgeRecords.map((b) => b.id) } },
    });
    const existingBadgeIds = new Set(existing.map((b) => b.badgeId));

    const missingBadgeIds = badgeRecords
      .filter((b) => !existingBadgeIds.has(b.id))
      .map((b) => b.id);
    if (missingBadgeIds.length === 0) return [];

    await tx.userBadge.createMany({
      data: missingBadgeIds.map((badgeId) => ({
        userId,
        badgeId,
        userGamificationId: userGamification.id,
      })),
    });

    for (const badgeRec of badgeRecords) {
      if (!existingBadgeIds.has(badgeRec.id)) {
        newBadges.push({ code: badgeRec.code, name: badgeRec.name, icon: badgeRec.icon });
      }
    }
    return newBadges;
  }

  /**
   * Mark a lesson as MASTERED in UserProgress.
   * This is used to track which lessons have been completed,
   * so XP is only awarded on the first completion.
   */
  private async markLessonAsMastered(userId: string, recipeId: string): Promise<void> {
    try {
      await this.progressRepo.findOrCreateByUserAndRecipe(userId, recipeId, 'MASTERED');
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error marking lesson as MASTERED');
    }
  }

  /**
   * Handle activity attempt event (perfect score).
   */
  private async handleActivityAttempt(payload: ActivityAttemptPayload): Promise<void> {
    const userId = payload.userId;
    const release = mutexManager.acquireLock(userId);

    try {
      if (payload.correct && payload.attemptNumber === 1) {
        // Perfect score bonus - award XP
        this.logger.info(`[GameEngine] Processing PERFECT ATTEMPT for user ${userId}`);

        const perfectBonus = GamificationConfig.PERFECT_FIRST_ATTEMPT_BONUS;

        // Build context for strategy execution
        const context = await this.buildRewardContext(
          userId,
          GameDomainEvents.ACTIVITY_ATTEMPT,
          payload,
        );

        // Execute badge strategies (could award badges for perfect attempts)
        const strategyResult = await this.strategyRegistry.execute(context);

        const newBadges: Array<{ code: string; name: string; icon: string }> = [];

        // Use atomic transaction for all state changes
        await this.transactionService.execute(async (tx) => {
          const xpResult = await this.applyXPInTx(tx, userId, perfectBonus);

          // Award badges within transaction (batched)
          const badgesEarned = await this.awardBadgesInTx(tx, userId, strategyResult.badgesToAward);
          newBadges.push(...badgesEarned);

          const result: RewardResult = {
            xpAwarded: perfectBonus,
            newTotalXP: xpResult.newTotalXP,
            leveledUp: false,
            newLevel: undefined,
            newLevelTitle: undefined,
            badgesEarned: newBadges,
            streakUpdated: false,
          };

          await this.emitRewardsEarned(userId, result);
        });

        // Log to audit trail
        await this.logToAudit(
          userId,
          'ACTIVITY_ATTEMPT',
          {
            activityId: payload.activityId,
            perfectAttempt: true,
          },
          perfectBonus,
          newBadges.map((b) => b.code),
          true,
        );
      }
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error processing activity attempt');
      await this.logToAudit(
        userId,
        'ACTIVITY_ATTEMPT',
        {
          activityId: payload.activityId,
        },
        0,
        [],
        false,
        (error as Error).message,
      );
    } finally {
      release();
    }
  }

  /**
   * Handle daily login event.
   * Uses StreakService for accurate streak tracking with timezone handling.
   */
  private async handleDailyLogin(payload: DailyLoginPayload): Promise<void> {
    const userId = payload.userId;
    const release = mutexManager.acquireLock(userId);

    try {
      this.logger.info(`[GameEngine] Processing DAILY_LOGIN for user ${userId}`);

      // Record activity and get streak result using StreakService
      const streakResult = await this.streakService.recordDailyLogin(userId, payload.loginDate);

      // Build context for strategy execution with updated streak
      const context = await this.buildRewardContext(userId, GameDomainEvents.DAILY_LOGIN, payload);

      // Execute strategies (StreakBonusStrategy, StreakMilestoneStrategy)
      const strategyResult = await this.strategyRegistry.execute(context);

      // Calculate total bonus XP from streak + strategies
      const totalStreakBonus = streakResult.bonusXP + strategyResult.totalStreakBonus;

      // Emit streak update event with extended info
      await this.eventBus.emit<StreakUpdatedEvent>(GameEngineEvents.STREAK_UPDATED, {
        userId: payload.userId,
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        isNewRecord: streakResult.isNewRecord,
        streakBonusXP: totalStreakBonus,
        streakBroken: streakResult.streakWasBroken,
      });

      // Also emit legacy StreakUpdatedPayload for backwards compatibility
      await this.eventBus.emit<StreakUpdatedPayload>(GameEngineEvents.STREAK_UPDATED, {
        userId: payload.userId,
        currentStreak: streakResult.currentStreak,
        longestStreak: streakResult.longestStreak,
        streakBroken: streakResult.streakWasBroken,
      });

      const newBadges: Array<{ code: string; name: string; icon: string }> = [];

      // Use atomic transaction for all state changes
      if (totalStreakBonus > 0 || strategyResult.badgesToAward.length > 0) {
        await this.transactionService.execute(async (tx) => {
          // Apply streak bonus XP (single update; level is derived, not stored)
          const xpResult =
            totalStreakBonus > 0
              ? await this.applyXPInTx(tx, userId, totalStreakBonus)
              : { newTotalXP: 0, leveledUp: false, newLevel: undefined, newLevelTitle: undefined };

          // Award badges within transaction (batched)
          const badgesEarned = await this.awardBadgesInTx(tx, userId, strategyResult.badgesToAward);
          newBadges.push(...badgesEarned);

          const result: RewardResult = {
            xpAwarded: totalStreakBonus,
            newTotalXP: xpResult.newTotalXP,
            leveledUp: xpResult.leveledUp,
            newLevel: xpResult.newLevel,
            newLevelTitle: xpResult.newLevelTitle,
            badgesEarned: newBadges,
            streakUpdated: true,
            newStreak: streakResult.currentStreak,
            isNewStreak: streakResult.streakWasBroken === false && streakResult.currentStreak > 1,
          };

          await this.emitRewardsEarned(userId, result);
        });
      }

      // Log to audit trail
      await this.logToAudit(
        userId,
        'DAILY_LOGIN',
        {
          loginDate: payload.loginDate,
          streak: streakResult.currentStreak,
          xpAwarded: totalStreakBonus,
          badges: newBadges.map((b) => b.code),
        },
        totalStreakBonus,
        newBadges.map((b) => b.code),
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
    } finally {
      release();
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
   * Emit rewards earned events for UI updates.
   */
  private async emitRewardsEarned(userId: string, result: RewardResult): Promise<void> {
    // Emit XP changed if XP was awarded
    if (result.xpAwarded > 0) {
      const profile = await this.userGamificationRepo.findByUserId(userId);
      const previousXP = profile ? profile.currentXP - result.xpAwarded : 0;

      await this.eventBus.emit<XPChangedPayload>(GameEngineEvents.XP_CHANGED, {
        userId,
        previousXP: Math.max(0, previousXP),
        newXP: result.newTotalXP,
        delta: result.xpAwarded,
        source: 'LESSON_COMPLETED',
      });
    }

    // Emit level up if applicable
    if (result.leveledUp && result.newLevel) {
      await this.eventBus.emit<LevelUpPayload>(GameEngineEvents.LEVEL_UP, {
        userId,
        previousLevel: result.newLevel - 1,
        newLevel: result.newLevel,
        newLevelTitle: result.newLevelTitle ?? LEVEL_TITLES[result.newLevel] ?? '',
        newIcon: this.getLevelIcon(result.newLevel),
      });
    }

    // Emit badges earned
    for (const badge of result.badgesEarned) {
      await this.eventBus.emit<BadgeEarnedPayload>(GameEngineEvents.BADGE_EARNED, {
        userId,
        badgeCode: badge.code,
        badgeName: badge.name,
        badgeIcon: badge.icon,
        totalBadges: (await this.userGamificationRepo.findByUserId(userId))?.totalBadges ?? 0,
      });
    }
  }

  /**
   * Get the icon for a level.
   */
  private getLevelIcon(level: number): string {
    const icons: Record<number, string> = {
      1: '🌱',
      2: '🌿',
      3: '🌸',
      4: '🌳',
      5: '🌲',
      6: '🏆',
    };
    return icons[level] ?? '🌟';
  }
}
