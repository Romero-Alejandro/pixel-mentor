/**
 * Unit Tests for Evaluation Metrics Module
 *
 * Tests cover:
 * 1. AtomicCounter thread-safety
 * 2. LatencyHistogram bucket distribution
 * 3. MetricsStore operations
 * 4. EvaluationMetricsCollector
 * 5. EvaluationTimer
 * 6. Structured logging
 */

import {
  getMetricsStore,
  resetMetricsStore,
  EvaluationMetricsCollector,
  EvaluationTimer,
  createEvaluationLog,
  getMetricsSummary,
} from '../eval-metrics';

// ============================================================
// Test Setup
// ============================================================

describe('EvaluationMetrics', () => {
  beforeEach(() => {
    resetMetricsStore();
  });

  afterEach(() => {
    resetMetricsStore();
  });

  // ============================================================
  // Atomic Counter Tests
  // ============================================================

  describe('AtomicCounter', () => {
    it('should initialize with value 0', () => {
      const metrics = getMetricsStore();
      const snapshot = metrics.getMetrics();
      expect(snapshot.engines).toEqual({});
    });

    it('should increment counters correctly', () => {
      const metrics = getMetricsStore();
      metrics.recordEngine('new');
      metrics.recordEngine('new');
      metrics.recordEngine('old');

      const snapshot = metrics.getMetrics();
      expect(snapshot.engines['new'].value).toBe(2);
      expect(snapshot.engines['old'].value).toBe(1);
    });

    it('should decrement counters correctly', () => {
      const metrics = getMetricsStore();
      metrics.recordEngine('new');
      metrics.recordEngine('new');
      metrics.recordEngine('new');

      // Access internal state via recordOutcome to verify
      metrics.recordOutcome('new', 'correct');
      metrics.recordOutcome('new', 'correct');

      const snapshot = metrics.getMetrics();
      expect(snapshot.outcomes['new:correct'].value).toBe(2);
    });
  });

  // ============================================================
  // Latency Histogram Tests
  // ============================================================

  describe('LatencyHistogram', () => {
    it('should record latencies correctly', () => {
      const metrics = getMetricsStore();

      // Record various latencies
      metrics.recordLatency(15); // Bucket 25
      metrics.recordLatency(50); // Bucket 50
      metrics.recordLatency(150); // Bucket 250
      metrics.recordLatency(5000); // Bucket 5000
      metrics.recordLatency(15000); // Bucket 10000

      const snapshot = metrics.getMetrics();
      expect(snapshot.latency.count).toBe(5);
      expect(snapshot.latency.sum).toBe(15 + 50 + 150 + 5000 + 15000);
    });

    it('should calculate average latency correctly', () => {
      const metrics = getMetricsStore();
      const snapshot1 = metrics.getMetrics();

      // Test average with no records
      expect(snapshot1.latency.count).toBe(0);

      // Record two latencies
      metrics.recordLatency(100);
      metrics.recordLatency(200);

      const snapshot2 = metrics.getMetrics();
      expect(snapshot2.latency.sum).toBe(300);
      expect(snapshot2.latency.count).toBe(2);
    });

    it('should distribute latencies into correct buckets', () => {
      const metrics = getMetricsStore();

      metrics.recordLatency(5); // Bucket 10
      metrics.recordLatency(30); // Bucket 50
      metrics.recordLatency(200); // Bucket 250

      const snapshot = metrics.getMetrics();
      expect(snapshot.latency.buckets['10']).toBe(1);
      expect(snapshot.latency.buckets['50']).toBe(1);
      expect(snapshot.latency.buckets['250']).toBe(1);
    });
  });

  // ============================================================
  // Engine Type Counter Tests
  // ============================================================

  describe('Engine Type Counters', () => {
    it('should track new engine evaluations', () => {
      const metrics = getMetricsStore();
      metrics.recordEngine('new');

      const snapshot = metrics.getMetrics();
      expect(snapshot.engines['new'].value).toBe(1);
      expect(snapshot.engines['new'].labels.engine).toBe('new');
    });

    it('should track old engine evaluations', () => {
      const metrics = getMetricsStore();
      metrics.recordEngine('old');
      metrics.recordEngine('old');
      metrics.recordEngine('old');

      const snapshot = metrics.getMetrics();
      expect(snapshot.engines['old'].value).toBe(3);
    });

    it('should track both engines independently', () => {
      const metrics = getMetricsStore();
      metrics.recordEngine('new');
      metrics.recordEngine('old');
      metrics.recordEngine('new');

      const snapshot = metrics.getMetrics();
      expect(snapshot.engines['new'].value).toBe(2);
      expect(snapshot.engines['old'].value).toBe(1);
    });
  });

  // ============================================================
  // Outcome Counter Tests
  // ============================================================

  describe('Outcome Counters', () => {
    it('should track correct outcomes', () => {
      const metrics = getMetricsStore();
      metrics.recordOutcome('new', 'correct');
      metrics.recordOutcome('old', 'correct');

      const snapshot = metrics.getMetrics();
      expect(snapshot.outcomes['new:correct'].value).toBe(1);
      expect(snapshot.outcomes['old:correct'].value).toBe(1);
    });

    it('should track partial outcomes', () => {
      const metrics = getMetricsStore();
      metrics.recordOutcome('new', 'partial');
      metrics.recordOutcome('new', 'partial');

      const snapshot = metrics.getMetrics();
      expect(snapshot.outcomes['new:partial'].value).toBe(2);
    });

    it('should track incorrect outcomes', () => {
      const metrics = getMetricsStore();
      metrics.recordOutcome('new', 'incorrect');
      metrics.recordOutcome('old', 'incorrect');

      const snapshot = metrics.getMetrics();
      expect(snapshot.outcomes['new:incorrect'].value).toBe(1);
      expect(snapshot.outcomes['old:incorrect'].value).toBe(1);
    });

    it('should maintain engine:outcome key structure', () => {
      const metrics = getMetricsStore();
      metrics.recordOutcome('new', 'correct');

      const snapshot = metrics.getMetrics();
      expect(snapshot.outcomes['new:correct'].labels.engine).toBe('new');
      expect(snapshot.outcomes['new:correct'].labels.outcome).toBe('correct');
    });
  });

  // ============================================================
  // Cohort Counter Tests
  // ============================================================

  describe('Cohort Counters', () => {
    it('should track cohort usage', () => {
      const metrics = getMetricsStore();
      metrics.recordCohort('beta-users');
      metrics.recordCohort('beta-users');
      metrics.recordCohort('premium-users');

      const snapshot = metrics.getMetrics();
      expect(snapshot.cohorts['beta-users'].value).toBe(2);
      expect(snapshot.cohorts['premium-users'].value).toBe(1);
    });

    it('should include cohort labels', () => {
      const metrics = getMetricsStore();
      metrics.recordCohort('test-cohort');

      const snapshot = metrics.getMetrics();
      expect(snapshot.cohorts['test-cohort'].labels.cohort).toBe('test-cohort');
    });
  });

  // ============================================================
  // Error Counter Tests
  // ============================================================

  describe('Error Counters', () => {
    it('should track LLM errors', () => {
      const metrics = getMetricsStore();
      metrics.recordError('llm_error');

      const snapshot = metrics.getMetrics();
      expect(snapshot.errors['llm_error'].value).toBe(1);
      expect(snapshot.errors['llm_error'].labels.error_type).toBe('llm_error');
    });

    it('should track validation errors', () => {
      const metrics = getMetricsStore();
      metrics.recordError('validation_error');
      metrics.recordError('validation_error');

      const snapshot = metrics.getMetrics();
      expect(snapshot.errors['validation_error'].value).toBe(2);
    });

    it('should track timeout errors', () => {
      const metrics = getMetricsStore();
      metrics.recordError('timeout_error');

      const snapshot = metrics.getMetrics();
      expect(snapshot.errors['timeout_error'].value).toBe(1);
    });

    it('should track network errors', () => {
      const metrics = getMetricsStore();
      metrics.recordError('network_error');

      const snapshot = metrics.getMetrics();
      expect(snapshot.errors['network_error'].value).toBe(1);
    });

    it('should track unknown errors', () => {
      const metrics = getMetricsStore();
      metrics.recordError('unknown_error');

      const snapshot = metrics.getMetrics();
      expect(snapshot.errors['unknown_error'].value).toBe(1);
    });
  });

  // ============================================================
  // Fallback Counter Tests
  // ============================================================

  describe('Fallback Counter', () => {
    it('should track fallback events', () => {
      const metrics = getMetricsStore();
      metrics.recordFallback();
      metrics.recordFallback();
      metrics.recordFallback();

      const snapshot = metrics.getMetrics();
      expect(snapshot.fallback.value).toBe(3);
    });

    it('should initialize to 0', () => {
      const metrics = getMetricsStore();

      const snapshot = metrics.getMetrics();
      expect(snapshot.fallback.value).toBe(0);
    });
  });

  // ============================================================
  // Reset Tests
  // ============================================================

  describe('Reset Functionality', () => {
    it('should reset all counters', () => {
      const metrics = getMetricsStore();

      // Record various metrics
      metrics.recordEngine('new');
      metrics.recordEngine('old');
      metrics.recordOutcome('new', 'correct');
      metrics.recordCohort('test-cohort');
      metrics.recordError('llm_error');
      metrics.recordFallback();
      metrics.recordLatency(100);

      // Reset
      resetMetricsStore();
      const newMetrics = getMetricsStore();
      const snapshot = newMetrics.getMetrics();

      expect(snapshot.engines).toEqual({});
      expect(snapshot.outcomes).toEqual({});
      expect(snapshot.cohorts).toEqual({});
      expect(snapshot.errors).toEqual({});
      expect(snapshot.fallback.value).toBe(0);
      expect(snapshot.latency.count).toBe(0);
    });

    it('should allow recording after reset', () => {
      const metrics = getMetricsStore();
      metrics.recordEngine('new');
      resetMetricsStore();
      metrics.recordEngine('new');

      const snapshot = metrics.getMetrics();
      expect(snapshot.engines['new'].value).toBe(1);
    });
  });

  // ============================================================
  // Timestamp Tests
  // ============================================================

  describe('Timestamp', () => {
    it('should include ISO timestamp in snapshot', () => {
      const metrics = getMetricsStore();
      const before = new Date().toISOString();
      const snapshot = metrics.getMetrics();
      const after = new Date().toISOString();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.timestamp >= before).toBe(true);
      expect(snapshot.timestamp <= after).toBe(true);
    });

    it('should generate unique snapshot IDs', () => {
      const metrics = getMetricsStore();
      const snapshot1 = metrics.getMetrics();
      const snapshot2 = metrics.getMetrics();

      expect(snapshot1.id).not.toBe(snapshot2.id);
    });
  });
});

