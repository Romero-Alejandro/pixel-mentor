import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UserGamificationProfile, EarnedBadge } from '@pixel-mentor/shared/gamification';

import { useGamificationStore } from '@/features/gamification/stores/gamification.store';
import { gamificationApi } from '@/features/gamification/services/gamification.api';

vi.mock('@/features/gamification/services/gamification.api', () => ({
  gamificationApi: {
    getProfile: vi.fn(),
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
  // XP is awarded server-side via domain events (no POST /xp/add endpoint).
  // recordActivity only refreshes the profile; level-up/badge modals
  // are driven by SSE handlers.

  describe('recordActivity', () => {
    it('should set isLoading to true during activity recording', async () => {
      mockedApi.getProfile.mockResolvedValue(mockProfile);

      const recordPromise = useGamificationStore.getState().recordActivity('LESSON_COMPLETED');
      expect(useGamificationStore.getState().isLoading).toBe(true);

      await recordPromise;
      expect(useGamificationStore.getState().isLoading).toBe(false);
    });

    it('should refresh profile via getProfile', async () => {
      const updatedProfile = { ...mockProfile, totalXP: 200 };
      mockedApi.getProfile.mockResolvedValue(updatedProfile);

      await useGamificationStore.getState().recordActivity('LESSON_COMPLETED');

      expect(mockedApi.getProfile).toHaveBeenCalled();
      expect(useGamificationStore.getState().profile).toEqual(updatedProfile);
      expect(useGamificationStore.getState().showLevelUp).toBe(false);
      expect(useGamificationStore.getState().showBadgeEarned).toBe(false);
    });

    it('should set error on failed activity recording', async () => {
      mockedApi.getProfile.mockRejectedValue(new Error('Server error'));

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
