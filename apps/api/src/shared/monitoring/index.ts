/**
 * Monitoring Module
 *
 * Exports all monitoring-related components for evaluation metrics,
 * staging validation, and observability.
 */

export {
  // Core metrics
  getMetricsStore,
  resetMetricsStore,
  EvaluationMetricsCollector,
  EvaluationTimer,

  // Types
  type EngineType,
  type EvaluationOutcome,
  type EvaluationErrorType,
  type EvaluationLogEntry,
  type EvaluationMetricsSnapshot,
  type MetricCounter,
  type MetricHistogram,
  type MetricGauge,

  // Logging
  createEvaluationLog,
  logEvaluationEvent,
  getMetricsSummary,
} from '@/shared/monitoring/eval-metrics.js';

export { createMetricsRouter } from '@/shared/monitoring/routes/eval-metrics.route.js';

export {
  // Staging validation
  logNewEvaluatorEngineBanner,
  validateDependencies,
  logConfigurationSummary,
  runStagingValidation,
  getEvaluationHealthCheck,
  type DependencyValidationResult,
  type EvaluationHealthCheck,
} from '@/shared/monitoring/staging-validation.js';