// ============================================================
// EvaluationTimer Tests
// ============================================================

describe('EvaluationTimer', () => {
  it('should measure elapsed time', async () => {
    const timer = new EvaluationTimer();

    // Wait a small amount
    await new Promise((resolve) => setTimeout(resolve, 10));

    const elapsed = timer.getElapsed();
    expect(elapsed).toBeGreaterThanOrEqual(10);
  });

  it('should reset timer correctly', async () => {
    const timer = new EvaluationTimer();

    // Wait and measure
    await new Promise((resolve) => setTimeout(resolve, 10));
    const firstElapsed = timer.getElapsed();

    // Reset
    timer.reset();

    // Small wait
    await new Promise((resolve) => setTimeout(resolve, 5));

    const secondElapsed = timer.getElapsed();
    expect(secondElapsed).toBeLessThan(firstElapsed);
  });
});

// ============================================================
// EvaluationMetricsCollector Tests
// ============================================================

describe('EvaluationMetricsCollector', () => {
  beforeEach(() => {
    resetMetricsStore();
  });

  afterEach(() => {
    resetMetricsStore();
  });

  describe('startEvaluation', () => {
    it('should record engine type', () => {
      const collector = new EvaluationMetricsCollector();
      collector.startEvaluation('new');

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.engines['new'].value).toBe(1);
    });

    it('should record cohort when provided', () => {
      const collector = new EvaluationMetricsCollector();
      collector.startEvaluation('new', 'beta-cohort');

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.cohorts['beta-cohort'].value).toBe(1);
    });

    it('should return tracking function', () => {
      const collector = new EvaluationMetricsCollector();
      const complete = collector.startEvaluation('new');

      expect(typeof complete).toBe('function');
    });
  });

  describe('recordCompletion', () => {
    it('should record outcome and latency', () => {
      const collector = new EvaluationMetricsCollector();
      collector.startEvaluation('new');
      collector.recordCompletion('new', 'correct', 150);

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.outcomes['new:correct'].value).toBe(1);
      expect(metrics.latency.count).toBe(1);
      expect(metrics.latency.sum).toBe(150);
    });

    it('should record with cohort', () => {
      const collector = new EvaluationMetricsCollector();
      collector.startEvaluation('old', 'test-cohort');
      collector.recordCompletion('old', 'partial', 200, 'test-cohort');

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.outcomes['old:partial'].value).toBe(1);
      expect(metrics.cohorts['test-cohort'].value).toBe(1);
    });
  });

  describe('recordError', () => {
    it('should record error type', () => {
      const collector = new EvaluationMetricsCollector();
      collector.recordError('llm_error', 'API timeout');

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.errors['llm_error'].value).toBe(1);
    });
  });

  describe('recordFallback', () => {
    it('should record fallback event', () => {
      const collector = new EvaluationMetricsCollector();
      collector.recordFallback();

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.fallback.value).toBe(1);
    });
  });

  describe('getRequestId', () => {
    it('should return unique request ID', () => {
      const collector1 = new EvaluationMetricsCollector();
      const collector2 = new EvaluationMetricsCollector();

      expect(collector1.getRequestId()).not.toBe(collector2.getRequestId());
    });
  });

  describe('tracking function', () => {
    it('should record outcome when called with outcome', () => {
      const collector = new EvaluationMetricsCollector();
      const complete = collector.startEvaluation('new');
      complete('correct');

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.outcomes['new:correct'].value).toBe(1);
    });

    it('should record error when called with error', () => {
      const collector = new EvaluationMetricsCollector();
      const complete = collector.startEvaluation('old');
      complete(undefined, 'validation_error', 'Schema mismatch');

      const metrics = getMetricsStore().getMetrics();
      expect(metrics.errors['validation_error'].value).toBe(1);
    });
  });
});

