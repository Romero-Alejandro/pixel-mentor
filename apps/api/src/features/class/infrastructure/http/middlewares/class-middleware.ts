import type { AppRequest } from '@/shared/types/express.d';
import {
  ClassEnrollmentError,
  ClassOwnershipError,
} from '@/features/class/application/services/class.service';
import type { ClassService } from '@/features/class/application/services/class.service';
import { ContentAccessService } from '@/features/group/application/services/content-access.service.js';

/**
 * Middleware to check if a user is enrolled in a class.
 * @throws {ClassEnrollmentError} If the user is not enrolled and is not an ADMIN.
 * @deprecated Use ContentAccessService.canAccessClass instead.
 */
export const checkEnrollment = async (
  req: AppRequest,
  _classService: ClassService,
  classId: string,
): Promise<boolean> => {
  const userId = req.user!.id;
  const userRole = req.user?.role ?? 'STUDENT';

  console.warn(
    `[DEPRECATION] checkEnrollment in class-middleware.ts is deprecated. Use ContentAccessService.canAccessClass instead.`,
  );

  const contentAccessService = new ContentAccessService();
  const canAccess = await contentAccessService.canAccessClass(userId, userRole, classId);
  if (!canAccess) {
    throw new ClassEnrollmentError(classId, userId);
  }
  return true;
};

/**
 * Middleware to check if a user owns a class.
 * @throws {ClassOwnershipError} If the user does not own the class.
 */
export const checkOwnership = async (
  req: AppRequest,
  classService: ClassService,
  classId: string,
): Promise<boolean> => {
  const userId = req.user!.id;
  const classEntity = await classService.getClass(classId);
  if (
    classEntity.tutorId !== userId &&
    req.user?.role !== 'ADMIN' &&
    req.user?.role !== 'TEACHER'
  ) {
    throw new ClassOwnershipError(classId, userId);
  }
  return true;
};
