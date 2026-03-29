// Domain entity for Class with state machine

import { validateClassTransition, type ValidatedClassStatus } from '@/domain/validators/index.js';

export type ClassStatus = 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

// ==================== Lesson Entities ====================

export interface ClassLessonEntity {
  readonly id: string;
  readonly classId: string;
  readonly recipeId: string;
  readonly order: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly recipe?: {
    readonly id: string;
    readonly title: string;
    readonly expectedDurationMinutes: number | null;
  };
}

export interface ClassVersionLessonEntity {
  readonly id: string;
  readonly classVersionId: string;
  readonly recipeId: string;
  readonly order: number;
  readonly title?: string;
  readonly duration?: number;
  readonly recipeSnapshot?: Record<string, unknown>;
  readonly createdAt: Date;
}

// ==================== Class Entities ====================

export interface ClassTemplateEntity {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly tutorId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ClassEntity {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tutorId: string;
  readonly classTemplateId?: string;
  readonly currentVersionId?: string;
  readonly status: ClassStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lessons?: readonly ClassLessonEntity[];
  readonly versions?: readonly ClassVersionEntity[];
  readonly classTemplate?: ClassTemplateEntity;
}

export interface ClassVersionEntity {
  readonly id: string;
  readonly classId: string;
  readonly version: string;
  readonly publishedAt?: Date;
  readonly isPublished: boolean;
  readonly title: string;
  readonly description?: string;
  readonly slug: string;
  readonly status: ClassStatus;
  readonly lessons?: readonly ClassVersionLessonEntity[];
  readonly createdAt: Date;
}

// ==================== Factory Functions ====================

export function createClassEntity(parameters: {
  id: string;
  title: string;
  description?: string;
  tutorId: string;
  classTemplateId?: string;
  status?: ClassStatus;
  version?: number;
  lessons?: readonly ClassLessonEntity[];
}): ClassEntity {
  return Object.freeze({
    id: parameters.id,
    title: parameters.title,
    description: parameters.description,
    tutorId: parameters.tutorId,
    classTemplateId: parameters.classTemplateId,
    status: parameters.status ?? 'DRAFT',
    version: parameters.version ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lessons: parameters.lessons ?? [],
  });
}

export function createClassLessonEntity(parameters: {
  id: string;
  classId: string;
  recipeId: string;
  order: number;
}): ClassLessonEntity {
  return Object.freeze({
    id: parameters.id,
    classId: parameters.classId,
    recipeId: parameters.recipeId,
    order: parameters.order,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export function createClassVersionEntity(parameters: {
  id: string;
  classId: string;
  version: string;
  title: string;
  description?: string;
  slug: string;
  status?: ClassStatus;
  isPublished?: boolean;
  lessons?: readonly ClassVersionLessonEntity[];
}): ClassVersionEntity {
  return Object.freeze({
    id: parameters.id,
    classId: parameters.classId,
    version: parameters.version,
    title: parameters.title,
    description: parameters.description,
    slug: parameters.slug,
    status: parameters.status ?? 'PUBLISHED',
    isPublished: parameters.isPublished ?? false,
    publishedAt: parameters.isPublished ? new Date() : undefined,
    lessons: parameters.lessons ?? [],
    createdAt: new Date(),
  });
}

export function createClassTemplateEntity(parameters: {
  id: string;
  name: string;
  description?: string;
  tutorId: string;
}): ClassTemplateEntity {
  return Object.freeze({
    id: parameters.id,
    name: parameters.name,
    description: parameters.description,
    tutorId: parameters.tutorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

// ==================== Authorization Functions ====================

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export function canEditClass(userRole: UserRole, classStatus: ClassStatus): boolean {
  if (userRole === 'ADMIN') return true;
  if (userRole === 'TEACHER') {
    // Teachers can edit draft and under_review classes
    return classStatus === 'DRAFT' || classStatus === 'UNDER_REVIEW';
  }
  return false;
}

export function canPublishClass(userRole: UserRole, classStatus: ClassStatus): boolean {
  if (userRole === 'ADMIN') return true;
  if (userRole === 'TEACHER') {
    // Teachers can only publish under_review classes
    return classStatus === 'UNDER_REVIEW';
  }
  return false;
}

export function canDeleteClass(userRole: UserRole, classStatus: ClassStatus): boolean {
  if (userRole === 'ADMIN') return true;
  // Teachers can only delete draft classes
  return userRole === 'TEACHER' && classStatus === 'DRAFT';
}

// ==================== State Machine ====================

export type ClassStatusTransition =
  | { from: 'DRAFT'; to: 'UNDER_REVIEW' }
  | { from: 'UNDER_REVIEW'; to: 'DRAFT' | 'PUBLISHED' }
  | { from: 'PUBLISHED'; to: 'ARCHIVED' }
  | { from: 'ARCHIVED'; to: 'PUBLISHED' };

/**
 * Validates if a status transition is allowed
 * State machine: DRAFT → UNDER_REVIEW → PUBLISHED → ARCHIVED
 *                          ↑______________↓ (can go back to DRAFT from UNDER_REVIEW)
 *                                   ↑______↓ (can restore from ARCHIVED)
 */
export function isValidStatusTransition(current: ClassStatus, next: ClassStatus): boolean {
  const transitions: Record<ClassStatus, readonly ClassStatus[]> = {
    DRAFT: ['UNDER_REVIEW', 'PUBLISHED'],
    UNDER_REVIEW: ['DRAFT', 'PUBLISHED'],
    PUBLISHED: ['DRAFT', 'ARCHIVED'],
    ARCHIVED: ['PUBLISHED'],
  };
  return transitions[current]?.includes(next) ?? false;
}

/**
 * Gets the next valid status for a given current status
 */
export function getValidTransitions(current: ClassStatus): readonly ClassStatus[] {
  const transitions: Record<ClassStatus, readonly ClassStatus[]> = {
    DRAFT: ['UNDER_REVIEW', 'PUBLISHED'],
    UNDER_REVIEW: ['DRAFT', 'PUBLISHED'],
    PUBLISHED: ['DRAFT', 'ARCHIVED'],
    ARCHIVED: ['PUBLISHED'],
  };
  return transitions[current] ?? [];
}

/**
 * Applies a status transition if valid
 * @returns The new status if transition is valid, throws AppError otherwise
 */
export function transitionStatus(current: ClassStatus, next: ClassStatus): ClassStatus {
  validateClassTransition(current as ValidatedClassStatus, next as ValidatedClassStatus);
  return next;
}
