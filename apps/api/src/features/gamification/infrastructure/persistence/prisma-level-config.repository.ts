import type {
  LevelConfig,
  ILevelConfigRepository,
} from '../../domain/ports/level-config.repository.port';
import { prisma } from '@/database/client.js';

export class PrismaLevelConfigRepository implements ILevelConfigRepository {
  async findByLevel(level: number): Promise<LevelConfig | null> {
    const config = await prisma.levelConfig.findUnique({
      where: { level },
    });

    if (!config) {
      return null;
    }

    return {
      level: config.level,
      title: config.title,
      minXP: config.minXP,
      icon: config.icon,
    };
  }

  async findAll(): Promise<LevelConfig[]> {
    const configs = await prisma.levelConfig.findMany({
      orderBy: { level: 'asc' },
    });

    return configs.map((c) => ({
      level: c.level,
      title: c.title,
      minXP: c.minXP,
      icon: c.icon,
    }));
  }
}
