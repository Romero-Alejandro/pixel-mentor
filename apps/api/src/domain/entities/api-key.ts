export interface ApiKey {
  readonly id: string;
  readonly keyHash: string;
  readonly userId: string | null;
  readonly lastUsedAt: Date | null;
  readonly usageCount: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createApiKey(parameters: {
  id: string;
  keyHash: string;
  userId?: string | null;
}): ApiKey {
  const now = new Date();
  return {
    id: parameters.id,
    keyHash: parameters.keyHash,
    userId: parameters.userId ?? null,
    lastUsedAt: null,
    usageCount: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function incrementUsage(apiKey: ApiKey): ApiKey {
  return {
    ...apiKey,
    usageCount: apiKey.usageCount + 1,
    lastUsedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function deactivate(apiKey: ApiKey): ApiKey {
  return {
    ...apiKey,
    isActive: false,
    updatedAt: new Date(),
  };
}

export function isKeyValid(apiKey: ApiKey): boolean {
  return apiKey.isActive;
}
