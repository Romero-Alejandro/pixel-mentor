/**
 * Prompt utilities barrel export
 *
 * @module prompt
 */

// Safe prompt builder with delimiter escaping
export {
  SafePromptBuilder,
  buildSafePrompt,
  UNSAFE_START,
  UNSAFE_END,
} from './safe.prompt.builder.js';

// Interface for safe prompt building
export type {
  ISafePromptBuilder,
  PromptValues,
} from './interfaces/safe-prompt-builder.interface.js';

// Template preprocessor with conditionals and placeholders
export { TemplatePreprocessor, createTemplatePreprocessor } from './template.preprocessor.js';

// Interface for template preprocessing
export type { ITemplatePreprocessor } from './interfaces/template-preprocessor.interface.js';

// Evaluator prompt builder combining preprocessing and safe building
export {
  EvaluatorPromptBuilder,
  createEvaluatorPromptBuilder,
} from './evaluator.prompt.builder.js';

// Interface for evaluator prompt builder options
export type { IEvaluatorPromptBuilderOptions } from './evaluator.prompt.builder.js';
