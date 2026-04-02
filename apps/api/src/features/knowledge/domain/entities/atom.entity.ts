import type { AssetAttachment } from '@/shared/entities/asset-attachment.js';
import type { KnowledgeChunk } from './knowledge-chunk.entity.js';
import type { AtomCompetency } from './atom-competency.entity.js';

export enum AtomType {
  MICROLECTURE = 'MICROLECTURE',
  DEMO = 'DEMO',
  MINI_ACTIVITY = 'MINI_ACTIVITY',
  HINT = 'HINT',
  MINI_QUIZ = 'MINI_QUIZ',
  REMEDIAL = 'REMEDIAL',
  INTERACTIVE = 'INTERACTIVE',
  MANIPULATIVE = 'MANIPULATIVE',
  DRAGDROP = 'DRAGDROP',
  MCQ = 'MCQ',
}

export type AtomOption = {
  readonly id: string;
  readonly atomId: string;
  readonly text: string;
  readonly isCorrect: boolean;
  readonly order: number;
  readonly feedback?: string;
};

export interface Atom {
  readonly id: string;
  readonly canonicalId: string;
  readonly title: string;
  readonly description?: string;
  readonly type: AtomType;
  readonly ssmlChunks?: unknown;
  readonly content?: unknown;
  readonly locale: string;
  readonly durationSeconds?: number;
  readonly difficulty: number;
  readonly version: string;
  readonly published: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly options?: readonly AtomOption[];
  readonly competencies?: readonly AtomCompetency[];
  readonly attachments?: readonly AssetAttachment[];
  readonly knowledgeChunks?: readonly KnowledgeChunk[];
}

export function createAtom(parameters: {
  id: string;
  canonicalId: string;
  title: string;
  type: AtomType;
  locale?: string;
  difficulty?: number;
  version?: string;
  published?: boolean;
}): Atom {
  const now = new Date();
  return {
    id: parameters.id,
    canonicalId: parameters.canonicalId,
    title: parameters.title,
    description: undefined,
    type: parameters.type,
    ssmlChunks: undefined,
    content: undefined,
    locale: parameters.locale ?? 'es-AR',
    durationSeconds: undefined,
    difficulty: parameters.difficulty ?? 1,
    version: parameters.version ?? '1.0.0',
    published: parameters.published ?? false,
    createdAt: now,
    updatedAt: now,
  };
}
