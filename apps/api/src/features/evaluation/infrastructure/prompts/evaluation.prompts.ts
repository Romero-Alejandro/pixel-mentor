/**
 * Evaluator Prompts Module
 *
 * Facade for loading evaluation prompts from .txt files.
 * Delegates to FileSystemPromptRepository with UnifiedPromptRenderer.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PromptValues } from '@/features/prompt/domain/ports/safe-prompt-builder.interface.js';
import { createUnifiedPromptRenderer } from '@/features/prompt/infrastructure/persistence/unified-prompt-renderer.js';

const PROMPTS_BASE_PATH = join(fileURLToPath(new URL('.', import.meta.url)), '../../prompts');

const renderer = createUnifiedPromptRenderer();

function loadTemplate(fileName: string): string {
  const filePath = join(PROMPTS_BASE_PATH, fileName);
  if (existsSync(filePath)) {
    return readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Template not found: ${fileName}`);
}

const EXTRACT_CONCEPTS_SYSTEM = loadTemplate('extract_concepts_system.txt');
const EXTRACT_CONCEPTS_USER = loadTemplate('extract_concepts_user.txt');
const CLASSIFY_SYSTEM = loadTemplate('classify_system.txt');
const CLASSIFY_USER = loadTemplate('classify_user.txt');
const GENERATE_FEEDBACK_SYSTEM = loadTemplate('generate_feedback_system.txt');
const GENERATE_FEEDBACK_USER = loadTemplate('generate_feedback_user.txt');

export const EXTRACT_CONCEPTS_USER_TEMPLATE = EXTRACT_CONCEPTS_USER;
export const CLASSIFY_USER_TEMPLATE = CLASSIFY_USER;
export const GENERATE_FEEDBACK_USER_TEMPLATE = GENERATE_FEEDBACK_USER;

export function buildExtractConceptsPrompt(questionText: string, studentAnswer: string): string {
  const values: PromptValues = {
    questionText: questionText || '',
    studentAnswer: studentAnswer || '',
  };

  const userPrompt = renderer.render(EXTRACT_CONCEPTS_USER, values);

  return `${EXTRACT_CONCEPTS_SYSTEM}\n\n${userPrompt}`;
}

export function buildClassifyPrompt(values: Record<string, string>, maxScore: number): string {
  const promptValues: PromptValues = {
    questionText: values.questionText || '',
    studentAnswer: values.studentAnswer || '',
    extractedConcepts: values.extractedConcepts || '',
    subject: values.subject || '',
    gradeLevel: values.gradeLevel || '',
    topic: values.topic || '',
    centralTruth: values.centralTruth || '',
    requiredKeywords: values.requiredKeywords || '',
    exemplarsSection: values.exemplarsSection || '',
    maxScore: String(maxScore),
  };

  const userPrompt = renderer.render(CLASSIFY_USER, promptValues);
  const systemWithScore = CLASSIFY_SYSTEM.replace(/\{\{maxScore\}\}/g, String(maxScore));

  return `${systemWithScore}\n\n${userPrompt}`;
}

export function buildFeedbackPrompt(values: Record<string, string>, maxScore: number): string {
  const promptValues: PromptValues = {
    outcome: values.outcome || '',
    score: values.score || '0',
    maxScore: String(maxScore),
    justification: values.justification || '',
    studentName: values.studentName || '',
    questionText: values.questionText || '',
    studentAnswer: values.studentAnswer || '',
  };

  const userPrompt = renderer.render(GENERATE_FEEDBACK_USER, promptValues);

  return `${GENERATE_FEEDBACK_SYSTEM}\n\n${userPrompt}`;
}
