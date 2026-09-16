import { createLogger } from '@/shared/logger/logger.js';

const logger = createLogger(undefined, { name: 'llm-stream-timeout', level: 'info' });

/** Maximum time (ms) to wait for a single LLM chunk before aborting */
export const LLM_CHUNK_TIMEOUT_MS = 30_000;
/** Maximum total time (ms) for the entire LLM streaming call */
export const LLM_TOTAL_TIMEOUT_MS = 60_000;

/**
 * Wraps an async generator with per-chunk and total timeouts.
 * If a single chunk doesn't arrive within LLM_CHUNK_TIMEOUT_MS, or the total
 * stream exceeds LLM_TOTAL_TIMEOUT_MS, the generator is abandoned.
 */
export async function* withTimeout<T>(
  source: AsyncGenerator<T>,
  chunkTimeoutMs: number = LLM_CHUNK_TIMEOUT_MS,
  totalTimeoutMs: number = LLM_TOTAL_TIMEOUT_MS,
): AsyncGenerator<T> {
  const deadline = Date.now() + totalTimeoutMs;
  let done = false;
  try {
    while (!done) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        logger.warn('[withTimeout] LLM total timeout reached');
        break;
      }
      const chunkTimeout = Math.min(chunkTimeoutMs, remaining);
      const result = await Promise.race([
        source.next(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM chunk timeout')), chunkTimeout),
        ),
      ]);
      if (result.done) {
        done = true;
      } else {
        yield result.value;
      }
    }
  } finally {
    // Ensure the source generator is properly closed on timeout or error
    if (!done) {
      try {
        await source.return(undefined as unknown as T);
      } catch {
        /* ignore */
      }
    }
  }
}
