export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitState,
  getCircuitBreaker,
  resetAllCircuitBreakers,
  getAllCircuitBreakerMetrics,
} from './circuit-breaker.js';

export type { CircuitBreakerOptions, CircuitBreakerMetrics } from './circuit-breaker.js';
