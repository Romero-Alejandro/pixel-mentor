import { withTimeout } from '@/features/recipe/application/services/llm-stream-timeout';

// Mock logger to suppress output during tests
jest.mock('@/shared/logger/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock event bus
jest.mock('@/shared/events/event-bus.port.js', () => ({
  getEventBus: jest.fn(() => ({ emit: jest.fn() })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Creates an async generator that yields values with a delay between each */
async function* createDelayedGenerator(values: string[], delayMs: number): AsyncGenerator<string> {
  for (const value of values) {
    await new Promise((r) => setTimeout(r, delayMs));
    yield value;
  }
}

/** Collects all values from an async generator */
async function collectGenerator<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const value of gen) {
    results.push(value);
  }
  return results;
}

/** Races a generator next() against a timeout, returns the result or throws */
async function nextWithTimeout<T>(
  iterator: AsyncIterator<T>,
  ms: number,
): Promise<IteratorResult<T>> {
  return Promise.race([
    iterator.next(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('test-timeout')), ms)),
  ]);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  describe('normal operation (no timeout)', () => {
    it('should yield all values from a fast source generator', async () => {
      const source = createDelayedGenerator(['a', 'b', 'c'], 5);
      const wrapped = withTimeout(source, 1000, 5000);
      const results = await collectGenerator(wrapped);
      expect(results).toEqual(['a', 'b', 'c']);
    }, 10_000);

    it('should yield all values from an immediate source generator', async () => {
      async function* immediate() {
        yield 'x';
        yield 'y';
        yield 'z';
      }

      const wrapped = withTimeout(immediate(), 1000, 5000);
      const results = await collectGenerator(wrapped);
      expect(results).toEqual(['x', 'y', 'z']);
    }, 10_000);

    it('should handle an empty source generator', async () => {
      async function* empty() {
        // yields nothing
      }

      const wrapped = withTimeout(empty(), 1000, 5000);
      const results = await collectGenerator(wrapped);
      expect(results).toEqual([]);
    }, 10_000);
  });

  describe('chunk timeout', () => {
    it('should stop yielding when chunks arrive too slowly', async () => {
      // Source yields 'a' quickly, then hangs for 200ms before 'b'
      async function* slowSource() {
        yield 'a';
        await new Promise((r) => setTimeout(r, 200));
        yield 'b';
      }

      const wrapped = withTimeout(slowSource(), 30, 5000);
      const results: string[] = [];
      const iterator = wrapped[Symbol.asyncIterator]();

      // First chunk arrives fast
      const first = await nextWithTimeout(iterator, 100);
      expect(first.done).toBe(false);
      expect(first.value).toBe('a');
      results.push(first.value);

      // Second chunk is slow — timeout fires after 30ms
      // The iterator should complete (timeout closes the source)
      try {
        const second = await nextWithTimeout(iterator, 100);
        // If we get here, the timeout didn't fire fast enough
        if (!second.done) results.push(second.value);
      } catch {
        // Expected: iterator throws or hangs when source is closed
      }

      expect(results).toEqual(['a']);
    }, 10_000);

    it('should call source.return() to close the generator on chunk timeout', async () => {
      const returnSpy = jest.fn();
      let resolveNext: (v: IteratorResult<string>) => void;
      let nextCallCount = 0;

      const source: AsyncGenerator<string> = {
        next: jest.fn().mockImplementation(() => {
          nextCallCount++;
          if (nextCallCount === 1) {
            return Promise.resolve({ done: false, value: 'a' });
          }
          // Second call hangs forever
          return new Promise((resolve) => {
            resolveNext = resolve;
          });
        }),
        return: jest.fn().mockImplementation(() => {
          returnSpy();
          // Resolve the hanging next() so the generator can clean up
          if (resolveNext) {
            resolveNext({ done: true, value: undefined as unknown as string });
          }
          return Promise.resolve({ done: true, value: undefined as unknown as string });
        }),
        throw: jest.fn(),
        [Symbol.asyncIterator]() {
          return this;
        },
        [Symbol.asyncDispose]: jest.fn(),
      };

      const wrapped = withTimeout(source, 20, 5000);
      const iterator = wrapped[Symbol.asyncIterator]();

      // First chunk succeeds
      const first = await nextWithTimeout(iterator, 100);
      expect(first.done).toBe(false);
      expect(first.value).toBe('a');

      // Second chunk hangs — timeout fires after 20ms
      try {
        await nextWithTimeout(iterator, 100);
      } catch {
        // Expected
      }

      expect(returnSpy).toHaveBeenCalled();
    }, 10_000);
  });

  describe('total timeout', () => {
    it('should stop yielding when total timeout is reached', async () => {
      async function* steadySource() {
        let i = 0;
        while (true) {
          await new Promise((r) => setTimeout(r, 5));
          yield `chunk-${i++}`;
        }
      }

      const wrapped = withTimeout(steadySource(), 1000, 50);
      const results: string[] = [];
      const iterator = wrapped[Symbol.asyncIterator]();

      // Collect chunks until timeout or max iterations
      const deadline = Date.now() + 200;
      while (Date.now() < deadline) {
        try {
          const result = await nextWithTimeout(iterator, 30);
          if (!result.done) results.push(result.value);
          else break;
        } catch {
          break;
        }
      }

      // Should have received some chunks but not infinite
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(20);
    }, 10_000);
  });

  describe('source generator errors', () => {
    it('should propagate source generator errors', async () => {
      async function* failing() {
        yield 'a';
        throw new Error('Simulated failure');
      }

      const wrapped = withTimeout(failing(), 1000, 5000);
      const results: string[] = [];

      await expect(
        (async () => {
          for await (const value of wrapped) {
            results.push(value);
          }
        })(),
      ).rejects.toThrow('Simulated failure');

      expect(results).toEqual(['a']);
    }, 10_000);
  });

  describe('edge cases', () => {
    it('should handle a single-yield generator', async () => {
      async function* single() {
        yield 'only';
      }

      const wrapped = withTimeout(single(), 1000, 5000);
      const results = await collectGenerator(wrapped);
      expect(results).toEqual(['only']);
    }, 10_000);

    it('should respect the minimum of chunk timeout and remaining total time', async () => {
      // Total timeout is 40ms, chunk timeout is 1000ms
      // After first chunk at t=0, remaining ≈ 40ms
      // Second chunk takes 80ms > remaining, so total timeout fires
      async function* source() {
        yield 'a';
        await new Promise((r) => setTimeout(r, 80));
        yield 'b';
      }

      const wrapped = withTimeout(source(), 1000, 40);
      const results: string[] = [];
      const iterator = wrapped[Symbol.asyncIterator]();

      const first = await nextWithTimeout(iterator, 100);
      expect(first.done).toBe(false);
      expect(first.value).toBe('a');
      results.push(first.value);

      // Wait for total timeout
      try {
        const second = await nextWithTimeout(iterator, 100);
        if (!second.done) results.push(second.value);
      } catch {
        // Expected
      }

      expect(results).toEqual(['a']);
    }, 10_000);

    it('should handle many small chunks within timeout', async () => {
      const values = Array.from({ length: 20 }, (_, i) => `v${i}`);
      const source = createDelayedGenerator(values, 2);
      const wrapped = withTimeout(source, 100, 5000);
      const results = await collectGenerator(wrapped);
      expect(results).toEqual(values);
    }, 10_000);
  });
});
