import type pino from 'pino';

import { SafePromptBuilder } from '@/features/prompt/application/services/safe-prompt-builder.service.js';
import { TemplatePreprocessor } from '@/features/prompt/application/services/template-preprocessor.service.js';
import { SchemaValidator } from '@/features/prompt/infrastructure/persistence/schema-validator.js';

export interface PromptContainer {
  safePromptBuilder: SafePromptBuilder;
  templatePreprocessor: TemplatePreprocessor;
  schemaValidator: SchemaValidator;
}

export function buildPromptContainer(_logger: pino.Logger): PromptContainer {
  const safePromptBuilder = new SafePromptBuilder();
  const templatePreprocessor = new TemplatePreprocessor();
  const schemaValidator = new SchemaValidator();

  return {
    safePromptBuilder,
    templatePreprocessor,
    schemaValidator,
  };
}