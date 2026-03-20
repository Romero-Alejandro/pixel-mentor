/**
 * Schema Validation Module
 *
 * Provides type-safe validation for LLM responses using Zod schemas.
 * Handles edge cases like markdown-wrapped JSON, empty responses, and malformed data.
 */

import { z } from 'zod';

/**
 * Error thrown when schema validation fails.
 * Contains detailed Zod error information for debugging and error reporting.
 *
 * @example
 * ```typescript
 * try {
 *   validator.validate(rawResponse, MySchema);
 * } catch (error) {
 *   if (error instanceof SchemaValidationError) {
 *     console.log(error.zodError.issues);
 *   }
 * }
 * ```
 */
export class SchemaValidationError extends Error {
  /** The original Zod error containing detailed validation issues. */
  readonly zodError: z.ZodError;

  /**
   * Creates a new SchemaValidationError.
   * @param zodError - The Zod validation error
   */
  constructor(zodError: z.ZodError) {
    const message = SchemaValidationError.formatMessage(zodError);
    super(message);
    this.name = 'SchemaValidationError';
    this.zodError = zodError;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaValidationError);
    }
  }

  /**
   * Formats a human-readable error message from Zod issues.
   * @param error - The Zod error to format
   * @returns Formatted error message
   */
  private static formatMessage(error: z.ZodError): string {
    const issues = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? ` at "${issue.path.join('.')}": ` : ': ';
      return `${issue.message}${path}${SchemaValidationError.getIssueDescription(issue)}`;
    });
    return `Schema validation failed:\n${issues.join('\n')}`;
  }

  /**
   * Gets a description for a specific Zod issue code.
   * @param issue - The Zod issue
   * @returns Human-readable description
   */
  private static getIssueDescription(issue: z.ZodIssue): string {
    switch (issue.code) {
      case 'too_small':
        return `minimum length is ${(issue as { minimum: unknown }).minimum}`;
      case 'too_big':
        return `maximum length is ${(issue as { maximum: unknown }).maximum}`;
      case 'invalid_type': {
        const invalidType = issue as { expected: unknown };
        return `expected ${invalidType.expected}`;
      }
      case 'invalid_value': {
        const invalidValue = issue as { values: unknown[] };
        return `expected one of: ${invalidValue.values.join(', ')}`;
      }
      case 'unrecognized_keys': {
        const unrecognized = issue as { keys: string[] };
        return `unrecognized keys: ${unrecognized.keys.join(', ')}`;
      }
      case 'invalid_union':
        return 'did not match any schema in the union';
      default:
        return '';
    }
  }

  /**
   * Returns an array of formatted issue messages for programmatic access.
   * @returns Array of issue messages
   */
  get issues(): string[] {
    return this.zodError.issues.map((issue) => {
      const path = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
      return `${path}${issue.message}`;
    });
  }
}

/**
 * Generic interface for schema-based validation.
 *
 * @typeParam T - The type inferred from the Zod schema
 *
 * @example
 * ```typescript
 * interface UserResponse {
 *   id: string;
 *   name: string;
 *   email: string;
 * }
 *
 * const validator: ISchemaValidator<UserResponse> = new SchemaValidator();
 * const user = validator.validate(rawJsonString, UserSchema);
 * ```
 */
export interface ISchemaValidator<T> {
  /**
   * Validates and parses raw input against a Zod schema.
   *
   * @param rawInput - Raw input to validate (string or object)
   * @param schema - Zod schema to validate against
   * @returns Parsed and type-safe object matching the schema type
   * @throws {SchemaValidationError} When validation fails
   */
  validate(rawInput: unknown, schema: z.ZodSchema<T>): T;
}

/**
 * Result of a successful validation attempt.
 */
export interface SchemaValidationSuccess<T> {
  /** Whether validation succeeded. */
  readonly success: true;
  /** The validated data. */
  readonly data: T;
}

/**
 * Result of a failed validation attempt.
 */
export interface SchemaValidationFailure {
  /** Whether validation failed. */
  readonly success: false;
  /** The validation error. */
  readonly error: SchemaValidationError;
}

/**
 * Union type for validation results from safeValidate.
 */
export type SafeSchemaValidationResult<T> = SchemaValidationSuccess<T> | SchemaValidationFailure;

/**
 * Schema Validator Implementation
 *
 * Provides robust validation for LLM responses with support for:
 * - Markdown-wrapped JSON extraction
 * - Empty response handling
 * - Missing field detection
 *
 * @example
 * ```typescript
 * const validator = new SchemaValidator();
 *
 * // Validate markdown-wrapped JSON
 * const response = '```json\n{"name": "John"}\n```';
 * const data = validator.validate(response, z.object({ name: z.string() }));
 * ```
 */
export class SchemaValidator<T = unknown> implements ISchemaValidator<T> {
  /**
   * Creates a new SchemaValidator instance.
   */
  constructor() {}

