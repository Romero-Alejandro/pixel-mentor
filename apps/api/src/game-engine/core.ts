/**
 * GameEngineCore - Central orchestrator for gamification.
 *
 * This class is the heart of the gamification system. It:
 * - Subscribes to domain events (lesson completion, activity attempts, etc.)
 * - Processes those events through reward strategies
 * - Updates user gamification state
 * - Emits game engine events for UI updates
 */

import pino from 'pino';

import type { RewardContext } from './strategies/reward.types';
import type { StrategyRegistry } from './strategies/strategy-registry';
import type { StreakService } from './streak.service';

import type { EventBus } from '@/events/event-bus';
import { getEventBus } from '@/events/event-bus';
import type {
  LessonCompletedPayload,
  ActivityAttemptPayload,
  DailyLoginPayload,
  XPChangedPayload,
  BadgeEarnedPayload,
  LevelUpPayload,
  StreakUpdatedPayload,
  StreakUpdatedEvent,
} from '@/events/game-events';
import { GameDomainEvents, GameEngineEvents } from '@/events/game-events';
import type {
  IUserGamificationRepository,
  IBadgeRepository,
  RewardResult,
  GamificationProfile,
} from '@/domain/ports/gamification-ports';
import { prisma } from '@/infrastructure/adapters/database/client.js';

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

export class GameEngineCore {
  private eventBus: EventBus;
  private unsubscribers: Array<() => void> = [];
  private readonly logger: pino.Logger;

  constructor(
    private userGamificationRepo: IUserGamificationRepository,
    private badgeRepo: IBadgeRepository,
    private strategyRegistry: StrategyRegistry,
    private streakService: StreakService,
    eventBus?: EventBus,
    logger?: pino.Logger,
  ) {
    this.eventBus = eventBus ?? getEventBus();
    this.logger = logger ?? pino({ level: 'silent' });
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

    // Query completed lessons (MASTERED UserProgress entries with recipeId)
    const completedProgress = await prisma.userProgress.findMany({
      where: { userId, status: 'MASTERED', recipeId: { not: null } },
      select: { recipeId: true },
    });
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
    try {
      this.logger.info(`[GameEngine] Processing LESSON_COMPLETED for user ${payload.userId}`);

      // Build context for strategy execution
      const context = await this.buildRewardContext(
        payload.userId,
        GameDomainEvents.LESSON_COMPLETED,
        payload,
      );

      // Execute strategies (LessonCompletionStrategy, FirstLessonBadgeStrategy)
      const strategyResult = await this.strategyRegistry.execute(context);

      // Apply XP rewards
      let newTotalXP = 0;
      let leveledUp = false;
      let newLevel: number | undefined;
      let newLevelTitle: string | undefined;

      if (strategyResult.totalXP > 0) {
        const xpResult = await this.userGamificationRepo.addXP(
          payload.userId,
          strategyResult.totalXP,
        );
        newTotalXP = xpResult.newXP;
        leveledUp = xpResult.leveledUp;
        newLevel = xpResult.newLevel;
        newLevelTitle = xpResult.newLevelTitle;
      }

      // Award streak bonus XP if any
      if (strategyResult.totalStreakBonus > 0) {
        const xpResult = await this.userGamificationRepo.addXP(
          payload.userId,
          strategyResult.totalStreakBonus,
        );
        newTotalXP = xpResult.newXP;
        if (xpResult.leveledUp) {
          leveledUp = true;
          newLevel = xpResult.newLevel;
          newLevelTitle = xpResult.newLevelTitle;
        }
      }

      // Award badges from strategy execution
      const newBadges: Array<{ code: string; name: string; icon: string }> = [];
      for (const badge of strategyResult.badgesToAward) {
        const awarded = await this.badgeRepo.awardBadge(payload.userId, badge.code);
        if (awarded) {
          newBadges.push({ code: badge.code, name: badge.name, icon: badge.icon });
        }
      }

      const result: RewardResult = {
        xpAwarded: strategyResult.totalXP + strategyResult.totalStreakBonus,
        newTotalXP,
        leveledUp,
        newLevel,
        newLevelTitle,
        badgesEarned: newBadges,
        streakUpdated: false,
      };

      // Emit game engine events for UI
      await this.emitRewardsEarned(payload.userId, result);

      // Mark lesson as MASTERED in UserProgress (if not already)
      await this.markLessonAsMastered(payload.userId, payload.lessonId);

      this.logger.info(
        `[GameEngine] Lesson completion processed: +${result.xpAwarded} XP, ${result.badgesEarned.length} badges`,
      );
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error processing lesson completion');
    }
  }

