/**
 * Class Application Service
 *
 * Coordinates all class operations including CRUD, publishing, and lesson management.
 */

import { prisma } from '@/database/client.js';
import { assertValidUUID } from '@/shared/validators/entity-validators';

import type {
  IClassRepository,
  IClassLessonRepository,
  IClassVersionRepository,
} from '@/features/class/domain/ports/class.repository.port';
import type {
  ClassEntity as Class,
  ClassStatus,
  ClassLessonEntity,
} from '@/features/class/domain/entities/class.entity';

// DTOs
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
  title?: string;
}

export interface ListClassesOptions {
  status?: ClassStatus;
  page?: number;
  limit?: number;
}

export interface ClassWithLessons extends Class {
  lessons: ClassLessonEntity[];
}

// Custom Errors
export class ClassNotFoundError extends Error {
  readonly code = 'CLASS_NOT_FOUND' as const;
  readonly classId: string;

  constructor(classId: string) {
    super(`Class with ID ${classId} not found`);
    this.name = 'ClassNotFoundError';
    this.classId = classId;
  }
}

export class ClassOwnershipError extends Error {
  readonly code = 'CLASS_OWNERSHIP_ERROR' as const;
  readonly classId: string;
  readonly userId: string;

  constructor(classId: string, userId: string) {
    super(`Class ${classId} does not belong to user ${userId}`);
    this.name = 'ClassOwnershipError';
    this.classId = classId;
    this.userId = userId;
  }
}

export class ClassStateError extends Error {
  readonly code = 'CLASS_STATE_ERROR' as const;
  readonly classId: string;

  constructor(classId: string, message: string) {
    super(message);
    this.name = 'ClassStateError';
    this.classId = classId;
  }
}

export class ClassValidationError extends Error {
  readonly code = 'CLASS_VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ClassValidationError';
  }
}

export class LessonNotFoundError extends Error {
  readonly code = 'LESSON_NOT_FOUND' as const;
  readonly lessonId: string;

  constructor(lessonId: string) {
    super(`Lesson with ID ${lessonId} not found`);
    this.name = 'LessonNotFoundError';
    this.lessonId = lessonId;
  }
}

export class ClassEnrollmentError extends Error {
  readonly code = 'CLASS_ENROLLMENT_ERROR' as const;
  readonly classId: string;
  readonly userId: string;

  constructor(classId: string, userId: string) {
    super(`User ${userId} is not enrolled in class ${classId}`);
    this.name = 'ClassEnrollmentError';
    this.classId = classId;
    this.userId = userId;
  }
}

// Class Service
export class ClassService {
  constructor(
    private classRepo: IClassRepository,
    private lessonRepo: IClassLessonRepository,
    private versionRepo: IClassVersionRepository,
  ) {}

  async createClass(tutorId: string, data: CreateClassInput): Promise<Class> {
    const classEntity = await this.classRepo.create({
      title: data.title,
      description: data.description,
      tutorId,
      status: 'DRAFT',
      version: 0,
    });

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

    return this.getClass(classEntity.id);
  }

  async getClass(idOrSlug: string): Promise<ClassWithLessons> {
    const classId = await this._resolveClassIdOrSlug(idOrSlug);
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      // This should ideally not happen if _resolveClassIdOrSlug already threw
      // but keeping for type safety and defensive programming.
      throw new ClassNotFoundError(classId);
    }

    const lessons = await this.lessonRepo.findByClassId(classId);

