/**
 * EvaluationPromptRepository
 *
 * Loads evaluation prompts from .txt files and renders them with SafePromptBuilder
 * to ensure all user input is wrapped in security delimiters.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PromptValues } from '@/features/prompt/domain/ports/safe-prompt-builder.interface.js';
import { createUnifiedPromptRenderer } from '@/features/prompt/infrastructure/persistence/unified-prompt-renderer.js';

type EvaluationPromptKey =
  | 'extract_concepts_system'
  | 'extract_concepts_user'
  | 'classify_system'
  | 'classify_user'
  | 'generate_feedback_system'
  | 'generate_feedback_user';

const PROMPTS_BASE_PATH = join(fileURLToPath(new URL('.', import.meta.url)), 'files');

const renderer = createUnifiedPromptRenderer();

function loadTemplate(fileName: string): string {
  const filePath = join(PROMPTS_BASE_PATH, fileName);
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Template not found: ${fileName}`);
}

const templates: Record<EvaluationPromptKey, string> = {
  extract_concepts_system: loadTemplate('extract_concepts_system.txt'),
  extract_concepts_user: loadTemplate('extract_concepts_user.txt'),
  classify_system: loadTemplate('classify_system.txt'),
  classify_user: loadTemplate('classify_user.txt'),
  generate_feedback_system: loadTemplate('generate_feedback_system.txt'),
  generate_feedback_user: loadTemplate('generate_feedback_user.txt'),
};

export class EvaluationPromptRepository {
  getPrompt(key: EvaluationPromptKey, values: PromptValues): string {
    const template = templates[key];
    if (!template) {
      throw new Error(`No template found for key: ${key}`);
    }

    return renderer.render(template, values);
  }

  /**
   * Builds the full prompt for concept extraction.
   * Wraps student input in security delimiters via SafePromptBuilder.
   */
  buildExtractConceptsPrompt(values: PromptValues): string {
    const systemPrompt = this.getPrompt('extract_concepts_system', {});
    const userPrompt = this.getPrompt('extract_concepts_user', values);

    return `${systemPrompt}\n\n${userPrompt}`;
  }

  /**
   * Builds the full prompt for classification.
   * Wraps student input in security delimiters via SafePromptBuilder.
   */
  buildClassifyPrompt(values: PromptValues, maxScore: number): string {
    const systemTemplate = templates.classify_system.replace(/\{\{maxScore\}\}/g, String(maxScore));
    const userPrompt = this.getPrompt('classify_user', values);

    return `${systemTemplate}\n\n${userPrompt}`;
  }

  /**
   * Builds the full prompt for feedback generation.
   * Wraps student input in security delimiters via SafePromptBuilder.
   */
  buildFeedbackPrompt(values: PromptValues): string {
    const systemPrompt = this.getPrompt('generate_feedback_system', {});
    const userPrompt = this.getPrompt('generate_feedback_user', values);

    return `${systemPrompt}\n\n${userPrompt}`;
  }

  /**
   * Wraps a value in security delimiters for unsafe user input.
   * Use this for wrapping raw student input before passing to the renderer.
   *
   * @param value - The user input to wrap
   * @returns Value wrapped in <student_input> delimiters
   */
  wrapUserInput(value: string): string {
    return `<student_input>${value}</student_input>`;
  }
}

let repositoryInstance: EvaluationPromptRepository | null = null;

export function getEvaluationPromptRepository(): EvaluationPromptRepository {
  if (!repositoryInstance) {
    repositoryInstance = new EvaluationPromptRepository();
  }
  return repositoryInstance;
}
