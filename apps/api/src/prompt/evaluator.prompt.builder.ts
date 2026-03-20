/**
 * EvaluatorPromptBuilder
 *
 * Combines TemplatePreprocessor and SafePromptBuilder to produce safe evaluation prompts.
 *
 * WORKFLOW:
 * 1. TemplatePreprocessor expands conditionals ({{#if}}, {{#unless}}) and replaces
 *    non-student-input placeholders with their values
 * 2. SafePromptBuilder wraps remaining placeholders (typically student input like
 *    {{studentAnswer}}) in security delimiters to prevent injection attacks
 *
 * SECURITY CONTRACT:
 * - All values from the context are treated as UNTRUSTED
 * - Conditional blocks are evaluated using raw context values
 * - Student input placeholders are wrapped in <student_input>...</student_input> delimiters
 * - Delimiter occurrences within values are HTML-entity escaped
 *
 * @example
 * ```typescript
 * const builder = new EvaluatorPromptBuilder(
 *   new TemplatePreprocessor(),
 *   new SafePromptBuilder()
 * );
 *
 * const template = `
 * {{#if exemplars}}
 * Example answers:
 * {{exemplars}}
 * {{/if}}
 *
 * Evaluate this answer: {{studentAnswer}}
 *
 * Rubric criteria: {{rubric}}
 * `;
 *
 * const result = builder.build(template, {
 *   exemplars: 'Example 1: Good response\nExample 2: Better response',
 *   studentAnswer: '<script>alert("xss")</script>',
 *   rubric: 'Content relevance, clarity, and accuracy'
 * });
 * ```
 */

import type { ITemplatePreprocessor } from './interfaces/template-preprocessor.interface';
import type { ISafePromptBuilder } from './interfaces/safe-prompt-builder.interface';
import { TemplatePreprocessor } from './template.preprocessor';
import { SafePromptBuilder } from './safe.prompt.builder';

/**
 * Sentinel placeholder used internally to preserve student answer placeholder
 * during preprocessing. This unique string should not appear in normal content.
 */
const STUDENT_ANSWER_SENTINEL = '__STUDENT_ANSWER_PH__';

/**
 * Configuration options for EvaluatorPromptBuilder.
 */
export interface IEvaluatorPromptBuilderOptions {
  /**
   * Optional name for student input placeholder.
   * Defaults to 'studentAnswer'.
   */
  studentInputPlaceholder?: string;
}

/**
 * Combines template preprocessing with safe prompt building.
 *
 * The class orchestrates two components:
 * - ITemplatePreprocessor: expands conditionals, replaces non-student placeholders
 * - ISafePromptBuilder: wraps student input in security delimiters
 */
export class EvaluatorPromptBuilder {
  private readonly preprocessor: ITemplatePreprocessor;
  private readonly promptBuilder: ISafePromptBuilder;
  private readonly studentInputPlaceholder: string;

  /**
   * Creates a new EvaluatorPromptBuilder.
   *
   * @param preprocessor - Template preprocessor for conditionals and placeholders
   * @param promptBuilder - Safe prompt builder for delimiter wrapping
   * @param options - Optional configuration
   *
   * @example
   * ```typescript
   * const builder = new EvaluatorPromptBuilder(
   *   new TemplatePreprocessor(),
   *   new SafePromptBuilder()
   * );
   * ```
   */
  constructor(
    preprocessor: ITemplatePreprocessor,
    promptBuilder: ISafePromptBuilder,
    options?: IEvaluatorPromptBuilderOptions,
  ) {
    if (!preprocessor) {
      throw new TypeError('TemplatePreprocessor is required');
    }
    if (!promptBuilder) {
      throw new TypeError('SafePromptBuilder is required');
    }

    this.preprocessor = preprocessor;
    this.promptBuilder = promptBuilder;
    this.studentInputPlaceholder = options?.studentInputPlaceholder ?? 'studentAnswer';
  }

