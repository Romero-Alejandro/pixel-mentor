/**
 * Outbound port: group/class access lookups needed by the class application layer.
 *
 * Replaces the deprecated ClassService.isUserEnrolledInClass's direct prisma
 * access with the same semantics as ContentAccessService.canAccessClass:
 * a user has access when they are an ACTIVE member of a group that has the
 * class assigned.
 */
export interface IGroupClassAccessPort {
  /** True when an ACTIVE group membership grants the user access to the class. */
  userHasAccess(userId: string, classId: string): Promise<boolean>;
  /** True when the class exists (any status). */
  classExists(classId: string): Promise<boolean>;
}