    return {
      ...classEntity,
      lessons,
    } as ClassWithLessons;
  }

  async updateClass(idOrSlug: string, tutorId: string, data: UpdateClassInput): Promise<Class> {
    const classId = await this._resolveClassIdOrSlug(idOrSlug);
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot update class in status ${classEntity.status}. Only DRAFT classes can be edited.`,
      );
    }

    return this.classRepo.update(classId, {
      title: data.title,
      description: data.description,
    });
  }

  async deleteClass(idOrSlug: string, tutorId: string): Promise<void> {
    const classId = await this._resolveClassIdOrSlug(idOrSlug);
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot delete class in status ${classEntity.status}. Only DRAFT classes can be deleted.`,
      );
    }

    await this.classRepo.delete(classId);
  }

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

  async publishClass(idOrSlug: string, tutorId: string): Promise<Class> {
    const classId = await this._resolveClassIdOrSlug(idOrSlug);
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status === 'PUBLISHED') {
      throw new ClassStateError(classId, 'Class is already published');
    }

    const lessons = await this.lessonRepo.findByClassId(classId);
    if (lessons.length < 1) {
      throw new ClassValidationError('Class must have at least 1 lesson before publishing');
    }

    const newVersion = classEntity.version + 1;
    const versionString = `${newVersion}.0.0`;
    const slug = this.generateSlug(classEntity.title); // This slug will be for the ClassVersion, not the Class itself

    // Update the Class entity with the generated slug
    await this.classRepo.update(classId, { slug: slug });

    // Create version first to get its ID
    await this.versionRepo.create({
      classId: classId,
      version: versionString,
      publishedAt: new Date(),
      isPublished: true,
      title: classEntity.title,
      description: classEntity.description,
      slug,
      status: 'PUBLISHED',
      lessons: lessons.map((lesson, index) => ({
        id: crypto.randomUUID(),
        classVersionId: '', // Set after version creation
        recipeId: lesson.recipeId,
        order: lesson.order ?? index,
        title: lesson.title ?? lesson.recipe?.title ?? 'Untitled Lesson',
        createdAt: new Date(),
      })),
    });

    await this.classRepo.update(classId, {
      status: 'PUBLISHED',
      version: newVersion,
    });

    const updated = await this.classRepo.findById(classId);
    if (!updated) {
      throw new ClassNotFoundError(classId);
    }
    return updated;
  }

  async unpublishClass(idOrSlug: string, tutorId: string): Promise<Class> {
    const classId = await this._resolveClassIdOrSlug(idOrSlug);
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status === 'DRAFT') {
      throw new ClassStateError(classId, 'Class is already in DRAFT status');
    }

    await this.classRepo.update(classId, { status: 'DRAFT' });

    const updated = await this.classRepo.findById(classId);
    if (!updated) {
      throw new ClassNotFoundError(classId);
    }
    return updated;
  }

  async addLesson(
    classId: string,
    tutorId: string,
    data: AddLessonInput,
  ): Promise<ClassLessonEntity> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot add lesson to class in status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    const existingLessons = await this.lessonRepo.findByClassId(classId);
    const maxOrder =
      existingLessons.length > 0 ? Math.max(...existingLessons.map((l) => l.order ?? 0)) : -1;

    return this.lessonRepo.create({
      classId,
      recipeId: data.recipeId,
      order: maxOrder + 1,
    });
  }

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

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot update lesson in class with status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    const lessons = await this.lessonRepo.findByClassId(classId);
    const lesson = lessons.find((l) => l.id === lessonId);

    if (!lesson) {
      throw new LessonNotFoundError(lessonId);
    }

    // Validate recipeId exists if being updated
    if (data.recipeId !== undefined) {
      const recipe = await prisma.recipe.findUnique({ where: { id: data.recipeId } });
      if (!recipe) {
        throw new ClassValidationError(`Recipe with ID ${data.recipeId} not found`);
      }
    }

    const updateData: { recipeId?: string; order?: number; title?: string } = {};
    if (data.recipeId !== undefined) updateData.recipeId = data.recipeId;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.title !== undefined) updateData.title = data.title;

    const updated = await this.lessonRepo.update(lessonId, updateData);
    if (!updated) {
      throw new LessonNotFoundError(lessonId);
    }

    return updated;
  }

  async removeLesson(classId: string, lessonId: string, tutorId: string): Promise<void> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot remove lesson from class in status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    const lessons = await this.lessonRepo.findByClassId(classId);
    const lesson = lessons.find((l) => l.id === lessonId);

    if (!lesson) {
      throw new LessonNotFoundError(lessonId);
    }

    await this.lessonRepo.delete(lessonId);

    const remainingLessons = lessons.filter((l) => l.id !== lessonId);
    const lessonIds = remainingLessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      await this.lessonRepo.reorder(classId, lessonIds);
    }
  }

  async reorderLessons(classId: string, tutorId: string, lessonIds: string[]): Promise<void> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(classId, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        classId,
        `Cannot reorder lessons in class in status ${classEntity.status}. Only DRAFT classes can be modified.`,
      );
    }

    const lessons = await this.lessonRepo.findByClassId(classId);
    const lessonIdSet = new Set(lessons.map((l) => l.id));

    for (const id of lessonIds) {
      if (!lessonIdSet.has(id)) {
        throw new LessonNotFoundError(id);
      }
    }

    await this.lessonRepo.reorder(classId, lessonIds);
  }

  /**
   * Checks if a user is enrolled in a class.
   * @deprecated Use ContentAccessService.canAccessClass instead.
   * @param userId The user ID
   * @param classId The class ID
   * @returns True if enrolled, false otherwise
   */
  async isUserEnrolledInClass(userId: string, classId: string): Promise<boolean> {
    console.warn(
      `[DEPRECATION] ClassService.isUserEnrolledInClass is deprecated. Use ContentAccessService.canAccessClass instead.`,
    );
    console.log(`[DEBUG] Verificando acceso: classId=${classId}, userId=${userId}`);

    // 1. Verificar si la clase existe (sin importar el estado)
    const classEntity = await prisma.class.findUnique({
      where: { id: classId },
    });
    if (!classEntity) {
      console.log(`[DEBUG] Clase no encontrada: ${classId}`);
      return false;
    }

    console.log(`[DEBUG] Estado de la clase: ${classEntity.status}`);

    // 2. Verificar si el usuario es miembro ACTIVO de un grupo que tiene acceso a la clase
    // FIX: Must filter by status: 'ACTIVE' to match ContentAccessService behavior
    const groupClass = await prisma.groupClass.findFirst({
      where: {
        classId,
        group: {
          memberships: {
            some: { studentId: userId, status: 'ACTIVE' },
          },
        },
      },
    });

    console.log(`[DEBUG] Resultado de groupClass: ${JSON.stringify(groupClass)}`);
    return !!groupClass;
  }

  async getLesson(classId: string, lessonId: string): Promise<ClassLessonEntity> {
    const classEntity = await this.classRepo.findById(classId);
    if (!classEntity) {
      throw new ClassNotFoundError(classId);
    }

    const lessons = await this.lessonRepo.findByClassId(classId);
    const lesson = lessons.find((l) => l.id === lessonId);

    if (!lesson) {
      throw new LessonNotFoundError(lessonId);
    }

    return lesson;
  }

  private async _resolveClassIdOrSlug(idOrSlug: string): Promise<string> {
    // 1. Check if it's a valid UUID
    try {
      assertValidUUID(idOrSlug);
      return idOrSlug; // It's a UUID, return directly
    } catch (error) {
      // Not a UUID, proceed to check as ID (fallback for legacy cases)
      const classEntity = await this.classRepo.findById(idOrSlug);
      if (classEntity) {
        return classEntity.id;
      }
      // If not found as ID, throw error (slug support removed for simplicity)
      throw new ClassNotFoundError(idOrSlug);
    }
  }

  private generateSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      crypto.randomUUID().slice(0, 8)
    );
  }
}
