/**
 * BadgeAwardService — the only writer of user badges.
 *
 * Awards are declarative: every active badge whose `rules` are satisfied (and
 * that the user does not own yet) is granted, and its `xpReward` is paid through
 * `AwardXpService` with `source: BADGE` and `sourceRef: <badge code>`. No code
 * outside the ledger can create XP, so a badge reward is idempotent and
 * reconcilable like any other XP source.
 *
 * Ordering and failure model:
 * 1. XP is paid first, then the badge row is created.
 * 2. Both steps are idempotent (ledger key; `(userId, badgeId)` unique).
 * If the process dies between them, the next call re-evaluates the badge, the XP
 * award is a no-op, and the badge row is created: the state heals itself. The
 * reverse order would leave a badge owned with its XP lost forever.
 *
 * Levels are derived from XP, so a badge whose rule is `LEVEL` is evaluated
 * against the balance produced by the triggering event. Badge XP itself can
 * cross a level, but that badge is awarded by the next event — a bounded,
 * documented lag instead of an unbounded award loop.
 */

import type {
  AwardXpOutcome,
  AwardXpService,
} from '@/features/gamification/application/services/award-xp.service.js';
import type { BadgeRuleEvaluator } from '@/features/gamification/application/services/badge-rule.evaluator.js';
import type { BadgeDefinition } from '@/features/gamification/domain/entities/badge.types.js';
import type {
  IBadgeRepository,
  IUserGamificationRepository,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import type { IGamificationTransactionService } from '@/features/gamification/domain/ports/gamification-transaction.port.js';

/** A badge that was newly created for the user in this call. */
export interface AwardedBadge {
  code: string;
  name: string;
  icon: string;
  xpReward: number;
}

/** XP movement produced by paying badge rewards, aggregated for events. */
export interface BadgeXpOutcome {
  xpAwarded: number;
  previousTotalXP: number;
  newTotalXP: number;
  previousLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newLevelTitle?: string;
  newLevelIcon?: string;
}

export interface BadgeAwardOutcome {
  /** Badges created by this call (not the ones already owned). */
  badges: AwardedBadge[];
  /** `null` when no badge XP moved. */
  xp: BadgeXpOutcome | null;
}

const EMPTY_OUTCOME: BadgeAwardOutcome = { badges: [], xp: null };

export class BadgeAwardService {
  constructor(
    private readonly badgeRepo: IBadgeRepository,
    private readonly userGamificationRepo: IUserGamificationRepository,
    private readonly transactionService: IGamificationTransactionService,
    private readonly awardXpService: AwardXpService,
    private readonly ruleEvaluator: BadgeRuleEvaluator,
  ) {}

  /**
   * Awards every badge this user has earned and does not own yet.
   *
   * Safe to call after any XP-producing event: it is a no-op when nothing new
   * is satisfied, and every effect is idempotent when it is not.
   */
  async awardApplicable(userId: string): Promise<BadgeAwardOutcome> {
    const [catalog, owned] = await Promise.all([
      this.badgeRepo.getActiveBadges(),
      this.badgeRepo.getUserBadges(userId),
    ]);

    const ownedCodes = new Set(owned.map((badge) => badge.code));
    const candidates = catalog.filter((badge) => !ownedCodes.has(badge.code));

    if (candidates.length === 0) {
      return EMPTY_OUTCOME;
    }

    const metrics = await this.ruleEvaluator.loadMetrics(userId);
    const satisfied = candidates.filter(
      (badge) => this.ruleEvaluator.evaluate(badge.rules, metrics)?.satisfied === true,
    );

    if (satisfied.length === 0) {
      return EMPTY_OUTCOME;
    }

    const xpOutcomes = await this.payBadgeXp(userId, satisfied);
    const createdCodes = new Set(await this.createUserBadges(userId, satisfied));

    // A badge lost to a concurrent award is still paid for by exactly one ledger
    // row (the XP award already deduplicated it); it is simply not announced by
    // this request, because the winner announces it.
    return {
      badges: satisfied.filter((badge) => createdCodes.has(badge.code)).map(toAwardedBadge),
      xp: this.sumXpOutcomes(xpOutcomes),
    };
  }

  /**
   * Pays each badge's `xpReward` through the ledger.
   *
   * Sequential on purpose: each award may cross a level, and the aggregate
   * outcome must reflect the real balance chain.
   */
  private async payBadgeXp(
    userId: string,
    badges: readonly BadgeDefinition[],
  ): Promise<AwardXpOutcome[]> {
    const outcomes: AwardXpOutcome[] = [];

    for (const badge of badges) {
      if (badge.xpReward <= 0) {
        continue;
      }

      outcomes.push(
        await this.awardXpService.award({
          userId,
          amount: badge.xpReward,
          source: 'BADGE',
          sourceRef: badge.code,
        }),
      );
    }

    return outcomes;
  }

  /**
   * Creates the user-badge rows and returns only the codes that this call
   * actually created.
   *
   * `createManyAndReturn` + `skipDuplicates` makes the "did I win the race?"
   * answer come from the database instead of a read-then-write guess.
   */
  private async createUserBadges(
    userId: string,
    badges: readonly BadgeDefinition[],
  ): Promise<string[]> {
    if (badges.length === 0) {
      return [];
    }

    // Same reason as AwardXpService: create the account outside the transaction
    // so a concurrent insert cannot abort it. A badge with xpReward 0 may skip
    // the XP path entirely, so this is the only guarantee the account exists.
    await this.userGamificationRepo.getOrCreate(userId);

    return this.transactionService.execute(async (tx) => {
      const account = await tx.userGamification.findUnique({ where: { userId } });
      if (!account) {
        return [];
      }

      const records = await tx.badge.findMany({
        where: { code: { in: badges.map((badge) => badge.code) } },
      });
      const badgeIdByCode = new Map(records.map((record) => [record.code, record.id]));

      const data = badges.flatMap((badge) => {
        const badgeId = badgeIdByCode.get(badge.code);
        return badgeId ? [{ userId, badgeId, userGamificationId: account.id }] : [];
      });

      if (data.length === 0) {
        return [];
      }

      const created = await tx.userBadge.createManyAndReturn({ data, skipDuplicates: true });
      const codeByBadgeId = new Map(records.map((record) => [record.id, record.code]));

      return created.flatMap((row) => {
        const code = codeByBadgeId.get(row.badgeId);
        return code ? [code] : [];
      });
    });
  }

  /** Collapses per-badge awards into one XP movement for the event layer. */
  private sumXpOutcomes(outcomes: readonly AwardXpOutcome[]): BadgeXpOutcome | null {
    const paid = outcomes.filter((outcome) => outcome.awarded && outcome.xpAwarded > 0);
    const first = paid[0];
    const last = paid[paid.length - 1];

    if (!first || !last) {
      return null;
    }

    const leveledUp = last.newLevel > first.previousLevel;
    // The title belongs to the award that crossed the last threshold, which is
    // not necessarily the last badge paid in the batch.
    const levelUpAward = paid.filter((outcome) => outcome.leveledUp).pop();

    return {
      xpAwarded: paid.reduce((sum, outcome) => sum + outcome.xpAwarded, 0),
      previousTotalXP: first.previousTotalXP,
      newTotalXP: last.newTotalXP,
      previousLevel: first.previousLevel,
      newLevel: last.newLevel,
      leveledUp,
      newLevelTitle: leveledUp ? levelUpAward?.newLevelTitle : undefined,
      newLevelIcon: leveledUp ? levelUpAward?.newLevelIcon : undefined,
    };
  }
}

function toAwardedBadge(badge: BadgeDefinition): AwardedBadge {
  return {
    code: badge.code,
    name: badge.name,
    icon: badge.icon,
    xpReward: badge.xpReward,
  };
}
