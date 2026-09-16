import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';
import type {
  IGroupAccessPort,
  GroupContentView,
} from '@/features/group/domain/ports/group-access.port.js';

export interface ContentAccessResult {
  classId: string;
  classTitle: string;
  groupId: string;
  groupName: string;
  order: number;
  status: string;
}

export class ContentAccessError extends Error {
  readonly code = 'CONTENT_ACCESS_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ContentAccessError';
  }
}

/**
 * Application service for group-content access decisions.
 *
 * All persistence goes through the IGroupAccessPort — this class contains
 * only the role-based routing logic.
 */
export class ContentAccessService {
  constructor(private readonly groupAccess: IGroupAccessPort) {}

  async getAccessibleContentForUser(
    userId: string,
    userRole: UserRole,
  ): Promise<ContentAccessResult[]> {
    if (userRole === 'ADMIN') {
      return this.groupAccess.findAllPublished();
    }

    if (userRole === 'TEACHER') {
      return this.groupAccess.findByTeacher(userId);
    }

    return this.groupAccess.findByStudent(userId);
  }

  async canAccessClass(userId: string, userRole: UserRole, classId: string): Promise<boolean> {
    return this.groupAccess.canAccess(userId, userRole, classId);
  }
}

export type { GroupContentView };
