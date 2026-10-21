/**
 * AwardXpService — the only writer of a user's XP.
 *
 * Invariants:
 * - `XpTransaction` is the source of truth; `UserGamification.totalXP` is a cache
 *   updated in the same transaction.
 * - Every award is idempotent per `(userId, source, sourceRef)`: repeating the
 *   same command is a no-op, not a double award. The database unique constraint
 *   is the final guard, so concurrent duplicates cannot both win.
 * - A user with no gamification row is created on the first award (the old
 *   engine threw P2025 here).
 * - `level` is never written; it is derived from the new balance.
 */

import type {
  IGamificationTransactionService,
  XpSourceName,
} from '@/features/gamification/domain/ports/gamification-transaction.port.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';
import { isUniqueConstraintError } from '@/database/prisma-error.js';

export interface ILevelResolver {
  resolve(totalXP: number): Promise<{ level: number; title: string; icon: string }>;
}

export interface AwardXpCommand {
  userId: string;
  amount: number;
  source: XpSourceName;
  /** Natural key of the event that produced the XP (lesson id, badge code, date). */
  sourceRef: string;
}

export interface AwardXpOutcome {
  /** True when this call created the ledger row. */
  awarded: boolean;
  /** True when the exact same award had already been recorded. */
  duplicate: boolean;
  xpAwarded: number;
  previousTotalXP: number;
  newTotalXP: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newLevelTitle?: string;
  newLevelIcon?: string;
}

export class AwardXpService {
  constructor(
    private readonly transactionService: IGamificationTransactionService,
    private readonly userGamificationRepo: IUserGamificationRepository,
    private readonly levelResolver: ILevelResolver,
  ) {}

  async award(command: AwardXpCommand): Promise<AwardXpOutcome> {
    if (command.amount <= 0) {
      return this.outcomeFor(command.userId, false);
    }

    // The account must exist before the award transaction runs: creating it
    // inside would make a unique violation abort the whole transaction block,
    // and the retry could not tell an account race from a duplicate award.
    await this.userGamificationRepo.getOrCreate(command.userId);

    let newTotalXP: number;
    try {
      newTotalXP = await this.awardInTransaction(command);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      // With the account guaranteed to exist, the only unique constraint inside
      // this transaction is the ledger key, so a P2002 means this exact award
      // already exists.
      return this.outcomeFor(command.userId, true);
    }

    // -1 means the ledger row already existed inside the transaction.
    if (newTotalXP < 0) {
      return this.outcomeFor(command.userId, true);
    }

    const previousTotalXP = newTotalXP - command.amount;
    const [previousLevel, nextLevel] = await Promise.all([
      this.levelResolver.resolve(previousTotalXP),
      this.levelResolver.resolve(newTotalXP),
    ]);
    const leveledUp = nextLevel.level > previousLevel.level;

    return {
      awarded: true,
      duplicate: false,
      xpAwarded: command.amount,
      previousTotalXP,
      newTotalXP,
      previousLevel: previousLevel.level,
      newLevel: nextLevel.level,
      leveledUp,
      newLevelTitle: leveledUp ? nextLevel.title : undefined,
      newLevelIcon: leveledUp ? nextLevel.icon : undefined,
    };
  }

  /**
   * Runs dedupe + increment + ledger insert atomically.
   * Returns the new balance, or -1 when the ledger row already existed.
   * The account row is guaranteed to exist (see `award`).
   */
  private async awardInTransaction(command: AwardXpCommand): Promise<number> {
    return this.transactionService.execute(async (tx) => {
      const existing = await tx.xpTransaction.findUnique({
        where: {
          userId_source_sourceRef: {
            userId: command.userId,
            source: command.source,
            sourceRef: command.sourceRef,
          },
        },
      });

      if (existing) {
        return -1;
      }

      const updated = await tx.userGamification.update({
        where: { userId: command.userId },
        data: { totalXP: { increment: command.amount } },
      });

      await tx.xpTransaction.create({
        data: {
          userId: command.userId,
          amount: command.amount,
          source: command.source,
          sourceRef: command.sourceRef,
          balanceAfter: updated.totalXP,
        },
      });

      return updated.totalXP;
    });
  }

  /** Builds the outcome for a no-op call (duplicate, or a non-positive amount). */
  private async outcomeFor(userId: string, duplicate: boolean): Promise<AwardXpOutcome> {
    const stats = await this.userGamificationRepo.getProfileStats(userId);
    const totalXP = stats?.totalXP ?? 0;
    const level = stats?.level ?? (await this.levelResolver.resolve(totalXP)).level;

    return {
      awarded: false,
      duplicate,
      xpAwarded: 0,
      previousTotalXP: totalXP,
      newTotalXP: totalXP,
      previousLevel: level,
      newLevel: level,
      leveledUp: false,
    };
  }
}
