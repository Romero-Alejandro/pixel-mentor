import { PrismaProgressRepository } from '../../repositories/progress-repository';
import { prisma } from '../../client';
import type { UserProgress } from '../../../../../domain/entities/user-progress';

// Mock the Prisma client
jest.mock('../../client', () => {
  return {
    prisma: {
      userProgress: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    },
  };
});

describe('PrismaProgressRepository', () => {
  let repo: PrismaProgressRepository;

  beforeEach(() => {
    repo = new PrismaProgressRepository();
    jest.clearAllMocks();
  });

  const mockProgressRaw = (overrides: Partial<any> = {}) => ({
    id: 'progress-id-1',
    userId: 'user-1',
    recipeId: 'recipe-1',
    atomId: 'atom-1',
    status: 'IN_PROGRESS',
    score: 85.5,
    attempts: 3,
    lastAttemptAt: new Date('2025-03-12T10:00:00Z'),
    updatedAt: new Date('2025-03-12T10:30:00Z'),
    ...overrides,
  });

  const mockProgressDomain = (overrides: Partial<UserProgress> = {}): UserProgress => ({
    id: 'progress-id-1',
    userId: 'user-1',
    recipeId: 'recipe-1',
    atomId: 'atom-1',
    status: 'IN_PROGRESS',
    score: 85.5,
    attempts: 3,
    lastAttemptAt: new Date('2025-03-12T10:00:00Z'),
    updatedAt: new Date('2025-03-12T10:30:00Z'),
    ...overrides,
  });

  describe('findByUserId', () => {
    it('should return array of UserProgress sorted by updatedAt desc', async () => {
      const rawData = [
        mockProgressRaw({ id: 'p2', updatedAt: new Date('2025-03-12T10:00:00Z') }),
        mockProgressRaw({ id: 'p1', updatedAt: new Date('2025-03-12T09:00:00Z') }),
        mockProgressRaw({ id: 'p3', updatedAt: new Date('2025-03-12T08:00:00Z') }),
      ];
      (prisma.userProgress.findMany as any).mockResolvedValue(rawData);

      const result = await repo.findByUserId('user-1');

      expect(prisma.userProgress.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('p2'); // newest first
      expect(result[1].id).toBe('p1');
      expect(result[2].id).toBe('p3');
    });

    it('should return empty array when no records found', async () => {
      (prisma.userProgress.findMany as any).mockResolvedValue([]);

      const result = await repo.findByUserId('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('findByUserIdAndRecipeId', () => {
    it('should return UserProgress when found', async () => {
      const raw = mockProgressRaw();
      (prisma.userProgress.findFirst as any).mockResolvedValue(raw);

      const result = await repo.findByUserIdAndRecipeId('user-1', 'recipe-1');

      expect(prisma.userProgress.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', recipeId: 'recipe-1' },
      });
      expect(result).toEqual(mockProgressDomain());
    });

    it('should return null when not found', async () => {
      (prisma.userProgress.findFirst as any).mockResolvedValue(null);

      const result = await repo.findByUserIdAndRecipeId('user-1', 'recipe-1');

      expect(result).toBeNull();
    });
  });

  describe('findByUserIdAndAtomId', () => {
    it('should return UserProgress when found', async () => {
      const raw = mockProgressRaw({ atomId: 'atom-1' });
      (prisma.userProgress.findFirst as any).mockResolvedValue(raw);

      const result = await repo.findByUserIdAndAtomId('user-1', 'atom-1');

      expect(prisma.userProgress.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', atomId: 'atom-1' },
      });
      expect(result).toEqual(mockProgressDomain({ atomId: 'atom-1' }));
    });
  });

  describe('create', () => {
    it('should create UserProgress and map all fields correctly', async () => {
      const raw = mockProgressRaw();
      (prisma.userProgress.create as any).mockResolvedValue(raw);

      const progressData: Omit<UserProgress, 'updatedAt'> = {
        id: 'progress-id-1',
        userId: 'user-1',
        recipeId: 'recipe-1',
        atomId: 'atom-1',
        status: 'IN_PROGRESS',
        score: 85.5,
        attempts: 3,
        lastAttemptAt: new Date('2025-03-12T10:00:00Z'),
      };

      const result = await repo.create(progressData);

      expect(prisma.userProgress.create).toHaveBeenCalledWith({
        data: {
          id: progressData.id,
          userId: 'user-1',
          recipeId: 'recipe-1',
          atomId: 'atom-1',
          status: 'IN_PROGRESS',
          score: 85.5,
          attempts: 3,
          lastAttemptAt: progressData.lastAttemptAt,
        },
      });
      expect(result).toEqual(mockProgressDomain());
    });
  });

  describe('update', () => {
    it('should update UserProgress with partial data', async () => {
      const raw = mockProgressRaw({ score: 95.0, attempts: 4 });
      (prisma.userProgress.update as any).mockResolvedValue(raw);

      const result = await repo.update('progress-id-1', {
        score: 95.0,
        attempts: 4,
      });

      expect(prisma.userProgress.update).toHaveBeenCalledWith({
        where: { id: 'progress-id-1' },
        data: {
          score: 95.0,
          attempts: 4,
          status: undefined,
          lastAttemptAt: undefined,
        },
      });
      expect(result.score).toBe(95.0);
      expect(result.attempts).toBe(4);
    });

    it('should update status and lastAttemptAt', async () => {
      const now = new Date();
      const raw = mockProgressRaw({ status: 'MASTERED', lastAttemptAt: now });
      (prisma.userProgress.update as any).mockResolvedValue(raw);

      const result = await repo.update('progress-id-1', {
        status: 'MASTERED',
        lastAttemptAt: now,
      });

      expect(prisma.userProgress.update).toHaveBeenCalledWith({
        where: { id: 'progress-id-1' },
        data: {
          status: 'MASTERED',
          lastAttemptAt: now,
          score: undefined,
          attempts: undefined,
        },
      });
      expect(result.status).toBe('MASTERED');
      expect(result.lastAttemptAt).toEqual(now);
    });
  });

  describe('upsert', () => {
    it('should update existing record when found', async () => {
      const existing = mockProgressRaw();
      (prisma.userProgress.findFirst as any).mockResolvedValue(existing);
      const updatedRaw = mockProgressRaw({ score: 100 });
      (prisma.userProgress.update as any).mockResolvedValue(updatedRaw);

      const result = await repo.upsert({
        userId: 'user-1',
        recipeId: 'recipe-1',
        atomId: 'atom-1',
        score: 100,
      });

      expect(prisma.userProgress.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', recipeId: 'recipe-1', atomId: 'atom-1' },
      });
      expect(prisma.userProgress.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { score: 100 },
      });
      expect(result).toEqual(mockProgressDomain({ score: 100 }));
    });

    it('should create new record when not exists', async () => {
      (prisma.userProgress.findFirst as any).mockResolvedValue(null);
      const createdRaw = mockProgressRaw({ id: 'new-id', status: 'UNLOCKED' });
      (prisma.userProgress.create as any).mockResolvedValue(createdRaw);

      // Mock crypto.randomUUID to return a predictable ID
      const randomUUIDSpy = jest.spyOn(crypto, 'randomUUID').mockReturnValue('new-id' as any);

      const result = await repo.upsert({
        userId: 'user-1',
        recipeId: 'recipe-1',
        atomId: 'atom-1',
        status: 'UNLOCKED',
      });

      expect(prisma.userProgress.create).toHaveBeenCalledWith({
        data: {
          id: 'new-id',
          userId: 'user-1',
          recipeId: 'recipe-1',
          atomId: 'atom-1',
          status: 'UNLOCKED',
          score: undefined,
          attempts: 0,
          lastAttemptAt: undefined,
        },
      });
      expect(result).toEqual(mockProgressDomain({ id: 'new-id', status: 'UNLOCKED' }));

      randomUUIDSpy.mockRestore();
    });
  });

  describe('findByScore', () => {
    it('should return progress entries with matching score', async () => {
      const rawData = [
        mockProgressRaw({ id: 'p1', score: 85.5 }),
        mockProgressRaw({ id: 'p2', score: 85.5 }),
      ];
      (prisma.userProgress.findMany as any).mockResolvedValue(rawData);

      const result = await repo.findByScore(85.5);

      expect(prisma.userProgress.findMany).toHaveBeenCalledWith({
        where: { score: 85.5 },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.score === 85.5)).toBe(true);
    });

    it('should return empty array when no matches', async () => {
      (prisma.userProgress.findMany as any).mockResolvedValue([]);

      const result = await repo.findByScore(100);

      expect(result).toEqual([]);
    });
  });

  describe('findByAttempts', () => {
    it('should return progress entries with matching attempts', async () => {
      const rawData = [
        mockProgressRaw({ id: 'p1', attempts: 3 }),
        mockProgressRaw({ id: 'p2', attempts: 3 }),
      ];
      (prisma.userProgress.findMany as any).mockResolvedValue(rawData);

      const result = await repo.findByAttempts(3);

      expect(prisma.userProgress.findMany).toHaveBeenCalledWith({
        where: { attempts: 3 },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.attempts === 3)).toBe(true);
    });
  });

  describe('findByLastAttemptAt', () => {
    it('should return progress entries with matching lastAttemptAt', async () => {
      const date = new Date('2025-03-12T10:00:00Z');
      const rawData = [
        mockProgressRaw({ id: 'p1', lastAttemptAt: date }),
        mockProgressRaw({ id: 'p2', lastAttemptAt: date }),
      ];
      (prisma.userProgress.findMany as any).mockResolvedValue(rawData);

      const result = await repo.findByLastAttemptAt(date);

      expect(prisma.userProgress.findMany).toHaveBeenCalledWith({
        where: { lastAttemptAt: date },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result.every((p: any) => p.lastAttemptAt?.getTime() === date.getTime())).toBe(true);
    });
  });
});
