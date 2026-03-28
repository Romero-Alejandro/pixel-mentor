/**
 * Class Application Service
 *
 * Coordinates all class operations including CRUD, publishing, and lesson management.
 * Enforces business rules and state machine transitions.
 */

import type {
  IClassRepository,
  IClassLessonRepository,
  IClassVersionRepository,
} from '@/domain/repositories/class.repository.js';
import type {
  ClassEntity as Class,
  ClassStatus,
  ClassLessonEntity,
} from '@/domain/entities/class.entity.js';

// ==================== Error Classes ====================

export class ClassNotFoundError extends Error {
  constructor(classId: string) {
    super(`Class not found: ${classId}`);
    this.name = 'ClassNotFoundError';
  }
}

export class ClassOwnershipError extends Error {
  constructor(classId: string, tutorId: string) {
    super(`User ${tutorId} does not have permission to modify class ${classId}`);
    this.name = 'ClassOwnershipError';
  }
}

export class ClassStateError extends Error {
  constructor(classId: string, message: string) {
    super(`Class ${classId} state error: ${message}`);
    this.name = 'ClassStateError';
  }
}

export class ClassValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassValidationError';
  }
}

export class LessonNotFoundError extends Error {
  constructor(lessonId: string) {
    super(`Lesson not found: ${lessonId}`);
    this.name = 'LessonNotFoundError';
  }
}

// ==================== DTOs ====================

export interface CreateClassInput {
  title: string;
  description?: string;
  lessons?: CreateLessonInput[];
}

export interface CreateLessonInput {
  recipeId: string;
  order?: number;
}

export interface UpdateClassInput {
  title?: string;
  description?: string;
}

export interface AddLessonInput {
  recipeId: string;
  order?: number;
}

export interface UpdateLessonInput {
  recipeId?: string;
  order?: number;
}

export interface ListClassesOptions {
  status?: ClassStatus;
  page?: number;
  limit?: number;
}

export interface ClassWithLessons extends Class {
  lessons: ClassLessonEntity[];
}

// ==================== Class Service ====================

export class ClassService {
  constructor(
    private classRepo: IClassRepository,
    private lessonRepo: IClassLessonRepository,
    private versionRepo: IClassVersionRepository,
  ) {}

  /**
   * Create a new class with optional lessons
   */
  async createClass(tutorId: string, data: CreateClassInput): Promise<Class> {
    // Create class without lessons first
    const classEntity = await this.classRepo.create({
      title: data.title,
      description: data.description,
      tutorId,
      status: 'DRAFT',
      version: 0,
    });

    // Add lessons if provided
    if (data.lessons && data.lessons.length > 0) {
      for (let i = 0; i < data.lessons.length; i++) {
        const lesson = data.lessons[i];
        await this.lessonRepo.create({
          classId: classEntity.id,
          recipeId: lesson.recipeId,
          order: lesson.order ?? i,
        });
      }
    }

    // Return class with lessons
    return this.getClass(classEntity.id) as Promise<Class>;
  }

  /**
   * Get a class by ID with its lessons
   */
  async getClass(id: string): Promise<ClassWithLessons> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    const lessons = await this.lessonRepo.findByClassId(id);

