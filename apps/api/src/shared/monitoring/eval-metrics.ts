/**
 * Evaluation Metrics Module
 *
 * Provides comprehensive metrics tracking for the evaluation engine with:
 * - Thread-safe atomic counters
 * - Histogram for latency tracking
 * - Structured logging with consistent format
 * - Metrics export and reset capabilities
 *
 * @module eval-metrics
 */

import { createLogger } from '@/shared/logger/logger.js';
import { randomUUID } from 'node:crypto';

// Create a logger for metrics events
const metricsLogger = createLogger(undefined, { name: 'eval-metrics', level: 'info' });

// ============================================================
// Type Definitions
// ============================================================

/**
 * Engine type for evaluation routing
 */
export type EngineType = 'new' | 'old';

/**
 * Evaluation outcome classification
 */
export type EvaluationOutcome = 'correct' | 'partial' | 'incorrect';

/**
 * Error types for evaluation failures
 */
export type EvaluationErrorType =
  | 'llm_error'
  | 'validation_error'
  | 'timeout_error'
  | 'network_error'
  | 'unknown_error';

/**
 * Latency histogram bucket boundaries (in milliseconds)
 */
const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;

/**
 * Metric record structure for serialization
 */
export interface MetricCounter {
  value: number;
  labels: Record<string, string>;
}

export interface MetricHistogram {
  count: number;
  sum: number;
  buckets: Record<number, number>;
}

export interface MetricGauge {
  value: number;
  labels: Record<string, string>;
}

// ============================================================
// Atomic Counter Implementation
// ============================================================

/**
 * Thread-safe atomic counter using atomic operations.
 * In Node.js single-threaded environment, this provides
 * safe increment/decrement operations.
 */
class AtomicCounter {
  private _value = 0;

  get value(): number {
    return this._value;
  }

  increment(delta = 1): number {
    this._value += delta;
    return this._value;
  }

  decrement(delta = 1): number {
    this._value -= delta;
    return this._value;
  }

  reset(): void {
    this._value = 0;
  }
}

// ============================================================
// Histogram Implementation
// ============================================================

/**
 * Histogram for tracking latency distributions.
 * Uses fixed buckets for consistent metric aggregation.
 */
class LatencyHistogram {
  private buckets: Map<number, number> = new Map();
  private count = 0;
  private sum = 0;

  constructor() {
    // Initialize all buckets to 0
    for (const bucket of LATENCY_BUCKETS) {
      this.buckets.set(bucket, 0);
    }
  }

  /**
   * Record a latency observation
   */
  record(value: number): void {
    this.count++;
    this.sum += value;

    // Find the appropriate bucket (first bucket where value <= bucket)
    for (const bucket of LATENCY_BUCKETS) {
      if (value <= bucket) {
        this.buckets.set(bucket, (this.buckets.get(bucket) ?? 0) + 1);
        break;
      }
    }

    // If value exceeds largest bucket, count in last bucket
    if (value > LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1]) {
      this.buckets.set(
        LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1],
        (this.buckets.get(LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1]) ?? 0) + 1,
      );
    }
  }

  /**
   * Get histogram metrics
   */
  getMetrics(): MetricHistogram {
    const bucketObj: Record<number, number> = {};
    for (const [bucket, count] of this.buckets) {
      bucketObj[bucket] = count;
    }
    return {
      count: this.count,
      sum: this.sum,
      buckets: bucketObj,
    };
  }

  /**
   * Get average latency
   */
  getAverage(): number {
    if (this.count === 0) return 0;
    return this.sum / this.count;
  }

  /**
   * Reset histogram
   */
  reset(): void {
    this.count = 0;
    this.sum = 0;
    for (const bucket of LATENCY_BUCKETS) {
      this.buckets.set(bucket, 0);
    }
  }
}

// ============================================================
// Metrics Store
// ============================================================

/**
 * Centralized metrics store with thread-safe operations.
 * All counters and histograms are protected by atomic operations.
 */
class MetricsStore {
  // Engine type counters
  private engineCounters: Map<string, AtomicCounter> = new Map();

  // Outcome counters (keyed by engine_type:outcome)
  private outcomeCounters: Map<string, AtomicCounter> = new Map();

  // Cohort usage counters
  private cohortCounters: Map<string, AtomicCounter> = new Map();

  // Error counters (keyed by error_type)
  private errorCounters: Map<string, AtomicCounter> = new Map();

  // Fallback counter
  private fallbackCounter = new AtomicCounter();

  // Latency histogram
  private latencyHistogram = new LatencyHistogram();