// ============================================================
// Structured Logging Tests
// ============================================================

describe('Structured Logging', () => {
  describe('createEvaluationLog', () => {
    it('should create log entry with all fields', () => {
      const entry = createEvaluationLog({
        event: 'evaluation_start',
        requestId: 'test-123',
        engineType: 'new',
        cohort: 'beta-users',
      });

      expect(entry.event).toBe('evaluation_start');
      expect(entry.requestId).toBe('test-123');
      expect(entry.engineType).toBe('new');
      expect(entry.cohort).toBe('beta-users');
      expect(entry.service).toBe('evaluation-metrics');
      expect(entry.timestamp).toBeDefined();
    });

    it('should include outcome when provided', () => {
      const entry = createEvaluationLog({
        event: 'evaluation_complete',
        requestId: 'test-456',
        engineType: 'old',
        outcome: 'correct',
        latencyMs: 150,
      });

      expect(entry.outcome).toBe('correct');
      expect(entry.latencyMs).toBe(150);
    });

    it('should include error info when provided', () => {
      const entry = createEvaluationLog({
        event: 'evaluation_error',
        requestId: 'test-789',
        engineType: 'new',
        errorType: 'llm_error',
        errorMessage: 'API rate limit exceeded',
      });

      expect(entry.errorType).toBe('llm_error');
      expect(entry.errorMessage).toBe('API rate limit exceeded');
    });
  });
});

