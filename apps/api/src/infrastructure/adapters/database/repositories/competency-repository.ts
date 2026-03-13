import { prisma } from '../client';
import type { Competency } from '@/domain/entities/competency';
import type { CompetencyRepository } from '@/domain/ports/competency-repository';

export class PrismaCompetencyRepository implements CompetencyRepository {
  async findById(id: string): Promise<Competency | null> {
    const raw = await prisma.competency.findUnique({ where: { id } });
    return raw ? this.mapCompetency(raw) : null;
  }

  async findByCode(code: string): Promise<Competency | null> {
    const raw = await prisma.competency.findUnique({ where: { code } });
    return raw ? this.mapCompetency(raw) : null;
  }

  async findAll(): Promise<Competency[]> {
    const raw = await prisma.competency.findMany();
    return raw.map(this.mapCompetency);
  }

  async create(competency: Omit<Competency, 'createdAt'>): Promise<Competency> {
    const raw = await prisma.competency.create({
      data: {
        code: competency.code,
        name: competency.name,
        description: competency.description,
      },
    });
    return this.mapCompetency(raw);
  }

  async update(id: string, data: Partial<Competency>): Promise<Competency> {
    const raw = await prisma.competency.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
      },
    });
    return this.mapCompetency(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.competency.delete({ where: { id } });
  }

  private mapCompetency(raw: any): Competency {
    return {
      id: raw.id,
      code: raw.code,
      name: raw.name,
      description: raw.description,
      createdAt: raw.createdAt,
    };
  }
}
