/**
 * Interface for safe prompt building with delimiter escaping.
 *
 * Implementations should treat all placeholder values as UNTRUSTED
 * and wrap them in security delimiters to prevent injection attacks.
 */

/**
 * Record mapping placeholder names to their string values.
 * Values are treated as untrusted user input.
 */
export type PromptValues = Readonly<Record<string, string | null | undefined>>;

/**
 * Interface for building prompts with safe delimiter wrapping.
 *
 * SECURITY CONTRACT:
 * - All values set via setValues() are treated as UNTRUSTED
 * - Values are automatically wrapped in security delimiters
 * - Delimiter occurrences within values are escaped to prevent injection
 */
export interface ISafePromptBuilder {
  /**
   * Sets the prompt template with {{placeholder}} syntax.
   *
   * @param template - Template string with {{placeholderName}} placeholders
   * @returns this builder for chaining
   */
  setTemplate(template: string): ISafePromptBuilder;

  /**
   * Sets the placeholder values to inject into the template.
   *
   * @param values - Record mapping placeholder names to their values
   *                 null/undefined values become empty strings
   * @returns this builder for chaining
   */
  setValues(values: PromptValues): ISafePromptBuilder;

  /**
   * Builds the final safe prompt by replacing placeholders with wrapped values.
   *
   * @returns The constructed safe prompt string
   * @throws Error if no template has been set
   */
  build(): string;

  /**
   * Resets the builder to its initial state for reuse.
   *
   * @returns this builder for chaining
   */
  reset(): ISafePromptBuilder;
}