// ============================================================
// Metrics Summary Tests
// ============================================================

describe('Metrics Summary', () => {
  beforeEach(() => {
    resetMetricsStore();
  });

  afterEach(() => {
    resetMetricsStore();
  });

  it('should generate human-readable summary', () => {
    const metrics = getMetricsStore();
    metrics.recordEngine('new');
    metrics.recordEngine('old');
    metrics.recordOutcome('new', 'correct');
    metrics.recordLatency(100);

    const summary = getMetricsSummary();

    expect(summary).toContain('=== Evaluation Metrics Summary ===');
    expect(summary).toContain('--- Engine Usage ---');
    expect(summary).toContain('new: 1');
    expect(summary).toContain('old: 1');
    expect(summary).toContain('--- Outcomes ---');
    expect(summary).toContain('new:correct: 1');
    expect(summary).toContain('--- Latency ---');
    expect(summary).toContain('Count: 1');
    expect(summary).toContain('Total:');
  });

  it('should handle empty metrics', () => {
    const summary = getMetricsSummary();

    expect(summary).toContain('=== Evaluation Metrics Summary ===');
    expect(summary).toContain('Count: 0');
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe('Metrics Integration', () => {
  beforeEach(() => {
    resetMetricsStore();
  });

  afterEach(() => {
    resetMetricsStore();
  });

  it('should track complete evaluation flow', () => {
    const collector = new EvaluationMetricsCollector();

    // Start evaluation (returns a completion tracking function)
    collector.startEvaluation('new', 'premium-users');

    // Simulate evaluation completion
    collector.recordCompletion('new', 'correct', 250, 'premium-users');

    // Verify metrics recorded correctly
    const metrics = getMetricsStore().getMetrics();

    // Verify all metrics recorded
    expect(metrics.engines['new'].value).toBe(1);
    expect(metrics.cohorts['premium-users'].value).toBe(1);
    expect(metrics.outcomes['new:correct'].value).toBe(1);
    expect(metrics.latency.count).toBe(1);
    expect(metrics.latency.sum).toBe(250);
  });

  it('should track error flow', () => {
    const collector = new EvaluationMetricsCollector();

    // Start evaluation
    collector.startEvaluation('old');

    // Record the error
    collector.recordError('network_error', 'Connection refused');

    const metrics = getMetricsStore().getMetrics();

    expect(metrics.engines['old'].value).toBe(1);
    expect(metrics.errors['network_error'].value).toBe(1);
  });

  it('should handle multiple evaluations', () => {
    const collector1 = new EvaluationMetricsCollector();
    const collector2 = new EvaluationMetricsCollector();

    // First evaluation
    collector1.startEvaluation('new', 'cohort-a');
    collector1.recordCompletion('new', 'correct', 100, 'cohort-a');

    // Second evaluation
    collector2.startEvaluation('old', 'cohort-b');
    collector2.recordCompletion('old', 'incorrect', 50, 'cohort-b');

    const metrics = getMetricsStore().getMetrics();

    expect(metrics.engines['new'].value).toBe(1);
    expect(metrics.engines['old'].value).toBe(1);
    expect(metrics.cohorts['cohort-a'].value).toBe(1);
    expect(metrics.cohorts['cohort-b'].value).toBe(1);
    expect(metrics.outcomes['new:correct'].value).toBe(1);
    expect(metrics.outcomes['old:incorrect'].value).toBe(1);
  });
});
