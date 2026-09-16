import { useState, useEffect } from 'react';
import type { BadgeInfo, EarnedBadge } from '@pixel-mentor/shared/gamification';

import { api, type Class, type Session, type User } from '@/services/api';
import { gamificationApi } from '@/features/gamification/services/gamification.api';
import { logger } from '@/utils/logger';

interface StreakHistoryEntry {
  date: string;
  active: boolean;
}

interface AchievementsData {
  badges: BadgeInfo[];
  userBadges: EarnedBadge[];
  // NOTE: streakHistory is typed as the API response shape.
  // XPChart currently expects { date: string; xp: number }[] which is a pre-existing
  // data mismatch — XPChart needs a separate fix to consume the correct data.
  streakHistory: StreakHistoryEntry[];
}

export function useDashboardData(user: User | null) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [achievements, setAchievements] = useState<AchievementsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAdventureData() {
      try {
        const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
        const [classesData, sessionsData, badges, userBadges, streakResponse] = await Promise.all([
          isTeacher
            ? api.listClasses('PUBLISHED').catch((err) => {
                // 403 for students or empty for new teachers is not a fatal dashboard error
                if (err?.response?.status === 403) return { classes: [] } as never;
                throw err;
              })
            : Promise.resolve({ classes: [] } as never),
          user ? api.listSessions(user.id, false) : Promise.resolve([]),
          gamificationApi.getBadges(),
          gamificationApi.getUserBadges(),
          gamificationApi.getStreakHistory(),
        ]);

        const streakHistory = Array.isArray(streakResponse)
          ? streakResponse
          : streakResponse?.history || [];

        setClasses(classesData.classes);
        setSessions(sessionsData);
        setAchievements({
          badges: badges?.allBadges || [],
          userBadges: userBadges?.earnedBadges || [],
          streakHistory,
        });
      } catch (e) {
        logger.error('Error loading dashboard data', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadAdventureData();
  }, [user]);

  return { classes, sessions, achievements, isLoading };
}
