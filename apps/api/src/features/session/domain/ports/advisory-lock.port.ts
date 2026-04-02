// Advisory Lock namespace constants to avoid collisions
export const ADVISORY_LOCK_NS = {
  SESSION: 1_000_000,
  LESSON: 2_000_000,
  API_KEY: 3_000_000,
  USER: 4_000_000,
} as const;

export type AdvisoryLockNamespace = (typeof ADVISORY_LOCK_NS)[keyof typeof ADVISORY_LOCK_NS];

export interface AdvisoryLockId {
  readonly namespace: AdvisoryLockNamespace;
  readonly key: string;
}

export function createSessionLockId(sessionId: string): AdvisoryLockId {
  return {
    namespace: ADVISORY_LOCK_NS.SESSION,
    key: sessionId,
  };
}

export function createLessonLockId(lessonId: string): AdvisoryLockId {
  return {
    namespace: ADVISORY_LOCK_NS.LESSON,
    key: lessonId,
  };
}

export function createApiKeyLockId(keyId: string): AdvisoryLockId {
  return {
    namespace: ADVISORY_LOCK_NS.API_KEY,
    key: keyId,
  };
}

export function createUserLockId(userId: string): AdvisoryLockId {
  return {
    namespace: ADVISORY_LOCK_NS.USER,
    key: userId,
  };
}

// Convert lock ID to PostgreSQL bigint
export function lockIdToBigInt(lockId: AdvisoryLockId): bigint {
  const namespaceNum = BigInt(lockId.namespace);
  // Simple hash for the key string
  let keyHash = BigInt(0);
  for (let i = 0; i < lockId.key.length; i++) {
    keyHash = keyHash * BigInt(31) + BigInt(lockId.key.charCodeAt(i));
  }
  return namespaceNum + (keyHash % BigInt(1_000_000));
}

export interface LockAcquisitionOptions {
  readonly timeoutMs?: number;
  readonly retryIntervalMs?: number;
  readonly maxRetries?: number;
}

export const DEFAULT_LOCK_OPTIONS: LockAcquisitionOptions = {
  timeoutMs: 5_000,
  retryIntervalMs: 100,
  maxRetries: 50,
};

export interface AdvisoryLockManager {
  acquireLock(lockId: AdvisoryLockId, options?: LockAcquisitionOptions): Promise<boolean>;
  releaseLock(lockId: AdvisoryLockId): Promise<boolean>;
  isLocked(lockId: AdvisoryLockId): Promise<boolean>;
}

export class LockAcquisitionError extends Error {
  readonly code = 'LOCK_ACQUISITION_ERROR' as const;
  readonly lockId: AdvisoryLockId;
  readonly originalError?: unknown;

  constructor(lockId: AdvisoryLockId, message: string, originalError?: unknown) {
    super(message);
    this.name = 'LockAcquisitionError';
    this.lockId = lockId;
    this.originalError = originalError;
  }
}

export class LockTimeoutError extends Error {
  readonly code = 'LOCK_TIMEOUT_ERROR' as const;
  readonly lockId: AdvisoryLockId;
  readonly timeoutMs: number;

  constructor(lockId: AdvisoryLockId, timeoutMs: number) {
    super(`Failed to acquire lock within ${timeoutMs}ms`);
    this.name = 'LockTimeoutError';
    this.lockId = lockId;
    this.timeoutMs = timeoutMs;
  }
}
