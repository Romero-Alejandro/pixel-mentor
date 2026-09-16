import { prisma } from '@/database/client.js';
import {
  AtomType,
  type Atom,
  type AtomOption,
} from '@/features/knowledge/domain/entities/atom.entity.js';
import type { AtomCompetency } from '@/features/knowledge/domain/entities/atom-competency.entity.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import { toPrismaJsonOrUndefined } from '@/shared/utils/prisma-json.js';

/** Row shape returned by the generated Atom delegate. */
type AtomRow =
  ReturnType<typeof prisma.atom.findUniqueOrThrow> extends Promise<infer R> ? R : never;

/**
 * Minimal competency columns included alongside atom-competency links.
 * Intentionally narrower than the full Competency entity (no createdAt):
 * it mirrors exactly what the repository selects, nothing more.
 * `description` keeps the DB's nullability; the domain mapping narrows it.
 */
interface IncludedCompetency {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

/** Atom-competency link row, optionally with its included competency. */
interface AtomCompetencyLink {
  id: string;
  atomId: string;
  competencyId: string;
  weight: number;
  competency?: IncludedCompetency | null;
}

const DOMAIN_ATOM_TYPES = new Set<string>(Object.values(AtomType));

/**
 * Boundary conversion generated-enum → domain-enum. Both declare the same
 * string members; the guard makes an unexpected value loud instead of
 * silently accepted.
 */
function toDomainAtomType(value: string): AtomType {
  if (DOMAIN_ATOM_TYPES.has(value)) return value as AtomType;
  throw new Error(`Unknown atom type from database: ${value}`);
}

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
        ssmlChunks: toPrismaJsonOrUndefined(atom.ssmlChunks, 'atom.ssmlChunks'),
        content: toPrismaJsonOrUndefined(atom.content, 'atom.content'),
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
        ssmlChunks: toPrismaJsonOrUndefined(data.ssmlChunks, 'atom.ssmlChunks'),
        content: toPrismaJsonOrUndefined(data.content, 'atom.content'),
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

  async findOptionsByAtomId(atomId: string): Promise<AtomOption[]> {
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
      ...(opt.feedback !== null && { feedback: opt.feedback }),
    }));
  }

  async createOption(option: AtomOption): Promise<AtomOption> {
    const raw = await prisma.atomOption.create({
      data: {
        atomId: option.atomId,
        text: option.text,
        isCorrect: option.isCorrect,
        order: option.order,
        feedback: option.feedback,
      },
    });
    return {
      id: raw.id,
      atomId: raw.atomId,
      text: raw.text,
      isCorrect: raw.isCorrect,
      order: raw.order,
      ...(raw.feedback !== null && { feedback: raw.feedback }),
    };
  }

  async findCompetenciesByAtomId(atomId: string): Promise<AtomCompetency[]> {
    const links = await prisma.atomCompetency.findMany({
      where: { atomId },
      include: {
        competency: { select: { id: true, code: true, name: true, description: true } },
      },
    });
    return links.map(this.mapCompetencyLink);
  }

  async linkCompetency(atomId: string, competencyId: string, weight: number = 1.0): Promise<void> {
    await prisma.atomCompetency.create({
      data: { atomId, competencyId, weight },
    });
  }

  private mapCompetencyLink(link: AtomCompetencyLink): AtomCompetency {
    const base: AtomCompetency = {
      id: link.id,
      atomId: link.atomId,
      competencyId: link.competencyId,
      weight: link.weight,
    };
    if (!link.competency) return base;
    const competency: IncludedCompetency = {
      id: link.competency.id,
      code: link.competency.code,
      name: link.competency.name,
      description: link.competency.description,
    };
    // Runtime link rows never carry a `competency` key; extra data is additive.
    return Object.freeze({ ...base, competency }) as AtomCompetency & {
      competency: IncludedCompetency;
    };
  }

  private mapAtom(raw: AtomRow): Atom {
    return {
      id: raw.id,
      canonicalId: raw.canonicalId,
      title: raw.title,
      description: raw.description ?? undefined,
      type: toDomainAtomType(raw.type),
      ssmlChunks: raw.ssmlChunks ?? undefined,
      content: raw.content ?? undefined,
      locale: raw.locale,
      durationSeconds: raw.durationSeconds ?? undefined,
      difficulty: raw.difficulty,
      version: raw.version,
      published: raw.published,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}
