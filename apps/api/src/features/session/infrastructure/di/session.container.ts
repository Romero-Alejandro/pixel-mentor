import type pino from 'pino';

import { PrismaSessionRepository } from '@/features/session/infrastructure/persistence/prisma-session.repository.js';
import { PrismaInteractionRepository } from '@/features/session/infrastructure/persistence/prisma-interaction.repository.js';
import { PrismaEventLogRepository } from '@/features/session/infrastructure/persistence/prisma-event-log.repository.js';
import { PostgresAdvisoryLockManager } from '@/features/session/infrastructure/persistence/postgres-advisory-lock.js';
import { EventService } from '@/features/session/application/services/event.service.js';
import { GetSessionUseCase } from '@/features/session/application/use-cases/get-session.use-case.js';
import { ListSessionsUseCase } from '@/features/session/application/use-cases/list-sessions.use-case.js';
import { ResetSessionUseCase } from '@/features/session/application/use-cases/reset-session.use-case.js';
import { CompleteSessionUseCase } from '@/features/session/application/use-cases/complete-session.use-case.js';
import { LogEventUseCase } from '@/features/session/application/use-cases/log-event.use-case.js';

export interface SessionContainer {
  sessionRepository: PrismaSessionRepository;
  interactionRepository: PrismaInteractionRepository;
  eventLogRepository: PrismaEventLogRepository;
  advisoryLock: PostgresAdvisoryLockManager;
  eventService: EventService;
  getSessionUseCase: GetSessionUseCase;
  listSessionsUseCase: ListSessionsUseCase;
  resetSessionUseCase: ResetSessionUseCase;
  completeSessionUseCase: CompleteSessionUseCase;
  logEventUseCase: LogEventUseCase;
}

export function buildSessionContainer(_logger: pino.Logger): SessionContainer {
  const sessionRepository = new PrismaSessionRepository();
  const interactionRepository = new PrismaInteractionRepository();
  const eventLogRepository = new PrismaEventLogRepository();
  const advisoryLock = PostgresAdvisoryLockManager.getInstance();

  const eventService = new EventService(eventLogRepository);

  return {
    sessionRepository,
    interactionRepository,
    eventLogRepository,
    advisoryLock,
    eventService,
    getSessionUseCase: new GetSessionUseCase(sessionRepository),
    listSessionsUseCase: new ListSessionsUseCase(sessionRepository),
    resetSessionUseCase: new ResetSessionUseCase(sessionRepository),
    completeSessionUseCase: new CompleteSessionUseCase(sessionRepository),
    logEventUseCase: new LogEventUseCase(eventLogRepository),
  };
}
