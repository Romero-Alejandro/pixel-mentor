import { prisma } from '@/database/client.js';
import {
  toPrismaJson,
  toPrismaJsonRequired,
  toPrismaJsonOrUndefined,
} from '@/shared/utils/prisma-json.js';
import type {
  Activity,
  ActivityFeedback,
  ActivityOption,
  ActivityType,
} from '@/features/activity/domain/entities/activity.entity.js';
import type { ActivityRepository } from '@/features/activity/domain/ports/activity.repository.port.js';

/** Row shape returned by the generated Activity delegate. */
type ActivityRow =
  ReturnType<typeof prisma.activity.findUniqueOrThrow> extends Promise<infer R> ? R : never;

const ACTIVITY_TYPES: readonly ActivityType[] = ['PRACTICE', 'QUIZ', 'GAME'];

function isActivityType(value: string): value is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value);
}

function isActivityOptionArray(value: unknown): value is ActivityOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'text' in item &&
        typeof item.text === 'string' &&
        'isCorrect' in item &&
        typeof item.isCorrect === 'boolean',
    )
  );
}

function isActivityFeedback(value: unknown): value is ActivityFeedback {
  return (
    typeof value === 'object' &&
    value !== null &&
    'correct' in value &&
    typeof value.correct === 'string' &&
    'incorrect' in value &&
    typeof value.incorrect === 'string'
  );
}

export class PrismaActivityRepository implements ActivityRepository {
  async findById(id: string): Promise<Activity | null> {
    const raw = await prisma.activity.findUnique({ where: { id } });
    if (!raw) return null;
    return this.mapActivity(raw);
  }

  async findByConceptId(conceptId: string): Promise<Activity[]> {
    const raw = await prisma.activity.findMany({
      where: { conceptId },
      orderBy: { order: 'asc' },
    });
    return raw.map(this.mapActivity);
  }

  async create(activity: Omit<Activity, 'createdAt'>): Promise<Activity> {
    const raw = await prisma.activity.create({
      data: {
        id: activity.id,
        conceptId: activity.conceptId,
        type: activity.type,
        order: activity.order,
        instruction: activity.instruction,
        options: toPrismaJson(activity.options ?? null, 'activity.options'),
        correctAnswer: activity.correctAnswer,
        feedback: toPrismaJsonRequired(activity.feedback, 'activity.feedback'),
      },
    });
    return this.mapActivity(raw);
  }

  async update(id: string, data: Partial<Activity>): Promise<Activity> {
    const raw = await prisma.activity.update({
      where: { id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.instruction !== undefined && { instruction: data.instruction }),
        options: toPrismaJsonOrUndefined(data.options ?? undefined, 'activity.options'),
        ...(data.correctAnswer !== undefined && { correctAnswer: data.correctAnswer }),
        ...(data.feedback !== undefined && {
          feedback: toPrismaJsonRequired(data.feedback, 'activity.feedback'),
        }),
      },
    });
    return this.mapActivity(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.activity.delete({ where: { id } });
  }

  private mapActivity(raw: ActivityRow): Activity {
    const type = isActivityType(raw.type) ? raw.type : (raw.type.toUpperCase() as ActivityType);

    return {
      id: raw.id,
      conceptId: raw.conceptId,
      type,
      order: raw.order,
      instruction: raw.instruction,
      options: raw.options !== null && isActivityOptionArray(raw.options) ? raw.options : null,
      correctAnswer: raw.correctAnswer,
      feedback: isActivityFeedback(raw.feedback) ? raw.feedback : { correct: '', incorrect: '' },
      createdAt: raw.createdAt,
    };
  }
}