    return {
      ...classEntity,
      lessons,
    } as ClassWithLessons;
  }

  /**
   * Update a class (only DRAFT status allowed)
   */
  async updateClass(id: string, tutorId: string, data: UpdateClassInput): Promise<Class> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    // Only DRAFT classes can be edited
    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        id,
        `Cannot update class in status ${classEntity.status}. Only DRAFT classes can be edited.`,
      );
    }

    // Update class
    const updated = await this.classRepo.update(id, {
      title: data.title,
      description: data.description,
    });

    return updated;
  }

  /**
   * Delete a class (only DRAFT status allowed)
   */
  async deleteClass(id: string, tutorId: string): Promise<void> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    // Only DRAFT classes can be deleted
    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        id,
        `Cannot delete class in status ${classEntity.status}. Only DRAFT classes can be deleted.`,
      );
    }

    await this.classRepo.delete(id);
  }

  /**
   * List classes for a tutor with pagination
   */
  async listClasses(
    tutorId: string,
    options?: ListClassesOptions,
  ): Promise<{
    classes: Class[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;

    const result = await this.classRepo.findByTutorId(tutorId, {
      status: options?.status,
      page,
      limit,
    });

    return {
      ...result,
      page,
      limit,
    };
  }

  /**
   * Publish a class: DRAFT -> UNDER_REVIEW -> PUBLISHED
   * Creates a ClassVersion snapshot on publish
   */
  async publishClass(id: string, tutorId: string): Promise<Class> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    // Can only publish from DRAFT or UNDER_REVIEW
    if (classEntity.status === 'PUBLISHED') {
      throw new ClassStateError(id, 'Class is already published');
    }

    // Quality rule: Must have at least 1 lesson before publishing
    const lessons = await this.lessonRepo.findByClassId(id);
    if (lessons.length < 1) {
      throw new ClassValidationError('Class must have at least 1 lesson before publishing');
    }

    // Bump version
    const newVersion = classEntity.version + 1;
    const versionString = `${newVersion}.0.0`;

    // Create slug from title
    const slug = this.generateSlug(classEntity.title);

    // Create version snapshot
    await this.versionRepo.create({
      classId: id,
      version: versionString,
      publishedAt: new Date(),
      isPublished: true,
      title: classEntity.title,
      description: classEntity.description,
      slug,
      status: 'PUBLISHED',
      lessons: lessons.map((lesson, index) => ({
        id: crypto.randomUUID(),
        classVersionId: '', // Will be set by repository
        recipeId: lesson.recipeId,
        order: lesson.order ?? index,
        title: classEntity.title,
        createdAt: new Date(),
      })),
    });

    // Update class status to PUBLISHED
    await this.classRepo.update(id, {
      status: 'PUBLISHED',
      version: newVersion,
    });

    // Return updated class
    const updated = await this.classRepo.findById(id);
    if (!updated) {
      throw new ClassNotFoundError(id);
    }
    return updated;
  }

  /**
   * Unpublish a class (PUBLISHED/UNDER_REVIEW -> DRAFT)
   */
  async unpublishClass(id: string, tutorId: string): Promise<Class> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    // Can only unpublish from PUBLISHED or UNDER_REVIEW
    if (classEntity.status === 'DRAFT') {
      throw new ClassStateError(id, 'Class is already in DRAFT status');
    }

    // Transition to DRAFT
    await this.classRepo.update(id, { status: 'DRAFT' });

    // Return updated class
    const updated = await this.classRepo.findById(id);
    if (!updated) {
      throw new ClassNotFoundError(id);
    }
    return updated;
  }

  /**
   * Add a lesson to a class (only DRAFT status allowed)
   */
  async addLesson(
    classId: string,
    tutorId: string,
    data: AddLessonInput,
  ): Promise<ClassLessonEntity> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    // Only DRAFT classes can have lessons added
    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot add lesson to class in status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    // Get current max order
    const existingLessons = await this.lessonRepo.findByClassId(classId);
    const maxOrder =
      existingLessons.length > 0 ? Math.max(...existingLessons.map((l) => l.order ?? 0)) : -1;

    // Create lesson
    const lesson = await this.lessonRepo.create({
      classId,
      recipeId: data.recipeId,
      order: maxOrder + 1,
    });

    return lesson;
  }

  /**
   * Update a lesson in a class (only DRAFT status allowed)
   */
  async updateLesson(
    classId: string,
    lessonId: string,
    tutorId: string,
    data: UpdateLessonInput,
  ): Promise<ClassLessonEntity> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    // Only DRAFT classes can have lessons updated
    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot update lesson in class with status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    // Verify lesson exists and belongs to this class
    const lessons = await this.lessonRepo.findByClassId(classId);
    const lesson = lessons.find((l) => l.id === lessonId);

    if (!lesson) {
      throw new LessonNotFoundError(lessonId);
    }

    // Build update data with only defined fields
    const updateData: Record<string, any> = {};
    if (data.recipeId !== undefined) updateData.recipeId = data.recipeId;
    if (data.order !== undefined) updateData.order = data.order;

    // Update lesson
    const updated = await this.lessonRepo.update(lessonId, updateData);

    if (!updated) {
      throw new LessonNotFoundError(lessonId);
    }

    return updated;
  }

  /**
   * Remove a lesson from a class (only DRAFT status allowed)
   */
  async removeLesson(classId: string, lessonId: string, tutorId: string): Promise<void> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    // Only DRAFT classes can have lessons removed
    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot remove lesson from class in status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    // Verify lesson exists and belongs to class
    const lessons = await this.lessonRepo.findByClassId(classId);
    const lesson = lessons.find((l) => l.id === lessonId);

    if (!lesson) {
      throw new LessonNotFoundError(lessonId);
    }

    // Delete lesson
    await this.lessonRepo.delete(lessonId);

    // Reorder remaining lessons
    const remainingLessons = lessons.filter((l) => l.id !== lessonId);
    const lessonIds = remainingLessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      await this.lessonRepo.reorder(classId, lessonIds);
    }
  }

  /**
   * Reorder lessons within a class (only DRAFT status allowed)
   */
  async reorderLessons(classId: string, tutorId: string, lessonIds: string[]): Promise<void> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    // Check ownership
    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    // Only DRAFT classes can have lessons reordered
    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot reorder lessons in class in status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    // Verify all lessons belong to this class
    const lessons = await this.lessonRepo.findByClassId(classId);
    const lessonIdSet = new Set(lessons.map((l) => l.id));

    for (const id of lessonIds) {
      if (!lessonIdSet.has(id)) {
        throw new LessonNotFoundError(id);
      }
    }

    // Reorder lessons
    await this.lessonRepo.reorder(classId, lessonIds);
  }

  /**
   * Generate a URL-safe slug from a title
   */
  private generateSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, '') + // Remove leading/trailing hyphens
      '-' +
      crypto.randomUUID().slice(0, 8)
    ); // Add unique suffix
  }
}
