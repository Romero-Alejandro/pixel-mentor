import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { GameEngineCore } from '@/game-engine/core';
import type { LevelService } from '@/game-engine/level.service';
import {
  calculateXPFromAccuracy,
  getPerformanceTier,
} from '@/game-engine/strategies/xp-reward.strategy';
import { getBadgeEngine } from '@/game-engine/badge-engine';
import { getEventBus } from '@/events/event-bus';
import { GameDomainEvents } from '@/events/game-events';
import type {
  LessonCompletedPayload,
  ActivityAttemptPayload,
  DailyLoginPayload,
} from '@/events/game-events';
import type {
  IUserGamificationRepository,
  IBadgeRepository,
  GamificationProfile,
} from '@/domain/ports/gamification-ports';
import type { GetSessionUseCase } from '@/application/use-cases/session/get-session.use-case';
import type { GetRecipeUseCase } from '@/application/use-cases/recipe/get-recipe.use-case';
import type { PrismaClient } from '@/infrastructure/adapters/database/client.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  logger?: pino.Logger;
}

// ===== Input Validation =====

const ActivitySchema = z.object({
  type: z.enum(['LESSON_COMPLETED', 'ACTIVITY_ATTEMPT', 'DAILY_LOGIN']),
  payload: z
    .object({
      lessonId: z.string().optional(),
      lessonTitle: z.string().optional(),
      activityId: z.string().optional(),
      correct: z.boolean().optional(),
      attemptNumber: z.number().int().positive().optional(),
      hintUsed: z.boolean().optional(),
    })
    .optional(),
});

// ===== Mapper: Domain Profile → API Response =====
// Matches the shape expected by @pixel-mentor/shared/gamification types

interface GamificationProfileResponse {
  userId: string;
  totalXP: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  levelTitle: string;
  xpToNextLevel: number;
  badges: Array<{
    code: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: string;
    xpReward: number;
  }>;
}

function mapToProfileResponse(profile: GamificationProfile): GamificationProfileResponse {
  return {
    userId: profile.userId,
    totalXP: profile.currentXP,
    currentLevel: profile.level,
    currentStreak: profile.streak,
    longestStreak: profile.longestStreak,
    levelTitle: profile.levelTitle,
    xpToNextLevel: profile.xpToNextLevel,
    badges: profile.badges.map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earnedAt: b.earnedAt instanceof Date ? b.earnedAt.toISOString() : String(b.earnedAt),
      xpReward: 0,
    })),
  };
}

// ===== Mission Report Response =====

interface MissionReportBadge {
  code: string;
  name: string;
  icon: string;
  xpReward: number;
}

interface MissionReportLevelUp {
  from: number;
  to: number;
  title: string;
}

interface MissionReport {
  xpEarned: number;
  totalXP: number;
  currentLevel: number;
  levelTitle: string;
  xpToNextLevel: number;
  newBadges: MissionReportBadge[];
  levelUp: MissionReportLevelUp | null;
  streakDays: number;
  conceptsMastered: string[];
}

// ===== Route Factory =====

