import type pino from 'pino';

import { PrismaAtomRepository } from '@/features/knowledge/infrastructure/persistence/prisma-atom.repository.js';
import { PrismaConceptRepository } from '@/features/knowledge/infrastructure/persistence/prisma-concept.repository.js';
import { PrismaKnowledgeChunkRepository } from '@/features/knowledge/infrastructure/persistence/prisma-knowledge-chunk.repository.js';

export interface KnowledgeContainer {
  atomRepository: PrismaAtomRepository;
  conceptRepository: PrismaConceptRepository;
  knowledgeChunkRepository: PrismaKnowledgeChunkRepository;
}

export function buildKnowledgeContainer(_logger: pino.Logger): KnowledgeContainer {
  const atomRepository = new PrismaAtomRepository();
  const conceptRepository = new PrismaConceptRepository();
  const knowledgeChunkRepository = new PrismaKnowledgeChunkRepository();

  return {
    atomRepository,
    conceptRepository,
    knowledgeChunkRepository,
  };
}
