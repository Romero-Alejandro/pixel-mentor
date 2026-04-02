import { prisma } from '@/database/client';

import type {
  AdvisoryLockId,
  AdvisoryLockManager,
  LockAcquisitionOptions,
} from '@/features/session/domain/ports/advisory-lock.port';
import {
  DEFAULT_LOCK_OPTIONS,
  LockAcquisitionError,
  lockIdToBigInt,
  LockTimeoutError,
} from '@/features/session/domain/ports/advisory-lock.port';

export class PostgresAdvisoryLockManager implements AdvisoryLockManager {
  private static instance: PostgresAdvisoryLockManager;

  static getInstance(): PostgresAdvisoryLockManager {
    if (!PostgresAdvisoryLockManager.instance) {
      PostgresAdvisoryLockManager.instance = new PostgresAdvisoryLockManager();
    }
    return PostgresAdvisoryLockManager.instance;
  }

  async acquireLock(
    lockId: AdvisoryLockId,
    options: LockAcquisitionOptions = DEFAULT_LOCK_OPTIONS,
  ): Promise<boolean> {
    const lockValue = lockIdToBigInt(lockId);
    const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_OPTIONS.timeoutMs ?? 5000;
    const retryInterval = options.retryIntervalMs ?? 100;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await prisma.$executeRaw`SELECT pg_try_advisory_lock(${lockValue})`;

        if (result === 1) {
          return true;
        }

        await this.sleep(retryInterval);
      } catch (error) {
        throw new LockAcquisitionError(lockId, 'Failed to acquire advisory lock', error as Error);
      }
    }

    throw new LockTimeoutError(lockId, timeoutMs);
  }

  async releaseLock(lockId: AdvisoryLockId): Promise<boolean> {
    const lockValue = lockIdToBigInt(lockId);

    try {
      const result = await prisma.$executeRaw`SELECT pg_advisory_unlock(${lockValue})`;
      return result === 1;
    } catch {
      return false;
    }
  }

  async isLocked(lockId: AdvisoryLockId): Promise<boolean> {
    const lockValue = lockIdToBigInt(lockId);

    try {
      const result = await prisma.$queryRaw<[{ lock_status: boolean }]>`SELECT pg_advisory_lock_status(${lockValue}) as lock_status`;
      return result[0]?.lock_status ?? false;
    } catch {
      return false;
    }
  }

  async withLock<T>(lockId: AdvisoryLockId, fn: () => Promise<T>): Promise<T> {
    await this.acquireLock(lockId);
    try {
      return await fn();
    } finally {
      await this.releaseLock(lockId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