  /**
   * Get or create a counter for the given key
   */
  private getCounter(map: Map<string, AtomicCounter>, key: string): AtomicCounter {
    let counter = map.get(key);
    if (!counter) {
      counter = new AtomicCounter();
      map.set(key, counter);
    }
    return counter;
  }

  /**
   * Record an evaluation with engine type
   */
  recordEngine(engineType: EngineType): void {
    const counter = this.getCounter(this.engineCounters, engineType);
    counter.increment();
  }

  /**
   * Record an evaluation outcome
   */
  recordOutcome(engineType: EngineType, outcome: EvaluationOutcome): void {
    const key = `${engineType}:${outcome}`;
    const counter = this.getCounter(this.outcomeCounters, key);
    counter.increment();
  }

  /**
   * Record cohort usage
   */
  recordCohort(cohort: string): void {
    const counter = this.getCounter(this.cohortCounters, cohort);
    counter.increment();
  }

  /**
   * Record an error
   */
  recordError(errorType: EvaluationErrorType): void {
    const counter = this.getCounter(this.errorCounters, errorType);
    counter.increment();
  }

  /**
   * Record a fallback
   */
  recordFallback(): void {
    this.fallbackCounter.increment();
  }

  /**
   * Record latency
   */
  recordLatency(latencyMs: number): void {
    this.latencyHistogram.record(latencyMs);
  }

