import type pino from 'pino';

import { PrismaActivityRepository } from '@/features/activity/infrastructure/persistence/prisma-activity.repository.js';
import { PrismaActivityAttemptRepository } from '@/features/activity/infrastructure/persistence/prisma-activity-attempt.repository.js';
import { AttemptActivityUseCase } from '@/features/activity/application/use-cases/attempt-activity.use-case.js';

export interface ActivityContainer {
  activityRepository: PrismaActivityRepository;
  activityAttemptRepository: PrismaActivityAttemptRepository;
  attemptActivityUseCase: AttemptActivityUseCase;
}

export function buildActivityContainer(_logger: pino.Logger): ActivityContainer {
  const activityRepository = new PrismaActivityRepository();
  const activityAttemptRepository = new PrismaActivityAttemptRepository();

  return {
    activityRepository,
    activityAttemptRepository,
    attemptActivityUseCase: new AttemptActivityUseCase(activityAttemptRepository, null as any),
  };
}
