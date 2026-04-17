import type pino from 'pino';

import { PrismaUserGamificationRepository } from '../persistence/prisma-user-gamification.repository.js';
import { PrismaBadgeRepository } from '../persistence/prisma-badge.repository.js';
import { PrismaLevelConfigRepository } from '../persistence/prisma-level-config.repository.js';
import { PrismaDailyActivityRepository } from '../persistence/prisma-daily-activity.repository.js';
import { PrismaAuditRepository } from '../persistence/prisma-audit.repository.js';
import { LevelService } from '../../application/services/level.service.js';
import { StreakService } from '../../application/services/streak.service.js';
import { BadgeProgressCalculator } from '../../application/services/badge-progress.service.js';
import { BadgeEngine } from '../../application/services/badge-engine.service.js';
import { StrategyRegistry } from '../../application/strategies/strategy-registry.js';
import { GameEngineCore } from '../../application/services/game-engine-core.service.js';
import {
  LessonCompletionStrategy,
  FirstLessonBadgeStrategy,
  StreakMilestone7Strategy,
  StreakMilestone30Strategy,
  StreakBonusStrategy,
} from '../../application/strategies/index.js';

import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port';
import { prisma } from '@/database/client.js';

export interface GamificationContainer {
  userGamificationRepository: PrismaUserGamificationRepository;
  badgeRepository: PrismaBadgeRepository;
  levelConfigRepository: PrismaLevelConfigRepository;
  dailyActivityRepository: PrismaDailyActivityRepository;
  levelService: LevelService;
  streakService: StreakService;
  badgeProgressCalc: BadgeProgressCalculator;
  badgeEngine: BadgeEngine;
  strategyRegistry: StrategyRegistry;
  gameEngine: GameEngineCore;
}

export function buildGamificationContainer(
  logger: pino.Logger,
  progressRepo: ProgressRepository,
  activityAttemptRepo: ActivityAttemptRepository,
): GamificationContainer {
  const userGamificationRepository = new PrismaUserGamificationRepository();
  const badgeRepository = new PrismaBadgeRepository();
  const levelConfigRepository = new PrismaLevelConfigRepository();
  const dailyActivityRepository = new PrismaDailyActivityRepository();

  const levelService = new LevelService(levelConfigRepository);
  const streakService = new StreakService(userGamificationRepository, dailyActivityRepository);

  const badgeProgressCalc = new BadgeProgressCalculator(
    badgeRepository,
    userGamificationRepository,
    progressRepo,
    activityAttemptRepo,
  );

  const badgeEngine = new BadgeEngine(
    badgeRepository,
    userGamificationRepository,
    badgeProgressCalc,
    progressRepo,
    activityAttemptRepo,
    undefined,
    logger,
  );

  const strategyRegistry = new StrategyRegistry(logger);
  strategyRegistry.register(new LessonCompletionStrategy());
  strategyRegistry.register(new FirstLessonBadgeStrategy());
  strategyRegistry.register(new StreakMilestone7Strategy());
  strategyRegistry.register(new StreakMilestone30Strategy());
  strategyRegistry.register(new StreakBonusStrategy());

  const auditRepository = new PrismaAuditRepository(prisma);

  const gameEngine = new GameEngineCore(
    userGamificationRepository,
    badgeRepository,
    strategyRegistry,
    streakService,
    progressRepo,
    undefined,
    logger,
    auditRepository,
  );
  gameEngine.initialize();

  return {
    userGamificationRepository,
    badgeRepository,
    levelConfigRepository,
    dailyActivityRepository,
    levelService,
    streakService,
    badgeProgressCalc,
    badgeEngine,
    strategyRegistry,
    gameEngine,
  };
}
