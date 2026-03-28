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
