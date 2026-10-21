import type pino from 'pino';

import { PrismaUserGamificationRepository } from '@/features/gamification/infrastructure/persistence/prisma-user-gamification.repository.js';
import { PrismaBadgeRepository } from '@/features/gamification/infrastructure/persistence/prisma-badge.repository.js';
import { PrismaLevelConfigRepository } from '@/features/gamification/infrastructure/persistence/prisma-level-config.repository.js';
import { PrismaDailyActivityRepository } from '@/features/gamification/infrastructure/persistence/prisma-daily-activity.repository.js';
import { PrismaAuditRepository } from '@/features/gamification/infrastructure/persistence/prisma-audit.repository.js';
import { LevelService } from '@/features/gamification/application/services/level.service.js';
import { AwardXpService } from '@/features/gamification/application/services/award-xp.service.js';
import { StreakService } from '@/features/gamification/application/services/streak.service.js';
import { BadgeRuleEvaluator } from '@/features/gamification/application/services/badge-rule.evaluator.js';
import { BadgeAwardService } from '@/features/gamification/application/services/badge-award.service.js';
import { BadgeProgressCalculator } from '@/features/gamification/application/services/badge-progress.service.js';
import { BadgeEngine } from '@/features/gamification/application/services/badge-engine.service.js';
import { GameEngineCore } from '@/features/gamification/application/services/game-engine-core.service.js';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port';
import { prisma } from '@/database/client.js';
import { PrismaGamificationTransactionService } from '@/features/gamification/infrastructure/persistence/prisma-gamification-transaction.service.js';

export interface GamificationContainer {
  userGamificationRepository: PrismaUserGamificationRepository;
  badgeRepository: PrismaBadgeRepository;
  levelConfigRepository: PrismaLevelConfigRepository;
  dailyActivityRepository: PrismaDailyActivityRepository;
  levelService: LevelService;
  awardXpService: AwardXpService;
  streakService: StreakService;
  badgeRuleEvaluator: BadgeRuleEvaluator;
  badgeAwardService: BadgeAwardService;
  badgeProgressCalc: BadgeProgressCalculator;
  badgeEngine: BadgeEngine;
  gameEngine: GameEngineCore;
}

export function buildGamificationContainer(
  logger: pino.Logger,
  progressRepo: ProgressRepository,
  activityAttemptRepo: ActivityAttemptRepository,
): GamificationContainer {
  const badgeRepository = new PrismaBadgeRepository();
  const levelConfigRepository = new PrismaLevelConfigRepository();
  const dailyActivityRepository = new PrismaDailyActivityRepository();

  const levelService = new LevelService(levelConfigRepository);
  const userGamificationRepository = new PrismaUserGamificationRepository(levelService);
  const streakService = new StreakService(userGamificationRepository, dailyActivityRepository);

  const transactionService = new PrismaGamificationTransactionService();
  const awardXpService = new AwardXpService(
    transactionService,
    userGamificationRepository,
    levelService,
  );

  const badgeRuleEvaluator = new BadgeRuleEvaluator(
    userGamificationRepository,
    progressRepo,
    activityAttemptRepo,
  );

  const badgeAwardService = new BadgeAwardService(
    badgeRepository,
    userGamificationRepository,
    transactionService,
    awardXpService,
    badgeRuleEvaluator,
  );

  const badgeProgressCalc = new BadgeProgressCalculator(badgeRepository, badgeRuleEvaluator);
  const badgeEngine = new BadgeEngine(badgeRepository, badgeProgressCalc);

  const auditRepository = new PrismaAuditRepository(prisma);

  const gameEngine = new GameEngineCore(
    userGamificationRepository,
    streakService,
    progressRepo,
    awardXpService,
    badgeAwardService,
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
    awardXpService,
    streakService,
    badgeRuleEvaluator,
    badgeAwardService,
    badgeProgressCalc,
    badgeEngine,
    gameEngine,
  };
}
