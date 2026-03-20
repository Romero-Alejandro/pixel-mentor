/**
 * EventBus - Simple Pub/Sub implementation for decoupling components.
 * Allows different parts of the application to communicate without tight coupling.
 */

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface EventBus {
  /**
   * Subscribe to an event. Returns unsubscribe function.
   */
  subscribe<T>(event: string, handler: EventHandler<T>): () => void;

  /**
   * Emit an event to all subscribers.
   */
  emit<T>(event: string, payload: T): void | Promise<void>;

  /**
   * Remove all handlers for an event.
   */
  clear(event: string): void;

  /**
   * Remove all handlers for all events.
   */
  clearAll(): void;
}

/**
 * In-memory implementation of EventBus.
 * Suitable for single-instance deployments.
 * For multi-instance, consider Redis pub/sub.
 */
export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as EventHandler);
    };
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];
    for (const handler of eventHandlers) {
      try {
        const result = (handler as EventHandler<T>)(payload);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for event "${event}":`, error);
      }
    }

    await Promise.all(promises);
  }

  clear(event: string): void {
    this.handlers.delete(event);
  }

  clearAll(): void {
    this.handlers.clear();
  }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new InMemoryEventBus();
  }
  return eventBusInstance;
}

export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.clearAll();
  }
  eventBusInstance = null;
}
