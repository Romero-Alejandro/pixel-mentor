import type { AppRequest } from '@/shared/types/express.d';
import type {
  ClassService,
  ClassEnrollmentError,
  ClassOwnershipError,
} from '@/features/class/application/services/class.service';

/**
 * Middleware to check if a user is enrolled in a class.
 * @throws {ClassEnrollmentError} If the user is not enrolled and is not an ADMIN.
 */
export const checkEnrollment = async (
  req: AppRequest,
  classService: ClassService,
  classId: string,
): Promise<boolean> => {
  const userId = req.user!.id;
  const isEnrolled = await classService.isUserEnrolledInClass(userId, classId);
  if (!isEnrolled && req.user?.role !== 'ADMIN') {
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
