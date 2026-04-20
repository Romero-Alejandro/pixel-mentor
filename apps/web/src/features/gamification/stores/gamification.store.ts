import { create } from 'zustand';
import type {
  UserGamificationProfile,
  LevelUpInfo,
  EarnedBadge,
} from '@pixel-mentor/shared/gamification';

import { gamificationApi } from '../services/gamification.api';

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

  // XP Particle trigger
  xpEarned: { amount: number } | null;

  // SSE real-time event state
  particleTrigger: number;
  pendingToasts: EarnedBadge[];

  // Race condition prevention
  lastUpdateTimestamp: number;
  requestVersion: number;

  // Actions
  fetchProfile: () => Promise<void>;
  recordActivity: (type: 'LESSON_COMPLETED' | 'ACTIVITY_ATTEMPT' | 'DAILY_LOGIN') => Promise<void>;
  dismissLevelUp: () => void;
  dismissBadgeEarned: () => void;
  processNextToast: () => void;
  clearAllToasts: () => void;
  emitXPEarned: (amount: number) => void;
  clearXPEarned: () => void;

  // SSE event handlers with version checking
  onXPEarned: (newTotalXP: number, reason: string, version: number) => void;
  onBadgeEarned: (badge: EarnedBadge, version: number) => void;
  onLevelUp: (
    data: {
      newLevel: number;
      newLevelTitle: string;
      previousLevel: number;
      totalXP: number;
    },
    version: number,
  ) => void;
  onStreakUpdated: (currentStreak: number, longestStreak: number, version: number) => void;
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

  // Initial XP particle state
  xpEarned: null,

  // Initial SSE real-time state
  particleTrigger: 0,
  pendingToasts: [],

  // Race condition prevention
  lastUpdateTimestamp: 0,
  requestVersion: 0,

  // Process the next badge from the toasts queue
  processNextToast: () => {
    set((state) => {
      if (state.pendingToasts.length === 0) {
        return { showBadgeEarned: false, badgeData: null };
      }
      const [next, ...rest] = state.pendingToasts;
      return {
        pendingToasts: rest,
        showBadgeEarned: true,
        badgeData: next,
      };
    });
  },

  // Clear all pending toasts
  clearAllToasts: () => set({ pendingToasts: [], showBadgeEarned: false, badgeData: null }),

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await gamificationApi.getProfile();
      set({ profile, isLoading: false, requestVersion: 0 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch gamification profile';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  recordActivity: async (type: 'LESSON_COMPLETED' | 'ACTIVITY_ATTEMPT' | 'DAILY_LOGIN') => {
    // Increment version for race condition detection
    set((state) => ({ isLoading: true, error: null, requestVersion: state.requestVersion + 1 }));
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

      // Process ALL new badges, not just the first one
      if (result.newBadges.length > 0) {
        const allNewBadges = result.newBadges as EarnedBadge[];
        // Add all to pending toasts queue
        set((state) => ({
          pendingToasts: [...state.pendingToasts, ...allNewBadges],
        }));
        // Show modal for first badge, rest will appear as toasts
        set({
          showBadgeEarned: true,
          badgeData: allNewBadges[0],
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
  emitXPEarned: (amount: number) => set({ xpEarned: { amount } }),
  clearXPEarned: () => set({ xpEarned: null }),

  // SSE event handlers with version checking to prevent race conditions
  onXPEarned: (newTotalXP: number, _reason: string, version: number) =>
    set((state) => {
      // Ignore stale responses - only process if version matches current request
      if (version < state.requestVersion) {
        return state;
      }
      return {
        profile: state.profile ? { ...state.profile, totalXP: newTotalXP } : state.profile,
        particleTrigger: state.particleTrigger + 1,
        lastUpdateTimestamp: Date.now(),
      };
    }),

  onBadgeEarned: (badge: EarnedBadge, version: number) =>
    set((state) => {
      // Ignore stale responses
      if (version < state.requestVersion) {
        return state;
      }
      return {
        profile: state.profile
          ? { ...state.profile, badges: [...state.profile.badges, badge] }
          : state.profile,
        showBadgeEarned: true,
        badgeData: badge,
        pendingToasts: [...state.pendingToasts, badge],
        lastUpdateTimestamp: Date.now(),
      };
    }),

  onLevelUp: (data, version: number) =>
    set((state) => {
      // Ignore stale responses
      if (version < state.requestVersion) {
        return state;
      }
      return {
        profile: state.profile
          ? {
              ...state.profile,
              currentLevel: data.newLevel,
              levelTitle: data.newLevelTitle,
            }
          : state.profile,
        showLevelUp: true,
        levelUpData: {
          userId: state.profile?.userId ?? '',
          newLevel: data.newLevel,
          newLevelTitle: data.newLevelTitle,
          previousLevel: data.previousLevel,
          totalXP: data.totalXP,
        },
        lastUpdateTimestamp: Date.now(),
      };
    }),

  onStreakUpdated: (currentStreak: number, longestStreak: number, version: number) =>
    set((state) => {
      // Ignore stale responses
      if (version < state.requestVersion) {
        return state;
      }
      return {
        profile: state.profile ? { ...state.profile, currentStreak, longestStreak } : state.profile,
        lastUpdateTimestamp: Date.now(),
      };
    }),
}));
