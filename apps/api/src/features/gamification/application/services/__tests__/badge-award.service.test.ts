import {
  BadgeAwardService,
  type BadgeAwardOutcome,
} from '@/features/gamification/application/services/badge-award.service.js';
import type { BadgeRuleEvaluator } from '@/features/gamification/application/services/badge-rule.evaluator.js';
import type {
  AwardXpOutcome,
  AwardXpService,
} from '@/features/gamification/application/services/award-xp.service.js';
import type { BadgeDefinition } from '@/features/gamification/domain/entities/badge.types.js';
import type {
  IBadgeRepository,
  IUserGamificationRepository,
} from '@/features/gamification/domain/ports/gamification.ports.js';
import type {
  GamificationTxClient,
  IGamificationTransactionService,
} from '@/features/gamification/domain/ports/gamification-transaction.port.js';

function badge(
  code: string,
  xpReward: number,
  type: BadgeDefinition['rules']['type'] = 'LESSON_COUNT',
  value = 1,
): BadgeDefinition {
  return {
    code,
    name: `${code} name`,
    description: '',
    icon: '🏆',
    xpReward,
    rules: { type, value },
    isActive: true,
  };
}

function xpOutcome(overrides: Partial<AwardXpOutcome>): AwardXpOutcome {
  return {
    awarded: true,
    duplicate: false,
    xpAwarded: 10,
    previousTotalXP: 0,
    newTotalXP: 10,
    previousLevel: 1,
    newLevel: 1,
    leveledUp: false,
    ...overrides,
  };
}

interface Harness {
  service: BadgeAwardService;
  badgeRepo: { getActiveBadges: jest.Mock; getUserBadges: jest.Mock };
  awardXp: jest.Mock;
  tx: {
    execute: jest.Mock;
    createManyAndReturn: jest.Mock;
    badgeFindMany: jest.Mock;
    accountFindUnique: jest.Mock;
    accountUpsert: jest.Mock;
  };
  ruleEvaluator: { loadMetrics: jest.Mock; evaluate: jest.Mock };
  ensureAccount: jest.Mock;
  satisfy: (...keys: string[]) => void;
  calls: string[];
}

