/**
 * Transaction Service
 *
 * Provides centralized transaction management for use cases.
 * Wraps Prisma transactions with domain-specific helpers.
 *
 * @example
 * ```typescript
 * const txService = getTransactionService();
 *
 * await txService.execute(async (tx) => {
 *   await tx.session.update({ where: { id }, data: { status: 'COMPLETED' } });
 *   await tx.userGamification.update({ where: { userId }, data: { totalXP: { increment: 10 } } });
 * });
 * ```
 */

import { prisma } from '@/infrastructure/adapters/database/client.js';

/**
 * Transaction callback type - receives prisma client for transaction
 */
export type TransactionCallback<T> = (tx: typeof prisma) => Promise<T>;

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Maximum time in milliseconds for the transaction */
  maxWait?: number;
  /** Timeout in milliseconds for the transaction */
  timeout?: number;
}

/**
 * Transaction Service for managing database transactions
 */
export class TransactionService {
  /**
   * Execute a callback within a transaction
   *
   * @param callback - Function to execute within the transaction
   * @param options - Transaction options
   * @returns The result of the callback
   */
  async execute<T>(callback: TransactionCallback<T>, options?: TransactionOptions): Promise<T> {
    return prisma.$transaction(callback as any, options);
  }

  /**
   * Execute with retry on transient failures
   *
   * @param callback - Function to execute
   * @param maxRetries - Maximum number of retries (default: 3)
   * @param options - Transaction options
   * @returns The result of the callback
   */
  async executeWithRetry<T>(
    callback: TransactionCallback<T>,
    maxRetries: number = 3,
    options?: TransactionOptions,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(callback, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on transient errors
        if (!this.isTransientError(error)) {
          throw lastError;
        }

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 100);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is transient and can be retried
   */
  private isTransientError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    // Prisma-specific transient errors
    if ('code' in error) {
      const prismaError = error as { code: string };
      // P2034 = Transaction conflict
      // P2028 = Transaction API error
      return ['P2034', 'P2028'].includes(prismaError.code);
    }

    // Connection errors
    if ('message' in error) {
      const message = (error as { message: string }).message.toLowerCase();
      return (
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('deadlock')
      );
    }

    return false;
  }

  /**
   * Delay execution for a specified time
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== Singleton Instance ====================

let transactionServiceInstance: TransactionService | null = null;

/**
 * Get the singleton TransactionService instance
 */
export function getTransactionService(): TransactionService {
  if (!transactionServiceInstance) {
    transactionServiceInstance = new TransactionService();
  }
  return transactionServiceInstance;
}
