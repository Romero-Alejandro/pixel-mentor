/**
 * Staging Validation Module
 *
 * Provides staging-specific validation and configuration checks:
 * - Environment variable validation
 * - Dependency wiring verification
 * - Startup configuration summary logging
 *
 * @module staging-validation
 */

import { createLogger } from '@/shared/logger/logger.js';
import { config } from '@/shared/config/index.js';

import type { FeatureFlagService } from '@/shared/config/index.js';

// Create a logger for staging validation
const stagingLogger = createLogger(undefined, { name: 'staging-validation', level: 'info' });

// ============================================================
// Banner Logging
// ============================================================

/**
 * Log the new evaluator engine activation banner
 */
export function logNewEvaluatorEngineBanner(): void {
  const isEnabled = config.USE_NEW_EVALUATOR_ENGINE;

  if (isEnabled) {
    stagingLogger.info(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀 NEW EVALUATOR ENGINE ACTIVE                                  ║
║                                                                   ║
║   The new LessonEvaluatorUseCase is enabled for evaluation.        ║
║   All metrics are being collected for monitoring.                  ║
╚═══════════════════════════════════════════════════════════════════╝
`);
  }
}

// ============================================================
// Dependency Validation
// ============================================================

/**
 * Validation result for dependency checks
 */
export interface DependencyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that all required dependencies are correctly wired
 */
export function validateDependencies(
  featureFlagService?: FeatureFlagService,
): DependencyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check FeatureFlagService
  if (!featureFlagService) {
    warnings.push('FeatureFlagService not provided - cohort-based routing disabled');
  } else {
    // Validate feature flags configuration
    const cohorts = featureFlagService.getCohorts();
    if (cohorts.length > 0) {
      warnings.push(`Feature flags configured for cohorts: ${cohorts.join(', ')}`);
    }
  }

  // Check environment-specific validations
  if (config.NODE_ENV === 'staging') {
    if (!config.DATABASE_URL) {
      errors.push('DATABASE_URL is not set in staging');
    }

    if (!config.GEMINI_API_KEY && !config.OPENROUTER_API_KEY && !config.GROQ_API_KEY) {
      errors.push(
        'No LLM API key configured in staging (GEMINI_API_KEY, OPENROUTER_API_KEY, or GROQ_API_KEY)',
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// Configuration Summary
// ============================================================

/**
 * Log configuration summary at startup
 */
export function logConfigurationSummary(featureFlagService?: FeatureFlagService): void {
  stagingLogger.info('\n📊 Evaluation Engine Configuration Summary');
  stagingLogger.info('─'.repeat(60));

  // Environment info
  stagingLogger.info(`Environment: ${config.NODE_ENV}`);
  stagingLogger.info(
    `USE_NEW_EVALUATOR_ENGINE: ${config.USE_NEW_EVALUATOR_ENGINE ? 'enabled' : 'disabled'}`,
  );

  // Feature flag info
  if (featureFlagService) {
    const config = featureFlagService.getConfig();
    stagingLogger.info(`\nFeature Flags:`);
    stagingLogger.info(
      `  Global New Engine: ${config.useNewEvaluatorEngine ? '✅ Enabled' : '❌ Disabled'}`,
    );

    const cohorts = featureFlagService.getCohorts();
    if (cohorts.length > 0) {
      stagingLogger.info(`  Configured Cohorts: ${cohorts.length}`);
      for (const cohort of cohorts) {
        const cohortConfig = featureFlagService.getCohortConfig(cohort);
        if (cohortConfig) {
          stagingLogger.info(`    - ${cohort}: ${cohortConfig.evaluatorType}`);
        }
      }
    } else {
      stagingLogger.info(`  Configured Cohorts: 0`);
    }

    // Cohort-specific new engine settings
    const cohortsWithNewEngine = cohorts.filter((c) => featureFlagService.shouldUseNewEngine(c));
    if (cohortsWithNewEngine.length > 0) {
      stagingLogger.info(`  Cohorts using new engine: ${cohortsWithNewEngine.join(', ')}`);
    }
  } else {
    stagingLogger.info(`\nFeature Flags: Not initialized`);
  }

  // LLM Configuration
  const hasGemini = !!config.GEMINI_API_KEY;
  const hasOpenRouter = !!config.OPENROUTER_API_KEY;
  const hasGroq = !!config.GROQ_API_KEY;
  stagingLogger.info(`\nLLM Configuration:`);
  stagingLogger.info(`  Gemini: ${hasGemini ? '✅ Configured' : '❌ Not configured'}`);
  stagingLogger.info(`  OpenRouter: ${hasOpenRouter ? '✅ Configured' : '❌ Not configured'}`);
  stagingLogger.info(`  Groq: ${hasGroq ? '✅ Configured' : '❌ Not configured'}`);
  stagingLogger.info(`  Provider: ${config.LLM_PROVIDER}`);

  // Database
  stagingLogger.info(`\nDatabase:`);
  stagingLogger.info(`  URL: ${config.DATABASE_URL ? '✅ Configured' : '❌ Not configured'}`);

  stagingLogger.info('─'.repeat(60));
  stagingLogger.info('');
}

// ============================================================
// Startup Validation
// ============================================================

/**
 * Run all staging validations and log results
 * Returns true if validation passed
 */
export function runStagingValidation(featureFlagService?: FeatureFlagService): boolean {
  // Log banner if new engine is active
  logNewEvaluatorEngineBanner();

  // Validate dependencies
  const validation = validateDependencies(featureFlagService);

  if (!validation.valid) {
    stagingLogger.error('\n❌ Staging Validation Failed:');
    for (const error of validation.errors) {
      stagingLogger.error(`  - ${error}`);
    }
  }

  if (validation.warnings.length > 0) {
    stagingLogger.warn('\n⚠️ Staging Validation Warnings:');
    for (const warning of validation.warnings) {
      stagingLogger.warn(`  - ${warning}`);
    }
  }

  // Log configuration summary
  logConfigurationSummary(featureFlagService);

  return validation.valid;
}

// ============================================================
// Health Check Integration
// ============================================================

/**
 * Extended health check result including evaluation engine status
 */
export interface EvaluationHealthCheck {
  healthy: boolean;
  engineActive: boolean;
  useNewEngine: boolean;
  configuredCohorts: string[];
  warnings: string[];
}

/**
 * Perform health check on evaluation engine
 */
export function getEvaluationHealthCheck(
  featureFlagService?: FeatureFlagService,
): EvaluationHealthCheck {
  const warnings: string[] = [];

  // Determine if new engine is active
  const useNewEngine =
    config.USE_NEW_EVALUATOR_ENGINE ||
    (featureFlagService?.getConfig().useNewEvaluatorEngine ?? false);

  const configuredCohorts = featureFlagService?.getCohorts() ?? [];

  // Check for potential issues
  if (config.NODE_ENV === 'production' && useNewEngine) {
    warnings.push('New evaluator engine is active in production');
  }

  if (useNewEngine && configuredCohorts.length === 0) {
    warnings.push('New engine enabled globally without cohort configuration');
  }

  return {
    healthy: warnings.filter((w) => w.includes('production')).length === 0,
    engineActive: useNewEngine,
    useNewEngine,
    configuredCohorts,
    warnings,
  };
}
