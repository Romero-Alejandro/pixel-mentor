import type { AppRequest } from '@/shared/types/express.d';
import { ClassOwnershipError } from '@/features/class/application/services/class.service';
import type { ClassService } from '@/features/class/application/services/class.service';

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
  if (classEntity.tutorId !== userId && req.user?.role !== 'ADMIN') {
    throw new ClassOwnershipError(classId, userId);
  }
  return true;
};