  /**
   * Validates and parses raw input against a Zod schema.
   *
   * This method handles the following cases:
   * - Markdown-wrapped JSON (```json ... ```)
   * - Plain JSON strings
   * - Already-parsed objects
   * - Empty or whitespace-only responses
   *
   * @param rawInput - Raw input to validate (string, JSON, or object)
   * @param schema - Zod schema to validate against
   * @returns Parsed and type-safe object
   * @throws {SchemaValidationError} When validation fails
   */
  validate(rawInput: unknown, schema: z.ZodSchema<T>): T {
    const parsed = this.parseInput(rawInput);
    this.validateNotEmpty(parsed);

    try {
      const result = schema.safeParse(parsed);

      if (!result.success) {
        throw new SchemaValidationError(result.error);
      }

      return result.data;
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        throw error;
      }
      // Handle unexpected errors during parsing
      if (error instanceof Error && !(error instanceof z.ZodError)) {
        throw new SchemaValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: `Unexpected parsing error: ${error.message}`,
              path: [],
            },
          ]),
        );
      }
      throw error;
    }
  }

  /**
   * Safely validates input without throwing.
   * Returns a result object indicating success or failure.
   *
   * @param rawInput - Raw input to validate
   * @param schema - Zod schema to validate against
   * @returns Result object with success status and data/error
   *
   * @example
   * ```typescript
   * const result = validator.safeValidate('{"name": "John"}', UserSchema);
   * if (result.success) {
   *   console.log(result.data);
   * } else {
   *   console.log(result.error.issues);
   * }
   * ```
   */
  safeValidate(rawInput: unknown, schema: z.ZodSchema<T>): SafeSchemaValidationResult<T> {
    try {
      const data = this.validate(rawInput, schema);
      return { success: true, data };
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        return { success: false, error };
      }
      // Wrap unexpected errors
      return {
        success: false,
        error: new SchemaValidationError(
          new z.ZodError([
            {
              code: 'custom',
              message: error instanceof Error ? error.message : 'Unknown error',
              path: [],
            },
          ]),
        ),
      };
    }
  }

  /**
   * Parses raw input into a JavaScript object.
   * Handles markdown-wrapped JSON, plain JSON, and pre-parsed objects.
   *
   * @param rawInput - Raw input to parse
   * @returns Parsed JavaScript object or the input if already an object
   */
  private parseInput(rawInput: unknown): unknown {
    // Handle null/undefined
    if (rawInput === null || rawInput === undefined) {
      return null;
    }

    // If already an object (not a string), return as-is
    if (typeof rawInput === 'object') {
      return rawInput;
    }

    // Handle strings
    if (typeof rawInput === 'string') {
      return this.parseString(rawInput);
    }

    // For other primitives, attempt JSON parsing
    try {
      return JSON.parse(String(rawInput));
    } catch {
      return rawInput;
    }
  }

  /**
   * Parses a string input, handling markdown and JSON formats.
   *
   * @param input - String input to parse
   * @returns Parsed object or string
   */
  private parseString(input: string): unknown {
    const trimmed = input.trim();

    // Empty string
    if (trimmed === '') {
      return null;
    }

    // Try markdown JSON block first
    const markdownJson = this.extractMarkdownJson(trimmed);
    if (markdownJson !== null) {
      return markdownJson;
    }

    // Try plain JSON
    const plainJson = this.tryParseJson(trimmed);
    if (plainJson !== null) {
      return plainJson;
    }

    // Return trimmed string if not valid JSON
    return trimmed;
  }

  /**
   * Extracts JSON from markdown code blocks.
   *
   * Supports formats:
   * - ```json\n{...}\n```
   * - ```json{...}```
   * - ```json\n{...}```
   *
   * @param input - Input string to extract from
   * @returns Parsed JSON object or null if not found
   */
  private extractMarkdownJson(input: string): unknown {
    // Match markdown code blocks with json language identifier
    const jsonBlockRegex = /```json\s*([\s\S]*?)```/gi;
    const match = jsonBlockRegex.exec(input);

    if (match && match[1]) {
      const jsonContent = match[1].trim();
      const parsed = this.tryParseJson(jsonContent);
      if (parsed !== null) {
        return parsed;
      }
    }

    // Try matching any code block if json-specific didn't work
    const anyCodeBlockRegex = /```\s*([\s\S]*?)```/gi;
    const anyMatch = anyCodeBlockRegex.exec(input);

    if (anyMatch && anyMatch[1]) {
      const codeContent = anyMatch[1].trim();
      const parsed = this.tryParseJson(codeContent);
      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  /**
   * Attempts to parse a string as JSON.
   *
   * @param input - String to parse
   * @returns Parsed object or null if parsing fails
   */
  private tryParseJson(input: string): unknown {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }

  /**
   * Validates that parsed input is not empty/null.
   *
   * @param parsed - The parsed input
   * @throws {SchemaValidationError} When input is empty
   */
  private validateNotEmpty(parsed: unknown): void {
    if (parsed === null || parsed === undefined) {
      throw new SchemaValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'Response is empty or null',
            path: [],
          },
        ]),
      );
    }

    if (typeof parsed === 'string' && parsed.trim() === '') {
      throw new SchemaValidationError(
        new z.ZodError([
          {
            code: 'custom',
            message: 'Response is empty or whitespace only',
            path: [],
          },
        ]),
      );
    }
  }
}

/**
 * Creates a default SchemaValidator instance.
 *
 * @returns A new SchemaValidator instance
 */
export function createSchemaValidator<T = unknown>(): ISchemaValidator<T> {
  return new SchemaValidator<T>();
}
