import { create } from 'zustand';
import type {
  UserGamificationProfile,
  LevelUpInfo,
  EarnedBadge,
} from '@pixel-mentor/shared/gamification';

import { gamificationApi } from '../api/gamification.api';

interface GamificationState {
  // Data
  profile: UserGamificationProfile | null;
  isLoading: boolean;
  error: string | null;

  // UI modals
  showLevelUp: boolean;
  levelUpData: LevelUpInfo | null;
  showBadgeEarned: boolean;
  badgeData: EarnedBadge | null;

  // Actions
  fetchProfile: () => Promise<void>;
  recordActivity: (type: 'LESSON_COMPLETED' | 'ACTIVITY_ATTEMPT' | 'DAILY_LOGIN') => Promise<void>;
  dismissLevelUp: () => void;
  dismissBadgeEarned: () => void;
}

export const useGamificationStore = create<GamificationState>()((set) => ({
  // Initial data state
  profile: null,
  isLoading: false,
  error: null,

  // Initial modal state
  showLevelUp: false,
  levelUpData: null,
  showBadgeEarned: false,
  badgeData: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await gamificationApi.getProfile();
      set({ profile, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch gamification profile';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  recordActivity: async (type: 'LESSON_COMPLETED' | 'ACTIVITY_ATTEMPT' | 'DAILY_LOGIN') => {
    set({ isLoading: true, error: null });
    try {
      const result = await gamificationApi.recordActivity({ type });
      set({
        profile: result.profile,
        isLoading: false,
      });

      if (result.levelUp) {
        set({
          showLevelUp: true,
          levelUpData: {
            userId: result.profile.userId,
            newLevel: result.profile.currentLevel,
            newLevelTitle: result.profile.levelTitle,
            previousLevel: result.profile.currentLevel - 1,
            totalXP: result.profile.totalXP,
          },
        });
      }

      if (result.newBadges.length > 0) {
        const firstBadge = result.newBadges[0] as EarnedBadge;
        set({
          showBadgeEarned: true,
          badgeData: firstBadge,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record activity';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  dismissLevelUp: () => set({ showLevelUp: false, levelUpData: null }),
  dismissBadgeEarned: () => set({ showBadgeEarned: false, badgeData: null }),
}));
