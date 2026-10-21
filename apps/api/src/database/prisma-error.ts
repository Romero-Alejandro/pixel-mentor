/**
 * Helpers for interpreting Prisma error codes at module boundaries.
 *
 * Prisma's `upsert` is not always pushed down as a single `INSERT ... ON
 * CONFLICT`: when it has nothing to update, the client can emulate it as a
 * find-then-create, so two concurrent callers can both attempt the INSERT and
 * one receives `P2002`. Callers that treat the row's existence as their
 * postcondition need to distinguish that from a real failure.
 */

/** Prisma unique-constraint violation (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