  /**
   * Builds a safe evaluation prompt from a template and context.
   *
   * PROCESS:
   * 1. Extract student answer value from context
   * 2. Replace {{studentAnswer}} with a unique sentinel in the template
   * 3. Preprocess the template with full context (conditionals + other placeholders)
   * 4. Restore the sentinel back to {{studentAnswer}}
   * 5. Build safe prompt with student answer wrapped in delimiters
   *
   * @param template - Template string with conditionals and placeholders
   * @param context - Record mapping variable names to their values
   * @returns Processed prompt with student input wrapped in security delimiters
   *
   * @example
   * ```typescript
   * const result = builder.build(
   *   'Evaluate: {{studentAnswer}}',
   *   { studentAnswer: 'My answer with <script> tags' }
   * );
   * // Result: 'Evaluate: <student_input>My answer with &lt;script&gt; tags</student_input>'
   * ```
   */
  build(template: string, context: Record<string, unknown>): string {
    if (typeof template !== 'string') {
      throw new TypeError('Template must be a string');
    }

    // Handle empty template
    if (template.length === 0) {
      return '';
    }

    // Step 1: Extract student answer value for safe wrapping later
    const studentAnswerValue = this.extractStudentAnswer(context);

    // Step 2: Replace {{studentAnswer}} with sentinel in template
    // This preserves the placeholder during preprocessing
    const templateWithSentinel = this.replacePlaceholderWithSentinel(
      template,
      this.studentInputPlaceholder,
      STUDENT_ANSWER_SENTINEL,
    );

    // Step 3: Preprocess template with full context
    // Conditionals are expanded and all non-sentinel placeholders are replaced
    const preprocessed = this.preprocessor.process(templateWithSentinel, context);

    // Step 4: Restore {{studentAnswer}} placeholder in the preprocessed template
    // Replace sentinel back to {{studentAnswer}} so SafePromptBuilder can wrap it
    const templateWithRestoredPlaceholder = this.replaceSentinelWithPlaceholder(
      preprocessed,
      STUDENT_ANSWER_SENTINEL,
      this.studentInputPlaceholder,
    );

    // Step 5: Build safe prompt with student answer wrapped in delimiters
    // SafePromptBuilder will escape the value and wrap it in <student_input> tags
    return this.promptBuilder
      .setTemplate(templateWithRestoredPlaceholder)
      .setValues({
        [this.studentInputPlaceholder]: studentAnswerValue,
      })
      .build();
  }

  /**
   * Extracts the student answer from context, converting to string.
   *
   * @param context - Full context object
   * @returns Student answer as string, or empty string if not present
   */
  private extractStudentAnswer(context: Record<string, unknown>): string {
    const value = context[this.studentInputPlaceholder];

    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  /**
   * Replaces a placeholder with a sentinel string in the template.
   *
   * @param template - Template string
   * @param placeholderName - Name of placeholder to replace
   * @param sentinel - Sentinel string to replace with
   * @returns Template with placeholder replaced by sentinel
   */
  private replacePlaceholderWithSentinel(
    template: string,
    placeholderName: string,
    sentinel: string,
  ): string {
    const pattern = new RegExp(`\\{\\{${this.escapeRegExp(placeholderName)}\\}\\}`, 'g');
    return template.replace(pattern, sentinel);
  }

  /**
   * Replaces a sentinel string back to a placeholder in the template.
   *
   * @param template - Template string with sentinel
   * @param sentinel - Sentinel string to replace
   * @param placeholderName - Placeholder name to restore
   * @returns Template with placeholder restored
   */
  private replaceSentinelWithPlaceholder(
    template: string,
    sentinel: string,
    placeholderName: string,
  ): string {
    // Escape special regex characters in sentinel before using in pattern
    const escapedSentinel = this.escapeRegExp(sentinel);
    const pattern = new RegExp(escapedSentinel, 'g');
    return template.replace(pattern, `{{${placeholderName}}}`);
  }

  /**
   * Escapes special regex characters in a string.
   *
   * @param str - String to escape
   * @returns Escaped string safe for use in RegExp
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Returns the configured student input placeholder name.
   */
  get studentPlaceholderName(): string {
    return this.studentInputPlaceholder;
  }
}

/**
 * Factory function for creating an EvaluatorPromptBuilder with default components.
 *
 * @param options - Optional configuration
 * @returns Configured EvaluatorPromptBuilder instance
 *
 * @example
 * ```typescript
 * const builder = createEvaluatorPromptBuilder();
 * const result = builder.build(template, context);
 * ```
 */
export function createEvaluatorPromptBuilder(
  options?: IEvaluatorPromptBuilderOptions,
): EvaluatorPromptBuilder {
  return new EvaluatorPromptBuilder(
    // Use dynamic import to avoid circular dependency issues
    createDefaultPreprocessor(),
    createDefaultPromptBuilder(),
    options,
  );
}

// Helper factory functions for default instances
function createDefaultPreprocessor(): ITemplatePreprocessor {
  return new TemplatePreprocessor();
}

function createDefaultPromptBuilder(): ISafePromptBuilder {
  return new SafePromptBuilder();
}
