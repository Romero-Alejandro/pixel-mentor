import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type pino from 'pino';

import type { GameEngineCore } from '@/game-engine/core';
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

// ===== Route Factory =====

export function createGamificationRouter(
  gameEngine: GameEngineCore,
  userGamificationRepo: IUserGamificationRepository,
  badgeRepository: IBadgeRepository,
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

  // GET /api/gamification/badges — All available badges + user's earned badges
  router.get(
    '/badges',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user!.id;
        const allBadges = await badgeEngine.getAllBadgeDefinitions();
        const userBadges = await badgeRepository.getUserBadges(userId);

        res.json({
          allBadges: allBadges.map((b) => ({
            code: b.code,
            name: b.name,
            description: b.description,
            icon: b.icon,
            xpReward: b.xpReward,
            requirement: {
              type: b.rules.type,
              target: b.rules.value,
            },
          })),
          earnedBadges: userBadges.map((b) => ({
            code: b.code,
            name: b.name,
            description: b.description,
            icon: b.icon,
            earnedAt: b.earnedAt instanceof Date ? b.earnedAt.toISOString() : String(b.earnedAt),
            xpReward: 0,
          })),
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

  return router;
}
