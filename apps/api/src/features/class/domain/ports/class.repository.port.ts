import type {
  ClassEntity,
  ClassStatus,
  ClassLessonEntity,
  ClassVersionEntity,
  ClassTemplateEntity,
} from '@/features/class/domain/entities/class.entity.js';

export interface IClassRepository {
  findById(id: string): Promise<ClassEntity | null>;
  findBySlug(slug: string): Promise<ClassEntity | null>;

  findByTutorId(
    tutorId: string,
    options?: {
      status?: ClassStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ classes: ClassEntity[]; total: number }>;

  create(classData: Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClassEntity>;

  /**
   * Create a class together with its initial lessons in a single transaction.
   * Atomicity matters: a half-created class with missing lessons is worse than
   * a failed request the client can retry.
   */
  createWithLessons(
    classData: Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>,
    lessons: readonly { recipeId: string; order: number }[],
  ): Promise<ClassEntity>;

  update(
    id: string,
    classData: Partial<Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassEntity>;

  delete(id: string): Promise<void>;
}

export interface IClassLessonRepository {
  findByClassId(classId: string): Promise<ClassLessonEntity[]>;

  findById(id: string): Promise<ClassLessonEntity | null>;
  findClassIdByLessonId(lessonId: string): Promise<string | null>;

  findByRecipeId(recipeId: string): Promise<ClassLessonEntity[]>;

  findByUserId(userId: string): Promise<ClassLessonEntity[]>;

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

  /**
   * Publish a class version (mark as published)
   */
  publish(id: string): Promise<ClassVersionEntity>;

  /**
   * Create the published version snapshot, mark the class PUBLISHED and bump
   * its version counter atomically. Kept in the repository (not the service)
   * so the multi-table write can run inside one database transaction.
   */
  createPublishedVersion(parameters: {
    classId: string;
    version: string;
    title: string;
    description?: string;
    slug: string;
    targetAgeMin?: number;
    targetAgeMax?: number;
    lessons: readonly {
      recipeId: string;
      order: number;
      title: string;
      duration?: number;
      recipeSnapshot?: Record<string, unknown>;
    }[];
  }): Promise<ClassVersionEntity>;

  /**
   * Mark a published version as unpublished (isPublished=false).
   */
  unpublishByClassId(classId: string): Promise<void>;
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