function createHarness(options: {
  catalog: BadgeDefinition[];
  ownedCodes?: string[];
  createdCodes?: string[] | 'all';
}): Harness {
  const calls: string[] = [];
  const ownedCodes = new Set(options.ownedCodes ?? []);
  const satisfied = new Set<string>();

  const badgeRepo = {
    getActiveBadges: jest.fn().mockResolvedValue(options.catalog),
    getUserBadges: jest.fn().mockImplementation(() =>
      Promise.resolve(
        Array.from(ownedCodes).map((code) => ({
          code,
          name: code,
          icon: '🏆',
          description: '',
          earnedAt: new Date(),
        })),
      ),
    ),
  };

  let balance = 0;
  const awardXp = jest.fn().mockImplementation((command: { amount: number }) => {
    calls.push(`xp:${command.amount}`);
    const previousTotalXP = balance;
    balance += command.amount;
    return Promise.resolve(
      xpOutcome({
        xpAwarded: command.amount,
        previousTotalXP,
        newTotalXP: balance,
      }),
    );
  });

  const createdCodes =
    options.createdCodes === undefined || options.createdCodes === 'all'
      ? null
      : new Set(options.createdCodes);

  const createManyAndReturn = jest
    .fn()
    .mockImplementation((args: { data: Array<{ badgeId: string }> }) => {
      calls.push('create-badges');
      const rows = args.data.filter(() => true);
      return Promise.resolve(
        createdCodes === null
          ? rows.map((row) => ({ badgeId: row.badgeId }))
          : rows.filter((row) => createdCodes.has(badgeIdToCode.get(row.badgeId) ?? '')),
      );
    });

  const badgeIdToCode = new Map<string, string>();
  options.catalog.forEach((entry, index) => badgeIdToCode.set(`badge-${index}`, entry.code));
  const codeToBadgeId = new Map(Array.from(badgeIdToCode).map(([id, code]) => [code, id]));

  const badgeFindMany = jest
    .fn()
    .mockImplementation((args: { where: { code: { in: string[] } } }) =>
      Promise.resolve(
        args.where.code.in.map((code) => ({
          id: codeToBadgeId.get(code),
          code,
          name: `${code} name`,
          icon: '🏆',
        })),
      ),
    );

  const accountFindUnique = jest.fn().mockResolvedValue({ id: 'ug-1' });
  const accountUpsert = jest.fn().mockResolvedValue({ id: 'ug-1' });
  const ensureAccount = jest.fn().mockResolvedValue({ userId: 'user-1' });

  const client = {
    userGamification: {
      findUnique: accountFindUnique,
      upsert: accountUpsert,
      update: jest.fn(),
    },
    xpTransaction: { findUnique: jest.fn(), create: jest.fn() },
    badge: { findUnique: jest.fn(), findMany: badgeFindMany },
    userBadge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      createManyAndReturn,
    },
  } as unknown as GamificationTxClient;

  const execute = jest.fn((fn: (tx: GamificationTxClient) => Promise<unknown>) => fn(client));

  const ruleEvaluator = {
    loadMetrics: jest.fn().mockResolvedValue({}),
    evaluate: jest.fn().mockImplementation((rule: { type: string; value: number }) => ({
      current: 1,
      target: rule.value,
      satisfied: satisfied.has(`${rule.type}:${rule.value}`),
    })),
  };

  const service = new BadgeAwardService(
    badgeRepo as unknown as IBadgeRepository,
    { getOrCreate: ensureAccount } as unknown as IUserGamificationRepository,
    { execute } as unknown as IGamificationTransactionService,
    { award: awardXp } as unknown as AwardXpService,
    ruleEvaluator as unknown as BadgeRuleEvaluator,
  );

  return {
    service,
    badgeRepo,
    awardXp,
    tx: { execute, createManyAndReturn, badgeFindMany, accountFindUnique, accountUpsert },
    ruleEvaluator,
    ensureAccount,
    satisfy: (...keys: string[]) => keys.forEach((key) => satisfied.add(key)),
    calls,
  };
}

