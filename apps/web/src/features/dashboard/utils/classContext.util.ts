import { LESSON_STATUS, type LessonStatus } from '../constants/dashboard.constants';

import type { Class, Session } from '@/services/api';

export interface ClassContext {
  status: LessonStatus;
  progressPercent: number;
  totalLessons: number;
  completedLessons: number;
}

export interface MapTier {
  tierId: number;
  classes: Array<{ classItem: Class; context: ClassContext }>;
}

export function getClassContext(classItem: Class, sessions: Session[] = []): ClassContext {
  // Manejo de seguridad si el objeto llega nulo
  if (!classItem)
    return {
      status: LESSON_STATUS.LOCKED,
      progressPercent: 0,
      totalLessons: 0,
      completedLessons: 0,
    };

  const lessons = classItem.lessons || [];
  const totalLessons = lessons.length;

  if (totalLessons === 0) {
    return {
      status: LESSON_STATUS.AVAILABLE,
      progressPercent: 0,
      totalLessons,
      completedLessons: 0,
    };
  }

  let completedLessons = 0;
  let hasWrongAnswers = false;

  for (const lesson of lessons) {
    const session = sessions.find((s) => s.recipeId === lesson.recipeId);
    if (session?.status === 'COMPLETED') {
      completedLessons++;
      const wrong = session.stateCheckpoint?.totalWrongAnswers ?? session.failedAttempts ?? 0;
      if (wrong > 0) hasWrongAnswers = true;
    }
  }

  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  let status: LessonStatus = LESSON_STATUS.AVAILABLE;
  if (completedLessons === totalLessons) {
    status = hasWrongAnswers ? LESSON_STATUS.PRACTICED : LESSON_STATUS.MASTERED;
  } else if (completedLessons > 0) {
    status = LESSON_STATUS.IN_PROGRESS;
  }

  return { status, progressPercent, totalLessons, completedLessons };
}

export function buildClassTiers(classes: Class[] = [], sessions: Session[] = []): MapTier[] {
  // 1. Prevención del error "Cannot read properties of undefined"
  if (!classes || !Array.isArray(classes)) return [];

  // 2. Usamos un objeto estándar en lugar de un Map para mayor compatibilidad
  const tiersObj: Record<number, Array<{ classItem: Class; context: ClassContext }>> = {};

  for (let i = 0; i < classes.length; i++) {
    const classItem = classes[i];
    const tier = (classItem as Class & { tier?: number }).tier ?? Math.floor(i / 1.5);
    const context = getClassContext(classItem, sessions);

    if (!tiersObj[tier]) {
      tiersObj[tier] = [];
    }
    tiersObj[tier].push({ classItem, context });
  }

  // 3. Object.entries es 100% seguro aquí.
  return Object.entries(tiersObj)
    .map(([tierId, items]) => ({ tierId: Number(tierId), classes: items }))
    .sort((a, b) => a.tierId - b.tierId);
}
