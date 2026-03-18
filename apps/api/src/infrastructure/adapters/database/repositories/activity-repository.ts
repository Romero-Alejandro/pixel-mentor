import { prisma } from '../client';

import type { Activity } from '@/domain/entities/activity';
import type { ActivityRepository } from '@/domain/ports/activity-repository';

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
        options: activity.options as any,
        correctAnswer: activity.correctAnswer,
        feedback: activity.feedback as any,
      },
    });
    return this.mapActivity(raw);
  }

  async update(id: string, data: Partial<Activity>): Promise<Activity> {
    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.instruction !== undefined) updateData.instruction = data.instruction;
    if (data.options !== undefined) updateData.options = data.options as any;
    if (data.correctAnswer !== undefined) updateData.correctAnswer = data.correctAnswer;
    if (data.feedback !== undefined) updateData.feedback = data.feedback as any;

    const raw = await prisma.activity.update({
      where: { id },
      data: updateData,
    });
    return this.mapActivity(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.activity.delete({ where: { id } });
  }

  private mapActivity(raw: any): Activity {
    return {
      id: raw.id,
      conceptId: raw.conceptId,
      type: raw.type,
      order: raw.order,
      instruction: raw.instruction,
      options: raw.options,
      correctAnswer: raw.correctAnswer,
      feedback: raw.feedback,
      createdAt: raw.createdAt,
    };
  }
}
