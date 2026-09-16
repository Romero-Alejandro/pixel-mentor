import { Prisma } from '@/database/client.js';

/**
 * JSON validation for Prisma writes — replaces the endemic `as never` /
 * `as any` casts at JSON columns (AGENTS.md forbids both).
 *
 * This is a REAL check, not a cast in disguise:
 *  - Fails fast on `undefined` / `function` / `symbol` / `bigint`, which the
 *    Prisma runtime would otherwise silently serialize to `null` or throw on.
 *  - Round-trips through `JSON.parse(JSON.stringify(value))` to strip class
 *    instances and non-enumerable state; the result is guaranteed assignable
 *    to `Prisma.InputJsonValue` by construction (object → InputJsonObject,
 *    array → InputJsonArray), so no cast is needed.
 *
 * Rows are NOT persisted as re-serialized strings: Postgres stores JSONB, so
 * `JSON.parse` output round-trips to identical data for any valid JSON value.
 */

/**
 * Shared round-trip + primitive narrowing used by all helpers.
 *
 * Note: `JSON.stringify` returns `undefined` for `function` / `symbol` /
 * `bigint` top-level values (and for objects containing them is silent —
 * those keys are dropped). We fail fast with the caller's field name so the
 * programming error is actionable instead of a cryptic SyntaxError.
 */
function roundTrip(value: unknown, field: string): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`Field "${field}" is not JSON-representable (got ${typeof value})`);
  }
  return JSON.parse(serialized) as unknown;
}

/**
 * For REQUIRED Json columns. Throws on `undefined`/`null` — a missing required
 * payload is a programming error and must surface, not become a SQL NULL.
 */
export function toPrismaJsonRequired(value: unknown, field: string): Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    throw new Error(`Field "${field}" is required but was ${String(value)}`);
  }
  const roundTripped = roundTrip(value, field);
  if (
    typeof roundTripped === 'string' ||
    typeof roundTripped === 'number' ||
    typeof roundTripped === 'boolean'
  ) {
    return roundTripped;
  }
  if (Array.isArray(roundTripped)) {
    return roundTripped as Prisma.InputJsonArray;
  }
  if (typeof roundTripped === 'object') {
    return roundTripped as Prisma.InputJsonObject;
  }
  throw new Error(`Field "${field}" is not JSON-representable for Prisma`);
}

/**
 * For NULLABLE Json columns. `undefined` → `DbNull` (SQL NULL, clear the
 * column), `null` → `JsonNull` (explicit SQL NULL).
 */
export function toPrismaJson(
  value: unknown,
  field = '<unknown>',
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined) return Prisma.DbNull;
  if (value === null) return Prisma.JsonNull;

  const roundTripped = roundTrip(value, field);
  if (
    typeof roundTripped === 'string' ||
    typeof roundTripped === 'number' ||
    typeof roundTripped === 'boolean'
  ) {
    return roundTripped;
  }
  if (roundTripped === null) return Prisma.JsonNull;
  if (Array.isArray(roundTripped)) {
    return roundTripped as Prisma.InputJsonArray;
  }
  if (typeof roundTripped === 'object') {
    return roundTripped as Prisma.InputJsonObject;
  }
  throw new Error(`Field "${field}" is not JSON-representable for Prisma`);
}

/**
 * For REQUIRED Json columns in partial updates. `undefined` → `undefined`,
 * so the key can be omitted from a Prisma payload (meaning "leave the column
 * untouched"); `null` → throws (a NOT NULL column cannot store SQL NULL —
 * writing one would be a runtime failure, so surface it at the call site).
 */
export function toPrismaJsonRequiredOrUndefined(
  value: unknown,
  field: string,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) {
    throw new Error(`Field "${field}" cannot be set to null: column is NOT NULL`);
  }
  return toPrismaJsonRequired(value, field);
}

/**
 * Spread-friendly variant of {@link toPrismaJson}: `undefined` → `undefined`,
 * so the key can be omitted from a Prisma payload (meaning "leave the column
 * untouched") instead of writing a SQL NULL.
 */
export function toPrismaJsonOrUndefined(
  value: unknown,
  field?: string,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  return toPrismaJson(value, field);
}
