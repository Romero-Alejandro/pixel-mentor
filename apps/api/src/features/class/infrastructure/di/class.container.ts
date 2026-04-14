import type { AIService } from '@/features/recipe/domain/ports/ai-service.port.js';
import { PrismaClassRepository } from '@/features/class/infrastructure/persistence/prisma-class.repository.js';
import { PrismaClassLessonRepository } from '@/features/class/infrastructure/persistence/prisma-class-lesson.repository.js';
import { PrismaClassVersionRepository } from '@/features/class/infrastructure/persistence/prisma-class-version.repository.js';
import { PrismaClassTemplateRepository } from '@/features/class/infrastructure/persistence/prisma-class-template.repository.js';
import { ClassService } from '@/features/class/application/services/class.service.js';
import { ClassAIService } from '@/features/class/application/services/class-ai.service.js';
import { ClassTemplateService } from '@/features/class/application/services/class-template.service.js';

export interface ClassContainer {
  classRepository: PrismaClassRepository;
  classLessonRepository: PrismaClassLessonRepository;
  classVersionRepository: PrismaClassVersionRepository;
  classTemplateRepository: PrismaClassTemplateRepository;
  classService: ClassService;
  classAIService: ClassAIService;
  classTemplateService: ClassTemplateService;
}

export function buildClassContainer(aiModel: AIService): ClassContainer {
  const classRepository = new PrismaClassRepository();
  const classLessonRepository = new PrismaClassLessonRepository();
  const classVersionRepository = new PrismaClassVersionRepository();
  const classTemplateRepository = new PrismaClassTemplateRepository();

  const classService = new ClassService(
    classRepository,
    classLessonRepository,
    classVersionRepository,
  );

  const classAIService = new ClassAIService(classRepository, classLessonRepository, aiModel);

  const classTemplateService = new ClassTemplateService(classTemplateRepository, classRepository);

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
