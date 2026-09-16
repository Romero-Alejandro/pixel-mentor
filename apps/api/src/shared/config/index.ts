// Environment configuration
export { config, envSchema } from '@/shared/config/env.js';
export type { Config } from '@/shared/config/env.js';

// Feature flag types and services
export {
  FeatureFlagService,
  featureFlagService,
  getFeatureFlagService,
  resetFeatureFlagService,
  createFeatureFlagService,
} from '@/shared/config/evaluation-flags.js';

export type {
  EvaluationFlags,
  CohortConfig,
  TemplateEngineConfig,
  KeywordExtractionConfig,
  EvaluatorType,
  PartialEvaluationFlags,
} from '@/shared/config/evaluation-flags.js';
