export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly age?: number; // Only for students
  readonly quota: number;
  readonly cohort: string; // Cohort identifier for feature flag routing (default: 'default')
  readonly passwordHash?: string; // Only for authentication, not exposed in domain logic
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Default cohort for students without explicit cohort assignment
 */
export const DEFAULT_COHORT = 'default';

export function isAdmin(user: User): boolean {
  return user.role === 'ADMIN';
}

export function isTeacher(user: User): boolean {
  return user.role === 'TEACHER' || user.role === 'ADMIN';
}

export function isStudent(user: User): boolean {
  return user.role === 'STUDENT';
}

export function canCreateLessons(user: User): boolean {
  return isTeacher(user);
}

export function canViewStatistics(user: User): boolean {
  return isTeacher(user);
}

export function canDeleteLessons(user: User): boolean {
  return isAdmin(user);
}
