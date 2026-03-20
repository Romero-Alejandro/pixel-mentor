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
} from './eval-metrics';

export { createMetricsRouter, type MetricsDependencies } from './routes/eval-metrics.route';

export {
  // Staging validation
  logNewEvaluatorEngineBanner,
  validateDependencies,
  logConfigurationSummary,
  runStagingValidation,
  getEvaluationHealthCheck,
  type DependencyValidationResult,
  type EvaluationHealthCheck,
} from './staging-validation';
