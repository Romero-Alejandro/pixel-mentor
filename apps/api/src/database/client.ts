import { PrismaClient, Prisma } from './generated/client';

import { config } from '@/shared/config';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

/**
 * Prisma query logging configuration based on environment
 * Development: silent (no query logging to avoid SQL in stdout)
 * Production: silent (no query logging for security/performance)
 * Test: error only (minimal noise)
 */
const isTest = config.NODE_ENV === 'test';

const prismaLogLevels: Prisma.LogLevel[] = isTest ? ['error'] : ['error'];

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: prismaLogLevels,
  });

if (config.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export { Prisma, PrismaClient };
