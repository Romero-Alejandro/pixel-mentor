// Class Repository Interface - Hexagonal Architecture
// Following the ports pattern: interfaces in domain/repositories

import type {
  ClassEntity,
  ClassStatus,
  ClassLessonEntity,
  ClassVersionEntity,
  ClassTemplateEntity,
} from '@/features/class/domain/entities/class.entity.js';

/**
 * Repository interface for Class entity operations
 * This follows the hexagonal architecture pattern where the domain defines
 * the port (interface) and the infrastructure implements it
 */
export interface IClassRepository {
  /**
   * Find a class by its unique ID
   */
  findById(id: string): Promise<ClassEntity | null>;

  /**
   * Find a class by its slug (shortId)
   */
  findBySlug(slug: string): Promise<ClassEntity | null>;

  /**
   * Find all classes for a specific tutor
   */
  findByTutorId(
    tutorId: string,
    options?: {
      status?: ClassStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{ classes: ClassEntity[]; total: number }>;

  /**
   * Create a new class
   */
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

  /**
   * Update an existing class
   */
  update(
    id: string,
    classData: Partial<Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassEntity>;

  /**
   * Delete a class by its ID
   */
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for ClassLesson entity operations
 */
export interface IClassLessonRepository {
  /**
   * Find all lessons for a specific class
   */
  findByClassId(classId: string): Promise<ClassLessonEntity[]>;

  /**
   * Find a lesson by its ID
   */
  findById(id: string): Promise<ClassLessonEntity | null>;

  /**
   * Find the class ID for a given lesson
   */
  findClassIdByLessonId(lessonId: string): Promise<string | null>;

  /**
   * Create a new lesson
   */
  create(
    lessonData: Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassLessonEntity>;

  /**
   * Update an existing lesson
   */
  update(
    id: string,
    lessonData: Partial<Omit<ClassLessonEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassLessonEntity>;

  /**
   * Delete a lesson by its ID
   */
  delete(id: string): Promise<void>;

  /**
   * Reorder lessons within a class
   */
  reorder(classId: string, lessonIds: string[]): Promise<void>;
}

/**
 * Repository interface for ClassVersion entity operations
 */
export interface IClassVersionRepository {
  /**
   * Find a version by its unique ID
   */
  findById(id: string): Promise<ClassVersionEntity | null>;

  /**
   * Find all versions for a specific class
   */
  findByClassId(classId: string): Promise<ClassVersionEntity[]>;

  /**
   * Find a published version by its slug
   */
  findBySlug(slug: string): Promise<ClassVersionEntity | null>;

  /**
   * Create a new class version (snapshot)
   */
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

/**
 * Repository interface for ClassTemplate entity operations
 */
export interface IClassTemplateRepository {
  /**
   * Find a template by its unique ID
   */
  findById(id: string): Promise<ClassTemplateEntity | null>;

  /**
   * Find all templates for a specific tutor
   */
  findByTutorId(tutorId: string): Promise<ClassTemplateEntity[]>;

  /**
   * Create a new template
   */
  create(
    templateData: Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClassTemplateEntity>;

  /**
   * Update an existing template
   */
  update(
    id: string,
    templateData: Partial<Omit<ClassTemplateEntity, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ClassTemplateEntity>;

  /**
   * Delete a template by its ID
   */
  delete(id: string): Promise<void>;
}
