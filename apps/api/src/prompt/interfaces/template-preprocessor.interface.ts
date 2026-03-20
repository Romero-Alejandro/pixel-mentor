/**
 * Interface for template preprocessing with conditional blocks and placeholders.
 */
export interface ITemplatePreprocessor {
  /**
   * Processes a template string by evaluating conditionals and replacing placeholders.
   *
   * @param template - Template string with conditional blocks and/or placeholders
   * @param context - Record of variable names to their values
   * @returns Processed string with conditionals evaluated and placeholders replaced
   */
  process(template: string, context: Record<string, unknown>): string;

  /**
   * Determines if a value is truthy according to template rules.
   *
   * Truthy values:
   * - Non-empty string
   * - Number > 0
   * - Boolean true
   * - Non-empty array
   * - Non-empty object
   *
   * Falsy values:
   * - null
   * - undefined
   * - Empty string
   * - 0
   * - false
   * - Empty array
   * - Empty object
   *
   * @param value - The value to evaluate
   * @returns Whether the value is truthy
   */
  isTruthy(value: unknown): boolean;
}
