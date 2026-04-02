import type {
  ClassEntity,
  ClassStatus,
  ClassLessonEntity,
  ClassVersionEntity,
  ClassTemplateEntity,
} from '../entities/class.entity';

export interface IClassRepository {
  findById(id: string): Promise<ClassEntity | null>;

  findByTutorId(
    tutorId: string,
    options?: {
      status?: ClassStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ classes: ClassEntity[]; total: number }>;

  create(classData: Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClassEntity>;

  update(
    id: string,
    classData: Partial<Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassEntity>;

  delete(id: string): Promise<void>;
}

export interface IClassLessonRepository {
  findByClassId(classId: string): Promise<ClassLessonEntity[]>;

  create(
    lessonData: Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassLessonEntity>;

  update(
    id: string,
    lessonData: Partial<Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassLessonEntity>;

  delete(id: string): Promise<void>;

  reorder(classId: string, lessonIds: string[]): Promise<void>;
}

export interface IClassVersionRepository {
  findById(id: string): Promise<ClassVersionEntity | null>;

  findByClassId(classId: string): Promise<ClassVersionEntity[]>;

  findBySlug(slug: string): Promise<ClassVersionEntity | null>;

  create(versionData: Omit<ClassVersionEntity, 'id' | 'createdAt'>): Promise<ClassVersionEntity>;

  publish(id: string): Promise<ClassVersionEntity>;
}

export interface IClassTemplateRepository {
  findById(id: string): Promise<ClassTemplateEntity | null>;

  findByTutorId(tutorId: string): Promise<ClassTemplateEntity[]>;

  create(
    templateData: Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassTemplateEntity>;

  update(
    id: string,
    templateData: Partial<Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassTemplateEntity>;

  delete(id: string): Promise<void>;
}
