import { getEventBus } from '@/shared/events/event-bus.port.js';
import { GameDomainEvents } from '@/shared/events/game-events.port.js';
import type { LessonCompletedPayload } from '@/shared/events/game-events.port.js';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port.js';

export interface LessonAccuracy {
  correctFirstAttempts: number;
  correctLastAttempts: number;
  totalActivities: number;
  skippedActivities: number;
  accuracyPercent: number;
  allCorrectOnFirstAttempt: boolean;
  tier: 'perfect' | 'high' | 'medium' | 'low';
}

/**
 * Lesson-completion side effects: accuracy calculation and gamification events.
 *
 * Extracted from OrchestrateRecipeUseCase (Phase 4 refactor).
 */
export class LessonCompletionService {
  constructor(private activityAttemptRepo?: ActivityAttemptRepository) {}

  /**
   * Calculate accuracy for a completed lesson.
   * Uses LAST attempt to determine if the student eventually mastered the material.
   * Also tracks if all answers were correct on first attempt for bonus XP.
   */
  async calculateAccuracy(
    userId: string,
    steps: readonly { atomId: string; stepType?: string | null }[],
    skippedAtomIds: readonly string[],
  ): Promise<LessonAccuracy> {
    const activitySteps = steps.filter(
      (s) => s.stepType === 'activity' || s.stepType === 'question',
    );
    const totalActivities = activitySteps.length;

    let correctFirstAttempts = 0;
    let correctLastAttempts = 0;
    let allCorrectOnFirstAttempt = true;

    const attemptedSteps = activitySteps.filter((s) => !skippedAtomIds.includes(s.atomId));

    if (attemptedSteps.length > 0 && this.activityAttemptRepo) {
      // Single batched query for ALL atoms (instead of one query per step).
      const attempts = await this.activityAttemptRepo.findByUserIdAndAtomIds(
        userId,
        attemptedSteps.map((s) => s.atomId),
      );

      // Group by atomId and compute first/last attempt per atom in memory.
      // first = record with the lowest attemptNo, last = highest attemptNo
      // (replaces the previous per-atom sort; equivalent for distinct attemptNo).
      interface AtomAttemptSummary {
        minAttemptNo: number;
        maxAttemptNo: number;
        firstCorrect: boolean;
        lastCorrect: boolean;
      }
      const attemptsByAtom = new Map<string, AtomAttemptSummary>();
      for (const attempt of attempts) {
        // Ungraded attempts (correct undefined/null) count as not correct,
        // matching the previous per-attempt truthiness behavior.
        const isCorrect = attempt.correct === true;
        const entry = attemptsByAtom.get(attempt.atomId);
        if (!entry) {
          attemptsByAtom.set(attempt.atomId, {
            minAttemptNo: attempt.attemptNo,
            maxAttemptNo: attempt.attemptNo,
            firstCorrect: isCorrect,
            lastCorrect: isCorrect,
          });
          continue;
        }
        if (attempt.attemptNo < entry.minAttemptNo) {
          entry.minAttemptNo = attempt.attemptNo;
          entry.firstCorrect = isCorrect;
        }
        if (attempt.attemptNo >= entry.maxAttemptNo) {
          entry.maxAttemptNo = attempt.attemptNo;
          entry.lastCorrect = isCorrect;
        }
      }

      for (const step of attemptedSteps) {
        const entry = attemptsByAtom.get(step.atomId);

        // Check first attempt (for bonus calculation)
        if (entry?.firstCorrect) {
          correctFirstAttempts++;
        } else {
          allCorrectOnFirstAttempt = false;
        }

        // Check last attempt (for accuracy calculation - mastery)
        if (entry?.lastCorrect) {
          correctLastAttempts++;
        }
      }
    }

    const skippedActivities = skippedAtomIds.length;
    const attemptedActivities = totalActivities - skippedActivities;

    // Accuracy is based on LAST attempt (mastery)
    const accuracyPercent =
      attemptedActivities > 0 ? Math.round((correctLastAttempts / attemptedActivities) * 100) : 100;

    // Determine tier based on last attempt accuracy
    let tier: 'perfect' | 'high' | 'medium' | 'low';
    if (accuracyPercent >= 100) tier = 'perfect';
    else if (accuracyPercent >= 80) tier = 'high';
    else if (accuracyPercent >= 50) tier = 'medium';
    else tier = 'low';

    return {
      correctFirstAttempts,
      correctLastAttempts,
      totalActivities,
      skippedActivities,
      accuracyPercent,
      allCorrectOnFirstAttempt,
      tier,
    };
  }

  /**
   * Emit LESSON_COMPLETED event to trigger gamification processing (XP, badges, streaks).
   * Calculates accuracy from ActivityAttempt records and includes it in the payload.
   * Wrapped in try/catch so gamification failures never break session completion.
   */
  async emitLessonCompleted(
    userId: string,
    lessonId: string,
    lessonTitle: string,
    steps: readonly { atomId: string; stepType?: string | null }[],
    skippedAtomIds: readonly string[],
  ): Promise<void> {
    try {
      const eventBus = getEventBus();

      // Calculate accuracy
      const accuracyData = await this.calculateAccuracy(userId, steps, skippedAtomIds);

      const payload: LessonCompletedPayload = {
        userId,
        lessonId,
        lessonTitle,
        completedAt: new Date(),
        accuracy: accuracyData,
      };
      await eventBus.emit(GameDomainEvents.LESSON_COMPLETED, payload);
    } catch {
      // Don't fail session completion if gamification fails
    }
  }
}
