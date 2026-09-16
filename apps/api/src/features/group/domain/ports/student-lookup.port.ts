/**
 * Outbound ports: minimal cross-feature lookups needed by the group
 * application layer, kept narrow so GroupService never needs prisma.
 */

/** Verify students exist (by id) with the STUDENT role. */
export interface IStudentLookupPort {
  /** Returns the ids of the given ids that exist as STUDENT-role users. */
  findExistingStudentIds(ids: string[]): Promise<string[]>;
}

/** Verify class existence and ownership without importing class persistence. */
export interface IClassReferencePort {
  /** Returns the class's owner (tutor) id, or null when it does not exist. */
  findOwnerById(classId: string): Promise<{ tutorId: string } | null>;
}
