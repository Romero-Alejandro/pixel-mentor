/**
 * Feature Flag Configuration for Cohort-Based Evaluation Rollout
 *
 * This module provides configuration management for evaluation engine features,
 * supporting cohort-based rollout with environment variable and config file support.
 *
 * @example
 * ```typescript
 * import { featureFlagService, type CohortConfig } from '@/config';
 *
 * // Check if a cohort uses the new engine
 * const useNewEngine = featureFlagService.shouldUseNewEngine('beta-users');
 *
 * // Get specific cohort config
 * const cohortConfig = featureFlagService.getCohortConfig('premium-users');
 * ```
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Evaluator type for cohort-based rollout
 */
export type EvaluatorType = 'keyword' | 'semantic' | 'llm';

/**
 * Cohort configuration mapping cohort name to evaluator settings
 */
export interface CohortConfig {
  /** The type of evaluator to use for this cohort */
  evaluatorType: EvaluatorType;
  /** Additional parameters for the evaluator */
  parameters?: {
    /** For keyword evaluator: minimum keyword match ratio (0-1) */
    keywordMatchThreshold?: number;
    /** For semantic evaluator: embedding model to use */
    embeddingModel?: string;
    /** For LLM evaluator: specific model name */
    modelName?: string;
    /** Enable detailed scoring breakdown */
    detailedScoring?: boolean;
    /** Custom timeout in milliseconds */
    timeoutMs?: number;
  };
  /** Enable template engine for prompt processing */
  useTemplateEngine?: boolean;
  /** Enable keyword extraction if not provided */
  autoExtractKeywords?: boolean;
}

/**
 * Configuration for the template engine used in prompt preprocessing
 */
export interface TemplateEngineConfig {
  /** Enable conditional templates ({{#if}}, {{#each}}) */
  allowConditionals: boolean;
  /** Maximum nesting depth for template processing */
  maxDepth: number;
}

/**
 * Configuration for automatic keyword extraction from content
 */
export interface KeywordExtractionConfig {
  /** Enable automatic keyword extraction when not provided */
  enabled: boolean;
  /** Domain-specific extraction settings */
  domain?: {
    /** Minimum keyword length */
    minLength?: number;
    /** Maximum keywords to extract */
    maxKeywords?: number;
    /** Use TF-IDF for extraction */
    useTfIdf?: boolean;
  };
}

/**
 * Top-level evaluation flags configuration
 */
export interface EvaluationFlags {
  /** Cohort-specific evaluator mappings */
  cohorts: Record<string, CohortConfig>;
  /** Template engine configuration */
  templateEngine: TemplateEngineConfig;
  /** Keyword extraction configuration */
  keywordExtraction: KeywordExtractionConfig;
  /** Global flag to use the new evaluator engine */
  useNewEvaluatorEngine: boolean;
}

/**
 * Partial evaluation flags for loading (all fields optional)
 */
export type PartialEvaluationFlags = Partial<EvaluationFlags>;

// ============================================================
// Zod Schemas for Validation
// ============================================================

const cohortParametersSchema = z
  .object({
    keywordMatchThreshold: z.number().min(0).max(1).optional(),
    embeddingModel: z.string().optional(),
    modelName: z.string().optional(),
    detailedScoring: z.boolean().optional(),
    timeoutMs: z.number().positive().optional(),
  })
  .optional();

const cohortConfigSchema: z.ZodType<CohortConfig> = z.object({
  evaluatorType: z.enum(['keyword', 'semantic', 'llm']),
  parameters: cohortParametersSchema,
  useTemplateEngine: z.boolean().optional(),
  autoExtractKeywords: z.boolean().optional(),
});

// Allow partial template engine config (merge with defaults later)
const templateEngineConfigSchema = z.object({
  allowConditionals: z.boolean().optional(),
  maxDepth: z.number().int().positive().max(10).optional(),
});

// Allow partial keyword extraction config (merge with defaults later)
const keywordExtractionDomainSchema = z.object({
  minLength: z.number().int().positive().optional(),
  maxKeywords: z.number().int().positive().optional(),
  useTfIdf: z.boolean().optional(),
});

const keywordExtractionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  domain: keywordExtractionDomainSchema.optional(),
});