  /**
   * Get all metrics as a structured object
   */
  getMetrics(): EvaluationMetricsSnapshot {
    const engines: Record<string, MetricCounter> = {};
    for (const [key, counter] of this.engineCounters) {
      engines[key] = { value: counter.value, labels: { engine: key } };
    }

    const outcomes: Record<string, MetricCounter> = {};
    for (const [key, counter] of this.outcomeCounters) {
      const [engine, outcome] = key.split(':');
      outcomes[key] = { value: counter.value, labels: { engine, outcome } };
    }

    const cohorts: Record<string, MetricCounter> = {};
    for (const [key, counter] of this.cohortCounters) {
      cohorts[key] = { value: counter.value, labels: { cohort: key } };
    }

    const errors: Record<string, MetricCounter> = {};
    for (const [key, counter] of this.errorCounters) {
      errors[key] = { value: counter.value, labels: { error_type: key } };
    }

    return {
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      engines,
      outcomes,
      cohorts,
      errors,
      fallback: { value: this.fallbackCounter.value, labels: {} },
      latency: this.latencyHistogram.getMetrics(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.engineCounters.clear();
    this.outcomeCounters.clear();
    this.cohortCounters.clear();
    this.errorCounters.clear();
    this.fallbackCounter.reset();
    this.latencyHistogram.reset();
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let _metricsStore: MetricsStore | null = null;

/**
 * Get the singleton metrics store instance
 */
export function getMetricsStore(): MetricsStore {
  if (!_metricsStore) {
    _metricsStore = new MetricsStore();
  }
  return _metricsStore;
}

/**
 * Reset the metrics store (useful for testing)
 */
export function resetMetricsStore(): void {
  if (_metricsStore) {
    _metricsStore.reset();
  }
}

// ============================================================
// Structured Logging
// ============================================================

/**
 * Log format for evaluation events
 */
export interface EvaluationLogEntry {
  event: 'evaluation_start' | 'evaluation_complete' | 'evaluation_error' | 'fallback_triggered';
  requestId: string;
  engineType: EngineType;
  cohort?: string;
  outcome?: EvaluationOutcome;
  latencyMs?: number;
  errorType?: EvaluationErrorType;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a structured log entry for an evaluation event
 */
export function createEvaluationLog(entry: EvaluationLogEntry): Record<string, unknown> {
  return {
    ...entry,
    service: 'evaluation-metrics',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log an evaluation event with structured format
 */
export function logEvaluationEvent(entry: EvaluationLogEntry): void {
  const logEntry = createEvaluationLog(entry);
  metricsLogger.info(logEntry);
}

// ============================================================
// Metrics Collector
// ============================================================

/**
 * Metrics collector that wraps the metrics store with
 * convenience methods for recording evaluation events.
 */
export class EvaluationMetricsCollector {
  private store: MetricsStore;
  private requestId: string;

  constructor(store?: MetricsStore) {
    this.store = store ?? getMetricsStore();
    this.requestId = randomUUID();
  }

  /**
   * Start tracking an evaluation
   * @returns A function to call when evaluation completes with optional outcome or error info
   */
  startEvaluation(
    engineType: EngineType,
    cohort?: string,
  ): (outcome?: EvaluationOutcome, errorType?: EvaluationErrorType, errorMessage?: string) => void {
    // Record engine usage
    this.store.recordEngine(engineType);

    // Record cohort usage if provided
    if (cohort) {
      this.store.recordCohort(cohort);
    }

    logEvaluationEvent({
      event: 'evaluation_start',
      requestId: this.requestId,
      engineType,
      cohort,
    });

    // Return function to call when evaluation completes
    return (
      outcome?: EvaluationOutcome,
      errorType?: EvaluationErrorType,
      errorMessage?: string,
    ) => {
      if (errorType) {
        this.store.recordError(errorType);
        logEvaluationEvent({
          event: 'evaluation_error',
          requestId: this.requestId,
          engineType,
          cohort,
          errorType,
          errorMessage,
        });
      } else if (outcome) {
        this.store.recordOutcome(engineType, outcome);
        logEvaluationEvent({
          event: 'evaluation_complete',
          requestId: this.requestId,
          engineType,
          cohort,
          outcome,
        });
      }
    };
  }

  /**
   * Record evaluation completion
   */
  recordCompletion(
    engineType: EngineType,
    outcome: EvaluationOutcome,
    latencyMs: number,
    cohort?: string,
  ): void {
    this.store.recordOutcome(engineType, outcome);
    this.store.recordLatency(latencyMs);

    logEvaluationEvent({
      event: 'evaluation_complete',
      requestId: this.requestId,
      engineType,
      cohort,
      outcome,
      latencyMs,
    });
  }

  /**
   * Record evaluation error
   */
  recordError(errorType: EvaluationErrorType, errorMessage?: string): void {
    this.store.recordError(errorType);

    logEvaluationEvent({
      event: 'evaluation_error',
      requestId: this.requestId,
      engineType: 'old', // Default to old for errors during engine determination
      errorType,
      errorMessage,
    });
  }

  /**
   * Record a fallback event
   */
  recordFallback(): void {
    this.store.recordFallback();

    logEvaluationEvent({
      event: 'fallback_triggered',
      requestId: this.requestId,
      engineType: 'old',
    });
  }

  /**
   * Get current request ID
   */
  getRequestId(): string {
    return this.requestId;
  }
}

// ============================================================
// Timer Utility
// ============================================================

/**
 * Timer for measuring evaluation latency
 */
export class EvaluationTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = Date.now();
  }
}

// ============================================================
// Types for API Response
// ============================================================

/**
 * Snapshot of evaluation metrics at a point in time
 */
export interface EvaluationMetricsSnapshot {
  timestamp: string;
  id: string;
  engines: Record<string, MetricCounter>;
  outcomes: Record<string, MetricCounter>;
  cohorts: Record<string, MetricCounter>;
  errors: Record<string, MetricCounter>;
  fallback: MetricCounter;
  latency: MetricHistogram;
}

// ============================================================
// Metrics Summary (Human-Readable)
// ============================================================

/**
 * Get a human-readable summary of current metrics
 */
export function getMetricsSummary(): string {
  const metrics = getMetricsStore().getMetrics();

  const lines: string[] = [
    '=== Evaluation Metrics Summary ===',
    `Timestamp: ${metrics.timestamp}`,
    '',
    '--- Engine Usage ---',
  ];

  for (const [engine, counter] of Object.entries(metrics.engines)) {
    lines.push(`  ${engine}: ${counter.value}`);
  }

  lines.push('', '--- Outcomes ---');
  for (const [key, counter] of Object.entries(metrics.outcomes)) {
    lines.push(`  ${key}: ${counter.value}`);
  }

  lines.push('', '--- Cohorts ---');
  for (const [cohort, counter] of Object.entries(metrics.cohorts)) {
    lines.push(`  ${cohort}: ${counter.value}`);
  }

  lines.push('', '--- Errors ---');
  for (const [errorType, counter] of Object.entries(metrics.errors)) {
    lines.push(`  ${errorType}: ${counter.value}`);
  }

  lines.push('', `Fallbacks: ${metrics.fallback.value}`);
  lines.push('', '--- Latency ---');
  lines.push(`  Count: ${metrics.latency.count}`);
  lines.push(`  Total: ${metrics.latency.sum.toFixed(2)}ms`);
  if (metrics.latency.count > 0) {
    lines.push(`  Average: ${(metrics.latency.sum / metrics.latency.count).toFixed(2)}ms`);
  }

  return lines.join('\n');
}
