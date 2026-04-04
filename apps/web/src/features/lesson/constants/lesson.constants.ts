export const UI_STATES = {
  IDLE: 'idle',
  CONCENTRATION: 'concentration',
  QUESTION: 'question',
  ACTIVITY: 'activity',
  FEEDBACK: 'feedback',
  COMPLETED: 'completed',
} as const;

export type UIState = (typeof UI_STATES)[keyof typeof UI_STATES];

export const UI_STATE_LABELS: Record<UIState, string> = {
  [UI_STATES.IDLE]: 'Preparado',
  [UI_STATES.CONCENTRATION]: 'Aprendiendo',
  [UI_STATES.QUESTION]: 'Tu Turno',
  [UI_STATES.ACTIVITY]: 'Desafío',
  [UI_STATES.FEEDBACK]: 'Resultado',
  [UI_STATES.COMPLETED]: '¡Misión Cumplida!',
} as const;

export const TIER_CONFIG = {
  perfect: {
    label: '¡Dominado!',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    stars: 3,
  },
  high: {
    label: '¡Excelente!',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    stars: 2,
  },
  medium: {
    label: '¡Bien!',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    stars: 1,
  },
  low: {
    label: '¡Sigue practicando!',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    stars: 1,
  },
} as const;

export type AccuracyTier = keyof typeof TIER_CONFIG;

// Timing constants for lesson flow orchestration
export const TIMING = {
  WORDS_PER_SECOND: 2.5,
  MIN_DISPLAY_MS: 3000,
  POST_SPEECH_BUFFER_MS: 1200,
  FEEDBACK_DISPLAY_MS: 1500,
  ACTIVITY_TIMEOUT_SECONDS: 30,
} as const;

export function estimateReadTime(text: string): number {
  if (!text || text.trim().length === 0) {
    return TIMING.MIN_DISPLAY_MS;
  }
  const words = text.trim().split(/\s+/).length;
  const estimatedMs = (words / TIMING.WORDS_PER_SECOND) * 1000;
  return Math.max(TIMING.MIN_DISPLAY_MS, estimatedMs + TIMING.POST_SPEECH_BUFFER_MS);
}

export function calculateStateDuration(
  state: 'concentration' | 'evaluation',
  text?: string,
): number {
  switch (state) {
    case 'concentration':
      return text ? estimateReadTime(text) : TIMING.MIN_DISPLAY_MS;
    case 'evaluation':
      return TIMING.FEEDBACK_DISPLAY_MS + (text ? estimateReadTime(text) : 0);
    default:
      return TIMING.MIN_DISPLAY_MS;
  }
}

// Backwards compatibility exports
export const WORDS_PER_SECOND = TIMING.WORDS_PER_SECOND;
export const MIN_DISPLAY_MS = TIMING.MIN_DISPLAY_MS;
export const POST_SPEECH_BUFFER_MS = TIMING.POST_SPEECH_BUFFER_MS;
export const FEEDBACK_DISPLAY_MS = TIMING.FEEDBACK_DISPLAY_MS;
export const ACTIVITY_TIMEOUT_SECONDS = TIMING.ACTIVITY_TIMEOUT_SECONDS;
