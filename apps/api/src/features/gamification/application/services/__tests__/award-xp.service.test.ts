import {
  AwardXpService,
  type ILevelResolver,
} from '@/features/gamification/application/services/award-xp.service.js';
import type {
  GamificationTxClient,
  IGamificationTransactionService,
} from '@/features/gamification/domain/ports/gamification-transaction.port.js';
import type { IUserGamificationRepository } from '@/features/gamification/domain/ports/gamification.ports.js';

interface TxMocks {
  client: GamificationTxClient;
  execute: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  findLedger: jest.Mock;
  createLedger: jest.Mock;
}

function createTxMocks(): TxMocks {
  const upsert = jest.fn().mockResolvedValue({ id: 'ug-1', totalXP: 0 });
  const update = jest.fn();
  const findLedger = jest.fn().mockResolvedValue(null);
  const createLedger = jest.fn().mockResolvedValue({});

  const client = {
    userGamification: {
      upsert,
      update,
      findUnique: jest.fn(),
    },
    xpTransaction: {
      findUnique: findLedger,
      create: createLedger,
    },
    badge: { findUnique: jest.fn(), findMany: jest.fn() },
    userBadge: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
  } as unknown as GamificationTxClient;

  const execute = jest.fn((fn: (tx: GamificationTxClient) => Promise<unknown>) => fn(client));

  return { client, execute, upsert, update, findLedger, createLedger };
}

describe('AwardXpService', () => {
  let tx: TxMocks;
  let repo: { getProfileStats: jest.Mock; getOrCreate: jest.Mock };
  let levels: ILevelResolver;
  let service: AwardXpService;

  beforeEach(() => {
    tx = createTxMocks();
    repo = {
      getProfileStats: jest.fn(),
      getOrCreate: jest.fn().mockResolvedValue({ userId: 'user-1' }),
    };
    levels = {
      resolve: jest.fn((totalXP: number) =>
        Promise.resolve(
          totalXP >= 100
            ? { level: 2, title: 'Brote', icon: '🌿' }
            : { level: 1, title: 'Semilla', icon: '🌱' },
        ),
      ),
    };

    service = new AwardXpService(
      { execute: tx.execute } as unknown as IGamificationTransactionService,
      repo as unknown as IUserGamificationRepository,
      levels,
    );
  });

  it('creates the account before the award transaction for a fresh user', async () => {
    tx.update.mockResolvedValue({ totalXP: 50 });

    const result = await service.award({
      userId: 'user-1',
      amount: 50,
      source: 'LESSON',
      sourceRef: 'recipe-1',
    });

    expect(repo.getOrCreate).toHaveBeenCalledWith('user-1');
    // Account creation must not happen inside the transaction: a unique
    // violation there would abort the whole transaction block.
    expect(tx.upsert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { totalXP: { increment: 50 } },
    });
    expect(tx.createLedger).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        amount: 50,
        source: 'LESSON',
        sourceRef: 'recipe-1',
        balanceAfter: 50,
      },
    });
    expect(result).toMatchObject({
      awarded: true,
      duplicate: false,
      xpAwarded: 50,
      previousTotalXP: 0,
      newTotalXP: 50,
      leveledUp: false,
    });
  });

  it('does not award twice for the same (user, source, sourceRef)', async () => {
    tx.findLedger.mockResolvedValue({ id: 'tx-existing' });
    repo.getProfileStats.mockResolvedValue({
      currentStreak: 0,
      level: 2,
      totalXP: 80,
      totalBadges: 0,
    });

    const result = await service.award({
      userId: 'user-1',
      amount: 50,
      source: 'LESSON',
      sourceRef: 'recipe-1',
    });

    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.createLedger).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      awarded: false,
      duplicate: true,
      xpAwarded: 0,
      newTotalXP: 80,
    });
  });

  it('treats a unique-constraint race as a duplicate', async () => {
    tx.execute.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 'P2002' }));
    repo.getProfileStats.mockResolvedValue({
      currentStreak: 0,
      level: 1,
      totalXP: 20,
      totalBadges: 0,
    });

    const result = await service.award({
      userId: 'user-1',
      amount: 50,
      source: 'LESSON',
      sourceRef: 'recipe-1',
    });

    expect(result).toMatchObject({ awarded: false, duplicate: true, newTotalXP: 20 });
  });

  it('skips non-positive amounts without touching the database', async () => {
    repo.getProfileStats.mockResolvedValue({
      currentStreak: 0,
      level: 1,
      totalXP: 10,
      totalBadges: 0,
    });

    const result = await service.award({
      userId: 'user-1',
      amount: 0,
      source: 'LESSON',
      sourceRef: 'recipe-1',
    });

    expect(tx.execute).not.toHaveBeenCalled();
    expect(repo.getOrCreate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ awarded: false, duplicate: false, xpAwarded: 0 });
  });

  it('does not report a level up when the balance starts exactly on a threshold', async () => {
    tx.update.mockResolvedValue({ totalXP: 110 });

    const result = await service.award({
      userId: 'user-1',
      amount: 10,
      source: 'LESSON',
      sourceRef: 'recipe-2',
    });

    expect(result).toMatchObject({
      previousTotalXP: 100,
      newTotalXP: 110,
      previousLevel: 2,
      newLevel: 2,
      leveledUp: false,
    });
    expect(result.newLevelTitle).toBeUndefined();
  });

  it('reports the level up with the derived title and icon', async () => {
    tx.update.mockResolvedValue({ totalXP: 140 });

    const result = await service.award({
      userId: 'user-1',
      amount: 50,
      source: 'LESSON',
      sourceRef: 'recipe-1',
    });

    expect(result).toMatchObject({
      awarded: true,
      previousTotalXP: 90,
      newTotalXP: 140,
      previousLevel: 1,
      newLevel: 2,
      leveledUp: true,
      newLevelTitle: 'Brote',
      newLevelIcon: '🌿',
    });
  });
});
