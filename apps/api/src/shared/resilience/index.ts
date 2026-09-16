export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitState,
  getCircuitBreaker,
  resetAllCircuitBreakers,
  getAllCircuitBreakerMetrics,
} from '@/shared/resilience/circuit-breaker.js';

export type {
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
} from '@/shared/resilience/circuit-breaker.js';
