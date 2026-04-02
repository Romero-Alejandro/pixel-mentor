/**
 * Idempotent Event Bus
 *
 * Extends the base EventBus with idempotency support.
 * Prevents duplicate event processing using event IDs.
 *
 * @example
 * ```typescript
 * const eventBus = getIdempotentEventBus();
 *
 * // Emit with auto-generated ID
 * await eventBus.emitIdempotent('LESSON_COMPLETED', payload);
 *
 * // Emit with specific ID (for retries)
 * await eventBus.emitIdempotent('LESSON_COMPLETED', payload, {
 *   eventId: 'unique-event-id',
 * });
 * ```
 */

import { createLogger } from '@/shared/logger/index.js';
import { InMemoryEventBus, type EventBus } from './event-bus.js';

export interface IdempotentEventOptions {
  /** Unique event ID for deduplication */
  eventId?: string;
  /** Time-to-live in seconds for event ID tracking (default: 24 hours) */
  ttlSeconds?: number;
}

export interface ProcessedEvent {
  eventId: string;
  event: string;
  processedAt: Date;
  success: boolean;
  error?: string;
}

export interface IdempotentEventBus extends EventBus {
  /**
   * Emit an event with idempotency support
   */
  emitIdempotent<T>(event: string, payload: T, options?: IdempotentEventOptions): Promise<void>;

  /**
   * Check if an event has been processed
   */
  isProcessed(eventId: string): boolean;

  /**
   * Get processed event details
   */
  getProcessedEvent(eventId: string): ProcessedEvent | undefined;

  /**
   * Clear processed events older than TTL
   */
  cleanupProcessedEvents(): void;

  /**
   * Get statistics about processed events
   */
  getStats(): {
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
  };
}

/**
 * In-memory implementation of IdempotentEventBus
 */
export class InMemoryIdempotentEventBus extends InMemoryEventBus implements IdempotentEventBus {
  protected override logger = createLogger();
  private processedEvents: Map<string, ProcessedEvent> = new Map();
  private readonly defaultTTL: number;
  private stats = {
    totalProcessed: 0,
    totalSucceeded: 0,
    totalFailed: 0,
  };

  constructor(ttlSeconds: number = 86400) {
    // Default: 24 hours
    super();
    this.defaultTTL = ttlSeconds;
  }

  async emitIdempotent<T>(
    event: string,
    payload: T,
    options?: IdempotentEventOptions,
  ): Promise<void> {
    const eventId = options?.eventId ?? this.generateEventId(event, payload);

    // Check if already processed
    if (this.isProcessed(eventId)) {
      this.logger.info(`[IdempotentEventBus] Skipping duplicate event: ${event} (${eventId})`);
      return;
    }

    // Mark as processing
    this.processedEvents.set(eventId, {
      eventId,
      event,
      processedAt: new Date(),
      success: false,
    });

    try {
      // Emit the event
      await this.emit(event, payload);

      // Mark as succeeded
      const processed = this.processedEvents.get(eventId);
      if (processed) {
        processed.success = true;
        this.stats.totalSucceeded++;
      }
    } catch (error) {
      // Mark as failed
      const processed = this.processedEvents.get(eventId);
      if (processed) {
        processed.error = error instanceof Error ? error.message : String(error);
        this.stats.totalFailed++;
      }
      throw error;
    } finally {
      this.stats.totalProcessed++;
    }
  }

  isProcessed(eventId: string): boolean {
    const processed = this.processedEvents.get(eventId);

    if (!processed) {
      return false;
    }

    // Check if expired
    const now = Date.now();
    const expiresAt = processed.processedAt.getTime() + this.defaultTTL * 1000;

    if (now > expiresAt) {
      this.processedEvents.delete(eventId);
      return false;
    }

    return true;
  }

  getProcessedEvent(eventId: string): ProcessedEvent | undefined {
    return this.processedEvents.get(eventId);
  }

  cleanupProcessedEvents(): void {
    const now = Date.now();

    for (const [eventId, processed] of this.processedEvents.entries()) {
      const expiresAt = processed.processedAt.getTime() + this.defaultTTL * 1000;
      if (now > expiresAt) {
        this.processedEvents.delete(eventId);
      }
    }
  }

  getStats(): {
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
  } {
    return { ...this.stats };
  }

  /**
   * Generate a deterministic event ID based on event type and payload
   * This ensures the same logical event always gets the same ID
   */
  private generateEventId<T>(event: string, payload: T): string {
    // For simple payloads, create a deterministic hash
    const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);

    // Use a simple hash for deterministic IDs
    const hash = this.simpleHash(`${event}:${payloadStr}`);
    return `${event}-${hash}`;
  }

  /**
   * Simple hash function for generating deterministic IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear all handlers and processed events
   */
  clearAll(): void {
    super.clearAll();
    this.processedEvents.clear();
    this.stats = {
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
    };
  }
}

// ==================== Singleton Instance ====================

let idempotentEventBusInstance: IdempotentEventBus | null = null;

export function getIdempotentEventBus(): IdempotentEventBus {
  if (!idempotentEventBusInstance) {
    idempotentEventBusInstance = new InMemoryIdempotentEventBus();
  }
  return idempotentEventBusInstance;
}

export function resetIdempotentEventBus(): void {
  if (idempotentEventBusInstance) {
    idempotentEventBusInstance.clearAll();
  }
  idempotentEventBusInstance = null;
}