describe('BadgeAwardService', () => {
  it('does nothing when the catalog is already fully owned', async () => {
    const harness = createHarness({
      catalog: [badge('FIRST_LESSON', 10)],
      ownedCodes: ['FIRST_LESSON'],
    });

    const outcome = await harness.service.awardApplicable('user-1');

    expect(outcome).toEqual({ badges: [], xp: null });
    expect(harness.awardXp).not.toHaveBeenCalled();
    expect(harness.tx.execute).not.toHaveBeenCalled();
    expect(harness.ruleEvaluator.loadMetrics).not.toHaveBeenCalled();
  });

  it('does nothing when no rule is satisfied', async () => {
    const harness = createHarness({ catalog: [badge('LESSON_5', 50, 'LESSON_COUNT', 5)] });

    const outcome = await harness.service.awardApplicable('user-1');

    expect(outcome).toEqual({ badges: [], xp: null });
    expect(harness.awardXp).not.toHaveBeenCalled();
    expect(harness.tx.execute).not.toHaveBeenCalled();
  });

  it('pays the badge xpReward through the ledger and creates the badge', async () => {
    const harness = createHarness({ catalog: [badge('FIRST_LESSON', 10)] });
    harness.satisfy('LESSON_COUNT:1');

    const outcome = await harness.service.awardApplicable('user-1');

    expect(harness.awardXp).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 10,
      source: 'BADGE',
      sourceRef: 'FIRST_LESSON',
    });
    expect(outcome.badges).toEqual([
      { code: 'FIRST_LESSON', name: 'FIRST_LESSON name', icon: '🏆', xpReward: 10 },
    ]);
    expect(outcome.xp).toEqual({
      xpAwarded: 10,
      previousTotalXP: 0,
      newTotalXP: 10,
      previousLevel: 1,
      newLevel: 1,
      leveledUp: false,
      newLevelTitle: undefined,
      newLevelIcon: undefined,
    });
  });

  it('pays XP before creating the row so a crash between both steps self-heals', async () => {
    const harness = createHarness({ catalog: [badge('FIRST_LESSON', 10)] });
    harness.satisfy('LESSON_COUNT:1');

    await harness.service.awardApplicable('user-1');

    expect(harness.calls).toEqual(['xp:10', 'create-badges']);
  });

  it('still reports the XP movement when a concurrent award wins the row', async () => {
    // The other transaction created the row; the ledger already deduplicated the
    // payout, so this request must not announce a badge it did not create.
    const harness = createHarness({ catalog: [badge('FIRST_LESSON', 10)], createdCodes: [] });
    harness.satisfy('LESSON_COUNT:1');

    const outcome = await harness.service.awardApplicable('user-1');

    expect(outcome.badges).toEqual([]);
    expect(outcome.xp?.xpAwarded).toBe(10);
  });

  it('creates a badge with no xpReward without touching the ledger', async () => {
    const harness = createHarness({ catalog: [badge('FREEBIE', 0)] });
    harness.satisfy('LESSON_COUNT:1');

    const outcome = await harness.service.awardApplicable('user-1');

    expect(harness.awardXp).not.toHaveBeenCalled();
    expect(outcome.badges.map((entry) => entry.code)).toEqual(['FREEBIE']);
    expect(outcome.xp).toBeNull();
  });

  it('aggregates several badge payouts into one XP movement', async () => {
    const harness = createHarness({
      catalog: [badge('FIRST_LESSON', 10), badge('LESSON_5', 50, 'LESSON_COUNT', 5)],
    });
    harness.awardXp
      .mockReset()
      .mockResolvedValueOnce(
        xpOutcome({
          xpAwarded: 10,
          previousTotalXP: 90,
          newTotalXP: 100,
          newLevel: 2,
          leveledUp: true,
          newLevelTitle: 'Brote',
          newLevelIcon: '🌿',
        }),
      )
      .mockResolvedValueOnce(
        xpOutcome({
          xpAwarded: 50,
          previousTotalXP: 100,
          newTotalXP: 150,
          previousLevel: 2,
          newLevel: 2,
        }),
      );
    harness.satisfy('LESSON_COUNT:1', 'LESSON_COUNT:5');

    const outcome = await harness.service.awardApplicable('user-1');

    expect(outcome.xp).toEqual({
      xpAwarded: 60,
      previousTotalXP: 90,
      newTotalXP: 150,
      previousLevel: 1,
      newLevel: 2,
      leveledUp: true,
      newLevelTitle: 'Brote',
      newLevelIcon: '🌿',
    });
  });

  it('reports no XP movement when every payout was a duplicate', async () => {
    const harness = createHarness({ catalog: [badge('FIRST_LESSON', 10)] });
    harness.awardXp
      .mockReset()
      .mockResolvedValue(xpOutcome({ awarded: false, duplicate: true, xpAwarded: 0 }));
    harness.satisfy('LESSON_COUNT:1');

    const outcome: BadgeAwardOutcome = await harness.service.awardApplicable('user-1');

    expect(outcome.badges.map((entry) => entry.code)).toEqual(['FIRST_LESSON']);
    expect(outcome.xp).toBeNull();
  });

  it('ensures the gamification account outside the transaction when it may not exist', async () => {
    const harness = createHarness({ catalog: [badge('FIRST_LESSON', 0)] });
    harness.tx.accountFindUnique.mockResolvedValue(null);
    harness.satisfy('LESSON_COUNT:1');

    await harness.service.awardApplicable('user-1');

    expect(harness.ensureAccount).toHaveBeenCalledWith('user-1');
    // A unique violation inside the transaction would abort it, so the account
    // is created before it starts.
    expect(harness.tx.accountUpsert).not.toHaveBeenCalled();
  });
});
