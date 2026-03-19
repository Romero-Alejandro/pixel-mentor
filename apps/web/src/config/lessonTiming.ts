// Timing constants for lesson flow orchestration
export const WORDS_PER_SECOND = 2.5;
export const MIN_DISPLAY_MS = 3000;
export const POST_SPEECH_BUFFER_MS = 1200;
export const FEEDBACK_DISPLAY_MS = 1500;
export const ACTIVITY_TIMEOUT_SECONDS = 30;

// LESSON_TIMING object (for convenience)
export const LESSON_TIMING = {
  WORDS_PER_SECOND,
  MIN_DISPLAY_MS,
  POST_SPEECH_BUFFER_MS,
  FEEDBACK_DISPLAY_MS,
  ACTIVITY_TIMEOUT_SECONDS,
} as const;

// Type
export type LessonState = 'concentration' | 'evaluation';

// Functions
export function estimateReadTime(text: string): number {
  if (!text || text.trim().length === 0) {
    return MIN_DISPLAY_MS;
  }
  const words = text.trim().split(/\s+/).length;
  const estimatedMs = (words / WORDS_PER_SECOND) * 1000;
  return Math.max(MIN_DISPLAY_MS, estimatedMs + POST_SPEECH_BUFFER_MS);
}

export function calculateStateDuration(state: LessonState, text?: string): number {
  switch (state) {
    case 'concentration':
      return text ? estimateReadTime(text) : MIN_DISPLAY_MS;
    case 'evaluation':
      return FEEDBACK_DISPLAY_MS + (text ? estimateReadTime(text) : 0);
    default:
      return MIN_DISPLAY_MS;
  }
}
