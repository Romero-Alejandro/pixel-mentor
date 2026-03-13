import { prisma } from '../client';
import type { Atom } from '@/domain/entities/atom';
import type { AtomRepository } from '@/domain/ports/atom-repository';

export class PrismaAtomRepository implements AtomRepository {
  async findById(id: string): Promise<Atom | null> {
    const raw = await prisma.atom.findUnique({ where: { id } });
    return raw ? this.mapAtom(raw) : null;
  }

  async findByCanonicalId(canonicalId: string): Promise<Atom | null> {
    const raw = await prisma.atom.findUnique({ where: { canonicalId } });
    return raw ? this.mapAtom(raw) : null;
  }

  async findAll(published: boolean = true): Promise<Atom[]> {
    const raw = await prisma.atom.findMany({ where: { published } });
    return raw.map(this.mapAtom);
  }

  async create(
    atom: Omit<
      Atom,
      'createdAt' | 'updatedAt' | 'options' | 'competencies' | 'attachments' | 'knowledgeChunks'
    >,
  ): Promise<Atom> {
    const raw = await prisma.atom.create({
      data: {
        canonicalId: atom.canonicalId,
        title: atom.title,
        description: atom.description,
        type: atom.type,
        ssmlChunks: atom.ssmlChunks,
        content: atom.content,
        locale: atom.locale,
        durationSeconds: atom.durationSeconds,
        difficulty: atom.difficulty,
        version: atom.version,
        published: atom.published,
      },
    });
    return this.mapAtom(raw);
  }

  async update(id: string, data: Partial<Atom>): Promise<Atom> {
    const raw = await prisma.atom.update({
      where: { id },
      data: {
        canonicalId: data.canonicalId,
        title: data.title,
        description: data.description,
        type: data.type,
        ssmlChunks: data.ssmlChunks,
        content: data.content,
        locale: data.locale,
        durationSeconds: data.durationSeconds,
        difficulty: data.difficulty,
        version: data.version,
        published: data.published,
      },
    });
    return this.mapAtom(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.atom.delete({ where: { id } });
  }

  async findOptionsByAtomId(atomId: string): Promise<any[]> {
    const options = await prisma.atomOption.findMany({
      where: { atomId },
      orderBy: { order: 'asc' },
    });
    return options.map((opt) => ({
      id: opt.id,
      atomId: opt.atomId,
      text: opt.text,
      isCorrect: opt.isCorrect,
      order: opt.order,
      feedback: opt.feedback,
    }));
  }

  async createOption(option: any): Promise<any> {
    const raw = await prisma.atomOption.create({
      data: {
        atomId: option.atomId,
        text: option.text,
        isCorrect: option.isCorrect,
        order: option.order,
        feedback: option.feedback,
      },
    });
    return raw;
  }

  async findCompetenciesByAtomId(atomId: string): Promise<any[]> {
    const links = await prisma.atomCompetency.findMany({
      where: { atomId },
      include: { competency: true },
    });
    return links.map((link) => ({
      id: link.id,
      atomId: link.atomId,
      competencyId: link.competencyId,
      weight: link.weight,
      competency: {
        id: link.competency.id,
        code: link.competency.code,
        name: link.competency.name,
        description: link.competency.description,
      },
    }));
  }

  async linkCompetency(atomId: string, competencyId: string, weight: number = 1.0): Promise<void> {
    await prisma.atomCompetency.create({
      data: { atomId, competencyId, weight },
    });
  }

  private mapAtom(raw: any): Atom {
    return {
      id: raw.id,
      canonicalId: raw.canonicalId,
      title: raw.title,
      description: raw.description,
      type: raw.type,
      ssmlChunks: raw.ssmlChunks,
      content: raw.content,
      locale: raw.locale,
      durationSeconds: raw.durationSeconds,
      difficulty: raw.difficulty,
      version: raw.version,
      published: raw.published,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
