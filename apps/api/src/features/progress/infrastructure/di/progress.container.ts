import type pino from 'pino';

import { PrismaProgressRepository } from '@/features/progress/infrastructure/persistence/prisma-progress.repository.js';
import { PrismaCompetencyMasteryRepository } from '@/features/progress/infrastructure/persistence/prisma-competency-mastery.repository.js';
import { ProgressService } from '@/features/progress/domain/services/progress.service.js';
import { TrackProgressUseCase } from '@/features/progress/application/use-cases/track-progress.use-case.js';

export interface ProgressContainer {
  progressRepository: PrismaProgressRepository;
  competencyMasteryRepository: PrismaCompetencyMasteryRepository;
  progressService: ProgressService;
  trackProgressUseCase: TrackProgressUseCase;
}

export function buildProgressContainer(_logger: pino.Logger): ProgressContainer {
  const progressRepository = new PrismaProgressRepository();
  const competencyMasteryRepository = new PrismaCompetencyMasteryRepository();

  const progressService = new ProgressService(progressRepository);

  return {
    progressRepository,
    competencyMasteryRepository,
    progressService,
    trackProgressUseCase: new TrackProgressUseCase(progressRepository),
  };
}