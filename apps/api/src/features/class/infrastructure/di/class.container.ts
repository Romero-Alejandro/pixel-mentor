import type pino from 'pino';
import type { Config } from '@/shared/config/index.js';

import { PrismaClassRepository } from '@/features/class/infrastructure/persistence/prisma-class.repository.js';
import { PrismaClassLessonRepository } from '@/features/class/infrastructure/persistence/prisma-class-lesson.repository.js';
import { PrismaClassVersionRepository } from '@/features/class/infrastructure/persistence/prisma-class-version.repository.js';
import { PrismaClassTemplateRepository } from '@/features/class/infrastructure/persistence/prisma-class-template.repository.js';
import { ClassService } from '@/features/class/application/services/class.service.js';
import { ClassAIService } from '@/features/class/application/services/class-ai.service.js';
import { ClassTemplateService } from '@/features/class/application/services/class-template.service.js';
import { AIAdapterFactory } from '@/shared/ai/ai-adapter-factory.js';

export interface ClassContainer {
  classRepository: PrismaClassRepository;
  classLessonRepository: PrismaClassLessonRepository;
  classVersionRepository: PrismaClassVersionRepository;
  classTemplateRepository: PrismaClassTemplateRepository;
  classService: ClassService;
  classAIService: ClassAIService;
  classTemplateService: ClassTemplateService;
}

export function buildClassContainer(config: Config, logger: pino.Logger): ClassContainer {
  const classRepository = new PrismaClassRepository();
  const classLessonRepository = new PrismaClassLessonRepository();
  const classVersionRepository = new PrismaClassVersionRepository();
  const classTemplateRepository = new PrismaClassTemplateRepository();

  const aiProvider = AIAdapterFactory.createResilient({
    provider: config.LLM_PROVIDER,
    geminiApiKey: config.GEMINI_API_KEY,
    openRouterApiKey: config.OPENROUTER_API_KEY,
    groqApiKey: config.GROQ_API_KEY,
    defaultModelOpenRouter: config.DEFAULT_MODEL_OPENROUTER,
    defaultModelGemini: config.DEFAULT_MODEL_GEMINI,
    defaultModelGroq: config.DEFAULT_MODEL_GROQ,
    promptRepo: null as any,
    knowledgeChunkRepository: null as any,
    logger,
  });

  const classService = new ClassService(
    classRepository,
    classLessonRepository,
    classVersionRepository,
  );

  const classAIService = new ClassAIService(
    classRepository,
    classLessonRepository,
    aiProvider.aiModel,
  );

  const classTemplateService = new ClassTemplateService(
    classTemplateRepository,
    classRepository,
  );

  return {
    classRepository,
    classLessonRepository,
    classVersionRepository,
    classTemplateRepository,
    classService,
    classAIService,
    classTemplateService,
  };
}