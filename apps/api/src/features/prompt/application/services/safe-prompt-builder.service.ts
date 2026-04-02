/**
 * SafePromptBuilder
 *
 * Constructs prompts by replacing template placeholders with user-provided values,
 * wrapping each value in strict XML-style delimiters to prevent injection attacks.
 *
 * SECURITY MODEL:
 * - All placeholder values are treated as UNTRUSTED (student input)
 * - Values are wrapped in <student_input>...</student_input> delimiters
 * - Any occurrences of the delimiters WITHIN the values are HTML-entity escaped
 *   to prevent premature tag closure and injection attacks
 *
 * @example
 * ```typescript
 * const builder = new SafePromptBuilder();
 * const prompt = builder
 *   .setTemplate('Hello {{name}}, you said: {{message}}')
 *   .setValues({ name: 'Alice', message: 'I love <math> and </student_input> tricks' })
 *   .build();
 * // Result: 'Hello <student_input>Alice</student_input>, you said: <student_input>I love &lt;math&gt; and &lt;/student_input&gt; tricks</student_input>'
 * ```
 */

import type {
  ISafePromptBuilder,
  PromptValues,
} from '@/features/prompt/domain/ports/safe-prompt-builder.interface';

/**
 * Opening delimiter that wraps untrusted student input.
 * LLM/regex-based systems can treat content inside these tags as user input.
 */
export const UNSAFE_START = '<student_input>';

/**
 * Closing delimiter that wraps untrusted student input.
 */
export const UNSAFE_END = '</student_input>';

/**
 * Placeholder pattern: matches {{placeholderName}}
 * Supports alphanumeric, underscores, and hyphens in placeholder names.
 */
const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_-]*)\}\}/g;

/**
 * Builds safe prompts by wrapping untrusted placeholder values in delimiters.
 *
 * Design principles:
 * - Single Responsibility: only safe prompt construction
 * - Open/Closed: extendable via constructor options for custom delimiters
 * - Defensive: all inputs escaped, no unsafe defaults
 */
export class SafePromptBuilder implements ISafePromptBuilder {
  private _template: string = '';
  private _values: PromptValues = {};
  private _customStart: string;
  private _customEnd: string;

  constructor(options?: { startDelimiter?: string; endDelimiter?: string }) {
    this._customStart = options?.startDelimiter ?? UNSAFE_START;
    this._customEnd = options?.endDelimiter ?? UNSAFE_END;
  }

  /**
   * Sets the prompt template with {{placeholder}} syntax.
   *
   * @param template - Template string with {{placeholderName}} placeholders
   * @returns this builder for chaining
   *
   * @example
   * ```typescript
   * builder.setTemplate('User: {{userMessage}}\nAssistant:');
   * ```
   */
  setTemplate(template: string): ISafePromptBuilder {
    if (typeof template !== 'string') {
      throw new TypeError('Template must be a string');
    }
    this._template = template;
    return this;
  }

  /**
   * Sets the placeholder values to inject into the template.
   *
   * @param values - Record mapping placeholder names to their values
   * @returns this builder for chaining
   *
   * @example
   * ```typescript
   * builder.setValues({ name: 'Alice', query: 'What is 2+2?' });
   * ```
   */
  setValues(values: PromptValues): ISafePromptBuilder {
    if (values === null || values === undefined) {
      this._values = {};
      return this;
    }
    if (typeof values !== 'object') {
      throw new TypeError('Values must be a record object');
    }
    this._values = values;
    return this;
  }

  /**
   * Builds the final safe prompt by replacing placeholders with wrapped values.
   *
   * SECURITY BEHAVIOR:
   * - Each placeholder value is wrapped in <student_input>...</student_input>
   * - Any existing delimiter patterns inside the value are HTML-entity escaped
   * - undefined/null values become empty strings
   * - Unmatched placeholders are left unchanged in the template
   *
   * @returns The constructed safe prompt string
   * @throws Error if no template has been set
   *
   * @example
   * ```typescript
   * const prompt = builder
   *   .setTemplate('Explain {{topic}} to {{age}}-year-old')
   *   .setValues({ topic: 'gravity', age: '10' })
   *   .build();
   * // Result: 'Explain <student_input>gravity</student_input> to <student_input>10</student_input>-year-old'
   * ```
   */
  build(): string {
    if (!this._template) {
      throw new Error('Template must be set before building. Use setTemplate() first.');
    }

    // Find all placeholders in the template
    const placeholders = this.findPlaceholders(this._template);

    if (placeholders.length === 0) {
      return this._template;
    }

    // SECURITY: Validate all placeholders have values
    this.validateAllPlaceholdersProvided(placeholders);

    // Build the result by replacing each placeholder
    let result = this._template;

    for (const placeholder of placeholders) {
      const rawValue = this._values[placeholder.name];

      // SECURITY: Treat null/undefined as empty string
      const stringValue = this.coerceToString(rawValue);

      // SECURITY: Escape any delimiter occurrences within the value
      const escapedValue = this.escapeDelimiters(stringValue);

      // SECURITY: Wrap the escaped value in delimiters
      const wrappedValue = `${this._customStart}${escapedValue}${this._customEnd}`;

      // Replace only the first occurrence of this placeholder
      result = this.replaceFirstPlaceholder(result, placeholder.name, wrappedValue);
    }

    return result;
  }

