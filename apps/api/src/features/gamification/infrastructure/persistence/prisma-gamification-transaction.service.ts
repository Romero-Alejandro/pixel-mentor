import { prisma } from '@/database/client.js';
import type {
  GamificationTxClient,
  IGamificationTransactionService,
} from '@/features/gamification/domain/ports/gamification-transaction.port.js';

/**
 * Prisma adapter for the gamification transaction port.
 * Runs reward transactions as prisma interactive transactions.
 *
 * The prisma tx client satisfies the structural GamificationTxClient shape:
 * the upcast is safe because the engine only uses the declared operations.
 */
export class PrismaGamificationTransactionService implements IGamificationTransactionService {
  async execute<T>(fn: (tx: GamificationTxClient) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => fn(tx as unknown as GamificationTxClient));
  }
}
