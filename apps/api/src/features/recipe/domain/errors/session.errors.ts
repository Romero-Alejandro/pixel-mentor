/**
 * Session Error Types
 *
 * Structured error classes for lesson session failures.
 * Each error has:
 *   - A unique error code for programmatic handling
 *   - A user-friendly message for display
 *   - Optional metadata for debugging
 *
 * Replaces ad-hoc `throw new Error(...)` with typed, catchable errors.
 */

// ---- Base Error ----

export class SessionError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly statusCode: number;
  readonly metadata?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

// ---- Session State Errors ----

export class SessionNotFoundError extends SessionError {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(
      'SESSION_NOT_FOUND',
      `Session ${sessionId} not found`,
      'No se encontro la sesion. Intenta de nuevo.',
      404,
      { sessionId },
    );
    this.name = 'SessionNotFoundError';
    this.sessionId = sessionId;
  }
}

export class SessionNotActiveError extends SessionError {
  readonly sessionId: string;
  readonly currentStatus: string;

  constructor(sessionId: string, currentStatus: string) {
    super(
      'SESSION_NOT_ACTIVE',
      `Session ${sessionId} is not active (status: ${currentStatus})`,
      'La sesion no esta activa. Recarga la pagina e intenta de nuevo.',
      409,
      { sessionId, currentStatus },
    );
    this.name = 'SessionNotActiveError';
    this.sessionId = sessionId;
    this.currentStatus = currentStatus;
  }
}

export class SessionAlreadyCompletedError extends SessionError {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(
      'SESSION_ALREADY_COMPLETED',
      `Session ${sessionId} is already completed`,
      'Esta leccion ya fue completada.',
      409,
      { sessionId },
    );
    this.name = 'SessionAlreadyCompletedError';
    this.sessionId = sessionId;
  }
}

// ---- Recipe/Content Errors ----

export class RecipeNotFoundError extends SessionError {
  readonly recipeId: string;

  constructor(recipeId: string) {
    super(
      'RECIPE_NOT_FOUND',
      `Recipe ${recipeId} not found`,
      'No se encontro la leccion. Verifica que este publicada.',
      404,
      { recipeId },
    );
    this.name = 'RecipeNotFoundError';
    this.recipeId = recipeId;
  }
}

export class RecipeHasNoStepsError extends SessionError {
  readonly recipeId: string;

  constructor(recipeId: string) {
    super(
      'RECIPE_HAS_NO_STEPS',
      `Recipe ${recipeId} has no steps`,
      'La leccion no tiene contenido configurado.',
      422,
      { recipeId },
    );
    this.name = 'RecipeHasNoStepsError';
    this.recipeId = recipeId;
  }
}

export class AtomNotFoundError extends SessionError {
  readonly atomId: string;
  readonly stepIndex: number;

  constructor(atomId: string, stepIndex: number) {
    super(
      'ATOM_NOT_FOUND',
      `Atom ${atomId} not found at step ${stepIndex}`,
      'Error en el contenido de la leccion.',
      422,
      { atomId, stepIndex },
    );
    this.name = 'AtomNotFoundError';
    this.atomId = atomId;
    this.stepIndex = stepIndex;
  }
}

// ---- LLM/AI Errors ----

export class LLMTimeoutError extends SessionError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      'LLM_TIMEOUT',
      `LLM response timed out after ${timeoutMs}ms`,
      'El tutor esta tardando mucho. Intenta de nuevo.',
      504,
      { timeoutMs },
    );
    this.name = 'LLMTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class LLMChunkTimeoutError extends SessionError {
  constructor() {
    super(
      'LLM_CHUNK_TIMEOUT',
      'LLM chunk timeout - stream interrupted',
      'La conexion con el tutor se interrumpio. Intenta de nuevo.',
      504,
    );
    this.name = 'LLMChunkTimeoutError';
  }
}

export class LLMServiceError extends SessionError {
  readonly provider?: string;