export function createGamificationRouter(
  gameEngine: GameEngineCore,
  userGamificationRepo: IUserGamificationRepository,
  badgeRepository: IBadgeRepository,
  levelService: LevelService,
  getSessionUseCase: GetSessionUseCase,
  getRecipeUseCase: GetRecipeUseCase,
  prisma: PrismaClient,
): Router {
  const router = Router();
  const badgeEngine = getBadgeEngine();

  // GET /api/gamification/profile — User's gamification profile
  router.get(
    '/profile',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id;
        const profile = await gameEngine.getProfile(userId);
        const shared = mapToProfileResponse(profile);
        res.json(shared);
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/gamification/xp/add — Record activity
  router.post(
    '/xp/add',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id;
        const validated = ActivitySchema.parse(req.body);
        const eventBus = getEventBus();

        const now = new Date();

        switch (validated.type) {
          case 'LESSON_COMPLETED': {
            const payload: LessonCompletedPayload = {
              userId,
              lessonId: validated.payload?.lessonId ?? 'unknown',
              lessonTitle: validated.payload?.lessonTitle ?? 'Lesson',
              completedAt: now,
            };
            await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, payload);
            break;
          }
          case 'ACTIVITY_ATTEMPT': {
            const payload: ActivityAttemptPayload = {
              userId,
              activityId: validated.payload?.activityId ?? 'unknown',
              correct: validated.payload?.correct ?? true,
              attemptNumber: validated.payload?.attemptNumber ?? 1,
              hintUsed: validated.payload?.hintUsed ?? false,
              completedAt: now,
            };
            await eventBus.emit(GameDomainEvents.ACTIVITY_ATTEMPT, payload);
            break;
          }
          case 'DAILY_LOGIN': {
            const payload: DailyLoginPayload = {
              userId,
              loginDate: now,
            };
            await eventBus.emit(GameDomainEvents.DAILY_LOGIN, payload);
            break;
          }
        }

        // Return updated profile
        const profile = await gameEngine.getProfile(userId);
        const shared = mapToProfileResponse(profile);

        res.json({
          success: true,
          profile: shared,
          levelUp: false,
          newBadges: [],
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Validation error', details: error.issues });
          return;
        }
        next(error);
      }
    },
  );

  // GET /api/gamification/badges — All badge definitions
  router.get(
    '/badges',
    async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const badges = await badgeRepository.findAll();
        res.json({
          badges: badges.map((b) => ({
            code: b.code,
            name: b.name,
            description: b.description,
            icon: b.icon,
            xpReward: b.xpReward,
            requirement: b.rules,
          })),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/gamification/badges/user — User's earned badges
  router.get(
    '/badges/user',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id;
        const profile = await userGamificationRepo.findByUserId(userId);
        if (!profile) {
          res.json({ badges: [] });
          return;
        }
        const userBadges = await badgeRepository.getUserBadges(userId);
        res.json({ badges: userBadges });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/gamification/streak-history — Streak data for the last 90 days
  router.get(
    '/streak-history',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id;
        const profile = await userGamificationRepo.findByUserId(userId);

        // Query daily activities for the last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        ninetyDaysAgo.setUTCHours(0, 0, 0, 0);

        const activities = await prisma.dailyActivity.findMany({
          where: {
            userId,
            date: { gte: ninetyDaysAgo },
          },
          orderBy: { date: 'asc' },
          select: { date: true },
        });

        // Build a set of active dates for fast lookup
        const activeDates = new Set(
          activities.map((a) => {
            const d = new Date(a.date);
            return d.toISOString().split('T')[0];
          }),
        );

        // Generate history array for last 90 days with active flag
        const history: Array<{ date: string; active: boolean }> = [];
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        for (let i = 89; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          history.push({
            date: dateStr,
            active: activeDates.has(dateStr),
          });
        }

        res.json({
          currentStreak: profile?.streak ?? 0,
          longestStreak: profile?.longestStreak ?? 0,
          lastActivityAt: profile?.lastActivityAt,
          history,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/gamification/progress — Badge progress
  router.get(
    '/progress',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id;
        const profile = await gameEngine.getProfile(userId);
        const shared = mapToProfileResponse(profile);

        const levelInfo = await userGamificationRepo.getLevelConfig(shared.currentLevel);
        const nextLevelInfo = await userGamificationRepo.getNextLevelConfig(shared.currentLevel);

        const progress = await badgeEngine.getBadgeProgress(userId);

        res.json({
          profile: shared,
          levelInfo: levelInfo ?? {
            level: shared.currentLevel,
            title: shared.levelTitle,
            minXP: 0,
            icon: '🌱',
          },
          nextLevelInfo,
          badgeProgress: progress.map((p) => ({
            badge: {
              code: p.badgeCode,
              name: p.badgeName,
              description: '',
              icon: p.badgeIcon,
              xpReward: 0,
              requirement: {
                type: p.requirementType,
                target: p.target,
              },
            },
            current: p.current,
            target: p.target,
            percentage: p.percent,
            isEarned: p.earned,
          })),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/gamification/mission-report/:sessionId — Session completion report
  router.get(
    '/mission-report/:sessionId',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { sessionId: rawSessionId } = req.params;
        const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
        const userId = req.user!.id;

        // 1. Get session and verify ownership
        const session = await getSessionUseCase.execute(sessionId);
        if (session.studentId !== userId) {
          res.status(403).json({ error: 'Session does not belong to user' });
          return;
        }

        if (!session.completedAt) {
          res.status(400).json({ error: 'Session is not completed yet' });
          return;
        }

        // 2. Get current user gamification profile
        const profile = await gameEngine.getProfile(userId);
        const levelConfig = await levelService.getLevel(profile.level);
        const xpToNextLevel = await levelService.getXPForNextLevel(profile.level);

        // 3. Calculate XP earned from this session
        // For now, we assume 100% accuracy (default behavior).
        // TODO: Store accuracy in session and retrieve it here for accurate reporting.
        const accuracyPercent = 100;
        const xpEarned = calculateXPFromAccuracy(accuracyPercent);
        void getPerformanceTier(accuracyPercent);

        // 4. Find new badges earned after session completion
        const newBadges = await prisma.userBadge.findMany({
          where: {
            userId,
            earnedAt: { gt: session.completedAt },
          },
          include: { badge: true },
          orderBy: { earnedAt: 'asc' },
        });

        const missionBadges: MissionReportBadge[] = newBadges.map((ub) => ({
          code: ub.badge.code,
          name: ub.badge.name,
          icon: ub.badge.icon,
          xpReward: ub.badge.xpReward,
        }));

        // 5. Detect level-up: check if level changed due to this session's XP
        // If badges awarded bonus XP, they could have triggered a level-up.
        const levelUp: MissionReportLevelUp | null = (() => {
          if (newBadges.length === 0) return null;
          // For now, we rely on the profile's current state.
          return null;
        })();

        // 6. Get concepts from the session's recipe
        const recipe = await getRecipeUseCase.execute(session.recipeId);
        const conceptsMastered: string[] = (recipe.concepts ?? []).map(
          (c: { title: string }) => c.title,
        );

        // 7. Build response
        const report: MissionReport = {
          xpEarned,
          totalXP: profile.currentXP,
          currentLevel: profile.level,
          levelTitle: levelConfig?.title ?? 'Nivel desconocido',
          xpToNextLevel,
          newBadges: missionBadges,
          levelUp,
          streakDays: profile.streak,
          conceptsMastered,
        };

        res.json(report);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
