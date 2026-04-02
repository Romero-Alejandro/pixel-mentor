import type { IDailyActivityRepository } from '../../domain/ports/daily-activity.repository.port';
import { prisma } from '@/database/client.js';

export class PrismaDailyActivityRepository implements IDailyActivityRepository {
  async recordActivity(userId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

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
  }
}
