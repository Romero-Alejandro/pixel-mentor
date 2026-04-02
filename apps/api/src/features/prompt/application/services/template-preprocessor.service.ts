/**
 * TemplatePreprocessor
 *
 * Processes template strings with conditional blocks and variable placeholders.
 *
 * Supported syntax:
 * - `{{#if variableName}}...{{/if}}` - includes block if variable is truthy
 * - `{{#unless variableName}}...{{/unless}}` - includes block if variable is falsy
 * - `{{variableName}}` - replaced with value from context
 *
 * Algorithm:
 * 1. Parse the template into tokens using a single pass with a stack
 * 2. Evaluate conditionals and include/exclude blocks based on truthy/falsy
 * 3. Replace remaining placeholders with values
 *
 * NOTE: This class does NOT perform delimiter escaping. That is SafePromptBuilder's
 * responsibility. TemplatePreprocessor only expands conditionals and does placeholder
 * replacement with raw values.
 *
 * @example
 * ```typescript
 * const processor = new TemplatePreprocessor();
 * const template = '{{#if isLoggedIn}}Welcome {{name}}{{/if}}';
 * const context = { isLoggedIn: true, name: 'Alice' };
 * const result = processor.process(template, context);
 * // Result: 'Welcome Alice'
 * ```
 */

import type { ITemplatePreprocessor } from '@/features/prompt/domain/ports/template-preprocessor.interface';

/**
 * Maximum nesting depth for conditional blocks to prevent stack overflow.
 */
const MAX_NESTING_DEPTH = 5;

/**
 * Processes templates with conditional blocks and variable placeholders.
 */