// Allow partial top-level config (merge with defaults later)
const evaluationFlagsSchema = z.object({
  cohorts: z.record(z.string(), cohortConfigSchema).optional(),
  templateEngine: templateEngineConfigSchema.optional(),
  keywordExtraction: keywordExtractionConfigSchema.optional(),
  useNewEvaluatorEngine: z.boolean().optional(),
});

// Type inferred from Zod schema for loading (all fields optional)
type RawLoadedFlags = z.infer<typeof evaluationFlagsSchema>;

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_EVALUATION_FLAGS: EvaluationFlags = {
  cohorts: {},
  templateEngine: {
    allowConditionals: false,
    maxDepth: 5,
  },
  keywordExtraction: {
    enabled: true,
    domain: {
      minLength: 3,
      maxKeywords: 20,
      useTfIdf: false,
    },
  },
  useNewEvaluatorEngine: false,
};

// ============================================================
// Configuration Loading
// ============================================================

/**
 * Load evaluation flags from environment variable
 *
 * @returns Parsed flags from ENV or null if not set/invalid
 */
function loadFromEnvVar(): RawLoadedFlags | null {
  const envValue = process.env.EVALUATION_FLAGS;
  if (!envValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(envValue);
    const result = evaluationFlagsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn(
      'EVALUATION_FLAGS contains invalid configuration, using defaults:',
      result.error.issues,
    );
    return null;
  } catch {
    console.warn('EVALUATION_FLAGS is not valid JSON, using defaults');
    return null;
  }
}

/**
 * Load evaluation flags from config file
 *
 * @param configPath - Optional path to config file (defaults to config/evaluation-flags.json)
 * @returns Parsed flags from file or null if not found/invalid
 */
function loadFromConfigFile(configPath?: string): RawLoadedFlags | null {
  const defaultPath = resolve(process.cwd(), 'config', 'evaluation-flags.json');
  const filePath = configPath || defaultPath;

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = evaluationFlagsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn(
      `${filePath} contains invalid configuration, using defaults:`,
      result.error.issues,
    );
    return null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`${filePath} is not valid JSON, using defaults`);
    } else {
      console.warn(`Failed to read ${filePath}:`, error);
    }
    return null;
  }
}

/**
 * Merge loaded configuration with defaults
 * Environment variables take precedence over config file
 *
 * @param fromEnv - Flags loaded from environment
 * @param fromFile - Flags loaded from config file
 * @returns Merged configuration with defaults applied
 */
function mergeWithDefaults(
  fromEnv: RawLoadedFlags | null,
  fromFile: RawLoadedFlags | null,
): EvaluationFlags {
  // Determine base defaults based on environment
  const baseDefaults: EvaluationFlags = {
    ...DEFAULT_EVALUATION_FLAGS,
    // In staging, default to new engine enabled
    useNewEvaluatorEngine:
      process.env.NODE_ENV === 'staging' ? true : DEFAULT_EVALUATION_FLAGS.useNewEvaluatorEngine,
  };

  // Start with defaults
  let merged: EvaluationFlags = { ...baseDefaults };

  // Apply file config if available
  if (fromFile) {
    merged = {
      ...merged,
      cohorts: { ...baseDefaults.cohorts, ...(fromFile.cohorts ?? {}) },
      templateEngine: { ...baseDefaults.templateEngine, ...(fromFile.templateEngine ?? {}) },
      keywordExtraction: {
        ...baseDefaults.keywordExtraction,
        ...(fromFile.keywordExtraction ?? {}),
      },
      useNewEvaluatorEngine:
        fromFile.useNewEvaluatorEngine !== undefined
          ? fromFile.useNewEvaluatorEngine
          : merged.useNewEvaluatorEngine,
    };
  }

  // Apply env config if available (highest priority)
  if (fromEnv) {
    merged = {
      ...merged,
      cohorts: { ...merged.cohorts, ...(fromEnv.cohorts ?? {}) },
      templateEngine: { ...merged.templateEngine, ...(fromEnv.templateEngine ?? {}) },
      keywordExtraction: {
        ...merged.keywordExtraction,
        ...(fromEnv.keywordExtraction ?? {}),
      },
      useNewEvaluatorEngine:
        fromEnv.useNewEvaluatorEngine !== undefined
          ? fromEnv.useNewEvaluatorEngine
          : merged.useNewEvaluatorEngine,
    };
  }

  return merged;
}

// ============================================================
// Feature Flag Service
// ============================================================