  constructor(message: string, provider?: string) {
    super(
      'LLM_SERVICE_ERROR',
      `LLM service error: ${message}`,
      'El tutor no esta disponible temporalmente. Intenta de nuevo.',
      502,
      { provider },
    );
    this.name = 'LLMServiceError';
    this.provider = provider;
  }
}

// ---- Streaming Errors ----

export class StreamingConnectionError extends SessionError {
  constructor(message: string = 'Connection lost') {
    super(
      'STREAMING_CONNECTION_ERROR',
      `Streaming connection error: ${message}`,
      'Se perdio la conexion. Reconectando...',
      503,
    );
    this.name = 'StreamingConnectionError';
  }
}

export class StreamingDisabledError extends SessionError {
  constructor() {
    super(
      'STREAMING_DISABLED',
      'Streaming is disabled',
      'El modo de streaming no esta disponible.',
      403,
    );
    this.name = 'StreamingDisabledError';
  }
}

// ---- Concurrency Errors ----

export class SessionLockedError extends SessionError {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(
      'SESSION_LOCKED',
      `Session ${sessionId} is locked by another request`,
      'La sesion esta siendo procesada. Espera un momento.',
      429,
      { sessionId },
    );
    this.name = 'SessionLockedError';
    this.sessionId = sessionId;
  }
}

// ---- Input Validation Errors ----

export class InvalidInputError extends SessionError {
  readonly field: string;

  constructor(field: string, reason: string) {
    super(
      'INVALID_INPUT',
      `Invalid input for ${field}: ${reason}`,
      'La entrada no es valida. Intenta de nuevo.',
      400,
      { field, reason },
    );
    this.name = 'InvalidInputError';
    this.field = field;
  }
}

// ---- Safety/Content Errors ----

export class SessionEscalatedError extends SessionError {
  readonly sessionId: string;
  readonly reason?: string;

  constructor(sessionId: string, reason?: string) {
    super(
      'SESSION_ESCALATED',
      `Session ${sessionId} has been escalated: ${reason ?? 'safety concern'}`,
      'La sesion ha sido escalada a un tutor humano.',
      403,
      { sessionId, reason },
    );
    this.name = 'SessionEscalatedError';
    this.sessionId = sessionId;
    this.reason = reason;
  }
}

// ---- Error Code Registry ----

export const SESSION_ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_NOT_ACTIVE: 'SESSION_NOT_ACTIVE',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  RECIPE_NOT_FOUND: 'RECIPE_NOT_FOUND',
  RECIPE_HAS_NO_STEPS: 'RECIPE_HAS_NO_STEPS',
  ATOM_NOT_FOUND: 'ATOM_NOT_FOUND',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_CHUNK_TIMEOUT: 'LLM_CHUNK_TIMEOUT',
  LLM_SERVICE_ERROR: 'LLM_SERVICE_ERROR',
  STREAMING_CONNECTION_ERROR: 'STREAMING_CONNECTION_ERROR',
  STREAMING_DISABLED: 'STREAMING_DISABLED',
  SESSION_LOCKED: 'SESSION_LOCKED',
  INVALID_INPUT: 'INVALID_INPUT',
  SESSION_ESCALATED: 'SESSION_ESCALATED',
} as const;

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[keyof typeof SESSION_ERROR_CODES];

// ---- Error Helper ----

/**
 * Extracts a user-friendly error message from any error.
 * If it's a SessionError, returns the userMessage.
 * Otherwise, returns a generic message.
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof SessionError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    // Map common error patterns
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      ('Error de conexion. Verifica tu internet.');
    }
    if (msg.includes('timeout')) {
      return 'La operacion tardo demasiado. Intenta de nuevo.';
    }
    if (msg.includes('429') || msg.includes('rate limit')) {
      return 'Demasiadas solicitudes. Espera un momento.';
    }
  }
  return 'Ocurrio un error inesperado. Intenta de nuevo.';
}

/**
 * Extracts the error code from any error.
 * If it's a SessionError, returns the code.
 * Otherwise, returns 'UNKNOWN_ERROR'.
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof SessionError) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}
