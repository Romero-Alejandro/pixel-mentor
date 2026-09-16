/**
 * Outbound port: access-view queries for group content, keeping the
 * ContentAccessService application logic independent of prisma models.
 *
 * Adapters translate prisma rows into these plain projections.
 */
import type { UserRole } from '@/features/auth/domain/entities/user.entity.js';

export interface GroupContentView {
  classId: string;
  classTitle: string;
  groupId: string;
  groupName: string;
  order: number;
  status: string;
}

export interface IGroupAccessPort {
  /** All PUBLISHED/UNDER_REVIEW class assignments (admin view). */
  findAllPublished(): Promise<GroupContentView[]>;

  /** PUBLISHED/UNDER_REVIEW assignments for groups taught by the teacher. */
  findByTeacher(teacherId: string): Promise<GroupContentView[]>;

  /** PUBLISHED/UNDER_REVIEW assignments across the student's ACTIVE groups. */
  findByStudent(studentId: string): Promise<GroupContentView[]>;

  /** True when the user (any role) can access the class. */
  canAccess(userId: string, userRole: UserRole, classId: string): Promise<boolean>;
}
