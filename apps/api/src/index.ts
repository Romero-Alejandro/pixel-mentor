import pino from 'pino';
import { config } from '@/config';
import { prisma } from '@/infrastructure/adapters/database/client.js';
import { createApp } from '@/infrastructure/adapters/http/server.js';
import { buildContainer } from './dependency-container';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
  } catch (error: unknown) {
    logger.fatal(error, 'Database connection failed');
    process.exit(1);
  }
}

function setupGracefulShutdown(server: ReturnType<typeof createApp>, shutdownSignal: string): void {
  logger.info({ signal: shutdownSignal }, 'Received shutdown signal');
  let isClosed = false;

  server.close((error) => {
    if (error) {
      logger.error(error, 'Error closing server');
    }

    prisma
      .$disconnect()
      .then(() => {
        logger.info('Database disconnected');
        isClosed = true;
        process.exit(0);
      })
      .catch((disconnectError) => {
        logger.error(disconnectError, 'Error disconnecting database');
        process.exit(1);
      });
  });

  setTimeout(() => {
    if (!isClosed) {
      logger.warn('Force exiting after timeout');
      process.exit(1);
    }
  }, config.REQUEST_TIMEOUT_MS).unref();
}

async function bootstrap(): Promise<void> {
  await verifyDatabaseConnection();

  const container = buildContainer(config, logger);

  const server = createApp({
    config,
    logger,
    prisma,
    ...container.useCases,
    ...container.repositories,
    ...container.services,
    ttsService: container.providers.tts,
  }).listen(config.PORT, () => {
    logger.info(`API running on port ${config.PORT}`);
  });

  server.on('error', (error: Error) => {
    logger.fatal(error, 'Server error');
    process.exit(1);
  });

  process.on('SIGTERM', () => setupGracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => setupGracefulShutdown(server, 'SIGINT'));
}

bootstrap().catch((error: Error) => {
  logger.fatal(error, 'Bootstrap failed');
  process.exit(1);
});
