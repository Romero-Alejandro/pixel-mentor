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

import type { FeatureFlagService } from '@/config/evaluation-flags.js';

// ============================================================
// Banner Logging
// ============================================================

/**
 * Log the new evaluator engine activation banner
 */
export function logNewEvaluatorEngineBanner(): void {
  const isEnabled =
    process.env.USE_NEW_EVALUATOR_ENGINE === 'true' || process.env.USE_NEW_EVALUATOR_ENGINE === '1';

  if (isEnabled) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀 NEW EVALUATOR ENGINE ACTIVE                                  ║
║                                                                   ║
║   The new LessonEvaluatorUseCase is enabled for evaluation.        ║
║   All metrics are being collected for monitoring.                  ║
║                                                                   ║
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
  if (process.env.NODE_ENV === 'staging') {
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is not set in staging');
    }

    if (
      !process.env.GEMINI_API_KEY &&
      !process.env.OPENROUTER_API_KEY &&
      !process.env.GROQ_API_KEY
    ) {
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
  console.log('\n📊 Evaluation Engine Configuration Summary');
  console.log('─'.repeat(60));

  // Environment info
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`USE_NEW_EVALUATOR_ENGINE: ${process.env.USE_NEW_EVALUATOR_ENGINE || '(not set)'}`);

  // Feature flag info
  if (featureFlagService) {
    const config = featureFlagService.getConfig();
    console.log(`\nFeature Flags:`);
    console.log(
      `  Global New Engine: ${config.useNewEvaluatorEngine ? '✅ Enabled' : '❌ Disabled'}`,
    );

    const cohorts = featureFlagService.getCohorts();
    if (cohorts.length > 0) {
      console.log(`  Configured Cohorts: ${cohorts.length}`);
      for (const cohort of cohorts) {
        const cohortConfig = featureFlagService.getCohortConfig(cohort);
        if (cohortConfig) {
          console.log(`    - ${cohort}: ${cohortConfig.evaluatorType}`);
        }
      }
    } else {
      console.log(`  Configured Cohorts: 0`);
    }

    // Cohort-specific new engine settings
    const cohortsWithNewEngine = cohorts.filter((c) => featureFlagService.shouldUseNewEngine(c));
    if (cohortsWithNewEngine.length > 0) {
      console.log(`  Cohorts using new engine: ${cohortsWithNewEngine.join(', ')}`);
    }
  } else {
    console.log(`\nFeature Flags: Not initialized`);
  }

  // LLM Configuration
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  console.log(`\nLLM Configuration:`);
  console.log(`  Gemini: ${hasGemini ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  OpenRouter: ${hasOpenRouter ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Groq: ${hasGroq ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Provider: ${process.env.LLM_PROVIDER || 'gemini'}`);

  // Database
  console.log(`\nDatabase:`);
  console.log(`  URL: ${process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured'}`);

  console.log('─'.repeat(60));
  console.log('');
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
    console.error('\n❌ Staging Validation Failed:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.warn('\n⚠️ Staging Validation Warnings:');
    for (const warning of validation.warnings) {
      console.warn(`  - ${warning}`);
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
    process.env.USE_NEW_EVALUATOR_ENGINE === 'true' ||
    process.env.USE_NEW_EVALUATOR_ENGINE === '1' ||
    (featureFlagService?.getConfig().useNewEvaluatorEngine ?? false);

  const configuredCohorts = featureFlagService?.getCohorts() ?? [];

  // Check for potential issues
  if (process.env.NODE_ENV === 'production' && useNewEngine) {
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
