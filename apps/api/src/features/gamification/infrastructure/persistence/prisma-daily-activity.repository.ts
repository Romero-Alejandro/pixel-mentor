import type { IDailyActivityRepository } from '../../domain/ports/daily-activity.repository.port';
import { prisma } from '@/database/client.js';
import { Prisma } from '@/database/generated/client/index.js';

export class PrismaDailyActivityRepository implements IDailyActivityRepository {
  async recordActivity(userId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    try {
      await prisma.dailyActivity.upsert({
        where: {
          userId_date: {
            userId,
            date: startOfDay,
          },
        },
        update: {},
        create: {
          userId,
          date: startOfDay,
        },
      });
    } catch (error) {
      // If record already exists (unique constraint), treat as success
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }
}
