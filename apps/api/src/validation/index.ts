/**
 * Validation Module
 *
 * Exports all validation utilities for type-safe schema validation.
 */

export {
  SchemaValidationError,
  SchemaValidator,
  createSchemaValidator,
  type ISchemaValidator,
  type SchemaValidationSuccess,
  type SchemaValidationFailure,
  type SafeSchemaValidationResult,
} from './schema.validator.js';
