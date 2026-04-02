import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UserGamificationProfile, EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '../gamification.store';
import { gamificationApi } from '../../api/gamification.api';

vi.mock('../../api/gamification.api', () => ({
  gamificationApi: {
    getProfile: vi.fn(),
    recordActivity: vi.fn(),
    getBadges: vi.fn(),
    getProgress: vi.fn(),
  },
}));

const mockedApi = vi.mocked(gamificationApi);

const mockProfile: UserGamificationProfile = {
  userId: 'user-1',
  totalXP: 150,
  currentLevel: 2,
  currentStreak: 3,
  longestStreak: 5,
  levelTitle: 'Aprendiz',
  xpToNextLevel: 350,
  badges: [],
};

const mockBadge: EarnedBadge = {
  code: 'first_lesson',
  name: 'Primera Lección',
  description: 'Completaste tu primera lección',
  icon: '🎯',
  earnedAt: '2026-03-20T10:00:00.000Z',
  xpReward: 10,
};

describe('gamification store', () => {
  beforeEach(() => {
    mockedApi.getProfile.mockClear();
    mockedApi.recordActivity.mockClear();
    mockedApi.getBadges.mockClear();
    useGamificationStore.setState({
      profile: null,
      isLoading: false,
      error: null,
      showLevelUp: false,
      levelUpData: null,
      showBadgeEarned: false,
      badgeData: null,
    });
  });

  // ==================== Initial State ====================

  describe('initial state', () => {
    it('should have null profile initially', () => {
      expect(useGamificationStore.getState().profile).toBeNull();
    });

    it('should have isLoading false initially', () => {
      expect(useGamificationStore.getState().isLoading).toBe(false);
    });

    it('should have null error initially', () => {
      expect(useGamificationStore.getState().error).toBeNull();
    });

    it('should have modal states hidden initially', () => {
      const state = useGamificationStore.getState();
      expect(state.showLevelUp).toBe(false);
      expect(state.levelUpData).toBeNull();
      expect(state.showBadgeEarned).toBe(false);
      expect(state.badgeData).toBeNull();
    });
  });

  // ==================== fetchProfile ====================

  describe('fetchProfile', () => {
    it('should set isLoading to true during fetch', async () => {
      mockedApi.getProfile.mockResolvedValue(mockProfile);

      const fetchPromise = useGamificationStore.getState().fetchProfile();
      expect(useGamificationStore.getState().isLoading).toBe(true);

      await fetchPromise;
      expect(useGamificationStore.getState().isLoading).toBe(false);
    });

    it('should set profile on successful fetch', async () => {
      mockedApi.getProfile.mockResolvedValue(mockProfile);

      await useGamificationStore.getState().fetchProfile();

      expect(useGamificationStore.getState().profile).toEqual(mockProfile);
      expect(useGamificationStore.getState().error).toBeNull();
    });

    it('should set error on failed fetch', async () => {
      mockedApi.getProfile.mockRejectedValue(new Error('Network error'));

      await expect(useGamificationStore.getState().fetchProfile()).rejects.toThrow('Network error');

      expect(useGamificationStore.getState().profile).toBeNull();
      expect(useGamificationStore.getState().error).toBe('Network error');
      expect(useGamificationStore.getState().isLoading).toBe(false);
    });

    it('should use generic error message for non-Error throws', async () => {
      mockedApi.getProfile.mockRejectedValue('string error');

      await expect(useGamificationStore.getState().fetchProfile()).rejects.toBe('string error');

      expect(useGamificationStore.getState().error).toBe('Failed to fetch gamification profile');
    });
  });

  // ==================== recordActivity ====================

  describe('recordActivity', () => {
    it('should set isLoading to true during activity recording', async () => {
      mockedApi.recordActivity.mockResolvedValue({
        success: true,
        profile: mockProfile,
        levelUp: false,
        newBadges: [],
      });

      const recordPromise = useGamificationStore.getState().recordActivity('LESSON_COMPLETED');
      expect(useGamificationStore.getState().isLoading).toBe(true);

      await recordPromise;
      expect(useGamificationStore.getState().isLoading).toBe(false);
    });

    it('should update profile on successful activity', async () => {
      const updatedProfile = { ...mockProfile, totalXP: 200 };
      mockedApi.recordActivity.mockResolvedValue({
        success: true,
        profile: updatedProfile,
        levelUp: false,
        newBadges: [],
      });

      await useGamificationStore.getState().recordActivity('LESSON_COMPLETED');

      expect(useGamificationStore.getState().profile).toEqual(updatedProfile);
      expect(useGamificationStore.getState().showLevelUp).toBe(false);
      expect(useGamificationStore.getState().showBadgeEarned).toBe(false);
    });

    it('should show level up modal when levelUp is true', async () => {
      const leveledUpProfile = {
        ...mockProfile,
        currentLevel: 3,
        levelTitle: 'Explorador',
        totalXP: 500,
      };
      mockedApi.recordActivity.mockResolvedValue({
        success: true,
        profile: leveledUpProfile,
        levelUp: true,
        newBadges: [],
      });

      await useGamificationStore.getState().recordActivity('LESSON_COMPLETED');

      expect(useGamificationStore.getState().showLevelUp).toBe(true);
      expect(useGamificationStore.getState().levelUpData).toEqual({
        userId: 'user-1',
        newLevel: 3,
        newLevelTitle: 'Explorador',
        previousLevel: 2,
        totalXP: 500,
      });
    });

    it('should show badge earned modal when newBadges is non-empty', async () => {
      mockedApi.recordActivity.mockResolvedValue({
        success: true,
        profile: mockProfile,
        levelUp: false,
        newBadges: [mockBadge],
      });

      await useGamificationStore.getState().recordActivity('ACTIVITY_ATTEMPT');

      expect(useGamificationStore.getState().showBadgeEarned).toBe(true);
      expect(useGamificationStore.getState().badgeData).toEqual(mockBadge);
    });

    it('should set error on failed activity recording', async () => {
      mockedApi.recordActivity.mockRejectedValue(new Error('Server error'));

      await expect(useGamificationStore.getState().recordActivity('DAILY_LOGIN')).rejects.toThrow(
        'Server error',
      );

      expect(useGamificationStore.getState().error).toBe('Server error');
      expect(useGamificationStore.getState().isLoading).toBe(false);
    });
  });

  // ==================== dismissLevelUp ====================

  describe('dismissLevelUp', () => {
    it('should hide level up modal and clear data', () => {
      useGamificationStore.setState({
        showLevelUp: true,
        levelUpData: {
          userId: 'user-1',
          newLevel: 3,
          newLevelTitle: 'Explorador',
          previousLevel: 2,
          totalXP: 500,
        },
      });

      useGamificationStore.getState().dismissLevelUp();

      expect(useGamificationStore.getState().showLevelUp).toBe(false);
      expect(useGamificationStore.getState().levelUpData).toBeNull();
    });
  });

  // ==================== dismissBadgeEarned ====================

  describe('dismissBadgeEarned', () => {
    it('should hide badge earned modal and clear data', () => {
      useGamificationStore.setState({
        showBadgeEarned: true,
        badgeData: mockBadge,
      });

      useGamificationStore.getState().dismissBadgeEarned();

      expect(useGamificationStore.getState().showBadgeEarned).toBe(false);
      expect(useGamificationStore.getState().badgeData).toBeNull();
    });
  });
});