  /**
   * Finds all placeholders in a template string.
   *
   * @param template - Template to scan
   * @returns Array of placeholder objects with name and position
   */
  private findPlaceholders(template: string): Array<{ name: string; fullMatch: string }> {
    const matches: Array<{ name: string; fullMatch: string }> = [];
    let match: RegExpExecArray | null;

    // Reset lastIndex to ensure we start from the beginning
    PLACEHOLDER_PATTERN.lastIndex = 0;

    while ((match = PLACEHOLDER_PATTERN.exec(template)) !== null) {
      matches.push({
        name: match[1],
        fullMatch: match[0],
      });
    }

    return matches;
  }

  /**
   * Escapes delimiter patterns within a value to prevent injection.
   *
   * SECURITY: This prevents attacks where malicious input contains:
   * - `</student_input>` to prematurely close the wrapper tag
   * - `<student_input>` to open a nested wrapper
   *
   * @param value - The value to escape
   * @returns The value with delimiters HTML-entity escaped
   */
  private escapeDelimiters(value: string): string {
    // First escape the closing delimiter (check this first to prevent double-escaping)
    let escaped = value.replace(
      new RegExp(this.escapeRegExp(this._customEnd), 'g'),
      this._customEnd.replace('<', '&lt;').replace('>', '&gt;'),
    );

    // Then escape the opening delimiter
    escaped = escaped.replace(
      new RegExp(this.escapeRegExp(this._customStart), 'g'),
      this._customStart.replace('<', '&lt;').replace('>', '&gt;'),
    );

    return escaped;
  }

  /**
   * Validates that all placeholders in the template have corresponding values.
   *
   * @param placeholders - Array of placeholder names found in template
   * @throws Error if a placeholder is missing from values
   */
  private validateAllPlaceholdersProvided(placeholders: Array<{ name: string }>): void {
    for (const placeholder of placeholders) {
      if (!(placeholder.name in this._values)) {
        throw new Error(
          `Missing value for placeholder: {{${placeholder.name}}}. ` +
            `All placeholders in the template must have corresponding values. ` +
            `Either provide a value or use a different template.`,
        );
      }
    }
  }

  /**
   * Escapes special regex characters in a string.
   * Necessary for building safe RegExp patterns from dynamic strings.
   *
   * @param str - String to escape
   * @returns Escaped string safe for use in RegExp
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Converts a value to string, handling null/undefined safely.
   *
   * @param value - Value to coerce
   * @returns String representation or empty string
   */
  private coerceToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  /**
   * Replaces the first occurrence of a placeholder with a value.
   *
   * @param template - Template string
   * @param placeholderName - Name of the placeholder to replace
   * @param replacement - Value to insert
   * @returns Modified template string
   */
  private replaceFirstPlaceholder(
    template: string,
    placeholderName: string,
    replacement: string,
  ): string {
    const pattern = new RegExp(`\\{\\{${this.escapeRegExp(placeholderName)}\\}\\}`, 'u');
    return template.replace(pattern, replacement);
  }

  /**
   * Resets the builder to its initial state.
   * Useful for reuse without creating a new instance.
   *
   * @returns this builder for chaining
   */
  reset(): ISafePromptBuilder {
    this._template = '';
    this._values = {};
    return this;
  }

  /**
   * Returns the configured start delimiter.
   */
  get startDelimiter(): string {
    return this._customStart;
  }

  /**
   * Returns the configured end delimiter.
   */
  get endDelimiter(): string {
    return this._customEnd;
  }
}

/**
 * Factory function for creating a SafePromptBuilder with fluent API.
 *
 * @param template - Initial template string (optional)
 * @param values - Initial values record (optional)
 * @returns Configured SafePromptBuilder instance
 *
 * @example
 * ```typescript
 * const prompt = buildSafePrompt(
 *   'Hello {{name}}, query: {{query}}',
 *   { name: 'Bob', query: 'Test <script>' }
 * );
 * ```
 */
export function buildSafePrompt(template?: string, values?: PromptValues): ISafePromptBuilder {
  const builder = new SafePromptBuilder();
  if (template) {
    builder.setTemplate(template);
  }
  if (values) {
    builder.setValues(values);
  }
  return builder;
}
