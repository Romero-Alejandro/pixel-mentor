import type { IDailyActivityRepository } from '@/features/gamification/domain/ports/daily-activity.repository.port.js';
import { prisma } from '@/database/client.js';

export class PrismaDailyActivityRepository implements IDailyActivityRepository {
  async recordActivity(userId: string, date: Date): Promise<void> {
    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);

    // The unique key does the dedupe in the database: a check-then-create would
    // race with a concurrent request for the same day and throw P2002.
    await prisma.dailyActivity.createMany({
      data: [{ userId, date: day }],
      skipDuplicates: true,
    });
  }

  async getActivityDates(userId: string, since?: Date): Promise<Date[]> {
    const rows = await prisma.dailyActivity.findMany({
      where: { userId, ...(since ? { date: { gte: since } } : {}) },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    return rows.map((row) => row.date);
  }
}
