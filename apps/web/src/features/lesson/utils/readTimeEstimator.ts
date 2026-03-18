const WORDS_PER_SECOND = 2.5;
const MIN_DISPLAY_MS = 3000;
const POST_SPEECH_BUFFER_MS = 1200;

export function estimateReadTime(text: string): number {
  if (!text || text.trim().length === 0) {
    return MIN_DISPLAY_MS;
  }

  const words = text.trim().split(/\s+/).length;
  const estimatedMs = (words / WORDS_PER_SECOND) * 1000;

  return Math.max(MIN_DISPLAY_MS, estimatedMs + POST_SPEECH_BUFFER_MS);
}
