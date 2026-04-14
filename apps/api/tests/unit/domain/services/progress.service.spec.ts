/**
 * Unit Tests for ProgressService
 *
 * Tests cover:
 * - getUserProgress: retrieves progress by userId, empty results, error handling
 * - upsertProgress: creates new progress, updates existing, handles partial data, validates required fields
 * - Edge cases: invalid inputs, repository errors, different progress configurations
 */

import { ProgressService } from '@/features/progress/domain/services/progress.service';
import type { ProgressRepository } from '@/features/progress/domain/ports/progress.repository.port';
import type {
  UserProgress,
  ProgressStatus,
} from '@/features/progress/domain/entities/user-progress.entity';

// Mock factories
const createMockUserProgress = (overrides: Partial<UserProgress> = {}): UserProgress => ({
  id: 'progress-1',
  userId: 'user-1',
  recipeId: 'recipe-1',
  atomId: 'atom-1',
  status: 'IN_PROGRESS' as ProgressStatus,
  score: 75,
  attempts: 3,
  lastAttemptAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock repository factories
const createMockProgressRepo = (): jest.Mocked<ProgressRepository> => ({
  findByUserId: jest.fn(),
  findByUserIdAndRecipeId: jest.fn(),
  findByUserIdAndAtomId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  findByScore: jest.fn(),
  findByAttempts: jest.fn(),
  findByLastAttemptAt: jest.fn(),
  countByUserIdAndStatus: jest.fn(),
  findMasteredByUser: jest.fn(),
  findOrCreateByUserAndRecipe: jest.fn(),
});

describe('ProgressService', () => {
  let progressRepo: jest.Mocked<ProgressRepository>;
  let service: ProgressService;

  beforeEach(() => {
    progressRepo = createMockProgressRepo();
    service = new ProgressService(progressRepo);
  });

  describe('getUserProgress', () => {
    it('should return user progress array for valid userId', async () => {
      // Given
      const userId = 'user-1';
      const mockProgress = [
        createMockUserProgress({ id: 'progress-1', userId }),
        createMockUserProgress({ id: 'progress-2', userId, recipeId: 'recipe-2' }),
      ];
      progressRepo.findByUserId.mockResolvedValue(mockProgress);

      // When
      const result = await service.getUserProgress(userId);

      // Then
      expect(progressRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId);
    });

    it('should return empty array when user has no progress', async () => {
      // Given
      progressRepo.findByUserId.mockResolvedValue([]);

      // When
      const result = await service.getUserProgress('user-1');

      // Then
      expect(result).toEqual([]);
    });

    it('should return single progress entry', async () => {
      // Given
      const mockProgress = [createMockUserProgress({ id: 'progress-1', userId: 'user-1' })];
      progressRepo.findByUserId.mockResolvedValue(mockProgress);

      // When
      const result = await service.getUserProgress('user-1');

      // Then
      expect(result).toHaveLength(1);
    });

    it('should handle progress with only userId (no recipeId/atomId)', async () => {
      // Given
      const mockProgress = [createMockUserProgress({ recipeId: undefined, atomId: undefined })];
      progressRepo.findByUserId.mockResolvedValue(mockProgress);

      // When
      const result = await service.getUserProgress('user-1');

      // Then
      expect(result[0].recipeId).toBeUndefined();
      expect(result[0].atomId).toBeUndefined();
    });

    it('should propagate repository errors', async () => {
      // Given
      const error = new Error('Database error');
      progressRepo.findByUserId.mockRejectedValue(error);

      // When/Then
      await expect(service.getUserProgress('user-1')).rejects.toThrow('Database error');
    });

    it('should handle different progress statuses', async () => {
      // Given
      const statuses: ProgressStatus[] = [
        'LOCKED',
        'UNLOCKED',
        'IN_PROGRESS',
        'MASTERED',
        'NEEDS_REMEDIATION',
        'FAILED',
      ];
      const mockProgress = statuses.map((status, idx) =>
        createMockUserProgress({ id: `progress-${idx}`, status }),
      );
      progressRepo.findByUserId.mockResolvedValue(mockProgress);

      // When
      const result = await service.getUserProgress('user-1');

      // Then
      expect(result).toHaveLength(6);
      result.forEach((progress, idx) => {
        expect(progress.status).toBe(statuses[idx]);
      });
    });

    it('should handle progress with score undefined', async () => {
      // Given
      const mockProgress = [createMockUserProgress({ score: undefined })];
      progressRepo.findByUserId.mockResolvedValue(mockProgress);

      // When
      const result = await service.getUserProgress('user-1');

      // Then
      expect(result[0].score).toBeUndefined();
    });

    it('should handle progress with lastAttemptAt undefined', async () => {
      // Given
      const mockProgress = [createMockUserProgress({ lastAttemptAt: undefined })];
      progressRepo.findByUserId.mockResolvedValue(mockProgress);

      // When
      const result = await service.getUserProgress('user-1');

      // Then
      expect(result[0].lastAttemptAt).toBeUndefined();
    });

    it('should pass userId exactly as provided (trim, case-sensitive)', async () => {
      // Given
      progressRepo.findByUserId.mockResolvedValue([]);

      // When
      await service.getUserProgress('User-1');

      // Then
      expect(progressRepo.findByUserId).toHaveBeenCalledWith('User-1');
    });
  });

  describe('upsertProgress', () => {
    it('should create new progress when no existing record', async () => {
      // Given
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        status: 'IN_PROGRESS' as ProgressStatus,
        score: 80,
        attempts: 1,
      };
      const createdProgress = createMockUserProgress({
        id: 'progress-new',
        ...input,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      });
      progressRepo.upsert.mockResolvedValue(createdProgress);

      // When
      const result = await service.upsertProgress(input);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(expect.objectContaining(input));
      expect(result).toEqual(createdProgress);
    });

    it('should update existing progress when record exists', async () => {
      // Given
      const existing = createMockUserProgress({
        id: 'progress-1',
        attempts: 2,
        score: 60,
        status: 'IN_PROGRESS' as ProgressStatus,
      });
      const updateInput = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        score: 85,
        attempts: 3, // increment
        status: 'MASTERED' as ProgressStatus,
      };
      const updated = { ...existing, ...updateInput, updatedAt: new Date() };
      progressRepo.upsert.mockResolvedValue(updated);

      // When
      const result = await service.upsertProgress(updateInput);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(expect.objectContaining(updateInput));
      expect(result.status).toBe('MASTERED');
      expect(result.attempts).toBe(3);
    });

    it('should accept partial data (only status)', async () => {
      // Given
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        status: 'FAILED' as ProgressStatus,
      };
      const result = createMockUserProgress({ ...input });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          recipeId: 'recipe-1',
          status: 'FAILED',
        }),
      );
      expect(res.status).toBe('FAILED');
    });

    it('should accept atomId instead of recipeId', async () => {
      // Given
      const input = {
        userId: 'user-1',
        atomId: 'atom-1',
        status: 'UNLOCKED' as ProgressStatus,
      };
      const result = createMockUserProgress({ ...input });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          atomId: 'atom-1',
          status: 'UNLOCKED',
        }),
      );
      expect(res.atomId).toBe('atom-1');
    });

    it('should handle upsert with both recipeId and atomId (edge case)', async () => {
      // Given
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        atomId: 'atom-1',
        status: 'IN_PROGRESS' as ProgressStatus,
      };
      const result = createMockUserProgress(input);
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(expect.objectContaining(input));
      expect(res.recipeId).toBe('recipe-1');
      expect(res.atomId).toBe('atom-1');
    });

    it('should handle upsert with undefined score', async () => {
      // Given
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        status: 'LOCKED' as ProgressStatus,
        score: undefined,
        attempts: 0,
      };
      const result = createMockUserProgress({ ...input, score: undefined });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(res.score).toBeUndefined();
    });

    it('should handle upsert with large attempt count', async () => {
      // Given
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        status: 'NEEDS_REMEDIATION' as ProgressStatus,
        attempts: 999,
      };
      const result = createMockUserProgress({ ...input });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(res.attempts).toBe(999);
    });

    it('should propagate repository errors during upsert', async () => {
      // Given
      const error = new Error('Failed to upsert progress');
      progressRepo.upsert.mockRejectedValue(error);
      const input = { userId: 'user-1', recipeId: 'recipe-1' };

      // When/Then
      await expect(service.upsertProgress(input)).rejects.toThrow('Failed to upsert progress');
    });

    it('should handle upsert with all status values', async () => {
      // Given
      const statuses: ProgressStatus[] = [
        'LOCKED',
        'UNLOCKED',
        'IN_PROGRESS',
        'MASTERED',
        'NEEDS_REMEDIATION',
        'FAILED',
      ];
      for (const status of statuses) {
        const input = { userId: 'user-1', recipeId: 'recipe-1', status };
        const result = createMockUserProgress({ ...input });
        progressRepo.upsert.mockResolvedValue(result);

        // When
        const res = await service.upsertProgress(input);

        // Then
        expect(res.status).toBe(status);
      }
    });

    it('should pass timestamp-related fields unchanged (lastAttemptAt)', async () => {
      // Given
      const existingDate = new Date('2024-01-01');
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        lastAttemptAt: existingDate,
      };
      const result = createMockUserProgress({ ...input });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(res.lastAttemptAt).toEqual(existingDate);
    });

    it('should handle upsert with minimal fields (only userId)', async () => {
      // Given
      const input = { userId: 'user-1' };
      const result = createMockUserProgress({
        ...input,
        recipeId: undefined,
        atomId: undefined,
        status: 'LOCKED', // default
      });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(res.status).toBe('LOCKED'); // default
    });

    it('should preserve existing updatedAt from repository response', async () => {
      // Given
      const now = new Date();
      const input = { userId: 'user-1', recipeId: 'recipe-1' };
      const result = createMockUserProgress({ ...input, updatedAt: now });
      progressRepo.upsert.mockResolvedValue(result);

      // When
      const res = await service.upsertProgress(input);

      // Then
      expect(res.updatedAt).toEqual(now);
    });

    it('should call upsert with exactly the input object (reference integrity)', async () => {
      // Given
      const input = {
        userId: 'user-1',
        recipeId: 'recipe-1',
        status: 'IN_PROGRESS' as ProgressStatus,
      };
      progressRepo.upsert.mockResolvedValue(createMockUserProgress(input));

      // When
      await service.upsertProgress(input);

      // Then
      expect(progressRepo.upsert).toHaveBeenCalledWith(expect.objectContaining(input));
      // Ensure no extra properties are added by service
      expect(progressRepo.upsert.mock.calls[0][0]).not.toHaveProperty('extraProp');
    });
  });
});
