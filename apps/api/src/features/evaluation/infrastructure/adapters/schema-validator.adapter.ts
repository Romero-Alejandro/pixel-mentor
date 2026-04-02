/**
 * Schema Validator Adapter
 *
 * Implementation of ISchemaValidator that wraps the existing
 * schema validator infrastructure.
 */

import type { z } from 'zod';

import type { ISchemaValidator } from '../../domain/ports/schema-validator.port';
import { SchemaValidator } from '@/features/prompt/infrastructure/persistence/schema-validator';

/**
 * Adapter that implements ISchemaValidator using the existing
 * SchemaValidator from the prompt infrastructure.
 */
export class SchemaValidatorAdapter implements ISchemaValidator<unknown> {
  /**
   * The underlying schema validator instance.
   */
  private readonly validator: SchemaValidator;

  /**
   * Creates a new SchemaValidatorAdapter instance.
   */
  constructor() {
    this.validator = new SchemaValidator();
  }

  /**
   * @inheritdoc
   */
  validate<T>(rawInput: unknown, schema: z.ZodSchema<T>): T {
    return this.validator.validate(rawInput, schema) as T;
  }
}

/**
 * Creates a new SchemaValidatorAdapter instance.
 */
export function createSchemaValidatorAdapter(): ISchemaValidator<unknown> {
  return new SchemaValidatorAdapter();
}
