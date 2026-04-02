import type { ApiKey } from '../entities/api-key.entity.js';

export interface IApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;

  findByHash(keyHash: string): Promise<ApiKey | null>;

  findByUserId(userId: string): Promise<ApiKey[]>;

  create(
    apiKey: Omit<ApiKey, 'lastUsedAt' | 'usageCount' | 'createdAt' | 'updatedAt'>,
  ): Promise<ApiKey>;

  incrementUsage(keyId: string): Promise<ApiKey>;

  deactivate(keyId: string): Promise<ApiKey>;
}

export class ApiKeyNotFoundError extends Error {
  readonly code = 'API_KEY_NOT_FOUND' as const;
  readonly keyId: string;

  constructor(keyId: string) {
    super(`API key with ID ${keyId} not found`);
    this.name = 'ApiKeyNotFoundError';
    this.keyId = keyId;
  }
}

export class ApiKeyInactiveError extends Error {
  readonly code = 'API_KEY_INACTIVE' as const;
  readonly keyId: string;

  constructor(keyId: string) {
    super(`API key ${keyId} is inactive`);
    this.name = 'ApiKeyInactiveError';
    this.keyId = keyId;
  }
}