/**
 * Service for accessing feature flags with cohort-based logic
 *
 * @example
 * ```typescript
 * import { featureFlagService } from '@/config';
 *
 * // Check if new engine should be used for a specific cohort
 * if (featureFlagService.shouldUseNewEngine('beta-users')) {
 *   // Use new evaluator
 * }
 *
 * // Check if conditional templates are enabled
 * if (featureFlagService.isConditionalTemplatesEnabled()) {
 *   // Apply template preprocessing
 * }
 * ```
 */
export class FeatureFlagService {
  private readonly flags: EvaluationFlags;

  constructor(flags: EvaluationFlags) {
    this.flags = flags;
  }

  /**
   * Get the full configuration object
   */
  getConfig(): EvaluationFlags {
    return { ...this.flags };
  }

  /**
   * Get configuration for a specific cohort
   *
   * @param cohort - The cohort name to look up
   * @returns Cohort configuration or null if not defined
   */
  getCohortConfig(cohort: string): CohortConfig | null {
    return this.flags.cohorts[cohort] ?? null;
  }

  /**
   * Determine if the new evaluator engine should be used
   * Combines the global flag with cohort-specific settings
   *
   * @param cohort - Optional cohort name to check
   * @returns true if new engine should be used
   */
  shouldUseNewEngine(cohort?: string): boolean {
    // Check global flag first
    if (this.flags.useNewEvaluatorEngine) {
      return true;
    }

    // Check cohort-specific setting
    if (cohort) {
      const cohortConfig = this.getCohortConfig(cohort);
      if (cohortConfig?.evaluatorType === 'llm') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if conditional templates are enabled
   * Conditional templates should be disabled until TemplatePreprocessor is fully integrated
   *
   * @returns true if conditionals are allowed
   */
  isConditionalTemplatesEnabled(): boolean {
    return this.flags.templateEngine.allowConditionals;
  }

  /**
   * Check if keyword extraction is enabled
   * When enabled, keywords are automatically extracted if not provided
   *
   * @returns true if keyword extraction is enabled
   */
  isKeywordExtractionEnabled(): boolean {
    return this.flags.keywordExtraction.enabled;
  }

  /**
   * Get the maximum template depth
   *
   * @returns Maximum nesting depth for template processing
   */
  getMaxTemplateDepth(): number {
    return this.flags.templateEngine.maxDepth;
  }

  /**
   * Get keyword extraction configuration
   *
   * @returns Keyword extraction config or null if disabled
   */
  getKeywordExtractionConfig(): KeywordExtractionConfig | null {
    if (!this.flags.keywordExtraction.enabled) {
      return null;
    }
    // Deep copy to prevent mutation
    return JSON.parse(JSON.stringify(this.flags.keywordExtraction));
  }

  /**
   * Check if a cohort has template engine enabled
   *
   * @param cohort - The cohort name
   * @returns true if cohort has template engine enabled
   */
  isTemplateEngineEnabledForCohort(cohort: string): boolean {
    const config = this.getCohortConfig(cohort);
    return config?.useTemplateEngine ?? false;
  }

  /**
   * Get all defined cohorts
   *
   * @returns Array of cohort names
   */
  getCohorts(): string[] {
    return Object.keys(this.flags.cohorts);
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let _featureFlagService: FeatureFlagService | null = null;

/**
 * Get the singleton FeatureFlagService instance
 * Configuration is loaded once and cached
 *
 * @param configPath - Optional path to config file
 * @returns The feature flag service instance
 */
export function getFeatureFlagService(configPath?: string): FeatureFlagService {
  if (!_featureFlagService) {
    const fromEnv = loadFromEnvVar();
    const fromFile = loadFromConfigFile(configPath);
    const merged = mergeWithDefaults(fromEnv, fromFile);
    _featureFlagService = new FeatureFlagService(merged);
  }
  return _featureFlagService;
}

/**
 * Reset the singleton instance
 * Useful for testing or when configuration needs to be reloaded
 */
export function resetFeatureFlagService(): void {
  _featureFlagService = null;
}

/**
 * Create a FeatureFlagService with explicit configuration
 * Bypasses the singleton and loading mechanism
 *
 * @param flags - Explicit configuration to use
 * @returns New FeatureFlagService instance
 */
export function createFeatureFlagService(flags: EvaluationFlags): FeatureFlagService {
  return new FeatureFlagService(flags);
}

// Named export for convenience
export const featureFlagService = {
  get instance() {
    return getFeatureFlagService();
  },
};
