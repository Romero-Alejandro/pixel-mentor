/**
 * Health Check Service
 *
 * Provides health check functionality for monitoring and load balancers.
 * Checks the status of critical dependencies like database, cache, and AI services.
 *
 * @example
 * ```typescript
 * const healthCheck = getHealthCheckService();
 * const status = await healthCheck.check();
 * // { status: 'healthy', checks: { database: { status: 'up' }, ... } }
 * ```
 */

import { prisma } from '@/database/client.js';
import { getCacheService } from '@/shared/cache/index.js';
import { getAllCircuitBreakerMetrics } from '@/shared/resilience/index.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DependencyCheck {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: {
    database: DependencyCheck;
    cache: DependencyCheck;
    circuitBreakers: DependencyCheck;
  };
  metrics: {
    circuitBreakers: Record<string, unknown>;
    cache: { size: number; maxSize: number };
  };
}

export class HealthCheckService {
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Run all health checks
   */
  async check(): Promise<HealthCheckResult> {
    const [database, cache, circuitBreakers] = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkCircuitBreakers(),
    ]);

    const checks = { database, cache, circuitBreakers };
    const status = this.determineOverallStatus(checks);

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
      metrics: {
        circuitBreakers: getAllCircuitBreakerMetrics(),
        cache: getCacheService().getStats(),
      },
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<DependencyCheck> {
    const start = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check cache service
   */
  private async checkCache(): Promise<DependencyCheck> {
    const start = Date.now();

    try {
      const cache = getCacheService();
      const testKey = '__health_check__';
      cache.set(testKey, 'ok', 5);
      const value = cache.get<string>(testKey);
      cache.delete(testKey);

      if (value !== 'ok') {
        throw new Error('Cache read/write test failed');
      }

      return {
        status: 'up',
        latencyMs: Date.now() - start,
        details: cache.getStats(),
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check circuit breakers status
   */
  private async checkCircuitBreakers(): Promise<DependencyCheck> {
    try {
      const metrics = getAllCircuitBreakerMetrics();
      const openCircuits = Object.entries(metrics).filter(([_, m]) => m.state === 'OPEN');

      if (openCircuits.length > 0) {
        return {
          status: 'down',
          error: `${openCircuits.length} circuit(s) open`,
          details: Object.fromEntries(openCircuits),
        };
      }

      return {
        status: 'up',
        details: metrics,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(checks: HealthCheckResult['checks']): HealthStatus {
    const { database, cache, circuitBreakers } = checks;

    // Database down = unhealthy
    if (database.status === 'down') {
      return 'unhealthy';
    }

    // Cache or circuit breakers down = degraded
    if (cache.status === 'down' || circuitBreakers.status === 'down') {
      return 'degraded';
    }

    return 'healthy';
  }
}

// ==================== Singleton Instance ====================

let healthCheckServiceInstance: HealthCheckService | null = null;

export function getHealthCheckService(): HealthCheckService {
  if (!healthCheckServiceInstance) {
    healthCheckServiceInstance = new HealthCheckService();
  }
  return healthCheckServiceInstance;
}
