/**
 * Class Application Service
 *
 * Coordinates all class operations including CRUD, publishing, and lesson management.
 */

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

  async updateClass(id: string, tutorId: string, data: UpdateClassInput): Promise<Class> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        id,
        `Cannot update class in status ${classEntity.status}. Only DRAFT classes can be edited.`,
      );
    }

    return this.classRepo.update(id, {
      title: data.title,
      description: data.description,
    });
  }

  async deleteClass(id: string, tutorId: string): Promise<void> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    if (classEntity.status !== 'DRAFT') {
      throw new ClassStateError(
        id,
        `Cannot delete class in status ${classEntity.status}. Only DRAFT classes can be deleted.`,
      );
    }

    await this.classRepo.delete(id);
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

  async publishClass(id: string, tutorId: string): Promise<Class> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    if (classEntity.status === 'PUBLISHED') {
      throw new ClassStateError(id, 'Class is already published');
    }

    const lessons = await this.lessonRepo.findByClassId(id);
    if (lessons.length < 1) {
      throw new ClassValidationError('Class must have at least 1 lesson before publishing');
    }

    const newVersion = classEntity.version + 1;
    const versionString = `${newVersion}.0.0`;
    const slug = this.generateSlug(classEntity.title);

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
        classVersionId: '',
        recipeId: lesson.recipeId,
        order: lesson.order ?? index,
        title: classEntity.title,
        createdAt: new Date(),
      })),
    });

    await this.classRepo.update(id, {
      status: 'PUBLISHED',
      version: newVersion,
    });

    const updated = await this.classRepo.findById(id);
    if (!updated) {
      throw new ClassNotFoundError(id);
    }
    return updated;
  }

  async unpublishClass(id: string, tutorId: string): Promise<Class> {
    const classEntity = await this.classRepo.findById(id);
    if (!classEntity) {
      throw new ClassNotFoundError(id);
    }

    if (classEntity.tutorId !== tutorId) {
      throw new ClassOwnershipError(id, tutorId);
    }

    if (classEntity.status === 'DRAFT') {
      throw new ClassStateError(id, 'Class is already in DRAFT status');
    }

    await this.classRepo.update(id, { status: 'DRAFT' });

    const updated = await this.classRepo.findById(id);
    if (!updated) {
      throw new ClassNotFoundError(id);
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

    const updateData: { recipeId?: string; order?: number } = {};
    if (data.recipeId !== undefined) updateData.recipeId = data.recipeId;
    if (data.order !== undefined) updateData.order = data.order;

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
