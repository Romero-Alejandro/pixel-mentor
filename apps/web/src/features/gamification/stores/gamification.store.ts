import { create } from 'zustand';
import type {
  UserGamificationProfile,
  LevelUpInfo,
  EarnedBadge,
} from '@pixel-mentor/shared/gamification';

import { gamificationApi } from '@/features/gamification/services/gamification.api';

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

  // Actions
  fetchProfile: () => Promise<void>;
  dismissLevelUp: () => void;
  dismissBadgeEarned: () => void;
  processNextToast: () => void;
  clearAllToasts: () => void;
  emitXPEarned: (amount: number) => void;
  clearXPEarned: () => void;

  // SSE event handlers
  onXPEarned: (newTotalXP: number, reason: string) => void;
  onBadgeEarned: (badge: EarnedBadge) => void;
  onLevelUp: (data: {
    newLevel: number;
    newLevelTitle: string;
    previousLevel: number;
    totalXP: number;
  }) => void;
  onStreakUpdated: (currentStreak: number, longestStreak: number) => void;
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
      set({ profile, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch gamification profile';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  dismissLevelUp: () => set({ showLevelUp: false, levelUpData: null }),
  dismissBadgeEarned: () => set({ showBadgeEarned: false, badgeData: null }),
  emitXPEarned: (amount: number) => set({ xpEarned: { amount } }),
  clearXPEarned: () => set({ xpEarned: null }),

  // SSE event handlers
  onXPEarned: (newTotalXP: number, _reason: string) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, totalXP: newTotalXP } : state.profile,
      particleTrigger: state.particleTrigger + 1,
      lastUpdateTimestamp: Date.now(),
    })),

  onBadgeEarned: (badge: EarnedBadge) =>
    set((state) => ({
      profile: state.profile
        ? { ...state.profile, badges: [...state.profile.badges, badge] }
        : state.profile,
      showBadgeEarned: true,
      badgeData: badge,
      pendingToasts: [...state.pendingToasts, badge],
      lastUpdateTimestamp: Date.now(),
    })),

  onLevelUp: (data) =>
    set((state) => ({
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
    })),

  onStreakUpdated: (currentStreak: number, longestStreak: number) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, currentStreak, longestStreak } : state.profile,
      lastUpdateTimestamp: Date.now(),
    })),
}));