  /**
   * Mark a lesson as MASTERED in UserProgress.
   * This is used to track which lessons have been completed,
   * so XP is only awarded on the first completion.
   */
  private async markLessonAsMastered(userId: string, recipeId: string): Promise<void> {
    try {
      const existing = await prisma.userProgress.findFirst({
        where: { userId, recipeId },
      });

      if (existing) {
        if (existing.status !== 'MASTERED') {
          await prisma.userProgress.update({
            where: { id: existing.id },
            data: {
              status: 'MASTERED',
              attempts: { increment: 1 },
              lastAttemptAt: new Date(),
            },
          });
        }
      } else {
        await prisma.userProgress.create({
          data: {
            userId,
            recipeId,
            status: 'MASTERED',
            attempts: 1,
            lastAttemptAt: new Date(),
          },
        });
      }
    } catch (error) {
      // Don't fail lesson completion if progress tracking fails
      this.logger.error({ err: error }, '[GameEngine] Error marking lesson as MASTERED');
    }
  }

  /**
   * Handle activity attempt event (perfect score).
   */
  private async handleActivityAttempt(payload: ActivityAttemptPayload): Promise<void> {
    try {
      if (payload.correct && payload.attemptNumber === 1) {
        // Perfect score bonus - award XP
        this.logger.info(`[GameEngine] Processing PERFECT ATTEMPT for user ${payload.userId}`);

        const PERFECT_BONUS = 20;
        const xpResult = await this.userGamificationRepo.addXP(payload.userId, PERFECT_BONUS);

        // Build context for strategy execution
        const context = await this.buildRewardContext(
          payload.userId,
          GameDomainEvents.ACTIVITY_ATTEMPT,
          payload,
        );

        // Execute badge strategies (could award badges for perfect attempts)
        const strategyResult = await this.strategyRegistry.execute(context);

        // Award badges from strategy execution
        const newBadges: Array<{ code: string; name: string; icon: string }> = [];
        for (const badge of strategyResult.badgesToAward) {
          const awarded = await this.badgeRepo.awardBadge(payload.userId, badge.code);
          if (awarded) {
            newBadges.push({ code: badge.code, name: badge.name, icon: badge.icon });
          }
        }

        const result: RewardResult = {
          xpAwarded: PERFECT_BONUS,
          newTotalXP: xpResult.newXP,
          leveledUp: xpResult.leveledUp,
          newLevel: xpResult.newLevel,
          newLevelTitle: xpResult.newLevelTitle,
          badgesEarned: newBadges,
          streakUpdated: false,
        };

        await this.emitRewardsEarned(payload.userId, result);
      }
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error processing activity attempt');
    }
  }

  /**
   * Handle daily login event.
   * Uses StreakService for accurate streak tracking with timezone handling.
   */
  private async handleDailyLogin(payload: DailyLoginPayload): Promise<void> {
    try {
      this.logger.info(`[GameEngine] Processing DAILY_LOGIN for user ${payload.userId}`);

      // Record activity and get streak result using StreakService
      const streakResult = await this.streakService.recordDailyLogin(
        payload.userId,
        payload.loginDate,
      );

      // Build context for strategy execution with updated streak
      const context = await this.buildRewardContext(
        payload.userId,
        GameDomainEvents.DAILY_LOGIN,
        payload,
      );

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

      // Apply streak bonus XP from both streak milestone and strategies
      let newTotalXP = 0;
      let leveledUp = false;
      let newLevel: number | undefined;
      let newLevelTitle: string | undefined;

      if (totalStreakBonus > 0) {
        const xpResult = await this.userGamificationRepo.addXP(payload.userId, totalStreakBonus);
        newTotalXP = xpResult.newXP;
        leveledUp = xpResult.leveledUp;
        newLevel = xpResult.newLevel;
        newLevelTitle = xpResult.newLevelTitle;
      }

      // Award badges from strategy execution
      const newBadges: Array<{ code: string; name: string; icon: string }> = [];
      for (const badge of strategyResult.badgesToAward) {
        const awarded = await this.badgeRepo.awardBadge(payload.userId, badge.code);
        if (awarded) {
          newBadges.push({ code: badge.code, name: badge.name, icon: badge.icon });
        }
      }

      const result: RewardResult = {
        xpAwarded: totalStreakBonus,
        newTotalXP,
        leveledUp,
        newLevel,
        newLevelTitle,
        badgesEarned: newBadges,
        streakUpdated: true,
        newStreak: streakResult.currentStreak,
        isNewStreak: streakResult.streakWasBroken === false && streakResult.currentStreak > 1,
      };

      await this.emitRewardsEarned(payload.userId, result);
    } catch (error) {
      this.logger.error({ err: error }, '[GameEngine] Error processing daily login');
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
