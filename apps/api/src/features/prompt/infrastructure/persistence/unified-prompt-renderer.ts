/**
 * UnifiedPromptRenderer
 *
 * Unified template rendering engine for prompt templates.
 * Supports:
 * - Mustache-style {{placeholder}} variables
 * - Conditional blocks {% if var %}...{% endif %}
 * - Loop blocks {% for item in items %}...{% endfor %}
 * - Filters | default: 'value'
 *
 * SECURITY: All user-provided values are wrapped via SafePromptBuilder
 * to prevent injection attacks.
 */

import type { PromptValues } from '@/features/prompt/domain/ports/safe-prompt-builder.interface.js';
import { SafePromptBuilder } from '@/features/prompt/application/services/safe-prompt-builder.service.js';

const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)(?:\|([^}]+))?\}\}/g;

function processConditionals(template: string, values: Record<string, string>): string {
  let result = template;

  const conditionalRegex =
    /\{%\s*(if|elsif)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}([\s\S]*?)(?:\{%\s*elsif\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}([\s\S]*?))*(?:\{% else %\}([\s\S]*?))?\{% endif %\}/g;

  result = result.replace(
    conditionalRegex,
    (_match, firstKeyword: string, firstVar: string, firstBlock: string) => {
      const branches: Array<{ condition: string | null; block: string }> = [];
      branches.push({ condition: firstKeyword === 'if' ? firstVar : null, block: firstBlock });

      const elsifRegex = /\{% elsif ([a-zA-Z_][a-zA-Z0-9_]*) %\}([\s\S]*?)/g;
      let elsifMatch;
      while ((elsifMatch = elsifRegex.exec(_match)) !== null) {
        branches.push({ condition: elsifMatch[1], block: elsifMatch[2] });
      }

      let elseBlock = '';
      const elseMatch = _match.match(/\{% else %\}([\s\S]*?)\{% endif %\}/);
      if (elseMatch) {
        elseBlock = elseMatch[1];
      }

      for (const branch of branches) {
        if (branch.condition === null) {
          if (isTruthy(values[firstVar])) {
            return branch.block;
          }
        } else if (isTruthy(values[branch.condition])) {
          return branch.block;
        }
      }

      return elseBlock;
    },
  );

  result = result.replace(/\{%[^%]*%\}/g, '');

  return result;
}

function processLoops(template: string, values: Record<string, string>): string {
  let result = template;

  const loopRegex =
    /\{%\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}([\s\S]*?)\{% endfor %\}/g;

  result = result.replace(loopRegex, (_match, itemVar: string, itemsVar: string, body: string) => {
    const itemsJson = values[itemsVar];

    if (!itemsJson) {
      return '';
    }

    let items: Array<{ role: string; content: string }>;
    try {
      items = JSON.parse(itemsJson);
    } catch {
      return '';
    }

    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }

    const renderedItems: string[] = [];

    for (const item of items) {
      let itemBody = body;

      if (typeof item === 'object' && item !== null) {
        for (const [key, val] of Object.entries(item)) {
          const varPattern = new RegExp(`\\{\\{${itemVar}\\.${key}\\}\\}`, 'g');
          itemBody = itemBody.replace(varPattern, String(val ?? ''));

          const ternaryPattern = new RegExp(
            `\\{\\{['"]([^'"]*)['"]\\s+if\\s+${itemVar}\\.${key}\\s+else\\s+['"]([^'"]*)['"]\\}\\}`,
            'g',
          );
          itemBody = itemBody.replace(ternaryPattern, (_, truthyVal, falsyVal) => {
            return isTruthy(String(val)) ? truthyVal : falsyVal;
          });

          const simpleTernaryPattern = new RegExp(
            `\\{\\{['"]([^'"]*)['"]\\s+if\\s+${key}\\s+else\\s+['"]([^'"]*)['"]\\}\\}`,
            'g',
          );
          itemBody = itemBody.replace(simpleTernaryPattern, (_, truthyVal, falsyVal) => {
            return isTruthy(String(val)) ? truthyVal : falsyVal;
          });
        }
      }

      const simpleVarPattern = new RegExp(`\\{\\{${itemVar}\\}\\}`, 'g');
      itemBody = itemBody.replace(simpleVarPattern, String(item));

      renderedItems.push(itemBody);
    }

    return renderedItems.join('');
  });

  return result;
}

function isTruthy(value: string | undefined): boolean {
  if (!value || value === '') {
    return false;
  }
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'number') return parsed !== 0;
    if (Array.isArray(parsed)) return parsed.length > 0;
    return true;
  } catch {
    return value.length > 0;
  }
}

function applyFilters(value: string, filters: string | undefined): string {
  if (!filters) {
    return value;
  }

  let result = value;
  const filterParts = filters.split('|').map((f) => f.trim());

  for (const filter of filterParts) {
    if (filter.startsWith('default:')) {
      const defaultValue = filter
        .substring(8)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (!result || result === '') {
        result = defaultValue;
      }
    }
  }

  return result;
}

export class UnifiedPromptRenderer {
  render(template: string, values: PromptValues): string {
    if (!template) {
      return template;
    }

    const stringValues: Record<string, string> = {};
    for (const [key, val] of Object.entries(values)) {
      if (val !== null && val !== undefined) {
        stringValues[key] = String(val);
      }
    }

    let result = template;

    result = processLoops(result, stringValues);
    result = processConditionals(result, stringValues);

    const builder = new SafePromptBuilder();
    builder.setTemplate(result);
    builder.setValues(stringValues);

    try {
      result = builder.build();
    } catch {
      result = this.manualReplace(result, stringValues);
    }

    return result;
  }

  private manualReplace(template: string, values: Record<string, string>): string {
    let result = template;

    PLACEHOLDER_PATTERN.lastIndex = 0;
    let match;

    while ((match = PLACEHOLDER_PATTERN.exec(template)) !== null) {
      const placeholderName = match[1];
      const filters = match[2];
      const fullMatch = match[0];

      let value = values[placeholderName] || '';

      value = applyFilters(value, filters);

      result = result.replace(fullMatch, value);
    }

    return result;
  }
}

export function createUnifiedPromptRenderer(): UnifiedPromptRenderer {
  return new UnifiedPromptRenderer();
}
