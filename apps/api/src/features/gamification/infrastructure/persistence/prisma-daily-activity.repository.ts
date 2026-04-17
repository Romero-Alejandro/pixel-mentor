import type { IDailyActivityRepository } from '../../domain/ports/daily-activity.repository.port';

import { prisma } from '@/database/client.js';

export class PrismaDailyActivityRepository implements IDailyActivityRepository {
  async recordActivity(userId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Verificar si el registro ya existe
    const existingActivity = await prisma.dailyActivity.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDay,
        },
      },
    });

    if (existingActivity) {
      // Si ya existe, no hacer nada - el registro ya está creado
      return;
    }
    // Si no existe, crear el registro
    await prisma.dailyActivity.create({
      data: {
        userId,
        date: startOfDay,
      },
    });
  }
}
