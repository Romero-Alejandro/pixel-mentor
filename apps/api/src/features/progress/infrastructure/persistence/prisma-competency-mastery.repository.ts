import type { CompetencyMastery } from '../../domain/entities/competency-mastery.entity.js';
import type { CompetencyMasteryRepository } from '../../domain/ports/competency-mastery.repository.port.js';

import { prisma } from '@/database/client.js';

export class PrismaCompetencyMasteryRepository implements CompetencyMasteryRepository {
  async findById(id: string): Promise<CompetencyMastery | null> {
    const raw = await prisma.competencyMastery.findUnique({ where: { id } });
    return raw ? this.mapToDomain(raw) : null;
  }

  async findByUserId(userId: string): Promise<CompetencyMastery[]> {
    const raw = await prisma.competencyMastery.findMany({
      where: { userId },
    });
    return raw.map(this.mapToDomain);
  }

  async findByUserIdAndCompetencyId(
    userId: string,
    competencyId: string,
  ): Promise<CompetencyMastery | null> {
    const raw = await prisma.competencyMastery.findUnique({
      where: {
        userId_competencyId: {
          userId,
          competencyId,
        },
      },
    });
    return raw ? this.mapToDomain(raw) : null;
  }

  async upsert(
    data: Partial<CompetencyMastery> & { userId: string; competencyId: string; mastery: number },
  ): Promise<CompetencyMastery> {
    const existing = await prisma.competencyMastery.findUnique({
      where: {
        userId_competencyId: {
          userId: data.userId,
          competencyId: data.competencyId,
        },
      },
    });

    if (existing) {
      const raw = await prisma.competencyMastery.update({
        where: { id: existing.id },
        data: {
          mastery: data.mastery,
        },
      });
      return this.mapToDomain(raw);
    } else {
      const raw = await prisma.competencyMastery.create({
        data: {
          userId: data.userId,
          competencyId: data.competencyId,
          mastery: data.mastery,
        },
      });
      return this.mapToDomain(raw);
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.competencyMastery.delete({ where: { id } });
  }

  private mapToDomain(raw: any): CompetencyMastery {
    return {
      id: raw.id,
      userId: raw.userId,
      competencyId: raw.competencyId,
      mastery: raw.mastery,
      lastUpdated: raw.lastUpdated,
    };
  }
}
