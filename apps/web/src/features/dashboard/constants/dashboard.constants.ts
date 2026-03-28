export const DASHBOARD_TABS = {
  STREAK: 'streak',
  BADGES: 'badges',
  PROGRESS: 'progress',
} as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[keyof typeof DASHBOARD_TABS];

export const LEVEL_EMOJIS: Record<number, string> = {
  1: '🌱',
  2: '🌿',
  3: '🌸',
  4: '🌳',
  5: '🌲',
  6: '⛰️',
};

export const LESSON_STATUS = {
  AVAILABLE: 'available',
  IN_PROGRESS: 'in-progress',
  PRACTICED: 'practiced',
  MASTERED: 'mastered',
  LOCKED: 'locked',
} as const;

export type LessonStatus = (typeof LESSON_STATUS)[keyof typeof LESSON_STATUS];

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '¡Buenos días';
  if (hour < 18) return '¡Buenas tardes';
  return '¡Buenas noches';
}