export class TemplatePreprocessor implements ITemplatePreprocessor {
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
  isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'boolean') {
      return value === true;
    }

    if (typeof value === 'number') {
      return value > 0;
    }

    if (typeof value === 'string') {
      return value.length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return false;
  }

  /**
   * Processes a template string by evaluating conditionals and replacing placeholders.
   *
   * @param template - Template string with conditional blocks and/or placeholders
   * @param context - Record of variable names to their values
   * @returns Processed string with conditionals evaluated and placeholders replaced
   *
   * @example
   * ```typescript
   * const processor = new TemplatePreprocessor();
   * const result = processor.process(
   *   '{{#if user}}Hello {{name}}{{/if}}',
   *   { user: true, name: 'Alice' }
   * );
   * // Result: 'Hello Alice'
   * ```
   */
  process(template: string, context: Record<string, unknown>): string {
    if (typeof template !== 'string') {
      throw new TypeError('Template must be a string');
    }

    if (template.length === 0) {
      return template;
    }

    if (context === null || context === undefined) {
      context = {};
    }

    // Process conditionals and collect result parts
    const result = this.processWithConditionals(template, context, 0);

    // Replace remaining placeholders
    return this.replacePlaceholders(result, context);
  }

  /**
   * Processes template with conditionals, tracking nesting depth.
   *
   * @param template - Template to process
   * @param context - Variable context
   * @param depth - Current nesting depth
   * @returns Processed string
   */
  private processWithConditionals(
    template: string,
    context: Record<string, unknown>,
    depth: number,
  ): string {
    if (depth > MAX_NESTING_DEPTH) {
      throw new Error(
        `Maximum nesting depth of ${MAX_NESTING_DEPTH} exceeded. ` +
          'Check for malformed template syntax.',
      );
    }

    let result = '';
    let index = 0;

    while (index < template.length) {
      // Find the next {{ tag
      const openBrace = template.indexOf('{{', index);

      if (openBrace === -1) {
        // No more tags, add rest of string
        result += template.slice(index);
        break;
      }

      // Add text before the tag
      result += template.slice(index, openBrace);

      // Find the closing }}
      const closeBrace = template.indexOf('}}', openBrace);
      if (closeBrace === -1) {
        // Unclosed tag, treat rest as text
        result += template.slice(openBrace);
        break;
      }

      const tagContent = template.slice(openBrace + 2, closeBrace).trim();

      if (tagContent.startsWith('#if ')) {
        // Process if block
        const variableName = tagContent.slice(4).trim();
        const { content, endIndex } = this.findBlockEnd(template, closeBrace + 2, 'if');
        const variableValue = context[variableName];

        if (this.isTruthy(variableValue)) {
          // Recursively process content with increased depth
          result += this.processWithConditionals(content, context, depth + 1);
        }
        index = endIndex + 7; // Move past {{/if}}
      } else if (tagContent.startsWith('#unless ')) {
        // Process unless block
        const variableName = tagContent.slice(8).trim();
        const { content, endIndex } = this.findBlockEnd(template, closeBrace + 2, 'unless');
        const variableValue = context[variableName];

        if (!this.isTruthy(variableValue)) {
          // Recursively process content with increased depth
          result += this.processWithConditionals(content, context, depth + 1);
        }
        // Move past {{/unless}} which is 11 characters total ({{ + /unless + }})
        index = endIndex + 11;
      } else if (tagContent === '/if') {
        // End of if block - this shouldn't happen if findBlockEnd is working
        // Return up to let caller handle it
        break;
      } else if (tagContent === '/unless') {
        // End of unless block - this shouldn't happen if findBlockEnd is working
        break;
      } else if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tagContent)) {
        // Simple placeholder - leave for later replacement
        result += `{{${tagContent}}}`;
        index = closeBrace + 2;
      } else {
        // Unknown tag, keep as-is
        result += `{{${tagContent}}}`;
        index = closeBrace + 2;
      }
    }

    return result;
  }

  /**
   * Finds the end of a conditional block, handling nested blocks.
   *
   * @param template - Full template string
   * @param startIndex - Index after the opening tag's }}
   * @param blockType - 'if' or 'unless'
   * @returns Object with block content and index of closing tag
   */
  private findBlockEnd(
    template: string,
    startIndex: number,
    blockType: 'if' | 'unless',
  ): { content: string; endIndex: number } {
    let depth = 1;
    let index = startIndex;
    const endTag = blockType === 'if' ? '/if' : '/unless';

    while (depth > 0 && index < template.length) {
      const openBrace = template.indexOf('{{', index);

      if (openBrace === -1) {
        // No more tags, rest of template is content
        const content = template.slice(startIndex, template.length);
        return { content, endIndex: template.length };
      }

      const closeBrace = template.indexOf('}}', openBrace);
      if (closeBrace === -1) {
        // Unclosed tag
        const content = template.slice(startIndex, template.length);
        return { content, endIndex: template.length };
      }

      const tagContent = template.slice(openBrace + 2, closeBrace).trim();

      if (tagContent.startsWith('#if ') || tagContent === '#if') {
        depth++;
        index = closeBrace + 2;
      } else if (tagContent.startsWith('#unless ') || tagContent === '#unless') {
        depth++;
        index = closeBrace + 2;
      } else if (tagContent === endTag) {
        depth--;
        if (depth === 0) {
          // Found our closing tag
          const content = template.slice(startIndex, openBrace);
          return { content, endIndex: openBrace };
        }
        index = closeBrace + 2;
      } else {
        index = closeBrace + 2;
      }
    }

    // Should have found closing tag
    const content = template.slice(startIndex, index);
    return { content, endIndex: index };
  }

  /**
   * Replaces all {{variable}} placeholders with their values from context.
   *
   * Missing variables are replaced with empty string.
   *
   * @param template - Template with placeholders
   * @param context - Variable context
   * @returns Template with placeholders replaced
   */
  private replacePlaceholders(template: string, context: Record<string, unknown>): string {
    // Pattern for {{variableName}} placeholders
    const placeholderPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_-]*)\}\}/g;

    return template.replace(placeholderPattern, (_fullMatch, variableName) => {
      const value = context[variableName];
      return this.coerceToString(value);
    });
  }

  /**
   * Converts a value to string safely.
   *
   * @param value - Value to coerce
   * @returns String representation or empty string
   */
  private coerceToString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      // For arrays and objects, JSON stringify them
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }
}

/**
 * Factory function for creating a TemplatePreprocessor instance.
 *
 * @returns New TemplatePreprocessor instance
 *
 * @example
 * ```typescript
 * const processor = createTemplatePreprocessor();
 * const result = processor.process('Hello {{name}}', { name: 'World' });
 * ```
 */
export function createTemplatePreprocessor(): ITemplatePreprocessor {
  return new TemplatePreprocessor();
}
